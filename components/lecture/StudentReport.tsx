"use client";

// 강사 화면의 «학생 리포트».
// 표의 숫자는 코드가 바로 센다(버튼 없이 실시간). AI 일지는 «학생 성향 분석»을 눌렀을 때만 만든다.

import { useMemo, useState, useSyncExternalStore } from "react";
import Modal from "../board/Modal";
import { useChat } from "../chat/ChatRoom";
import { emptyLive, liveClient } from "@/lib/live/client";
import { computeStudentStats, leaders, type ChatCounts, type JournalDraft, type StudentJournal, type StudentStat } from "@/lib/lecture/studentStats";

const serverLive = () => emptyLive;

function useChatCounts(): { counts: ChatCounts; loaded: number } {
  const chat = useChat();
  const messages = chat?.data.messages;
  return useMemo(() => {
    const counts: ChatCounts = {};
    for (const m of messages ?? []) {
      if (m.role !== "student") continue;
      const c = (counts[m.name] ??= { count: 0, samples: [] });
      c.count += 1;
      if (c.samples.length < 5) c.samples.push(m.text.slice(0, 300));
    }
    return { counts, loaded: messages?.length ?? 0 };
  }, [messages]);
}

const fmt = (v: number | null) => (v === null ? "–" : `${v}%`);
const names = (list: StudentStat[]) => (list.length ? list.map((s) => s.name).join(", ") : "아직 없음");

export default function StudentReport({ sessionId }: { sessionId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-full bg-viola-tint px-3 py-1 text-sm text-viola-deep transition-colors hover:bg-viola/20"
      >
        학생 리포트
      </button>
      {open && <ReportModal sessionId={sessionId} onClose={() => setOpen(false)} />}
    </>
  );
}

