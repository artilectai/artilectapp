"use client";

import { useEffect } from "react";

export function useTelegramBack(active: boolean, onBack: () => void) {
  useEffect(() => {
    const tg = (typeof window !== 'undefined') ? (window as any)?.Telegram?.WebApp : undefined;
    if (!tg) return;

    try { tg.ready?.(); } catch {}

    const handler = () => onBack();

    if (active) {
      try { tg.BackButton?.show?.(); } catch {}
      // Bind handler via SDK (new/backward compat)
      try {
        if (tg.BackButton?.onClick) tg.BackButton.onClick(handler);
        else tg.onEvent?.("backButtonClicked", handler);
      } catch {}

      // so Android system back works too
      try { history.pushState({ wa: true }, ""); } catch {}
      const pop = () => onBack();
      window.addEventListener("popstate", pop);

      return () => {
        try { tg.BackButton?.hide?.(); } catch {}
        try {
          if (tg.BackButton?.offClick) tg.BackButton.offClick(handler);
          else tg.offEvent?.("backButtonClicked", handler);
        } catch {}
        window.removeEventListener("popstate", pop);
      };
    } else {
      try { tg.BackButton?.hide?.(); } catch {}
    }
  }, [active, onBack]);
}
