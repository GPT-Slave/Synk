import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { QueryProvider } from "@/components/query-provider";
import { CursorHalo } from "@/components/cursor-halo";
import { PwaRegister } from "@/components/pwa-register";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { I18nProvider } from "@/lib/i18n";
import "./globals.css";
import "./branding.css";
import "./theme.css";
import "./performance.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteIcon = "/logo_nobg.png?v=31f7d33";
const themeInitializationScript = `
  (function () {
    try {
      var storedTheme = window.localStorage.getItem("synk-theme");
      var theme = storedTheme === "light" ? "light" : "dark";
      var root = document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(theme);
      root.dataset.theme = theme;
      root.style.colorScheme = theme;
    } catch (_) {
      document.documentElement.classList.add("dark");
      document.documentElement.dataset.theme = "dark";
    }
  })();
`;

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
  themeColor: [
    { color: "#f7f9fc", media: "(prefers-color-scheme: light)" },
    { color: "#080d18", media: "(prefers-color-scheme: dark)" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />
      </head>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <I18nProvider>
          <QueryProvider>{children}</QueryProvider>
          <CursorHalo />
          <ThemeToggle />
          <LanguageSwitcher />
        </I18nProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