function ReportModal({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const client = liveClient(sessionId);
  const live = useSyncExternalStore(client.subscribe, client.snapshot, serverLive);
  const { counts, loaded } = useChatCounts();
  const { students, summary } = useMemo(() => computeStudentStats(live, counts), [live, counts]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const report = live.studentReport ?? null;
  const journals = new Map((report?.journals ?? []).map((j) => [j.key, j]));

  const analyze = async () => {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/student-report", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-teacher-token": localStorage.getItem(`classflow:teacher:${sessionId}`) ?? "" },
        body: JSON.stringify({ sessionId, chat: counts }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "일지를 만들지 못했어요.");
      // 저장된 리포트는 다음 동기화에 실려 온다
    } catch (e) { setError(e instanceof Error ? e.message : "일지를 만들지 못했어요."); }
    finally { setBusy(false); }
  };

  return (
    <Modal onClose={onClose} size="lg">
      <div className="px-6 py-6">
        <div className="flex items-start gap-3">
          <div>
            <p className="eyebrow text-mute">학생 리포트 · 강사 화면 전용</p>
            <h2 className="mt-1 text-xl font-bold text-ink">누가 얼마나 참여했을까</h2>
          </div>
          <button onClick={onClose} className="ml-auto rounded-full border border-line-strong px-3 py-1 text-sm text-ink-soft hover:border-mocha hover:text-mocha">닫기</button>
        </div>

        {/* 요약 — 코드가 센 숫자 */}
        <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["참여 학생", `${summary.students}명`],
            ["평균 참여율", fmt(summary.averageParticipation)],
            ["평균 정답률", fmt(summary.averageAccuracy)],
            ["올라온 결과물", `${summary.posts}개`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-line bg-cream px-4 py-3">
              <dt className="text-xs text-mute">{k}</dt>
              <dd className="mt-1 text-lg font-bold tabular-nums text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <ul className="mt-3 space-y-1 text-sm text-ink-soft">
          <li>🏅 결과물을 가장 많이 올린 학생: <strong className="text-ink">{names(leaders(students, (s) => s.posts))}</strong></li>
          <li>🎯 퀴즈를 가장 많이 맞힌 학생: <strong className="text-ink">{names(leaders(students, (s) => s.quizCorrect))}</strong></li>
          <li>💬 채팅을 가장 많이 한 학생: <strong className="text-ink">{names(leaders(students, (s) => s.chats))}</strong></li>
        </ul>

        {/* 학생별 표 */}
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-mute">
                <th className="py-2 pr-2 font-medium">이름</th>
                <th className="py-2 pr-2 font-medium">참여율</th>
                <th className="py-2 pr-2 font-medium">퀴즈 정답</th>
                <th className="py-2 pr-2 font-medium">결과물</th>
                <th className="py-2 pr-2 font-medium">채팅</th>
                <th className="py-2 font-medium">설문·단어</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.key} className="border-b border-line/60 tabular-nums">
                  <td className="py-2 pr-2 text-ink">{s.name}{!s.named && <span className="ml-1 text-xs text-mute">(이름 없음)</span>}</td>
                  <td className="py-2 pr-2">{fmt(s.participation)}</td>
                  <td className="py-2 pr-2">{s.quizGraded ? `${s.quizCorrect}/${s.quizGraded} (${fmt(s.accuracy)})` : "–"}</td>
                  <td className="py-2 pr-2">{s.posts}{s.likesReceived > 0 && <span className="ml-1 text-xs text-mute">♥{s.likesReceived}</span>}</td>
                  <td className="py-2 pr-2">{s.chats}</td>
                  <td className="py-2">{s.surveys + s.words}</td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-center text-mute">아직 참여 기록이 없어요. 학생이 퀴즈에 답하거나 결과물을 올리면 여기에 쌓여요.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs leading-5 text-mute">
          참여율은 지금까지 진행된 참여 활동 {summary.activitiesRun}개(누군가 한 명이라도 답한 퀴즈·설문·워드클라우드) 기준이에요.
          채팅은 이 화면이 불러온 최근 {loaded}개 메시지로 셉니다. 이름이 같으면 한 사람으로 합칩니다.
        </p>

        {/* AI 일지 — 버튼을 눌렀을 때만 */}
        <section className="mt-6 rounded-2xl border border-viola/30 bg-viola-tint/40 px-5 py-5">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <h3 className="font-bold text-ink">✦ 학생 성향 분석</h3>
              <p className="mt-1 text-xs text-ink-soft">위 기록만 근거로 AI가 학생별 참여 일지를 씁니다. 성격을 판단하지 않고, 강사님이 참고할 관찰 기록으로만 보여줘요. 일지는 직접 고칠 수 있고, 강사 메모는 다시 분석해도 남아요.</p>
            </div>
            <button
              onClick={analyze}
              disabled={busy || students.length === 0}
              className="ml-auto rounded-full bg-ink px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-mocha-deep disabled:opacity-40"
            >
              {busy ? "기록을 읽는 중…" : report ? "다시 분석하기" : "학생 성향 분석"}
            </button>
          </div>
          {error && <p className="mt-3 text-sm text-rosetan-deep">{error}</p>}
          {report && (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-mute">
                {new Date(report.createdAt).toLocaleString("ko-KR")} 기록 기준
                {/* 리포트를 저장하는 쓰기 자체가 revision을 하나 올린다 */}
                {report.basedOnRevision + 1 < live.revision && " · 이후 참여는 반영되지 않았어요"}
              </p>
              <p className="rounded-xl bg-paper px-4 py-3 text-sm leading-6 text-ink-soft">{report.overview}</p>
              {students.filter((s) => journals.has(s.key)).map((s) => (
                <JournalCard key={s.key} sessionId={sessionId} journal={journals.get(s.key)!} chat={counts} />
              ))}
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}

const lines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);
const teacherHeaders = (sessionId: string) => ({ "Content-Type": "application/json", "x-teacher-token": localStorage.getItem(`classflow:teacher:${sessionId}`) ?? "" });

/** 학생 한 명의 일지. 강사가 직접 고치고, 원하면 «AI로 다듬기»로 문장을 정리한다 */
function JournalCard({ sessionId, journal: j, chat }: { sessionId: string; journal: StudentJournal; chat: ChatCounts }) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<"" | "save" | "refine">("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ summary: "", strengths: "", watch: "", suggestion: "", teacherNote: "" });
  const draft = (): JournalDraft => ({ summary: form.summary, strengths: lines(form.strengths), watch: lines(form.watch), suggestion: form.suggestion, teacherNote: form.teacherNote });
  const open = () => {
    setForm({ summary: j.summary, strengths: j.strengths.join("\n"), watch: j.watch.join("\n"), suggestion: j.suggestion, teacherNote: j.teacherNote ?? "" });
    setError(""); setEditing(true);
  };

  const save = async () => {
    setBusy("save"); setError("");
    try {
      await liveClient(sessionId).send({ action: "updateJournal", key: j.key, draft: draft() });
      setEditing(false);
    } catch (e) { setError(e instanceof Error ? e.message : "저장하지 못했어요."); }
    finally { setBusy(""); }
  };
  // 편집 중이면 고친 내용을, 아니면 지금 일지를 다듬는다. 결과는 저장되어 다음 동기화에 실려 온다
  const refine = async () => {
    setBusy("refine"); setError("");
    const current: JournalDraft = editing ? draft() : { summary: j.summary, strengths: j.strengths, watch: j.watch, suggestion: j.suggestion, teacherNote: j.teacherNote ?? "" };
    try {
      const res = await fetch("/api/student-report/refine", { method: "POST", headers: teacherHeaders(sessionId), body: JSON.stringify({ sessionId, key: j.key, draft: current, chat }) });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "일지를 다듬지 못했어요.");
      setEditing(false);
    } catch (e) { setError(e instanceof Error ? e.message : "일지를 다듬지 못했어요."); }
    finally { setBusy(""); }
  };

  const field = "mt-1 w-full resize-y rounded-lg border border-line bg-cream px-3 py-2 text-sm leading-6 text-ink outline-none focus:border-mocha";
  const stamp = [j.editedAt && `강사 편집 ${new Date(j.editedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`,
    j.refinedAt && `AI 다듬기 ${new Date(j.refinedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}`].filter(Boolean).join(" · ");

  return (
    <article className="rounded-xl bg-paper px-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="font-bold text-ink">{j.name}</h4>
        {stamp && <span className="text-xs text-mute">{stamp}</span>}
        <span className="ml-auto flex gap-1.5">
          {!editing && <button onClick={open} disabled={!!busy} className="rounded-full border border-line-strong px-3 py-1 text-xs text-ink-soft hover:border-mocha hover:text-mocha disabled:opacity-40">편집</button>}
          <button onClick={refine} disabled={!!busy} className="rounded-full border border-viola/50 bg-viola-tint px-3 py-1 text-xs text-viola-deep hover:border-viola disabled:opacity-40">
            {busy === "refine" ? "다듬는 중…" : "✦ AI로 다듬기"}
          </button>
        </span>
      </div>

      {editing ? (
        <div className="mt-3 space-y-3">
          <label className="block text-xs font-medium text-mocha-deep">강사 관찰 메모 <span className="font-normal text-mute">— 수업 중 직접 보고 느낀 점. AI로 다듬을 때 사실로 반영돼요</span>
            <textarea value={form.teacherNote} onChange={(e) => setForm({ ...form, teacherNote: e.target.value })} rows={3} maxLength={1000} placeholder="예: 실습 3에서 옆자리 학생을 먼저 도와줬다. 질문은 채팅으로만 했다." className={field} />
          </label>
          <label className="block text-xs font-medium text-ink-soft">요약
            <textarea value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} rows={3} maxLength={800} className={field} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-tendril-deep">잘한 점 <span className="font-normal text-mute">(한 줄에 하나)</span>
              <textarea value={form.strengths} onChange={(e) => setForm({ ...form, strengths: e.target.value })} rows={3} className={field} />
            </label>
            <label className="block text-xs font-medium text-rosetan-deep">살펴볼 점 <span className="font-normal text-mute">(한 줄에 하나)</span>
              <textarea value={form.watch} onChange={(e) => setForm({ ...form, watch: e.target.value })} rows={3} className={field} />
            </label>
          </div>
          <label className="block text-xs font-medium text-mocha-deep">다음 수업
            <textarea value={form.suggestion} onChange={(e) => setForm({ ...form, suggestion: e.target.value })} rows={2} maxLength={300} className={field} />
          </label>
          <div className="flex items-center gap-2">
            <button onClick={save} disabled={!!busy} className="rounded-full bg-ink px-4 py-1.5 text-sm text-white hover:bg-mocha-deep disabled:opacity-40">{busy === "save" ? "저장하는 중…" : "저장"}</button>
            <button onClick={() => setEditing(false)} disabled={!!busy} className="rounded-full border border-line-strong px-4 py-1.5 text-sm text-ink-soft hover:border-mocha disabled:opacity-40">취소</button>
            <span className="text-xs text-mute">고친 뒤 «AI로 다듬기»를 누르면 메모와 함께 문장을 정리해요</span>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm leading-6 text-ink-soft">{j.summary}</p>
          {j.strengths.length > 0 && (
            <p className="mt-2 text-sm leading-6"><span className="font-medium text-tendril-deep">잘한 점</span> <span className="text-ink-soft">{j.strengths.join(" · ")}</span></p>
          )}
          {j.watch.length > 0 && (
            <p className="mt-1 text-sm leading-6"><span className="font-medium text-rosetan-deep">살펴볼 점</span> <span className="text-ink-soft">{j.watch.join(" · ")}</span></p>
          )}
          <p className="mt-1 text-sm leading-6"><span className="font-medium text-mocha-deep">다음 수업</span> <span className="text-ink-soft">{j.suggestion}</span></p>
          {j.teacherNote && (
            <p className="mt-2 whitespace-pre-wrap rounded-lg bg-mocha-tint px-3 py-2 text-sm leading-6 text-mocha-deep"><span className="font-medium">강사 메모</span> {j.teacherNote}</p>
          )}
        </>
      )}
      {error && <p className="mt-2 text-sm text-rosetan-deep">{error}</p>}
    </article>
  );
}
