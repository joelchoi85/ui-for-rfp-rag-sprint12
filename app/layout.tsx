import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NLP of Legend",
  description: "나라장터 입찰공고를 자연어로 찾고, 고른 공고에 대해 근거와 함께 묻는다.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // 글꼴은 globals.css 의 @font-face 가 잡는다. next/font 를 안 쓴다 —
  // 빌드 단계 하나를 없애자고 고른 것이고, 실제로 next/font 캐시가 깨져 한 번 막혔다.
  // 다크 모드는 tokens.css 의 prefers-color-scheme 이 알아서 한다. 토글은 아직 없다.
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
