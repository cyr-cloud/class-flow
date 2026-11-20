# 클래스플로우 (ClassFlow)

- 이름: 클래스플로우 - 강의 공간 · 갤러리
- 경로: `C:\Users\rkdld\Desktop\yuniqcoding\class-flow-merged`
- 원격: https://github.com/cyr-cloud/class-flow (작업 브랜치 `feature/course-gallery`)
- 완료 기준: `docs/development-checklist.md` · 요구사항: `docs/functional-spec.md`
- 노션 프로젝트: https://www.notion.so/419abd06af53811cab24d024700dbecd
- 노션 상위 허브: https://www.notion.so/0a4b232864bb467186f1a4086ca3eaac (YuniqCoding)
- 날짜 페이지
  - 2026-11-15: https://www.notion.so/419abd06af5381f6a785ed349ffda58e
  - 2026-11-16: https://www.notion.so/41aabd06af5381b9a893e6eb514d35c9
- 노션 기능 페이지(2026-11-20부터 기능 단위 + 처리 날짜):
  - HOME-02·03 (2026-11-20): https://www.notion.so/41eabd06af5381b4ae5af38243612495
  - GAL-01a (2026-11-20): https://www.notion.so/41eabd06af53819f9e12f6d8043b0aad
  - GAL-01b (2026-11-20): https://www.notion.so/41eabd06af5381a28b30c38e16600c77
  - GAL-01c·08 (2026-11-20): https://www.notion.so/41eabd06af538121ad5dd93a3a507531
  - GAL-02 (2026-11-20): https://www.notion.so/41eabd06af5381f0925ce2f5fbd92407
  - GAL-상세 (2026-11-20): https://www.notion.so/41eabd06af53817cbaace3dae62f7213
  - GAL-03 (2026-11-20): https://www.notion.so/41eabd06af5381f1b00dd77ee78e84a3
  - GAL-04 (2026-11-20): https://www.notion.so/41eabd06af53813199b2e62abe29169e
  - GAL-05 (2026-11-20): https://www.notion.so/41eabd06af5381058020f73eb6916097
- 노션 명세: https://www.notion.so/419abd06af5381acb38ec5f2ac476d87
- 계정: 스토어와 같은 Supabase 프로젝트 `yuco-store-dev` (무료 플랜, 사용이 적으면 일시정지됨)

## 실행

```powershell
cd C:\Users\rkdld\Desktop\yuniqcoding\class-flow-merged
npm ci
$env:CLASSFLOW_LOCAL_ONLY='1'; npx next dev --hostname 127.0.0.1 --port 3311
```

검사: `npx tsc --noEmit` · `node --test tests/*.test.mjs` · `npx eslint app components lib`
