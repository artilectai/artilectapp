import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import VisualEditsMessenger from "../visual-edits/VisualEditsMessenger";
import ErrorReporter from "@/components/ErrorReporter";
import { Toaster } from "@/components/ui/sonner";
import Script from "next/script";
import I18nClientInit from "@/i18n-client";
import I18nProvider from "@/i18n/I18nProvider";
import TelegramBridge from "@/components/TelegramBridge";
import TelegramBootstrap from "@/components/TelegramBootstrap";
import ViewportHeightFix from "@/components/ViewportHeightFix";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
  title: "ArtiLect - Your AI-Powered Life Assistant",
  description: "Manage your tasks, finances, and workouts with AI assistance in English, Russian, and Uzbek",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover" as const,
  // Keep layout stable when the on-screen keyboard appears
  interactiveWidget: 'overlays-content' as const,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
  {/* Add a runtime class to <body> only in Telegram environment to scope full-height styles */}
  <body className="antialiased app-frame" data-env="web">
          {/* Early Telegram bootstrap to force full-screen and disable collapse before hydration */}
          <Script id="tg-early-expand" strategy="beforeInteractive">
            {`
              (function(){
                // Detect Telegram environment; do nothing on normal web so browser UI (tabs, window chrome) stays visible.
                var isTg = !!(window.Telegram && window.Telegram.WebApp);
                if(!isTg){
                  try { document.body?.setAttribute('data-env','web'); } catch(e){}
                  return; // exit early: no forced fullscreen
                }
                try { document.body?.setAttribute('data-env','telegram'); document.documentElement.classList.add('tg-env'); } catch(e){}
                var tries = 0;
                function apply(){
                  try {
                    var tg = window.Telegram && window.Telegram.WebApp; if(!tg) return false;
                    try{ tg.ready && tg.ready(); }catch(e){}
                    try{ tg.expand && tg.expand(); }catch(e){}
                    // Only request explicit fullscreen inside Telegram host; never in normal browser context
                    try{ if (typeof tg.isVersionAtLeast === 'function' && tg.isVersionAtLeast('8.0') && typeof tg.requestFullscreen === 'function' && !tg.isFullscreen) { tg.requestFullscreen(); } }catch(e){}
                    try{ tg.disableVerticalSwipes && tg.disableVerticalSwipes(); }catch(e){}
                    try{ tg.enableClosingConfirmation && tg.enableClosingConfirmation(); }catch(e){}
                    try{ tg.setHeaderColor && tg.setHeaderColor('secondary_bg_color'); }catch(e){}
                    return true;
                  } catch(e) { return false; }
                }
                apply();
                var iv = setInterval(function(){ tries++; if (apply() || tries > 20) { clearInterval(iv); } }, 150);
                function re(){ apply(); }
                window.addEventListener('focus', re, { passive: true });
                document.addEventListener('visibilitychange', re, { passive: true });
                try { if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.onEvent) {
                  window.Telegram.WebApp.onEvent('viewportChanged', re);
                  window.Telegram.WebApp.onEvent('fullscreenChanged', function(){ try { var tg = window.Telegram && window.Telegram.WebApp; if (tg && !tg.isFullscreen && typeof tg.requestFullscreen === 'function') { tg.requestFullscreen(); } } catch(e){} });
                }} catch(e){}
              })();
            `}
          </Script>
          <I18nClientInit />
          <Suspense fallback={null}>
            <TelegramBridge />
          </Suspense>
          <TelegramBootstrap />
          <ViewportHeightFix />
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
          <Analytics />
      </body>
    </html>
  );
}