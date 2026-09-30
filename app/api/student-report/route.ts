// 강사가 «학생 성향 분석»을 눌렀을 때만 실행된다.
//
// 숫자(퀴즈 정답률·제출 수·참여율)는 lib/lecture/studentStats.ts가 코드로 센다.
// AI는 그 숫자와 학생이 직접 쓴 글(결과물 설명·채팅 일부)만 읽고 참여 일지를 쓴다.
// 성격·능력을 단정하지 않고, 기록에 없는 것은 쓰지 않게 한다 — 강사가 판단할 참고 자료다.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { execute, isTeacher, readSession } from "@/lib/live/server";
import { computeStudentStats, type ChatCounts, type StudentReport } from "@/lib/lecture/studentStats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_STUDENTS = 60;

const Body = z.object({
  sessionId: z.string(),
  chat: z.record(z.string().max(30), z.object({ count: z.number().int().min(0).max(20000), samples: z.array(z.string().max(300)).max(5) })).default({}),
});

const Output = z.object({
  overview: z.string().describe("수업 전체 참여 흐름 2~3문장. 숫자 근거를 포함"),
  journals: z.array(z.object({
    key: z.string().describe("입력의 key를 그대로"),
    summary: z.string().describe("이 학생의 참여 방식 2~3문장. 기록의 숫자를 근거로"),
    strengths: z.array(z.string()).max(3),
    watch: z.array(z.string()).max(2).describe("강사가 살펴볼 점. 없으면 빈 배열"),
    suggestion: z.string().describe("다음 수업에서 강사가 이 학생에게 해볼 만한 것 한 가지"),
  })),
});

const SYSTEM = `당신은 강의 참여 기록을 정리하는 조교입니다. 강사가 수업 뒤에 학생별 참여 일지를 봅니다.

규칙:
- 입력에 있는 숫자와 학생이 직접 쓴 글만 근거로 씁니다. 기록에 없는 행동·감정·배경은 추측하지 않습니다.
- 성격, 지능, 능력, 태도를 단정하는 표현("게으르다", "소극적인 성격", "머리가 좋다")은 쓰지 않습니다. 관찰된 참여 방식으로만 씁니다("퀴즈 7문항 중 6문항에 답했고", "결과물은 올리지 않았다").
- 정답률은 채점 문항 수와 함께 말합니다. 채점 문항이 적으면(3개 미만) 판단을 보류한다고 씁니다.
- 참여가 적은 학생을 비난하지 않습니다. 가능한 이유를 지어내지 말고, 강사가 확인해 볼 점으로만 적습니다.
- 채팅은 강사 화면이 불러온 최근 메시지만 센 것이라 전체가 아닐 수 있습니다.
- 한국어 존댓말이 아닌 간결한 평서문(~했다, ~이다)으로 씁니다.
- teacherNote가 있는 학생은 강사가 수업 중 직접 본 관찰입니다. 사실로 존중해 반영하되, 성격을 단정하는 표현은 관찰한 행동으로 바꿔 씁니다.
- journals는 입력 학생 수와 같게, key를 그대로 돌려줍니다.`;

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN)
    return Response.json({ error: "AI 기능을 쓰려면 서버에 ANTHROPIC_API_KEY가 있어야 해요." }, { status: 503 });
  try {
    const parsed = Body.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "요청을 확인해 주세요." }, { status: 400 });
    const { sessionId, chat } = parsed.data;
    const token = request.headers.get("x-teacher-token") ?? "";
    const state = await readSession(sessionId, true);
    if (!state) return Response.json({ error: "수업을 찾지 못했어요." }, { status: 404 });
    if (!isTeacher(state, token)) return Response.json({ error: "수업을 연 강사만 분석할 수 있어요." }, { status: 403 });

    const { students, summary } = computeStudentStats(state, chat as ChatCounts);
    if (students.length === 0) return Response.json({ error: "아직 참여 기록이 없어요. 학생이 퀴즈에 답하거나 결과물을 올린 뒤 눌러 주세요." }, { status: 422 });
    if (students.length > MAX_STUDENTS) return Response.json({ error: `한 번에 ${MAX_STUDENTS}명까지 분석할 수 있어요.` }, { status: 413 });

    // 학생이 직접 쓴 글 — 결과물 설명과 채팅 몇 줄. 길면 잘라서 보낸다
    const writing = (name: string, key: string) => {
      const ids = new Set(Object.entries(state.roster ?? {}).filter(([, v]) => `name:${v.name}` === key).map(([id]) => id));
      const posts = (state.posts ?? []).filter(p => ids.has(p.ownerId) || (p.authorName.trim() && `name:${p.authorName.trim()}` === key))
        .map(p => p.description.slice(0, 200)).filter(Boolean).slice(0, 5);
      return { posts, chat: (chat as ChatCounts)[name]?.samples.slice(0, 5) ?? [] };
    };
    // 다시 분석할 때도 강사가 적어 둔 관찰 메모를 읽게 한다
    const notes = new Map((state.studentReport?.journals ?? []).filter(j => j.teacherNote).map(j => [j.key, j.teacherNote!]));
    const payload = {
      class: summary,
      students: students.map(s => ({
        ...(notes.has(s.key) ? { teacherNote: notes.get(s.key) } : {}),
        key: s.key, name: s.name, named: s.named,
        quiz: { answered: s.quizAnswered, graded: s.quizGraded, correct: s.quizCorrect, accuracy: s.accuracy },
        posts: s.posts, likesReceived: s.likesReceived, surveys: s.surveys, wordclouds: s.words, chats: s.chats,
        participation: s.participation,
        writing: writing(s.name, s.key),
      })),
    };

    const client = new Anthropic({ maxRetries: 0, timeout: 55000 });
    const response = await client.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { effort: "low", format: zodOutputFormat(Output) },
      messages: [{ role: "user", content: `[수업 참여 기록]\n${JSON.stringify(payload)}` }],
    });
    if (response.stop_reason === "refusal") return Response.json({ error: "AI가 이 요청을 처리하지 않았어요. 내용을 확인하고 다시 시도해 주세요." }, { status: 422 });
    const out = response.parsed_output;
    if (!out) return Response.json({ error: "일지를 만들지 못했어요. 다시 시도해 주세요." }, { status: 502 });

    const byKey = new Map(out.journals.map(j => [j.key, j]));
    const report: StudentReport = {
      createdAt: Date.now(),
      basedOnRevision: state.revision,
      overview: out.overview.trim(),
      // 입력에 없는 학생을 AI가 만들어내도 저장하지 않는다
      journals: students.filter(s => byKey.has(s.key)).map(s => {
        const j = byKey.get(s.key)!;
        return { key: s.key, name: s.name, summary: j.summary.trim(), strengths: j.strengths, watch: j.watch, suggestion: j.suggestion.trim() };
      }),
    };
    await execute(sessionId, token, { action: "setStudentReport", report });
    return Response.json({ report, usage: { input: response.usage.input_tokens, output: response.usage.output_tokens } });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return Response.json({ error: "ANTHROPIC_API_KEY가 올바르지 않아요." }, { status: 503 });
    if (error instanceof Anthropic.RateLimitError) return Response.json({ error: "지금 요청이 몰려 있어요. 잠시 뒤 다시 시도해 주세요." }, { status: 429 });
    return Response.json({ error: error instanceof Error ? error.message : "일지를 만들지 못했어요." }, { status: 500 });
  }
}
