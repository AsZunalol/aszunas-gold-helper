import type { Metadata } from "next";
import "./globals.css";
import Script from "next/script";
import Navbar from "@/components/Navbar";

export const metadata: Metadata = {
  title: "AsZuna's Gold Helper | WoW Gold Guides",
  description:
    "Curated World of Warcraft gold-making guides for all expansions. Clean, tested, and easy to follow.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-slate-950">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        {/* Global navbar */}
        <Navbar />

        {/* Page content */}
        <main>{children}</main>

        {/* Wowhead tooltip config */}
        <Script id="wowhead-tooltips-config" strategy="beforeInteractive">
          {`
            var whTooltips = {
              colorLinks: true,
              iconizeLinks: true,
              renameLinks: true
            };
          `}
        </Script>

        {/* Wowhead tooltip script */}
        <Script
          id="wowhead-tooltips-script"
          src="https://wow.zamimg.com/widgets/power.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
