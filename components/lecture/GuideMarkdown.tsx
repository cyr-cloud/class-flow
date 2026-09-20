import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Image from "next/image";

export default function GuideMarkdown({ source }: { source: string }) {
  return <div className="guide-markdown min-w-0 break-words text-ink-soft leading-7">
    <Markdown remarkPlugins={[remarkGfm]} components={{
      img({ src, alt }) {
        const url = typeof src === "string" ? src : "";
        if (!/^\/(api\/image\/[a-z0-9]{8,64}|samples\/guides\/[\w.-]+)$/.test(url)) {
          return <span className="my-3 block rounded-xl border border-dashed border-line-strong p-4 text-sm text-mute">이미지: {alt || "첨부 이미지"} — 편집에서 ‘이미지 넣기’로 파일을 다시 첨부해 주세요.</span>;
        }
        return <Image src={url} alt={alt || "가이드 이미지"} width={1400} height={900} unoptimized className="my-4 h-auto max-w-full rounded-xl border border-line" />;
      },
      table({ children }) { return <div className="my-4 overflow-x-auto"><table>{children}</table></div>; },
      a({ href, children }) { return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>; },
    }}>{source}</Markdown>
  </div>;
}
