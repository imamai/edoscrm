import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "EDOS CRM", template: "%s · EDOS CRM" },
  description: "Complaint management and workflow platform.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
