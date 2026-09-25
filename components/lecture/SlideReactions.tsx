"use client";

import { useEffect, useState } from "react";
import { liveClient, responderId } from "@/lib/live/client";
import { REACTIONS, type SlideReaction } from "@/lib/live/reactions";

export default function SlideReactions({ sessionId, page }: {
  sessionId: string; page: number;
}) {
  const [active, setActive] = useState<SlideReaction[]>([]);

  useEffect(() => {
    const client = liveClient(sessionId);
    const seen = new Set((client.snapshot().reactions ?? []).map(r => r.id));
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const unsubscribe = client.subscribe(() => {
      const recent = client.snapshot().reactions ?? [];
      const fresh = recent.filter(r => !seen.has(r.id) && r.slideNo === page && Date.now() - r.createdAt < 5000);
      for (const r of recent) seen.add(r.id);
      const ids = new Set(recent.map(r => r.id));
      for (const id of seen) if (!ids.has(id)) seen.delete(id);
      if (!fresh.length) return;
      setActive(current => [...current, ...fresh].slice(-24));
      const timer = setTimeout(() => {
        setActive(current => current.filter(r => !fresh.some(f => f.id === r.id)));
        timers.delete(timer);
      }, 4000);
      timers.add(timer);
    });
    return () => { unsubscribe(); timers.forEach(clearTimeout); };
  }, [sessionId, page]);


  return <>
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden" aria-hidden="true">
      {active.filter(r => r.slideNo === page).map(r => {
        const lane = [...r.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 76;
        return <span key={r.id} className="slide-reaction absolute bottom-14 text-4xl drop-shadow-md sm:text-5xl" style={{ left: `${12 + lane}%` }}>{r.emoji}</span>;
      })}
    </div>
  </>;
}

export function SlideReactionButtons({ sessionId, page }: { sessionId: string; page: number }) {
  const [error, setError] = useState("");
  async function react(emoji: string) {
    setError("");
    try {
      await liveClient(sessionId).send({ action: "react", slideNo: page, emoji, senderId: responderId() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "반응을 보내지 못했어요.");

    }
  }

  return (
    <div className="mx-auto mt-2 max-w-full shrink-0">
      <div aria-label="슬라이드 이모지 반응" className="flex flex-wrap justify-center gap-1 rounded-full border border-line bg-paper/95 p-1.5 shadow-sm">
        {REACTIONS.map(r => <button key={r.emoji} type="button" aria-label={`${r.label} 반응 보내기`} title={r.label}
          onClick={() => void react(r.emoji)} className="h-9 w-9 rounded-full text-2xl transition-transform hover:scale-110 hover:bg-gardenia disabled:opacity-50 sm:h-10 sm:w-10">{r.emoji}</button>)}
      </div>
      {error && <p role="alert" className="mt-1 rounded-lg bg-paper px-3 py-1 text-center text-xs text-rosetan">{error}</p>}
    </div>
  );
}
