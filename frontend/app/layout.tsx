import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css"


const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "InterviewAce — AI Mock Interview Coach",
  description: "Practice interviews with real-time AI feedback on your answers, eye contact, and posture.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* face-api.js loaded via CDN — runs browser-side only.
            Models are fetched from the face-api.js GitHub weights CDN.
            No video data ever leaves the browser. */}
        <Script
          src="https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js"
          strategy="beforeInteractive"
        />
        {children}
      </body>
    </html>
  );
}