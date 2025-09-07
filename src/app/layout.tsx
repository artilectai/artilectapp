import type { Metadata } from "next";
import "./globals.css";
import VisualEditsMessenger from "../visual-edits/VisualEditsMessenger";
import ErrorReporter from "@/components/ErrorReporter";
import { Toaster } from "@/components/ui/sonner";
import Script from "next/script";
import I18nClientInit from "@/i18n-client";
import I18nProvider from "@/i18n/I18nProvider";
import TelegramBridge from "@/components/TelegramBridge";

export const metadata: Metadata = {
  title: "ArtiLect - Your AI-Powered Life Assistant",
  description: "Manage your tasks, finances, and workouts with AI assistance in English, Russian, and Uzbek",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
          <I18nClientInit />
          <TelegramBridge />
          <ErrorReporter />
          <Script
            src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/scripts//route-messenger.js"
            strategy="afterInteractive"
            data-target-origin="*"
            data-message-type="ROUTE_CHANGE"
            data-include-search-params="true"
            data-only-in-iframe="true"
            data-debug="true"
            data-custom-data='{"appName": "ArtiLect", "version": "2.1.0", "greeting": "hi"}'
          />
          <I18nProvider>
            {children}
          </I18nProvider>
          <Toaster
            position="top-center"
            theme="dark"
            closeButton
            toastOptions={{
              style: { marginTop: "calc(env(safe-area-inset-top) + 8px)" },
              classNames: {
                toast: "z-[100] bg-card border border-border text-foreground shadow-xl",
                description: "text-muted-foreground",
              },
            }}
          />
          <VisualEditsMessenger />
      </body>
    </html>
  );
}