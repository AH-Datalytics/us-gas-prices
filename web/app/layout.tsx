import type { Metadata } from "next";
import TopBar from "@/components/TopBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "US Energy Explorer \u2014 AH Datalytics",
  description: "Explore U.S. electricity grid operations, national energy trends, and gas prices with data from the EIA.",
  openGraph: {
    title: "US Energy Explorer \u2014 AH Datalytics",
    description: "Explore U.S. electricity grid operations, national energy trends, and gas prices with data from the EIA.",
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
