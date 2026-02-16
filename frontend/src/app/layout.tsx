// frontend/src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { AuthGate } from "../components/AuthGate";
import { Inter, Noto_Sans_JP } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-jp",
  display: "swap",
});

export const metadata: Metadata = {
  title: "肌管理アプリ（仮）",
  description: "毎日の肌状態を記録・分析するアプリ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className={`${inter.variable} ${notoSansJP.variable}`}>
      <body>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
