// 강사가 학생 한 명의 일지에서 «AI로 다듬기»를 눌렀을 때만 실행된다.
//
// 강사가 고친 문장과 직접 적은 관찰 메모를 기록 숫자와 함께 읽고, 일지를 자연스럽게 다시 쓴다.
// 강사 메모는 사실로 존중하되, 성격을 단정하는 표현은 관찰한 행동으로 바꿔 쓴다.

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { execute, isTeacher, readSession } from "@/lib/live/server";
import { cleanJournalDraft, computeStudentStats, type ChatCounts, type JournalDraft } from "@/lib/lecture/studentStats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  sessionId: z.string(),
  key: z.string().max(200),
  draft: z.object({ summary: z.string(), strengths: z.array(z.string()), watch: z.array(z.string()), suggestion: z.string(), teacherNote: z.string() }),
  chat: z.record(z.string().max(30), z.object({ count: z.number().int().min(0).max(20000), samples: z.array(z.string().max(300)).max(5) })).default({}),
});

const Output = z.object({
  summary: z.string().describe("참여 방식 2~4문장"),
  strengths: z.array(z.string()).max(3),
  watch: z.array(z.string()).max(3),
  suggestion: z.string().describe("다음 수업에서 강사가 해볼 것 한 가지"),
});

const SYSTEM = `당신은 강사를 돕는 조교입니다. 강사가 학생 한 명의 참여 일지를 고쳤고, 수업 중 직접 본 관찰 메모도 적었습니다. 이 내용을 한 편의 자연스러운 일지로 다듬습니다.

규칙:
- 강사의 관찰 메모와 강사가 고친 문장은 강사가 직접 본 사실로 존중해 반드시 반영합니다. 빼거나 뒤집지 않습니다.
- 기록 숫자(퀴즈·결과물·채팅)와 어긋나는 부분이 있으면 숫자는 그대로 두고, 강사 관찰을 "수업 중 강사가 본 바로는"처럼 출처를 밝혀 함께 씁니다.
- 성격·지능·능력을 단정하는 표현("게으르다", "소극적인 성격")은 관찰한 행동으로 바꿔 씁니다("질문할 때 목소리가 작았다", "실습 중 두 번 도움을 요청했다"). 강사가 쓴 뜻은 유지합니다.
- 입력에 없는 사실은 새로 만들지 않습니다.
- 간결한 평서문(~했다, ~이다)으로 씁니다. 강사 관찰 메모 원문은 따로 보관되므로 그대로 옮겨 적지 않아도 됩니다.`;

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN)
    return Response.json({ error: "AI 기능을 쓰려면 서버에 ANTHROPIC_API_KEY가 있어야 해요." }, { status: 503 });
  try {
    const parsed = Body.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "요청을 확인해 주세요." }, { status: 400 });
    const { sessionId, key } = parsed.data;
    let draft: JournalDraft;
    try { draft = cleanJournalDraft(parsed.data.draft); } catch (e) { return Response.json({ error: e instanceof Error ? e.message : "일지 내용을 확인해 주세요." }, { status: 400 }); }
    const token = request.headers.get("x-teacher-token") ?? "";
    const state = await readSession(sessionId, true);
    if (!state) return Response.json({ error: "수업을 찾지 못했어요." }, { status: 404 });
    if (!isTeacher(state, token)) return Response.json({ error: "수업을 연 강사만 다듬을 수 있어요." }, { status: 403 });
    const journal = state.studentReport?.journals.find(j => j.key === key);
    if (!journal) return Response.json({ error: "일지를 찾지 못했어요. 먼저 «학생 성향 분석»을 눌러 주세요." }, { status: 404 });

    const stat = computeStudentStats(state, parsed.data.chat as ChatCounts).students.find(s => s.key === key);
    const payload = {
      name: journal.name,
      record: stat && {
        quiz: { answered: stat.quizAnswered, graded: stat.quizGraded, correct: stat.quizCorrect, accuracy: stat.accuracy },
        posts: stat.posts, chats: stat.chats, participation: stat.participation,
      },
      teacherNote: draft.teacherNote || "(없음)",
      teacherEditedJournal: { summary: draft.summary, strengths: draft.strengths, watch: draft.watch, suggestion: draft.suggestion },
    };

    const client = new Anthropic({ maxRetries: 0, timeout: 55000 });
    const response = await client.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      system: SYSTEM,
      output_config: { effort: "low", format: zodOutputFormat(Output) },
      messages: [{ role: "user", content: JSON.stringify(payload) }],
    });
    if (response.stop_reason === "refusal") return Response.json({ error: "AI가 이 요청을 처리하지 않았어요. 메모 내용을 확인하고 다시 시도해 주세요." }, { status: 422 });
    const out = response.parsed_output;
    if (!out) return Response.json({ error: "일지를 다듬지 못했어요. 다시 시도해 주세요." }, { status: 502 });

    // 강사 메모는 AI 결과로 덮지 않고 강사가 적은 그대로 둔다
    const refined = cleanJournalDraft({ ...out, teacherNote: draft.teacherNote });
    await execute(sessionId, token, { action: "updateJournal", key, draft: refined, refined: true });
    return Response.json({ journal: refined });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return Response.json({ error: "ANTHROPIC_API_KEY가 올바르지 않아요." }, { status: 503 });
    if (error instanceof Anthropic.RateLimitError) return Response.json({ error: "지금 요청이 몰려 있어요. 잠시 뒤 다시 시도해 주세요." }, { status: 429 });
    return Response.json({ error: error instanceof Error ? error.message : "일지를 다듬지 못했어요." }, { status: 500 });
  }
}
