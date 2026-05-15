import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Navbar from "../components/Navbar";
import "./globals.css";
import ConditionalFooter from "../components/ConditionalFooter";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";

const averta = localFont({
  src: [
    {
      path: "../public/fonts/AvertaDemo-Regular.otf",
      weight: "400",
      style: "normal"
    },
    {
      path: "../public/fonts/AvertaDemo-Semibold.otf",
      weight: "600",
      style: "normal"
    },
    {
      path: "../public/fonts/AvertaDemo-Bold.otf",
      weight: "700",
      style: "normal"
    }
  ],
  variable: "--font-averta",
  display: "swap"
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ireland Votes",
  description: "Ireland's new political data hub",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
<html
  lang="en"
  className={`${inter.variable} ${averta.variable} h-full antialiased`}
  suppressHydrationWarning
>
<body
className="h-screen flex flex-col overflow-hidden"
style={{
  background: "var(--bg)",
  color: "var(--text)"
}}
>

        {/* NAVBAR */}
        <Navbar />

{/* MAIN CONTENT */}
<div className="flex-1 flex overflow-hidden">
  {children}
</div>

{/* FOOTER */}
<ConditionalFooter />

        <Analytics />
      </body>
    </html>
  );
}