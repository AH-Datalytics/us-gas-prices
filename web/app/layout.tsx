import type { Metadata } from "next";
import TopBar from "@/components/TopBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "US Gas Prices \u2014 AH Datalytics",
  description: "County-level gas prices across all 50 states, weekly national trends since 1990, and 18-month EIA forecasts.",
  openGraph: {
    title: "US Gas Prices \u2014 AH Datalytics",
    description: "County-level gas prices across all 50 states, weekly national trends since 1990, and 18-month EIA forecasts.",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=DM+Sans:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col">
        <TopBar />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
