import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geistSans = Geist({
  variable: "--font-geist-sans",
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
      className={cn("h-full antialiased", geistSans.variable, geistMono.variable, "font-sans")}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
