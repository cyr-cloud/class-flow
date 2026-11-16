'use client';
// 관리자 강의·차시 화면의 폼 조각들 (COURSE-01b · COURSE-02)
import { useActionState, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { CHANNELS, VISIBILITIES, suggestSlug, type Course, type Lesson } from '@/lib/course/model';
import { addLesson, saveCourse, saveLesson, type FormState } from './actions';

export const inputClass =
  'mt-1.5 w-full rounded-xl border border-line-strong bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-mocha disabled:opacity-60';
const labelClass = 'block text-sm font-medium text-ink';
const primary = 'rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-mocha-deep disabled:opacity-50';

function Field({ label, name, error, hint, children }: { label: string; name: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={name} className={labelClass}>{label}</label>
      {children}
      {error ? <p className="mt-1 text-xs text-mocha-deep">{error}</p> : hint ? <p className="mt-1 text-xs text-mute">{hint}</p> : null}
    </div>
  );
}

function Status({ state }: { state: FormState }) {
  if (!state.message) return null;
  return <p role="status" className={`text-sm ${state.saved ? 'text-tendril' : 'text-mocha-deep'}`}>{state.message}</p>;
}

export function CourseForm({ course }: { course?: Course }) {
  const [state, action, pending] = useActionState(saveCourse, {});
  const [slug, setSlug] = useState(course?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(!!course);
  const e = state.errors ?? {};
  return (
    <form action={action} className="grid gap-5">
      {course && <input type="hidden" name="id" value={course.id} />}
      <Field label="강의 이름" name="title" error={e.title}>
        <input
          id="title" name="title" required maxLength={80} defaultValue={course?.title} className={inputClass}
          onChange={(ev) => { if (!slugTouched) setSlug(suggestSlug(ev.target.value)); }}
        />
      </Field>
      <Field label="주소" name="slug" error={e.slug} hint={`/courses/${slug || '주소'} — 영문 소문자·숫자·하이픈. 공개 후에는 바꾸지 않는 게 좋아요(링크·QR이 깨져요).`}>
        <input
          id="slug" name="slug" required maxLength={60} value={slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" className={inputClass}
          onChange={(ev) => { setSlugTouched(true); setSlug(ev.target.value.toLowerCase()); }}
        />
      </Field>
      <Field label="소개" name="description" error={e.description} hint="강의 소개 페이지 맨 위에 보여요. 2000자까지.">
        <textarea id="description" name="description" rows={4} maxLength={2000} defaultValue={course?.description} className={inputClass} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="채널" name="channel" error={e.channel}>
          <select id="channel" name="channel" defaultValue={course?.channel ?? 'youtube'} className={inputClass}>
            {Object.entries(CHANNELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="공개 범위" name="visibility" error={e.visibility}>
          <select id="visibility" name="visibility" defaultValue={course?.visibility ?? 'draft'} className={inputClass}>
            {Object.entries(VISIBILITIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
      </div>
      <Field label="강의 링크 (유튜브 재생목록·인프런 강의 주소)" name="external_url" error={e.external_url}>
        <input id="external_url" name="external_url" type="url" placeholder="https://" defaultValue={course?.external_url ?? ''} className={inputClass} />
      </Field>
      <Field label="표지 이미지 주소" name="cover_url" error={e.cover_url} hint="비워도 돼요. 이미지 올리기는 갤러리 업로드와 함께 붙일 예정이에요.">
        <input id="cover_url" name="cover_url" type="url" placeholder="https://" defaultValue={course?.cover_url ?? ''} className={inputClass} />
      </Field>
      <div className="flex items-center gap-4">
        <button disabled={pending} className={primary}>{pending ? '저장 중…' : course ? '강의 저장' : '강의 만들기'}</button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function AddLessonForm({ courseId, nextNumber }: { courseId: string; nextNumber: number }) {
  const [state, action, pending] = useActionState(addLesson, {});
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="course_id" value={courseId} />
      <div className="min-w-0 flex-1">
        <label htmlFor="new-lesson" className={labelClass}>{nextNumber}차시 추가</label>
        <input id="new-lesson" name="title" required maxLength={80} placeholder="차시 제목" className={inputClass} />
      </div>
      <button disabled={pending} className={primary}>{pending ? '추가 중…' : '추가'}</button>
      <div className="basis-full"><Status state={state} /></div>
    </form>
  );
}

export function LessonForm({ lesson }: { lesson: Lesson }) {
  const [state, action, pending] = useActionState(saveLesson, {});
  const [guide, setGuide] = useState(lesson.guide_md);
  const e = state.errors ?? {};
  return (
    <form action={action} className="grid gap-5">
      <input type="hidden" name="id" value={lesson.id} />
      <input type="hidden" name="course_id" value={lesson.course_id} />
      <Field label="차시 제목" name="title" error={e.title}>
        <input id="title" name="title" required maxLength={80} defaultValue={lesson.title} className={inputClass} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="짧은 코드" name="short_code" error={e.short_code} hint="공유 링크 /p/코드 에 쓰여요. 예: py03 (비워도 돼요)">
          <input id="short_code" name="short_code" maxLength={16} pattern="[a-z0-9]{3,16}" defaultValue={lesson.short_code ?? ''} className={inputClass} />
        </Field>
        <Field label="예시 이미지 주소" name="example_image_url" error={e.example_image_url}>
          <input id="example_image_url" name="example_image_url" type="url" placeholder="https://" defaultValue={lesson.example_image_url ?? ''} className={inputClass} />
        </Field>
      </div>
      <div>
        <p className={labelClass}>실습 안내 (마크다운)</p>
        <div className="mt-1.5 grid gap-3 lg:grid-cols-2">
          <textarea
            id="guide_md" name="guide_md" aria-label="실습 안내 마크다운" rows={18} maxLength={20000}
            value={guide} onChange={(ev) => setGuide(ev.target.value)}
            placeholder={'## 오늘 만들 것\n- 변수에 이름을 담고 출력하기\n\n## 올릴 것\n실행 화면 캡처 1장'}
            className={inputClass + ' mt-0 font-mono leading-relaxed'}
          />
          <div className="guide-markdown min-h-40 overflow-auto rounded-xl border border-line bg-cream px-4 py-3 text-sm leading-relaxed text-ink">
            <p className="eyebrow mb-2">미리보기</p>
            {guide.trim() ? <ReactMarkdown>{guide}</ReactMarkdown> : <p className="text-mute">왼쪽에 쓰면 학생에게 보일 모습이 여기에 나와요.</p>}
          </div>
        </div>
        {e.guide_md && <p className="mt-1 text-xs text-mocha-deep">{e.guide_md}</p>}
      </div>
      <div className="flex items-center gap-4">
        <button disabled={pending} className={primary}>{pending ? '저장 중…' : '차시 저장'}</button>
        <Status state={state} />
      </div>
    </form>
  );
}

export function ConfirmButton({ label, message, className }: { label: string; message: string; className?: string }) {
  return (
    <button
      className={className ?? 'text-sm text-mute hover:text-mocha-deep'}
      onClick={(ev) => { if (!window.confirm(message)) ev.preventDefault(); }}
    >
      {label}
    </button>
  );
}
