'use client';
// 결과물 올리기 폼: 이미지(GAL-01b) · 링크·미리보기(GAL-01c) · 개인정보 안내(GAL-08). 이미지·링크 없이 글만 올려도 된다.
import { useActionState, useCallback, useState } from 'react';
import ImagePicker, { type PickedImage } from '@/components/gallery/ImagePicker';
import { BODY_MAX, MAX_LINKS, TITLE_MAX, linkLabel, parseLink } from '@/lib/gallery/model';
import { submitPost } from '../../../actions';

const inputClass = 'mt-1.5 w-full rounded-xl border border-line-strong bg-paper px-3.5 py-2.5 text-[15px] text-ink outline-none focus:border-mocha';

export default function NewPostForm({ slug, accessKey, lesson, author }: { slug: string; accessKey: string | null; lesson: number; author: string }) {
  const [state, action, pending] = useActionState(submitPost, {});
  const [images, setImages] = useState<PickedImage[]>([]);
  const [links, setLinks] = useState<string[]>(['']);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const onImages = useCallback((picked: PickedImage[]) => setImages(picked), []);
  const e = state.errors ?? {};

  // 입력하는 동안 바로 보여 주는 링크 검사(빈 칸은 건너뜀). 서버가 같은 규칙으로 다시 확인한다.
  const checked = links.map((l) => (l.trim() ? parseLink(l) : null));
  const goodLinks = [...new Set(checked.flatMap((c) => (c?.ok ? [c.value] : [])))];
  const linkError = checked.some((c) => c && !c.ok);
  const textOnly = images.length === 0 && goodLinks.length === 0;
  const ready = title.trim() && (!textOnly || body.trim()) && !linkError;

  return (
    <form action={action} className="grid gap-6">
      <input type="hidden" name="slug" value={slug} />
      {accessKey && <input type="hidden" name="key" value={accessKey} />}
      <input type="hidden" name="lesson" value={lesson} />
      <input type="hidden" name="images" value={JSON.stringify(images.map((i) => i.path))} />

      {/* GAL-08 개인정보 안내: 이미지 고르기 바로 위, 눈에 띄게 */}
      <aside className="rounded-2xl border border-mocha bg-mocha-tint px-4 py-3.5 text-sm leading-relaxed text-mocha-deep">
        <p className="font-semibold">올리기 전에 꼭 확인해 주세요 🔒</p>
        <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
          <li>스크린샷에 <b>API 키 · 비밀번호 · 토큰</b>이 보이지 않나요?</li>
          <li><b>이메일 · 전화번호 · 실명 · 주소</b>가 찍혀 있지 않나요?</li>
          <li>올린 결과물은 이 강의를 보는 <b>다른 사람도 볼 수 있어요.</b></li>
        </ul>
        <p className="mt-1.5 text-xs">보이면 가리고 다시 캡처해 주세요. 실수로 올렸다면 바로 지우거나 강사에게 알려 주세요.</p>
      </aside>

      <div>
        <p className="block text-sm font-medium text-ink">이미지 <span className="text-mute">(선택, 4장까지)</span></p>
        <div className="mt-1.5"><ImagePicker onChange={onImages} error={e.images} /></div>
      </div>

      <div>
        <p className="block text-sm font-medium text-ink">링크 <span className="text-mute">(선택, {MAX_LINKS}개까지 — 배포 주소·GitHub·노션 등)</span></p>
        <div className="mt-1.5 grid gap-2">
          {links.map((l, i) => (
            <div key={i}>
              <div className="flex gap-2">
                <input
                  name="link" value={l} inputMode="url" autoComplete="off" spellCheck={false} maxLength={500}
                  aria-label={`링크 ${i + 1}`} placeholder="https://github.com/내아이디/프로젝트"
                  onChange={(ev) => setLinks((all) => all.map((x, k) => (k === i ? ev.target.value : x)))}
                  className={inputClass + ' mt-0 min-w-0 flex-1 font-mono text-sm'}
                />
                {links.length > 1 && (
                  <button type="button" aria-label={`링크 ${i + 1} 빼기`} onClick={() => setLinks((all) => all.filter((_, k) => k !== i))}
                    className="rounded-xl border border-line-strong px-3 text-sm text-mute hover:border-mocha hover:text-mocha">×</button>
                )}
              </div>
              {(checked[i] && !checked[i]!.ok) || e[`links.${i}`] ? (
                <p className="mt-1 text-xs text-mocha-deep">{checked[i] && !checked[i]!.ok ? checked[i]!.message : e[`links.${i}`]}</p>
              ) : null}
            </div>
          ))}
          {links.length < MAX_LINKS && (
            <button type="button" onClick={() => setLinks((all) => [...all, ''])} className="justify-self-start text-sm text-mocha underline-offset-4 hover:underline">
              + 링크 추가
            </button>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-ink">제목</label>
        <input id="title" name="title" required maxLength={TITLE_MAX} value={title} onChange={(ev) => setTitle(ev.target.value)}
          placeholder="예: 나만의 RPG 캐릭터" className={inputClass} />
        <p className={`mt-1 text-xs ${e.title ? 'text-mocha-deep' : 'text-mute'}`}>{e.title ?? `${[...title].length}/${TITLE_MAX}자`}</p>
      </div>

      <div>
        <label htmlFor="body" className="block text-sm font-medium text-ink">소개 <span className="text-mute">{textOnly ? '(글만 올릴 땐 꼭 적어 주세요)' : '(선택)'}</span></label>
        <textarea id="body" name="body" rows={4} maxLength={BODY_MAX} value={body} onChange={(ev) => setBody(ev.target.value)}
          placeholder="무엇을 만들었는지, 어디가 재밌었는지 적어 주세요." className={inputClass} />
        <p className={`mt-1 text-xs ${e.body ? 'text-mocha-deep' : 'text-mute'}`}>{e.body ?? `${[...body].length}/${BODY_MAX}자`}</p>
      </div>

      {/* GAL-01c 미리보기: 다른 사람에게 보일 모습 */}
      <section aria-label="미리보기">
        <p className="eyebrow">미리보기 — 다른 사람에게 이렇게 보여요</p>
        <article className="mt-2 max-w-xs overflow-hidden rounded-2xl border border-line bg-paper">
          {images.length > 0 ? (
            <div className={`grid gap-0.5 ${images.length > 1 ? 'grid-cols-2' : ''}`}>
              {images.map((img, i) => (
                // eslint-disable-next-line @next/next/no-img-element -- Storage 공개 주소
                <img key={img.path} src={img.url} alt={`미리보기 이미지 ${i + 1}`} className="aspect-[4/3] w-full bg-cream object-cover" />
              ))}
            </div>
          ) : goodLinks.length > 0 ? (
            <div className="grid aspect-[4/3] place-items-center bg-cream px-4 text-center text-sm text-mute">🔗 {linkLabel(goodLinks[0])}</div>
          ) : null}
          <div className="px-4 py-3">
            <p className="font-medium text-ink">{title.trim() || '제목'}</p>
            <p className="mt-0.5 text-xs text-mute">{author}</p>
            {body.trim() && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{body.trim()}</p>}
            {goodLinks.length > 0 && (
              <ul className="mt-2 grid gap-1">
                {goodLinks.map((l) => <li key={l} className="truncate text-sm text-mocha-deep underline underline-offset-2">🔗 {linkLabel(l)}</li>)}
              </ul>
            )}
          </div>
        </article>
      </section>

      {state.message && <p role="alert" className="rounded-xl bg-mocha-tint px-4 py-3 text-sm text-mocha-deep">{state.message}</p>}
      <button disabled={pending || !ready}
        className="w-full rounded-2xl bg-ink px-6 py-4 text-base font-semibold text-white transition-colors hover:bg-mocha-deep disabled:opacity-40">
        {pending ? '올리는 중…' : '결과물 올리기'}
      </button>
      {!ready && !pending && <p className="-mt-3 text-center text-xs text-mute">{linkError ? '빨간 안내가 있는 링크를 고쳐 주세요.' : '제목과 함께 이미지·링크·소개 중 하나를 넣어 주세요.'}</p>}
    </form>
  );
}
