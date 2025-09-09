"use client";
import { useEffect } from "react";
import { tg } from "@/lib/telegram";

export default function ViewportHeightFix() {
  useEffect(() => {
    const webApp: any = tg || (typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : undefined);
    const set = () => {
      const h = (webApp && webApp.viewportHeight) || window.innerHeight;
      document.documentElement.style.setProperty("--tgvh", `${h}px`);
    };
    set();
    try { webApp?.onEvent?.("viewportChanged", set); } catch {}
    return () => { try { webApp?.offEvent?.("viewportChanged", set); } catch {} };
  }, []);
  return null;
}
