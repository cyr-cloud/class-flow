'use client';
// 결과물 올리기 폼 (GAL-01b: 이미지). 링크 입력·미리보기·개인정보 안내는 GAL-01c·GAL-08에서.
import { useActionState, useCallback, useState } from 'react';
import ImagePicker from '@/components/gallery/ImagePicker';
import { BODY_MAX, TITLE_MAX } from '@/lib/gallery/model';
import { submitPost } from '../../../actions';

const inputClass = 'mt-1.5 w-full rounded-xl border border-line-strong bg-paper px-3.5 py-2.5 text-[15px] text-ink outline-none focus:border-mocha';

export default function NewPostForm({ slug, accessKey, lesson }: { slug: string; accessKey: string | null; lesson: number }) {
  const [state, action, pending] = useActionState(submitPost, {});
  const [images, setImages] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const onImages = useCallback((paths: string[]) => setImages(paths), []);
  const e = state.errors ?? {};

  return (
    <form action={action} className="grid gap-6">
      <input type="hidden" name="slug" value={slug} />
      {accessKey && <input type="hidden" name="key" value={accessKey} />}
      <input type="hidden" name="lesson" value={lesson} />
      <input type="hidden" name="images" value={JSON.stringify(images)} />

      <div>
        <p className="block text-sm font-medium text-ink">이미지 <span className="text-mute">(1~4장)</span></p>
        <div className="mt-1.5"><ImagePicker onChange={onImages} error={e.images} /></div>
      </div>

      <div>
        <label htmlFor="title" className="block text-sm font-medium text-ink">제목</label>
        <input id="title" name="title" required maxLength={TITLE_MAX} value={title} onChange={(ev) => setTitle(ev.target.value)}
          placeholder="예: 나만의 RPG 캐릭터" className={inputClass} />
        <p className={`mt-1 text-xs ${e.title ? 'text-mocha-deep' : 'text-mute'}`}>{e.title ?? `${[...title].length}/${TITLE_MAX}자`}</p>
      </div>

      <div>
        <label htmlFor="body" className="block text-sm font-medium text-ink">소개 <span className="text-mute">(선택)</span></label>
        <textarea id="body" name="body" rows={4} maxLength={BODY_MAX} value={body} onChange={(ev) => setBody(ev.target.value)}
          placeholder="무엇을 만들었는지, 어디가 재밌었는지 적어 주세요." className={inputClass} />
        <p className={`mt-1 text-xs ${e.body ? 'text-mocha-deep' : 'text-mute'}`}>{e.body ?? `${[...body].length}/${BODY_MAX}자`}</p>
      </div>

      {state.message && <p role="alert" className="rounded-xl bg-mocha-tint px-4 py-3 text-sm text-mocha-deep">{state.message}</p>}
      <button disabled={pending || images.length === 0 || !title.trim()}
        className="w-full rounded-2xl bg-ink px-6 py-4 text-base font-semibold text-white transition-colors hover:bg-mocha-deep disabled:opacity-40">
        {pending ? '올리는 중…' : '결과물 올리기'}
      </button>
    </form>
  );
}
