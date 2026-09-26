import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.CHAT_LOCAL_DATA ? '.next-chat' : '.next',
  // 로컬 변환의 동적 파일 경로가 시험 자료/환경 파일을 배포 번들로 끌어들이지 않게 한다.
  outputFileTracingExcludes: {
    "/*": ["./.classflow/**", "./.env*", "./output/**", "./convert-server/**", "./chat-server/**", "./tests/**", "./scripts/**", "./*.pptx"],
  },
  // 샘플 교안·안내문·발표자 노트는 readFileSync로 경로를 만들어 읽는다.
  // Next가 그걸 추적하지 못해 배포 번들에서 빠지므로 직접 포함시킨다.
  outputFileTracingIncludes: {
    "/api/live/[sessionId]": ["./data/samples/**"],
    "/api/extract-quiz": ["./data/samples/*.json"],
  },
};

export default nextConfig;
