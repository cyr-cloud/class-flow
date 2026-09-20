export type OnboardingRole = "teacher" | "student";
export type GuideStep = {
  label: string; title: string; description: string; image: string; alt: string;
  size?: [number, number];
  callouts: { label: string; detail: string; from: [number, number]; to: [number, number] }[];
  tip: string;
};
export const onboardingSteps: Record<OnboardingRole, GuideStep[]> = {
  teacher: [
    {
      label: "수업 준비", title: "준비된 샘플로 먼저 열어보세요",
      description: "자료 준비 없이 실제 강의 61장과 퀴즈·실습을 체험할 수 있어요. 내 자료는 PDF로 업로드해 학생과 함께 볼 수 있습니다.",
      image: "teacher-quiz.png", alt: "강사 화면 상단의 샘플 버튼과 슬라이드 아래 퀴즈·실습 추가 버튼",
      callouts: [
        { label: "샘플 시작", detail: "상단 ‘샘플’을 누르면 슬라이드·퀴즈·실습가이드가 함께 열려요.", from: [56, 9], to: [71, 15] },
        { label: "참여 요소 추가", detail: "원하는 슬라이드에 퀴즈 문항이나 실습 게시판을 직접 붙일 수도 있어요.", from: [51, 25], to: [46, 36] }
      ],
      tip: "‘PDF 업로드’로 내 자료를 올리거나, ‘샘플’로 준비된 수업을 체험해 보세요."
    },
    {
      label: "AI 퀴즈", title: "강의 대본을 AI 퀴즈로 바꿔요",
      description: "PPT 제목은 퀴즈·실습 위치를 찾는 단서, 발표자 노트는 문항을 만드는 재료예요. AI가 현재 슬라이드의 제목과 대본을 읽어 질문·선택지·정답을 생성합니다.",
      image: "teacher-ai.png", alt: "샘플 5쪽에서 AI로 퀴즈 만들기를 눌러 실제 생성된 문항",
      callouts: [
        { label: "대본으로 생성", detail: "‘AI로 퀴즈 만들기’를 누르세요. 샘플에는 대본이 포함되어 바로 체험할 수 있어요.", from: [53, 37], to: [35, 55] },
        { label: "생성 결과 확인", detail: "슬라이드 아래에 생성된 문제를 확인한 뒤 수업에 활용하세요.", from: [75, 55], to: [50, 65] }
      ],
      tip: "AI 퀴즈는 발표자 노트가 포함된 PPT에서만 사용할 수 있어요. 현재는 대본이 준비된 샘플에서 체험할 수 있고, 직접 올린 PDF에서는 퀴즈를 수동으로 추가해 주세요."
    },
    {
      label: "학생 초대", title: "링크 하나로 같은 수업에 모여요",
      description: "화면 아래의 학생 입장 링크를 공유하거나 상단의 참여 코드를 알려주세요. 학생이 입장하면 강사가 넘기는 슬라이드를 함께 봅니다.",
      image: "teacher-share.png", alt: "학생 입장 링크와 복사 버튼, 상단 강사 학생 전환",
      callouts: [
        { label: "학생 링크 복사", detail: "‘복사’를 눌러 학생에게 전달하세요. 가입이나 설치 없이 참여합니다.", from: [66, 59], to: [84, 71] },
        { label: "혼자 체험할 때", detail: "상단 ‘학생’으로 전환하면 같은 수업을 학생 입장에서 볼 수 있어요.", from: [39, 11], to: [24, 4] }
      ],
      tip: "혼자 테스트할 때는 강사 화면과 학생 입장 링크를 각각 다른 탭에 열면 변화가 더 잘 보여요."
    },
    {
      label: "응답 확인", title: "답변은 실시간으로, 정답은 원할 때",
      description: "퀴즈 슬라이드로 이동하면 학생 화면에도 문제가 나타나요. 학생이 선택한 응답이 강사 화면에 모이고, 공개 버튼으로 정답 확인 시점을 정합니다.",
      image: "teacher-results.png", alt: "학생 1명의 응답이 반영되고 정답이 공개된 강사 퀴즈 화면",
      callouts: [
        // This capture is scrolled differently from teacher-quiz.png; anchor to its own controls.
        { label: "응답 집계", detail: "참여 인원과 선택지별 응답 수가 자동으로 갱신돼요.", from: [66, 57], to: [83.4, 66.8] },
        { label: "정답 공개·숨기기", detail: "정답을 공개하면 학생도 정답을 확인해요. 공개 중에는 답 변경이 마감됩니다.", from: [56, 40], to: [73.8, 50] }
      ],
      tip: "샘플 20쪽에서 먼저 퀴즈를 체험해 보세요. 화면의 수치는 캡처 당시 테스트 응답입니다."
    },
    {
      label: "발표·실습", title: "설명하고, 직접 해보고, 함께 확인해요",
      description: "‘전체화면 발표’에서는 슬라이드를 크게 띄우고 판서할 수 있어요. 실습 슬라이드의 참여 패널에서는 가이드와 결과물을 바로 열어봅니다.",
      image: "teacher-present.png", size: [1722, 1034], alt: "전체화면 발표의 하단 판서 도구와 오른쪽 실습 참여 패널",
      callouts: [
        { label: "판서 도구", detail: "펜·형광펜·화살표·도형으로 설명할 부분을 강조하세요.", from: [36, 76], to: [36, 90] },
        { label: "실습 이어가기", detail: "실습가이드와 결과물을 수업 화면 안에서 열어 확인합니다.", from: [84, 32], to: [82, 11.6] }
      ],
      tip: "나가기(ESC)로 강사 화면에 돌아올 수 있어요. 사용법은 화면 상단에서 언제든 다시 열 수 있습니다."
    }
  ],
  student: [
    {
      label: "입장·따라가기", title: "코드로 입장하면 준비 끝이에요",
      description: "강사님에게 받은 링크를 열거나 첫 화면에서 참여 코드를 입력하세요. 강사님이 슬라이드를 넘기면 내 화면도 자동으로 따라갑니다.",
      image: "student-join.png", alt: "첫 화면 학생 카드의 참여 코드 입력칸과 입장 버튼",
      callouts: [
        { label: "참여 코드 입력", detail: "학생 카드에 강사님이 알려주신 코드를 입력해 주세요.", from: [64, 80], to: [64, 64] },
        { label: "입장", detail: "‘입장’을 누르면 수업에 연결돼요. 별도 회원가입이나 설치는 필요 없어요.", from: [85, 80], to: [83, 64] }
      ],
      tip: "이미 학생 화면에 들어왔다면 입장은 완료된 상태예요. 휴대폰에서도 같은 링크로 참여할 수 있어요."
    },
    {
      label: "퀴즈 참여", title: "선택지를 누르면 답이 전달돼요",
      description: "퀴즈가 있는 슬라이드에서는 화면 아래로 내려 문제를 풀어보세요. 별도 제출 버튼 없이 선택한 답이 바로 전송됩니다.",
      image: "student-quiz.png", alt: "학생이 두 번째 선택지를 선택하고 응답 저장 안내가 표시된 화면",
      callouts: [
        { label: "답 선택", detail: "문항에 맞는 선택지를 누르세요. 복수 선택 문제라면 여러 개를 고를 수 있어요.", from: [73, 36], to: [60, 50] },
        { label: "저장 상태 확인", detail: "‘응답이 저장됐어요’가 나오면 완료! 정답 공개 전까지 답을 바꿀 수 있어요.", from: [52, 82], to: [28, 71] }
      ],
      tip: "강사님이 정답을 공개하면 내 선택과 정답을 함께 확인할 수 있어요."
    },
    {
      label: "실습 가이드", title: "실습은 안내를 보며 차근차근",
      description: "실습 슬라이드 아래 ‘실습가이드 보러가기’를 누르면 목표와 단계별 설명이 열려요. 안내를 따라 직접 작업해 보세요.",
      image: "student-guide.png", alt: "실습가이드의 목표와 단계별 안내, 상단 결과물 탭과 수업으로 버튼",
      callouts: [
        { label: "가이드 읽기", detail: "아래로 스크롤하며 단계별 설명과 예시 화면을 확인해요.", from: [79, 57], to: [52, 65] },
        { label: "결과물 탭", detail: "완료했다면 ‘결과물’ 탭에서 예시를 보고 내 결과를 올릴 수 있어요.", from: [37, 23], to: [18, 15] }
      ],
      tip: "오른쪽 위 ‘수업으로’를 누르면 강사님과 함께 보는 슬라이드로 돌아가요."
    },
    {
      label: "결과물 공유", title: "내가 해낸 것을 캡처해서 올려요",
      description: "결과물 탭의 ‘결과물 올리기’를 눌러 작업 화면을 첨부하세요. 무엇을 했는지, 어디서 막혔는지도 함께 적으면 좋아요.",
      image: "student-submit.png", size: [1280, 720], alt: "결과물 등록 창의 이름, 화면 캡처 고르기, 설명, 올리기 버튼",
      callouts: [
        { label: "화면 캡처 첨부", detail: "이름은 비워두면 익명으로 표시돼요. 실습 결과 화면을 선택하세요.", from: [73, 21], to: [49, 39] },
        { label: "설명 후 올리기", detail: "한두 줄 설명을 적고 ‘올리기’를 누르면 같은 수업의 게시판에 공유돼요.", from: [57, 83], to: [33, 66] }
      ],
      tip: "결과물은 리스트 또는 갤러리로 볼 수 있어요. 안내가 필요하면 학생 화면의 ‘사용법’을 다시 열어보세요."
    }
  ]
};
