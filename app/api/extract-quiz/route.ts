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
import { ExtractedQuiz, QUIZ_SYSTEM, QuizHistory, validateAiQuizzes } from "@/lib/lecture/aiQuizRules";

// 샘플 강의의 발표자 노트. 원본 PPT는 45MB라 저장소에 넣지 않고 노트만 뽑아 두었다
// (data/samples/jeonju-day-02-notes.json, 25KB). 심사·시연에서도 같은 AI 경로를 그대로 탄다.
const SAMPLE_NOTES = "data/samples/jeonju-day-02-notes.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// 퀴즈·실습으로 찍힌 슬라이드만 보내므로 보통 10~20초면 끝난다.
// (Vercel 무료 플랜의 함수 제한이 60초라 덱 전체를 보내면 끊긴다)
export const maxDuration = 60;

const MAX_BYTES = 80 * 1024 * 1024;

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
    const rawHistory = form.get("quizHistory");
    if (typeof rawHistory === "string" && rawHistory.length > 100000) {
      return Response.json({ error: "퀴즈 참고 정보가 너무 길어요." }, { status: 413 });
    }
    let historyResult;
    try { historyResult = QuizHistory.safeParse(typeof rawHistory === "string" ? JSON.parse(rawHistory) : []); }
    catch { return Response.json({ error: "퀴즈 참고 정보 형식을 확인해 주세요." }, { status: 400 }); }
    if (!historyResult.success) return Response.json({ error: "퀴즈 참고 정보 형식을 확인해 주세요." }, { status: 400 });
    const history = historyResult.data.sort((a, b) => a.slideNo - b.slideNo);
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

    const client = new Anthropic({ maxRetries: 0, timeout: 25000 });
    const context = JSON.stringify(history);
    const prompt = `슬라이드 ${note.slideNo}쪽${title ? ` — ${title}` : ""}\n\n[발표자 노트]\n${note.text}\n\n[기존 퀴즈 — 출제 근거가 아닌 유형·번호 분포 참고]\n${context}\n새 문항은 현재 슬라이드의 기존 문항 뒤에 추가됩니다. 뒤쪽 슬라이드 문항과도 정답 번호가 3연속 겹치지 않게 하세요.`;
    let feedback = "";
    let inputTokens = 0, outputTokens = 0;
    // One repair attempt within the route's 60-second budget; never save invalid output.
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await client.messages.parse({
        model: "claude-opus-5",
        max_tokens: 4000,
        system: QUIZ_SYSTEM,
        thinking: { type: "adaptive" },
        output_config: { effort: "medium", format: zodOutputFormat(ExtractedQuiz) },
        messages: [{ role: "user", content: prompt + feedback }],
      });
      inputTokens += response.usage.input_tokens;
      outputTokens += response.usage.output_tokens;
      const parsed = response.parsed_output;
      if (!parsed) return Response.json({ error: "문항을 읽어내지 못했어요. 다시 시도해 주세요." }, { status: 502 });
      const checked = validateAiQuizzes(parsed.items, history, note.slideNo);
      if (checked.issues.length === 0) {
        return Response.json({ slideNo: note.slideNo, items: checked.items,
          usage: { input: inputTokens, output: outputTokens } });
      }
      feedback = `\n\n[이전 생성 결과]\n${JSON.stringify(parsed)}\n[검사에서 발견한 문제 — 모두 수정해 다시 생성]\n${checked.issues.join("\n")}`;
    }
    return Response.json({ error: "생성된 퀴즈가 작성 규칙을 충족하지 못했어요. 문항은 추가하지 않았으니 다시 시도해 주세요." }, { status: 422 });

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
