import type { Metadata } from 'next';
import { MIN_SIGNUP_AGE, PRIVACY_VERSION } from '@/lib/legal/documents';
import LegalDoc, { Section, Todo } from '../LegalDoc';

export const metadata: Metadata = { title: '개인정보처리방침 — ClassFlow' };

const cell = 'border border-line px-3 py-2 align-top';

// 개인정보처리방침 초안 (LEGAL-01·02). 실제 DB 규칙(202611200001~0010)에 맞춰 적었다. 확정·전문가 검토 전.
export default function PrivacyPage() {
  return (
    <LegalDoc title="개인정보처리방침" version={PRIVACY_VERSION} draft={PRIVACY_VERSION.endsWith('-draft')}>
      <Section title="1. 모으는 정보와 쓰는 곳">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead><tr className="bg-cream text-ink"><th className={cell}>언제</th><th className={cell}>무엇을</th><th className={cell}>왜</th><th className={cell}>언제까지</th></tr></thead>
            <tbody>
              <tr><td className={cell}>로그인</td><td className={cell}>구글·네이버가 주는 이메일, 이름(별명), 계정 식별값, 로그인 시각</td><td className={cell}>본인 확인, 로그인 유지</td><td className={cell}>탈퇴할 때까지</td></tr>
              <tr><td className={cell}>가입</td><td className={cell}>닉네임, 만 {MIN_SIGNUP_AGE}세 이상 확인·약관·처리방침 동의 기록(판·시각)</td><td className={cell}>결과물·댓글에 이름 표시, 동의 증거</td><td className={cell}>탈퇴할 때까지</td></tr>
              <tr><td className={cell}>결과물·댓글</td><td className={cell}>올린 이미지·링크·제목·소개, 댓글, 좋아요</td><td className={cell}>다른 사람에게 보여 주기</td><td className={cell}>지울 때까지(지운 결과물은 30일 뒤 완전 삭제, 안 쓰이는 이미지는 하루 뒤 삭제)</td></tr>
              <tr><td className={cell}>신고·운영</td><td className={cell}>신고 사유·내용, 업로드 정지 기록</td><td className={cell}>문제 콘텐츠 처리, 도배 방지</td><td className={cell}><Todo>처리 후 보관 기간</Todo></td></tr>
              <tr><td className={cell}>실시간 수업</td><td className={cell}>수업에 들어갈 때 적은 이름(실명 아니어도 됨), 퀴즈·투표 응답</td><td className={cell}>수업 진행</td><td className={cell}><Todo>수업 기록 보관 기간</Todo></td></tr>
            </tbody>
          </table>
        </div>
        <p>필요 없는 정보는 받지 않아요. 결과물 사진에 개인정보가 찍히지 않게 올리기 화면에서 안내해요.</p>
      </Section>
      <Section title={`2. 만 ${MIN_SIGNUP_AGE}세 미만`}>
        <p>만 {MIN_SIGNUP_AGE}세 미만은 가입할 수 없어요. 가입한 사실을 알게 되면 그 계정과 정보를 지워요. 가입하지 않고 보기만 할 때는 개인정보를 받지 않아요.</p>
      </Section>
      <Section title="3. 맡기는 곳(처리 위탁·국외 이전)">
        <ul className="list-disc pl-5">
          <li>Supabase(미국 회사) — 회원·결과물 데이터베이스와 이미지 저장. 저장 위치는 서울(ap-northeast-2) <Todo>운영용 프로젝트도 서울로 만들 것, 회사 쪽 접근에 따른 국외 이전 표기 여부</Todo></li>
          <li>Vercel — 웹사이트 운영(접속 기록) <Todo>서버 위치와 국외 이전 항목</Todo></li>
          <li>Google·네이버 — 로그인(각 회사의 처리방침을 따름)</li>
        </ul>
        <p>위 목적 밖으로 다른 곳에 주지 않아요. 법에 따라 요청이 있을 때는 예외예요.</p>
      </Section>
      <Section title="4. 지우는 방법">
        <p>보관 기간이 끝나거나 탈퇴하면 바로 지워요. 이미지 파일은 매일 한 번 도는 정리 작업이 지워요. 백업에 남은 정보는 <Todo>백업 보관 기간</Todo> 안에 함께 지워져요.</p>
      </Section>
      <Section title="5. 내 정보에 대한 권리">
        <p>내 정보를 보거나 고치거나 지워 달라고 하거나, 처리를 멈춰 달라고 할 수 있어요. 닉네임은 마이페이지에서 바꾸고, 결과물·댓글은 직접 고치거나 지울 수 있어요. <b className="text-ink">마이페이지 &gt; 탈퇴하기</b>로 모든 정보를 바로 지울 수 있어요(유코스토어 구매 기록이 있으면 구매 기록과 로그인 계정은 법정 보관 기간 동안 남아요). 그 밖의 요청: <Todo>요청 창구</Todo></p>
      </Section>
      <Section title="6. 쿠키">
        <p>로그인을 유지하려고 쿠키를 써요. 광고·분석용 쿠키는 쓰지 않아요. <Todo>분석 도구를 붙이면 여기에 추가</Todo></p>
      </Section>
      <Section title="7. 개인정보 보호책임자">
        <p><Todo>이름·연락처</Todo></p>
      </Section>
      <Section title="8. 바뀌면">
        <p>처리방침을 바꾸면 적용 전에 알리고 다시 동의를 받아요. 시행일: <Todo>정식 시행일</Todo></p>
      </Section>
    </LegalDoc>
  );
}
