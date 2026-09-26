import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans_KR } from "next/font/google";
import AppHeader from "@/components/AppHeader";
import "./globals.css";

// 한글이 본문의 대부분이라 한글 자체가 좋은 산세리프를 본문 서체로 쓴다.
const sansKr = Noto_Sans_KR({
  variable: "--font-sans-kr",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://class-flow-fawn.vercel.app"),
  title: "ClassFlow — 보여주는 수업에서, 함께하는 수업으로",
  description: "AI 퀴즈, 실시간 참여, 실습 공유까지. 강사와 학생이 같은 슬라이드에서 함께하는 수업을 시작하세요.",
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "ClassFlow",
    title: "ClassFlow — 보여주는 수업에서, 함께하는 수업으로",
    description: "AI 퀴즈 · 실시간 참여 · 실습 공유. 가입 없이 샘플 수업을 체험해 보세요.",
    images: [{ url: "/classflow-share.png", width: 1672, height: 941, alt: "ClassFlow — AI 퀴즈, 실시간 참여, 실습 공유" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "ClassFlow — 보여주는 수업에서, 함께하는 수업으로",
    description: "AI 퀴즈 · 실시간 참여 · 실습 공유",
    images: ["/classflow-share.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${sansKr.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <AppHeader />
        {/* 본문이 짧은 화면에서도 저작권 줄이 바닥에 붙도록 flex-1 */}
        <div className="flex-1">{children}</div>
        <footer className="mt-12 border-t border-line px-6 py-6 text-center text-xs text-mute">
          © {new Date().getFullYear()} YuniqCoding
        </footer>
      </body>
    </html>
  );
}
