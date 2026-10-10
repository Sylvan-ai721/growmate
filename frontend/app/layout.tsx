import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GrowMate",
  description: "\u9762\u5411\u666e\u901a KOC \u7684\u793e\u5a92\u589e\u957f\u667a\u80fd\u4f53\u6f14\u793a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
