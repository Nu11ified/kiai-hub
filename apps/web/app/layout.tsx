import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kiai Hub — Kendo Event Management",
  description:
    "Free platform for organizing kendo events worldwide. Seminars, taikais, shinsa, and more.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        {children}
      </body>
    </html>
  );
}
