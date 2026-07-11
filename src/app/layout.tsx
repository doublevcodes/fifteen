import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Barlow_Condensed, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const display = Barlow_Condensed({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Fifteen — Delay Repay for London commuters",
  description:
    "Detect train delays and generate Delay Repay compensation claims for SWR, Southern, and Southeastern.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable} h-full`}>
      <body className="min-h-full antialiased">
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
}
