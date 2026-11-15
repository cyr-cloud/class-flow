<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# ClassFlow 작업 규칙

- 작업 시작 전 `docs/development-checklist.md`(완료 상태 기준)와 `docs/functional-spec.md`(요구사항)를 읽는다. TASKS.md는 따로 만들지 않는다.
- 작업 하나가 끝날 때마다 검증하고 체크리스트 항목을 `- [x]`로 바꾼다. 미완료·미검증·외부 설정 대기는 체크하지 않는다.
- 완료한 항목 ID·변경 내용·검증 결과를 `WORKLOG.md`에 짧게 남긴다.
- 최종 답변에는 완료한 항목과 다음 우선 작업 한 개를 제안한다. 제안만으로 착수하지 않는다.

## 노션 개발 기록

- `project-workflow-log` 스킬을 따른다. `PROJECT.md`의 노션 프로젝트 페이지를 재사용한다.
- 프로젝트 페이지 바로 아래 `YYYY-MM-DD` 날짜 페이지(하루 하나)에 그날 모든 작업을 모은다. 작업마다 번호순 따라 하기 · 실제 캡처 · 검증 · 완료 상태 · 다음 순서를 쓴다.
- 캡처 원본은 `generated/worklog/YYYY-MM-DD/<작업ID>/`(git 제외). 비밀 키·개인정보는 가린다. 기능 완료와 기록 미완료를 구별한다.
