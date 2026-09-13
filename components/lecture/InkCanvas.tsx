"use client";

// 슬라이드 위에 겹쳐 그리는 판서 레이어.
//
// 좌표는 0~1 비율로 저장하므로 창 크기·전체화면 여부와 무관하게 같은 자리에 다시 그려진다.
// 그리는 동안에는 화면에만 그리고, 손을 뗄 때 한 번 저장한다.

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import {
  InkTool,
  SHAPE_TOOLS,
  Stroke,
  inkStore,
  newStrokeId,
} from "@/lib/lecture/inkStore";

const EMPTY = { strokes: {}, live: null } as const;
const NO_STROKES: Stroke[] = [];
const emptySnapshot = () => EMPTY as unknown as ReturnType<typeof inkStore.snapshot>;

export function useInk(sessionId: string) {
  const subscribe = useCallback(
    (l: () => void) => inkStore.subscribe(sessionId, l),
    [sessionId],
  );
  const snapshot = useCallback(() => inkStore.snapshot(sessionId), [sessionId]);
  return useSyncExternalStore(subscribe, snapshot, emptySnapshot);
}

function isShape(tool: InkTool) {
  return SHAPE_TOOLS.includes(tool);
}

/** 획 하나를 그린다. w/h는 캔버스의 CSS 크기 */
function paint(ctx: CanvasRenderingContext2D, s: Stroke, w: number, h: number) {
  if (s.points.length === 0) return;
  const px = (p: [number, number]) => [p[0] * w, p[1] * h] as const;

  ctx.save();
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = Math.max(1, s.width * w);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (s.tool === "highlighter") {
    ctx.globalAlpha = 0.35;
    ctx.lineCap = "butt";
  }

  const [x0, y0] = px(s.points[0]);
  const last = s.points[s.points.length - 1];
  const [x1, y1] = px(last);

  if (s.tool === "rect") {
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
  } else if (s.tool === "ellipse") {
    ctx.beginPath();
    ctx.ellipse(
      (x0 + x1) / 2,
      (y0 + y1) / 2,
      Math.abs(x1 - x0) / 2,
      Math.abs(y1 - y0) / 2,
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  } else if (s.tool === "line" || s.tool === "arrow") {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    if (s.tool === "arrow") {
      // 화살촉 — 선 굵기에 비례
      const head = Math.max(10, ctx.lineWidth * 3.2);
      const angle = Math.atan2(y1 - y0, x1 - x0);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(
        x1 - head * Math.cos(angle - Math.PI / 7),
        y1 - head * Math.sin(angle - Math.PI / 7),
      );
      ctx.lineTo(
        x1 - head * Math.cos(angle + Math.PI / 7),
        y1 - head * Math.sin(angle + Math.PI / 7),
      );
      ctx.closePath();
      ctx.fill();
    }
  } else {
    // 펜 · 형광펜 — 자유곡선
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    for (let i = 1; i < s.points.length; i++) {
      const [x, y] = px(s.points[i]);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

export default function InkCanvas({
  sessionId,
  slideNo,
  width,
  height,
  drawing,
  tool,
  color,
  lineWidth,
}: {
  sessionId: string;
  slideNo: number;
  /** 슬라이드가 그려진 CSS 크기 — 여기에 정확히 겹친다 */
  width: number;
  height: number;
  /** 펜을 든 상태인지 (false면 클릭이 통과한다) */
  drawing: boolean;
  tool: InkTool;
  color: string;
  /** 슬라이드 폭 대비 굵기 비율 */
  lineWidth: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const draftRef = useRef<Stroke | null>(null);
  const rafRef = useRef<number | null>(null);
  const ink = useInk(sessionId);

  const saved = useMemo(() => ink.strokes[slideNo] ?? NO_STROKES, [ink.strokes, slideNo]);
  const live = ink.live;

  /** 저장된 획 + 남이 그리는 중인 획 + 내가 그리는 중인 획을 모두 다시 그린다 */
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || width === 0 || height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(width * dpr)) canvas.width = Math.round(width * dpr);
    if (canvas.height !== Math.round(height * dpr)) canvas.height = Math.round(height * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    for (const s of saved) paint(ctx, s, width, height);
    if (live) paint(ctx, live, width, height);
    if (draftRef.current) paint(ctx, draftRef.current, width, height);
  }, [saved, live, width, height]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const pointOf = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = e.currentTarget.getBoundingClientRect();
    return [(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height];
  };

  const scheduleRedraw = () => {
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      redraw();
    });
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pointOf(e);
    draftRef.current = {
      id: newStrokeId(),
      color,
      width: lineWidth,
      tool,
      points: [p, p],
    };
    scheduleRedraw();
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const draft = draftRef.current;
    if (!drawing || !draft) return;
    const p = pointOf(e);
    if (isShape(draft.tool)) {
      draft.points = [draft.points[0], p];
    } else {
      draft.points.push(p);
    }
    // 그리는 중에는 다른 화면에만 흘려보낸다 (저장은 손 뗄 때 한 번)
    inkStore.stream(sessionId, { ...draft, points: [...draft.points] });
    scheduleRedraw();
  };

  const onUp = () => {
    const draft = draftRef.current;
    draftRef.current = null;
    if (!draft) return;
    inkStore.commit(sessionId, slideNo, draft);
    scheduleRedraw();
  };

  if (width === 0 || height === 0) return null;

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      style={{ width, height }}
      className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg ${
        drawing ? "cursor-crosshair touch-none" : "pointer-events-none"
      }`}
    />
  );
}
