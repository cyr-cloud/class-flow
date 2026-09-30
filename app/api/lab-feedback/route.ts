// 강사가 실습 게시판에서 «AI 피드백 달기»를 눌렀을 때만 실행된다.
//
// 학생이 결과물을 올리는 순간에는 AI를 부르지 않는다 — 수업 한 번에 실습 6개 × 30명이면
// 호출이 180번이 되고, AI가 느리거나 실패해도 제출이 멈추면 안 되기 때문이다.
// 아직 피드백이 없는 결과물만 모아 한 번에 보낸다.

import { readFile } from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { execute, isTeacher, publicState, readSession } from "@/lib/live/server";
import { kv } from "@/lib/live/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** 한 번에 보내는 결과물 수 — 이미지가 많으면 60초 안에 못 끝난다 */
const BATCH = 12;
const SEED_OWNER = "seed";

const Body = z.object({ sessionId: z.string(), slideNo: z.number().int().min(1) });
const Output = z.object({
  items: z.array(z.object({
    postId: z.string(),
    feedback: z.string().describe("잘한 점 한 문장 + 다음에 해볼 것 한 문장. 합쳐 120자 이내"),
  })),
});

const SYSTEM = `당신은 실습 수업의 조교입니다. 학생이 올린 실습 결과물(화면 캡처와 설명)에 짧은 피드백을 답니다.

규칙:
- 결과물마다 두 문장: 잘한 점 한 문장, 다음에 해볼 것 한 문장. 합쳐 120자 이내.
- 실습 안내문의 목표와 비교해서 씁니다. 이미지에서 확인되는 것만 말하고, 안 보이는 것은 추측하지 않습니다.
- 점수를 매기거나 다른 학생과 비교하지 않습니다.
- 막혔다고 적은 학생에게는 원인을 단정하지 말고 확인해 볼 곳을 알려줍니다.
- 학생에게 직접 말하는 친근한 존댓말(~했어요, ~해 보세요).
- items는 입력 결과물과 같은 수, postId를 그대로 돌려줍니다.`;

type ImageBlock = { type: "image"; source: { type: "base64"; media_type: "image/png" | "image/jpeg" | "image/webp"; data: string } };

async function loadImage(url: string | null): Promise<ImageBlock | null> {
  if (!url) return null;
  const sample = url.match(/^\/samples\/gallery\/(lab-\d+\.png)$/);
  if (sample) {
    const data = (await readFile(path.join(process.cwd(), "public/samples/gallery", sample[1]))).toString("base64");
    return { type: "image", source: { type: "base64", media_type: "image/png", data } };
  }
  const id = url.match(/^\/api\/image\/([a-z0-9]{8,64})$/)?.[1];
  if (!id) return null;
  const stored = await kv().get(`img:${id}`);
  if (!stored) return null;
  const at = stored.indexOf(":");
  const kind = stored.slice(0, at);
  const media_type = kind === "png" ? "image/png" : kind === "jpeg" ? "image/jpeg" : kind === "webp" ? "image/webp" : null;
  return media_type ? { type: "image", source: { type: "base64", media_type, data: stored.slice(at + 1) } } : null;
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN)
    return Response.json({ error: "AI 기능을 쓰려면 서버에 ANTHROPIC_API_KEY가 있어야 해요." }, { status: 503 });
  try {
    const parsed = Body.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "요청을 확인해 주세요." }, { status: 400 });
    const { sessionId, slideNo } = parsed.data;
    const token = request.headers.get("x-teacher-token") ?? "";
    const state = await readSession(sessionId, true);
    if (!state) return Response.json({ error: "수업을 찾지 못했어요." }, { status: 404 });
    if (!isTeacher(state, token)) return Response.json({ error: "수업을 연 강사만 피드백을 달 수 있어요." }, { status: 403 });

    // 샘플 수업의 안내문은 저장된 덱이 아니라 읽을 때 붙으므로 강사용 상태에서 꺼낸다
    const slide = publicState(state, true).deck?.slides.find(s => s.slideNo === slideNo);
    if (!slide || slide.kind !== "lab") return Response.json({ error: "실습 슬라이드가 아니에요." }, { status: 400 });

    const pending = (state.posts ?? []).filter(p => p.slideNo === slideNo && p.ownerId !== SEED_OWNER && !p.aiFeedback);
    if (pending.length === 0) return Response.json({ done: 0, remaining: 0 });
    const batch = pending.slice(0, BATCH);

    const content: (ImageBlock | { type: "text"; text: string })[] = [
      { type: "text", text: `[실습] ${slide.title}\n\n[실습 안내문]\n${(slide.guide ?? "안내문 없음").slice(0, 6000)}` },
    ];
    for (const post of batch) {
      content.push({ type: "text", text: `\n[결과물 postId=${post.id}]\n설명: ${post.description.slice(0, 600) || "(설명 없음)"}` });
      const image = await loadImage(post.imageUrl).catch(() => null);
      if (image) content.push(image);
    }

    const client = new Anthropic({ maxRetries: 0, timeout: 55000 });
    const response = await client.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      system: SYSTEM,
      output_config: { effort: "low", format: zodOutputFormat(Output) },
      messages: [{ role: "user", content }],
    });
    if (response.stop_reason === "refusal") return Response.json({ error: "AI가 이 요청을 처리하지 않았어요. 내용을 확인하고 다시 시도해 주세요." }, { status: 422 });
    const out = response.parsed_output;
    if (!out) return Response.json({ error: "피드백을 만들지 못했어요. 다시 시도해 주세요." }, { status: 502 });

    const valid = new Set(batch.map(p => p.id));
    const items = out.items.filter(i => valid.has(i.postId) && i.feedback.trim()).map(i => ({ postId: i.postId, feedback: i.feedback.trim() }));
    await execute(sessionId, token, { action: "setLabFeedback", items });
    return Response.json({ done: items.length, remaining: pending.length - items.length });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return Response.json({ error: "ANTHROPIC_API_KEY가 올바르지 않아요." }, { status: 503 });
    if (error instanceof Anthropic.RateLimitError) return Response.json({ error: "지금 요청이 몰려 있어요. 잠시 뒤 다시 시도해 주세요." }, { status: 429 });
    return Response.json({ error: error instanceof Error ? error.message : "피드백을 만들지 못했어요." }, { status: 500 });
  }
}
