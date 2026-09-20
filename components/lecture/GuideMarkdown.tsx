// 실습 안내문(마크다운)을 화면에 그린다.
//
// 교안이 쓰는 문법만 다룬다 — 제목(##·###), 글머리표, 번호 목록, 표, 코드 블록,
// 굵게, 인라인 코드. 라이브러리를 쓰지 않는 이유는 HTML을 그대로 심지 않기 위해서다.
// 나중에 강사가 직접 안내문을 쓰게 되면 그 글이 곧 남의 화면에 뜨는데,
// React가 글자를 그대로 이스케이프해 주면 그 경로로 스크립트가 들어올 일이 없다.

import { Fragment, ReactNode } from "react";
import Image from "next/image";

// 안내문 이미지는 우리가 public/samples/guides 에 넣어둔 것만 띄운다.
// 바깥 주소를 그대로 그리면, 나중에 강사가 안내문을 직접 쓰게 됐을 때
// 학생 화면이 남의 서버로 요청을 보내게 된다.
const IMAGE = /^!\[([^\]]*)\]\((\/samples\/guides\/[\w.-]+)\)$/;

/** `**굵게**` 와 `` `코드` `` 만 처리한다 */
function inline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong>;
    }
    if (/^`[^`]+`$/.test(part)) {
      return (
        <code key={i} className="rounded bg-gardenia px-1.5 py-0.5 font-mono text-[0.9em] text-mocha-deep">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function cells(row: string): string[] {
  return row.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
}

export default function GuideMarkdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 코드 블록 — 안쪽은 건드리지 않는다
    if (line.startsWith("```")) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) body.push(lines[i++]);
      i += 1;
      out.push(
        <pre key={out.length} className="overflow-x-auto rounded-xl bg-ink px-4 py-3.5 text-sm leading-6 text-white/90">
          <code>{body.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // 표 — 헤더 줄 다음에 |---|---| 구분선이 오는 것만 표로 본다
    if (line.startsWith("|") && /^\|[\s:|-]+\|$/.test(lines[i + 1] ?? "")) {
      const head = cells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith("|")) rows.push(cells(lines[i++]));
      out.push(
        <div key={out.length} className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {head.map((c, n) => (
                  <th key={n} className="border-b border-line-strong px-3 py-2 text-left font-semibold text-ink">
                    {inline(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, n) => (
                <tr key={n}>
                  {row.map((c, m) => (
                    <td key={m} className="border-b border-line px-3 py-2 align-top text-ink-soft">{inline(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // 캡처 — 한 줄에 홀로 있는 것만 이미지로 본다
    const picture = IMAGE.exec(line.trim());
    if (picture) {
      out.push(
        <figure key={out.length} className="overflow-hidden rounded-xl border border-line bg-paper">
          <Image
            src={picture[2]}
            alt={picture[1]}
            width={1400}
            height={900}
            unoptimized
            className="h-auto w-full"
          />
          {picture[1] && (
            <figcaption className="border-t border-line px-4 py-2.5 text-xs text-mute">
              {picture[1]}
            </figcaption>
          )}
        </figure>,
      );
      i += 1;
      continue;
    }

    if (line.startsWith("# ")) {
      out.push(<h1 key={out.length} className="pb-3 text-2xl font-bold text-ink">{inline(line.slice(2))}</h1>);
      i += 1;
      continue;
    }
    if (line.startsWith("### ")) {
      out.push(<h3 key={out.length} className="pt-2 text-base font-bold text-ink">{inline(line.slice(4))}</h3>);
      i += 1;
      continue;
    }
    if (line.startsWith("## ")) {
      out.push(
        <h2 key={out.length} className="border-b border-line pb-2 pt-4 text-lg font-bold text-ink">
          {inline(line.slice(3))}
        </h2>,
      );
      i += 1;
      continue;
    }

    // 번호 목록.
    // 중간에 그림이나 들여쓴 설명이 끼면 목록이 한 번 끊긴다. 그때 새로 여는 <ol>에
    // start를 주지 않으면 번호가 1부터 다시 시작한다 — 「Step 3의 7번」 같은 안내가 어긋난다.
    const numberedAt = /^(\d+)\.\s+(.*)$/.exec(line);
    if (numberedAt) {
      const start = Number(numberedAt[1]);
      const items: { text: string; sub: string[] }[] = [];
      while (i < lines.length) {
        const item = /^(\d+)\.\s+(.*)$/.exec(lines[i]);
        if (item) {
          items.push({ text: item[2], sub: [] });
          i += 1;
          continue;
        }
        // 들여쓴 글머리표는 바로 위 항목에 딸린 설명이다
        const sub = /^\s+[-*]\s+(.*)$/.exec(lines[i]);
        if (sub && items.length > 0) {
          items[items.length - 1].sub.push(sub[1]);
          i += 1;
          continue;
        }
        break;
      }
      out.push(
        <ol key={out.length} start={start} className="space-y-1.5 pl-5 text-ink-soft list-decimal marker:text-mute">
          {items.map((item, n) => (
            <li key={n} className="leading-7">
              {inline(item.text)}
              {item.sub.length > 0 && (
                <ul className="mt-1 space-y-1 pl-5 text-sm list-disc marker:text-mute">
                  {item.sub.map((s, m) => <li key={m} className="leading-6">{inline(s)}</li>)}
                </ul>
              )}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    // 글머리표 목록 — 이어지는 줄을 한 덩어리로 모은다
    const bullet = /^[-*]\s+/;
    if (bullet.test(line)) {
      const items: string[] = [];
      while (i < lines.length && bullet.test(lines[i])) items.push(lines[i++].replace(bullet, ""));
      out.push(
        <ul key={out.length} className="space-y-1.5 pl-5 text-ink-soft list-disc marker:text-mute">
          {items.map((item, n) => <li key={n} className="leading-7">{inline(item)}</li>)}
        </ul>,
      );
      continue;
    }

    if (!line.trim()) {
      i += 1;
      continue;
    }

    // 나머지는 문단 — 빈 줄이 나올 때까지 모은다
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(\s*[-*]\s|```|\d+\.\s|#{1,3}\s|\||!\[)/.test(lines[i])) {
      para.push(lines[i++]);
    }
    // 지원하지 않는 이미지·표 문법도 한 줄 소비해야 무한 루프가 생기지 않는다.
    if (!para.length) para.push(lines[i++]);
    out.push(
      <p key={out.length} className="leading-7 text-ink-soft">{inline(para.join(" "))}</p>,
    );
  }

  return <div className="space-y-3">{out}</div>;
}
