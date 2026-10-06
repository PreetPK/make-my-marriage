import type { Metadata } from "next";
import type { ReactNode } from "react";
import { env } from "@/server/config/env";
import { jakarta, playfair } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(env.APP_URL),
  title: "Make My Marriage",
  description: "A place for your wedding plans and memories.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${jakarta.variable} ${playfair.variable}`}>
      <body>{children}</body>
    </html>
  );
}
