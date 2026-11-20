import type { Course } from '@/lib/course/model';

// 관리자·강의 주인이 준비 중 강의를 미리 볼 때, 또는 링크 공개 강의일 때 맨 위에 붙는 안내.
export function VisibilityNote({ course }: { course: Course }) {
  if (course.visibility === 'draft')
    return <p className="rounded-xl border border-mocha bg-mocha-tint px-4 py-2.5 text-sm text-mocha-deep">준비 중인 강의예요. 관리자와 강의 주인에게만 보이는 미리보기예요.</p>;
  if (course.visibility === 'unlisted')
    return <p className="rounded-xl border border-line bg-cream px-4 py-2.5 text-xs text-mute">링크를 받은 사람만 볼 수 있는 강의예요. 링크를 다른 곳에 올리지 말아 주세요.</p>;
  return null;
}
