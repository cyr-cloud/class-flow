import type { Metadata } from 'next';
import { MIN_SIGNUP_AGE, TERMS_VERSION } from '@/lib/legal/documents';
import LegalDoc, { Section, Todo } from '../LegalDoc';

export const metadata: Metadata = { title: '이용약관 — ClassFlow' };

// 이용약관 초안 (LEGAL-03). 확정·전문가 검토 전.
export default function TermsPage() {
  return (
    <LegalDoc title="이용약관" version={TERMS_VERSION} draft={TERMS_VERSION.endsWith('-draft')}>
      <Section title="1. 이 약관이 하는 일">
        <p>ClassFlow(이하 &quot;서비스&quot;)는 강의 실습 안내를 보고, 실습 결과물을 올려 함께 보는 공간이에요. 이 약관은 서비스를 쓰는 사람과 운영자 사이의 약속이에요.</p>
        <p>운영자: <Todo>상호·대표자·연락처</Todo></p>
      </Section>
      <Section title="2. 가입">
        <p>구글·네이버 계정으로 로그인하고 닉네임을 정하면 가입이 끝나요. <b className="text-ink">만 {MIN_SIGNUP_AGE}세 이상만 가입할 수 있어요.</b> 가입할 때 만 {MIN_SIGNUP_AGE}세 이상임을 확인받아요.</p>
        <p>만 {MIN_SIGNUP_AGE}세 미만이 가입한 것을 알게 되면 계정과 관련 정보를 지울 수 있어요. 가입하지 않아도 공개된 강의 안내와 결과물은 볼 수 있어요.</p>
      </Section>
      <Section title="3. 올리는 결과물·댓글">
        <p>결과물(이미지·링크·글)과 댓글은 그 강의를 볼 수 있는 다른 사람에게 보여요. 올린 내용의 권리는 올린 사람에게 있고, 서비스는 그 내용을 이 서비스 안에서 보여 주는 데에만 써요.</p>
        <p>한 차시에 하루 3개, 댓글은 하루 50개까지 올릴 수 있어요. 본인이 올린 것은 고치거나 지울 수 있어요. 지운 결과물은 바로 안 보이고 30일 뒤 완전히 지워져요.</p>
      </Section>
      <Section title="4. 하면 안 되는 일">
        <ul className="list-disc pl-5">
          <li>남의 저작물을 허락 없이 올리기, 남의 개인정보(이메일·전화번호·얼굴 등)를 올리기</li>
          <li>욕설·괴롭힘·차별, 광고·도배, 불법이거나 해로운 내용</li>
          <li>API 키·비밀번호 같은 비밀값을 올리기(본인 피해를 막기 위해 숨길 수 있어요)</li>
          <li>운영자나 다른 사람인 척하기, 서비스를 망가뜨리려는 시도</li>
        </ul>
      </Section>
      <Section title="5. 신고와 운영자 조치">
        <p>누구든 문제가 있는 결과물·댓글을 신고할 수 있어요. 서로 다른 3명이 신고하면 자동으로 숨겨지고, 운영자가 확인해 다시 보이게 하거나 지워요.</p>
        <p>약관을 어기면 운영자는 내용을 숨기거나 지우고, 결과물·댓글 올리기를 정지(7일·30일·풀 때까지)할 수 있어요. 정지돼도 보기·좋아요는 할 수 있어요.</p>
        <p>저작권·명예훼손·사생활 침해 신고: <Todo>신고 받는 메일 주소와 처리 기간</Todo></p>
      </Section>
      <Section title="6. 탈퇴">
        <p>탈퇴하면 계정과 올린 결과물·댓글·좋아요가 지워져요. 탈퇴 방법: <Todo>탈퇴 화면 또는 요청 창구</Todo></p>
      </Section>
      <Section title="7. 책임의 범위">
        <p>서비스는 무료로 제공되고, 점검·장애로 잠시 쓸 수 없을 수 있어요. 다른 사람이 올린 링크로 이동한 바깥 사이트는 운영자가 책임지지 않아요. <Todo>책임 제한 문구 전문가 검토</Todo></p>
      </Section>
      <Section title="8. 유료 기능과 환불">
        <p>지금은 유료 기능이 없어요. 강의나 AI 기능을 판매하게 되면, 결제 전에 가격·제공 기간·<b className="text-ink">환불 기준(기간·수강 진도에 따른 환불 금액과 계산 예시)</b>을 따로 안내하고 동의를 받아요.</p>
      </Section>
      <Section title="9. 약관 변경">
        <p>약관을 바꾸면 적용하기 전에 서비스에 알리고, 바뀐 판에 다시 동의를 받아요. 시행일: <Todo>정식 시행일</Todo></p>
      </Section>
    </LegalDoc>
  );
}
