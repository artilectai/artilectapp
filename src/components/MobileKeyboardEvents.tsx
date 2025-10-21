"use client";
import { useEffect } from "react";

/**
 * Listens for mobile container keyboard events when available (e.g., Cordova/Capacitor/Ionic hosts)
 * and exposes the keyboard height via a CSS var --kb-offset. Also adjusts body padding-bottom
 * outside Telegram environments to avoid content being obscured.
 */
export default function MobileKeyboardEvents() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    const isTelegram = root.classList.contains('tg-env');

    const getHeight = (e: any) => {
      const h = e?.keyboardHeight ?? e?.detail?.keyboardHeight ?? e?.detail ?? 0;
      return typeof h === 'number' && isFinite(h) ? Math.max(0, Math.round(h)) : 0;
    };

    const onShow = (e: Event) => {
      // Use provided keyboard height when available; fallback to 250px for generic hosts
      const raw = getHeight(e);
      const h = raw > 0 ? raw : 250;
      try { root.style.setProperty('--kb-offset', `${h}px`); } catch {}
      // Only add body padding on generic web containers; Telegram body is pinned already.
      if (!isTelegram) {
        try { document.body.style.paddingBottom = `${h}px`; } catch {}
      }
    };
    const onHide = () => {
      try { root.style.removeProperty('--kb-offset'); } catch {}
      if (!isTelegram) {
        try { document.body.style.paddingBottom = ''; } catch {}
      }
    };

    window.addEventListener('keyboardDidShow', onShow as any);
    window.addEventListener('keyboardDidHide', onHide as any);
    return () => {
      window.removeEventListener('keyboardDidShow', onShow as any);
      window.removeEventListener('keyboardDidHide', onHide as any);
      onHide();
    };
  }, []);

  return null;
}
