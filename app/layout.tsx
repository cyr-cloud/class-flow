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
  title: "ClassFlow",
  description: "강의 슬라이드를 함께 넘기고, 실습 결과물을 모으는 수업 도구",
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
