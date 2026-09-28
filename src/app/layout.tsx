import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";

// The stylesheet has always declared Inter; nothing was loading it, so the
// app rendered in whatever sans-serif the machine happened to have.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

// Public pages only — see globals.css.
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });

export const metadata: Metadata = {
  title: { default: "EDOS CRM — every complaint, answered and accounted for", template: "%s · EDOS CRM" },
  description:
    "EDOS CRM captures every complaint, gives it an owner and a clock, drives it to a root cause and a fix, and shows you what keeps coming back.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  );
}
