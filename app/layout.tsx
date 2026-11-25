import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import DebugBanner from "@/components/layout/DebugBanner";

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
  metadataBase: new URL("https://sc-toolkit.vercel.app"),

  title: {
    default: "Fantasy King",
    template: "%s | Fantasy King",
  },

  description:
    "Fantasy AFL tools including price projections, cash cows, live scores and trade planning.",

  applicationName: "Fantasy King",

  icons: {
    icon: [
      {
        url: "/favicon.ico",
      },
      {
        url: "/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: "/favicon-48x48.png",
        sizes: "48x48",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/apple-touch-icon-180x180.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },

  manifest: "/site.webmanifest",

  openGraph: {
    type: "website",
    siteName: "Fantasy King",
    title: "Fantasy King",
    description:
      "Fantasy AFL tools including price projections, cash cows, live scores and trade planning.",
    images: [
      {
        url: "/images/branding/fantasy-king-logo-full.png",
        width: 1200,
        height: 630,
        alt: "Fantasy King",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: "Fantasy King",
    description:
      "Fantasy AFL tools including price projections, cash cows, live scores and trade planning.",
    images: ["/images/branding/fantasy-king-logo-full.png"],
  },

  appleWebApp: {
    capable: true,
    title: "Fantasy King",
    statusBarStyle: "black-translucent",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <DebugBanner />
        {children}
      </body>
    </html>
  );
}