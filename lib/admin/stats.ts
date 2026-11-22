// 관리자 현황(ADM-03) 계산. DB 함수(202611220002)가 준 줄을 화면용으로 묶는다. 순수 함수만 둬서 테스트한다.

export interface LessonStatRow {
  course_id: string; course_slug: string; course_title: string; course_visibility: 'draft' | 'unlisted' | 'public';
  lesson_id: string; lesson_number: number; lesson_title: string;
  visible_posts: number; hidden_posts: number; week_posts: number; authors: number; last_post_at: string | null;
}
export interface SignupDay { day: string; classflow: number; accounts: number }
export interface SignupTotals { classflow: number; accounts: number; posters: number }

export interface CourseStats {
  id: string; slug: string; title: string; visibility: LessonStatRow['course_visibility'];
  lessons: LessonStatRow[];
  visible: number; hidden: number; week: number;
  emptyLessons: number;        // 결과물이 하나도 없는 차시 수
  topLesson: number | null;    // 결과물이 가장 많은 차시 번호(같으면 앞 차시)
}

// DB가 강의(최근 것 먼저)·차시 번호 순으로 준 줄을 강의별로 묶는다. 순서는 그대로 둔다.
export function groupByCourse(rows: LessonStatRow[]): CourseStats[] {
  const map = new Map<string, CourseStats>();
  for (const r of rows) {
    let c = map.get(r.course_id);
    if (!c) {
      c = { id: r.course_id, slug: r.course_slug, title: r.course_title, visibility: r.course_visibility, lessons: [], visible: 0, hidden: 0, week: 0, emptyLessons: 0, topLesson: null };
      map.set(r.course_id, c);
    }
    c.lessons.push(r);
    c.visible += r.visible_posts;
    c.hidden += r.hidden_posts;
    c.week += r.week_posts;
    if (r.visible_posts + r.hidden_posts === 0) c.emptyLessons += 1;
  }
  for (const c of map.values()) {
    let best = 0;
    for (const l of c.lessons) {
      if (l.visible_posts > best) { best = l.visible_posts; c.topLesson = l.lesson_number; }
    }
  }
  return [...map.values()];
}

// 최근 n일(오늘 포함) 합. days는 DB가 최근 날짜부터 준다.
export function sumRecent(days: SignupDay[], n: number, key: 'classflow' | 'accounts' = 'classflow'): number {
  return days.slice(0, Math.max(0, n)).reduce((s, d) => s + d[key], 0);
}

// 막대 길이 비율(0~100). 가장 큰 값을 100으로. 값이 있으면 아주 작아도 보이게 최소 4.
export function barPercent(value: number, max: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.max(4, Math.round((value / max) * 100));
}
