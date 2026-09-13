// 동기화 계층의 계약(interface).
// 화면 코드는 이 SyncProvider에만 의존한다. 로컬 → Supabase 교체가 화면에 영향 없도록.

// 강사가 조작하고 학생이 구독하는 "세션 실시간 상태".
export interface SessionState {
  currentSlide: number; // 1-based
  totalSlides: number;
  // 현재 로드된 PDF를 식별하는 키. 실제 파일 바이트는 별도 저장소(IndexedDB)에 둔다.
  pdfKey: string | null;
  pdfName: string | null;
  /** 지금 열려 있는 참여요소 문항 id. null이면 닫힌 상태 */
  activeActivityId: string | null;
  /** 강사가 정답을 공개했는지 */
  revealAnswer: boolean;
  updatedAt: number;
}

export const initialSessionState: SessionState = {
  currentSlide: 1,
  totalSlides: 0,
  pdfKey: null,
  pdfName: null,
  activeActivityId: null,
  revealAnswer: false,
  updatedAt: 0,
};

export type Unsubscribe = () => void;

export interface SyncProvider {
  /** 현재 상태 스냅샷 */
  get(): SessionState;
  /** 상태 변경 구독. 즉시 현재값으로 한 번 호출된다. */
  subscribe(listener: (state: SessionState) => void): Unsubscribe;
  /** 상태 일부 갱신 (강사 화면에서 호출). */
  patch(partial: Partial<SessionState>): void;
  /** 정리 */
  dispose(): void;
}
