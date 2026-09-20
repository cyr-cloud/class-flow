"use client";

// 슬라이드 + 판서 레이어를 겹쳐 놓은 무대.
// 강사 화면·학생 화면·전체화면 발표에서 모두 이걸 쓴다. 판서 도구는 강사에게만 보인다.

import { useCallback, useState } from "react";
import SlideViewer from "../SlideViewer";
import InkCanvas from "./InkCanvas";
import SlideReactions from "./SlideReactions";
import { InkTool, inkStore } from "@/lib/lecture/inkStore";

const TOOLS: { tool: InkTool; label: string; title: string }[] = [
  { tool: "pen", label: "✎", title: "펜" },
  { tool: "highlighter", label: "▬", title: "형광펜" },
  { tool: "line", label: "╱", title: "직선" },
  { tool: "arrow", label: "↗", title: "화살표" },
  { tool: "rect", label: "▭", title: "사각형" },
  { tool: "ellipse", label: "◯", title: "원" },
];

// 밝은 덱·어두운 덱 양쪽에서 보이는 색으로 고른다
const COLORS = ["#d94f4f", "#a47864", "#7391c8", "#8ba475", "#f5c542", "#ffffff"];

const WIDTHS: { label: string; value: number }[] = [
  { label: "가늘게", value: 0.002 },
  { label: "보통", value: 0.004 },
  { label: "굵게", value: 0.008 },
];

export default function SlideStage({
  sessionId,
  pdfKey,
  page,
  fit = "width",
  onLoaded,
  canDraw = false,
  className,
}: {
  sessionId: string;
  pdfKey: string | null;
  page: number;
  fit?: "width" | "contain";
  onLoaded?: (total: number) => void;
  /** 강사만 true. false면 남이 그린 것만 보인다 */
  canDraw?: boolean;
  className?: string;
}) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [penOn, setPenOn] = useState(false);
  const [tool, setTool] = useState<InkTool>("pen");
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(WIDTHS[1].value);

  const onSize = useCallback((w: number, h: number) => {
    setSize((prev) => (Math.abs(prev.w - w) < 0.5 && Math.abs(prev.h - h) < 0.5 ? prev : { w, h }));
  }, []);

  const drawing = canDraw && penOn;

  const chip = (active: boolean) =>
    `flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm transition-colors ${
      active ? "bg-ink text-white" : "text-ink-soft hover:bg-gardenia"
    }`;

  return (
    <div className={`relative ${className ?? ""}`}>
      <SlideViewer
        pdfKey={pdfKey}
        page={page}
        fit={fit}
        onLoaded={onLoaded}
        onSize={onSize}
        className={fit === "contain" ? "h-full w-full" : "w-full"}
      />

      <InkCanvas
        sessionId={sessionId}
        slideNo={page}
        width={size.w}
        height={size.h}
        drawing={drawing}
        tool={tool}
        color={color}
        lineWidth={width}
      />

      {pdfKey && size.w > 0 && <SlideReactions key={`${sessionId}:${page}`} sessionId={sessionId} page={page} canReact={!canDraw} />}

      {canDraw && size.w > 0 && (
        // 슬라이드 제목은 대개 위쪽에 있으니 도구 모음은 아래에 띄운다
        <div className="absolute bottom-3 left-1/2 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-full [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border border-line bg-paper/95 px-2 py-1.5 shadow-sm backdrop-blur">
          <button
            onClick={() => setPenOn((v) => !v)}
            title="판서 켜기/끄기"
            className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              penOn ? "bg-mocha text-white" : "text-ink-soft hover:bg-gardenia"
            }`}
          >
            {penOn ? "판서 중" : "판서"}
          </button>

          {penOn && (
            <>
              <span className="mx-1 h-5 w-px shrink-0 bg-line" />
              {TOOLS.map((t) => (
                <button
                  key={t.tool}
                  onClick={() => setTool(t.tool)}
                  title={t.title}
                  className={chip(tool === t.tool)}
                >
                  {t.label}
                </button>
              ))}

              <span className="mx-1 h-5 w-px shrink-0 bg-line" />
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  title="색"
                  className={`h-6 w-6 shrink-0 rounded-full border transition-transform ${
                    color === c ? "scale-110 border-ink" : "border-line-strong"
                  }`}
                  style={{ background: c }}
                />
              ))}

              <span className="mx-1 h-5 w-px shrink-0 bg-line" />
              <select
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="shrink-0 rounded-full bg-transparent px-1 py-1 text-xs text-ink-soft outline-none"
              >
                {WIDTHS.map((w) => (
                  <option key={w.value} value={w.value}>
                    {w.label}
                  </option>
                ))}
              </select>

              <span className="mx-1 h-5 w-px shrink-0 bg-line" />
              <button
                onClick={() => inkStore.undo(sessionId, page)}
                title="되돌리기"
                className={chip(false)}
              >
                ↶
              </button>
              <button
                onClick={() => inkStore.clearSlide(sessionId, page)}
                title="이 슬라이드 판서 지우기"
                className="shrink-0 rounded-full px-3 py-1 text-sm text-ink-soft transition-colors hover:bg-rosetan/15 hover:text-rosetan"
              >
                지우기
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
