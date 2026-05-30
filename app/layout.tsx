import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

// DESIGN.md specifies Notion Sans with an Inter fallback chain (D-DS-04). Notion Sans
// is proprietary; Inter is the sanctioned substitute and ships Cyrillic, fixing the
// serif-fallback bug that Geist (no Cyrillic glyphs) caused on Ukrainian headings.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ФОП Документи",
  description: "Внутрішня система обліку платежів і автогенерації актів виконаних робіт.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="uk"
      className={cn("h-full antialiased", inter.variable, geistMono.variable, "font-sans")}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
