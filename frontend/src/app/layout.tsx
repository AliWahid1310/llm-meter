import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LLM Meter — Usage Metering & Billing Dashboard",
  description: "Enterprise metering, quota enforcement, and AI token billing platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
