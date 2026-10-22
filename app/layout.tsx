import type { Metadata } from "next";
import { bodyFont, headingFont } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://creator-authenticity-checker.vercel.app"), // for the link-preview image
  title: "Collabgram",
  description: "Collabgram: find genuine influencers for your brand, with authenticity scores and reasons",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${headingFont.variable} ${bodyFont.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
