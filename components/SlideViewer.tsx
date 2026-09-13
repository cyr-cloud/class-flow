"use client";

// PDF 한 페이지를 Canvas에 렌더하는 뷰어.
// pdfKey로 IndexedDB에서 PDF 바이트를 읽어와 문서를 열고, page 번호에 맞춰 렌더한다.
//
// fit="width"   : 컨테이너 폭에 맞춘다 (기본, 일반 화면)
// fit="contain" : 컨테이너 안에 통째로 들어가게 맞춘다 (전체화면 발표용 — 세로도 넘치면 안 된다)

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { loadPdf } from "@/lib/sync/pdfStore";

// pdfjs는 브라우저에서만 로드 (SSR 회피)
async function getPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  return pdfjs;
}

interface Props {
  pdfKey: string | null;
  page: number; // 1-based
  onLoaded?: (totalPages: number) => void;
  /** 슬라이드가 실제로 그려진 CSS 크기 — 판서 레이어를 정확히 겹치는 데 쓴다 */
  onSize?: (width: number, height: number) => void;
  className?: string;
  fit?: "width" | "contain";
}

export default function SlideViewer({
  pdfKey,
  page,
  onLoaded,
  onSize,
  className,
  fit = "width",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  // 렌더 effect 의존성에 넣지 않으려고 ref로 들고 있는다 (매 렌더 새 함수일 수 있어서)
  const onSizeRef = useRef(onSize);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);
  // 어느 pdfKey에 대한 결과인지 같이 들고 있는다. 그래야 키가 바뀐 순간의 "loading"을
  // effect 안에서 동기적으로 setState 하지 않고 렌더에서 바로 계산할 수 있다.
  const [loaded, setLoaded] = useState<{
    key: string;
    status: "ready" | "error";
    errorMsg: string;
  } | null>(null);
  // 컨테이너 크기가 바뀌면(전체화면 전환·창 크기 조절) 다시 렌더해야 흐릿해지지 않는다.
  const [box, setBox] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  const status: "empty" | "loading" | "ready" | "error" = !pdfKey
    ? "empty"
    : loaded?.key === pdfKey
      ? loaded.status
      : "loading";
  const errorMsg = loaded?.key === pdfKey ? loaded.errorMsg : "";

  useEffect(() => {
    onSizeRef.current = onSize;
  });

  // 컨테이너 크기 관찰
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      setBox((prev) =>
        Math.abs(prev.w - rect.width) < 1 && Math.abs(prev.h - rect.height) < 1
          ? prev
          : { w: rect.width, h: rect.height },
      );
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // pdfKey 바뀌면 문서 로드
  useEffect(() => {
    let cancelled = false;
    if (!pdfKey) {
      pdfRef.current = null;
      return;
    }
    (async () => {
      try {
        const bytes = await loadPdf(pdfKey);
        if (!bytes) throw new Error("PDF 데이터를 찾을 수 없어요");
        const pdfjs = await getPdfjs();
        // getDocument가 버퍼를 detach할 수 있으니 복사본 전달
        const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;
        if (cancelled) {
          doc.destroy();
          return;
        }
        pdfRef.current = doc;
        setLoaded({ key: pdfKey, status: "ready", errorMsg: "" });
        onLoaded?.(doc.numPages);
      } catch (e) {
        if (!cancelled) {
          setLoaded({
            key: pdfKey,
            status: "error",
            errorMsg: e instanceof Error ? e.message : String(e),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // onLoaded는 매 렌더 새 함수일 수 있어 의존성에서 제외
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfKey]);

  // page · 문서 준비 상태 · 컨테이너 크기가 바뀌면 렌더
  useEffect(() => {
    const doc = pdfRef.current;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (status !== "ready" || !doc || !canvas || !container) return;

    let cancelled = false;
    (async () => {
      try {
        const pageNo = Math.min(Math.max(1, page), doc.numPages);
        const pdfPage = await doc.getPage(pageNo);
        if (cancelled) return;

        const unscaled = pdfPage.getViewport({ scale: 1 });
        const width = container.clientWidth || unscaled.width;
        const height = container.clientHeight;
        const scale =
          fit === "contain" && height > 0
            ? Math.min(width / unscaled.width, height / unscaled.height)
            : width / unscaled.width;

        const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
        const viewport = pdfPage.getViewport({ scale: scale * dpr });

        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${viewport.width / dpr}px`;
        canvas.style.height = `${viewport.height / dpr}px`;
        onSizeRef.current?.(viewport.width / dpr, viewport.height / dpr);

        renderTaskRef.current?.cancel();
        const task = pdfPage.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = task;
        await task.promise;
      } catch (e) {
        // 렌더 취소는 정상 흐름 — 무시
        if (
          e &&
          typeof e === "object" &&
          "name" in e &&
          (e as { name: string }).name === "RenderingCancelledException"
        )
          return;
      }
    })();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
    };
  }, [page, status, fit, box]);

  // 문서 정리
  useEffect(() => {
    return () => {
      pdfRef.current?.destroy();
    };
  }, []);

  const placeholder = "flex aspect-video w-full items-center justify-center rounded-xl";

  return (
    <div
      ref={containerRef}
      className={className ?? "w-full"}
      // 전체화면에서는 캔버스를 가운데로
      style={fit === "contain" ? { display: "flex", alignItems: "center", justifyContent: "center" } : undefined}
    >
      {status === "empty" && (
        <div className={`${placeholder} border border-dashed border-line-strong text-mute`}>
          아직 슬라이드(PDF)가 없어요
        </div>
      )}
      {status === "loading" && (
        <div className={`${placeholder} bg-gardenia text-mute`}>슬라이드 불러오는 중…</div>
      )}
      {status === "error" && (
        <div className={`${placeholder} bg-rosetan/15 text-rosetan`}>
          불러오기 실패: {errorMsg}
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={
          status === "ready"
            ? fit === "contain"
              // 어두운 덱이면 무대 배경과 경계가 안 보여서 얇은 테두리를 준다
              ? "block rounded-lg ring-1 ring-white/15"
              : "block w-full rounded-lg"
            : "hidden"
        }
      />
    </div>
  );
}
