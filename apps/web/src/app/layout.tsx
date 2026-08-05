import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { QueryProvider } from "@/components/query-provider";
import { PwaRegister } from "@/components/pwa-register";
import { LanguageSwitcher } from "@/components/language-switcher";
import { I18nProvider } from "@/lib/i18n";
import "./globals.css";
import "./branding.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteIcon = "/logo_nobg.png?v=31f7d33";

export const metadata: Metadata = {
  title: "Synk — Find time. Together.",
  description: "Availability polling and meeting scheduling made effortless.",
  applicationName: "Synk",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      {
        url: siteIcon,
        type: "image/png",
        sizes: "499x499",
      },
    ],
    shortcut: siteIcon,
    apple: [
      {
        url: siteIcon,
        type: "image/png",
        sizes: "499x499",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#4197ff",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <I18nProvider>
          <QueryProvider>{children}</QueryProvider>
          <LanguageSwitcher />
        </I18nProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
