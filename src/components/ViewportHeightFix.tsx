"use client";
import { useEffect } from "react";
import { tg } from "@/lib/telegram";

export default function ViewportHeightFix() {
  useEffect(() => {
    const webApp: any = tg || (typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : undefined);
    const set = () => {
      const h = (webApp && (webApp.viewportStableHeight || webApp.viewportHeight)) || window.innerHeight;
      document.documentElement.style.setProperty("--tgvh", `${h}px`);
      try { document.documentElement.style.setProperty("--tg-viewport", `${h}px`); } catch {}
    };
    set();
    try { webApp?.onEvent?.("viewportChanged", set); } catch {}
    return () => { try { webApp?.offEvent?.("viewportChanged", set); } catch {} };
  }, []);
  return null;
}
