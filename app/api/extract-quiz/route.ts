// PPT의 발표자 노트를 읽어 퀴즈 문항과 실습 슬라이드를 뽑아낸다.
//
// 강사가 규격에 맞는 교안 마크다운을 따로 만들 필요가 없게 하려는 것이다.
// 대본에는 "… 네, ②번입니다" 처럼 정답이 문장 속에 있고 오답 해설까지 붙어 있어서,
// 규칙 기반 파싱으로는 못 읽지만 모델은 읽어낸다.
//
// 결과는 "초안"이다. 강사가 슬라이드마다 손볼 수 있게 화면에서 다시 보여준다.

import { readFileSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { extractNotes, type SlideNote } from "@/lib/lecture/pptxNotes";

// 샘플 강의의 발표자 노트. 원본 PPT는 45MB라 저장소에 넣지 않고 노트만 뽑아 두었다
// (data/samples/jeonju-day-02-notes.json, 25KB). 심사·시연에서도 같은 AI 경로를 그대로 탄다.
const SAMPLE_NOTES = "data/samples/jeonju-day-02-notes.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 퀴즈·실습으로 찍힌 슬라이드만 보내므로 보통 10~20초면 끝난다.
// (Vercel 무료 플랜의 함수 제한이 60초라 덱 전체를 보내면 끊긴다)
export const maxDuration = 60;

const MAX_BYTES = 80 * 1024 * 1024;

const Extracted = z.object({
  items: z.array(
    z.object({
      question: z.string().describe("학생에게 보여줄 질문 한 문장"),
      options: z.array(z.string()).describe("선택지. 3~4개가 보통"),
      answers: z
        .array(z.number().int())
        .describe("정답 선택지의 0부터 시작하는 번호. 정답이 여럿이면 모두"),
    }),
  ),
});

const SYSTEM = `강사가 수업 중에 슬라이드 한 장을 보면서 "여기서 학생들한테 물어볼 것 하나 만들어줘" 라고 부탁한 상황입니다.

그 슬라이드의 제목과 발표자 노트(강의 대본)를 받습니다. 노트에는 [학생 참여 요소]와 [강의 대본]이 들어 있기도 합니다.

## 지켜야 할 것

**오직 이 슬라이드에서 강사가 말한 내용으로만 문항을 만듭니다.**
대본에 없는 지식을 끌어오거나, 일반 상식 문제를 내지 마세요. 앞뒤 슬라이드 이야기도 넣지 마세요.
학생은 방금 이 슬라이드 설명을 들은 참이고, 그 설명을 이해했는지 확인하는 것이 목적입니다.

## 두 가지 경우

1. **대본에 이미 문제와 답이 있는 경우** — 강사가 "첫 번째 문제입니다 … 네, ②번입니다" 처럼
   문제를 내고 답을 알려주는 슬라이드입니다. 그러면 **그 문제를 그대로 되살립니다.**
   선택지 텍스트는 대본의 해설에서 복원하세요. 대본이 "①번은 … 프로젝트를 지워도 폴더는
   그대로 있습니다" 라고 오답을 설명하면, ①번 선택지는 "프로젝트를 지우면 폴더의 파일도
   지워진다" 였다는 뜻입니다. 정답 번호는 대본에 적힌 것을 그대로 따릅니다.

2. **그냥 설명하는 슬라이드인 경우** — 강사가 이 슬라이드에서 가르친 것 중
   **가장 핵심이 되는 한 가지**를 골라 문항을 새로 만듭니다.
   오답은 그럴듯하되 대본을 들었으면 가려낼 수 있어야 합니다.

## 문항 규칙

- 보통 **한 문항**만 만듭니다. 대본에 문제가 여러 개 들어 있을 때만 그 수만큼 만드세요.
- 선택지는 3~4개. 정답은 대개 하나이고, 복수 정답이면 모두 넣습니다.
- 질문과 선택지는 강사의 말투와 용어를 그대로 살려 한국어로 씁니다.
- 대본이 너무 짧거나(인사, 표지, 목차 등) 물어볼 내용이 없으면 **items를 빈 배열로** 두세요.
  억지 문항을 만드는 것보다 아무것도 안 만드는 쪽이 낫습니다.`;

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return Response.json(
      { error: "AI 기능을 쓰려면 서버에 ANTHROPIC_API_KEY가 있어야 해요. .env.local 에 넣고 개발 서버를 다시 켜주세요." },
      { status: 503 },
    );
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    const useSample = form.get("sample") === "true";
    const rawNotes = form.get("notes");
    let clientNotes: SlideNote[] | null = null;
    if (typeof rawNotes === "string") {
      if (rawNotes.length > 200000) return Response.json({ error: "대본이 너무 길어요." }, { status: 413 });
      const parsed = z.array(z.object({ slideNo: z.number().int().min(1), text: z.string().max(100000) })).max(10).safeParse(JSON.parse(rawNotes));
      if (!parsed.success) return Response.json({ error: "대본 형식을 확인해 주세요." }, { status: 400 });
      clientNotes = parsed.data.filter(note => note.text.trim());
    }

    if (!useSample && !clientNotes) {
      if (!(file instanceof File)) return Response.json({ error: "PPT 파일이 없어요." }, { status: 400 });
      if (file.size > MAX_BYTES) return Response.json({ error: "80MB 이하 파일만 읽을 수 있어요." }, { status: 413 });
    }

    const titles = (() => {
      const raw = form.get("titles");
      if (typeof raw !== "string") return [] as string[];
      try {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map(String) : [];
      } catch {
        return [] as string[];
      }
    })();

    const all: SlideNote[] = useSample
      ? (JSON.parse(readFileSync(path.join(process.cwd(), SAMPLE_NOTES), "utf8")) as SlideNote[])
      : clientNotes ?? extractNotes(await (file as File).arrayBuffer());

    // 제목으로 이미 퀴즈·실습을 찾아뒀으면 그 슬라이드 대본만 읽는다.
    // 덱 전체를 보내면 입력이 몇 배로 늘고, 무료 플랜의 60초 제한에 걸린다.
    const wanted = (() => {
      const raw = form.get("slideNos");
      if (typeof raw !== "string") return null;
      try {
        const parsed: unknown = JSON.parse(raw);
        const nos = Array.isArray(parsed) ? parsed.map(Number).filter(Number.isInteger) : [];
        return nos.length > 0 ? new Set(nos) : null;
      } catch {
        return null;
      }
    })();
    const notes = wanted ? all.filter((n) => wanted.has(n.slideNo)) : all;

    if (notes.length === 0) {
      return Response.json(
        {
          error: wanted
            ? "그 슬라이드에는 발표자 노트가 없어요. 노트에 강의 대본이 적혀 있어야 문항을 뽑을 수 있습니다."
            : "이 PPT에는 발표자 노트가 없어요. 노트에 강의 대본이 적혀 있어야 문항을 뽑을 수 있습니다.",
        },
        { status: 422 },
      );
    }

    const note = notes[0];
    const title = titles[note.slideNo - 1]?.trim();

    const client = new Anthropic();
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 4000,
      system: SYSTEM,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium", format: zodOutputFormat(Extracted) },
      messages: [
        {
          role: "user",
          content: `슬라이드 ${note.slideNo}쪽${title ? ` — ${title}` : ""}\n\n[발표자 노트]\n${note.text}`,
        },
      ],
    });

    const parsed = response.parsed_output;
    if (!parsed) return Response.json({ error: "문항을 읽어내지 못했어요. 다시 시도해 주세요." }, { status: 502 });

    // 모델이 빈 문항이나 범위를 벗어난 정답 번호를 내놓을 수 있다 — 화면에 넘기기 전에 걸러낸다
    const items = parsed.items
      .map((item) => {
        const options = item.options.map((o) => o.trim()).filter(Boolean);
        return {
          question: item.question.trim(),
          options,
          answers: [...new Set(item.answers)].filter((i) => i >= 0 && i < options.length).sort((a, b) => a - b),
        };
      })
      .filter((item) => item.question && item.options.length >= 2);

    return Response.json({
      slideNo: note.slideNo,
      items,
      usage: { input: response.usage.input_tokens, output: response.usage.output_tokens },
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError)
      return Response.json({ error: "ANTHROPIC_API_KEY가 올바르지 않아요." }, { status: 503 });
    if (error instanceof Anthropic.RateLimitError)
      return Response.json({ error: "지금 요청이 몰려 있어요. 잠시 뒤 다시 시도해 주세요." }, { status: 429 });
    return Response.json(
      { error: error instanceof Error ? error.message : "문항을 뽑지 못했어요." },
      { status: 500 },
    );
  }
}
