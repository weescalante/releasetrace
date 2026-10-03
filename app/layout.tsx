import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://watchleaks.com"),

  title: {
    default: "Watch Leaks",
    template: "%s | Watch Leaks",
  },

  description:
    "Track theatrical, digital, physical, streaming, and unauthorized availability across film and television.",

  openGraph: {
    type: "website",
    siteName: "Watch Leaks",
    title: "Watch Leaks",
    description:
      "Track theatrical, digital, physical, streaming, and unauthorized availability across film and television.",
  },

  twitter: {
    card: "summary_large_image",
    title: "Watch Leaks",
    description:
      "Track theatrical, digital, physical, streaming, and unauthorized availability across film and television.",
  },

  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}