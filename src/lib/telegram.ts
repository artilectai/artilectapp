export const tg = (typeof window !== "undefined" ? (window as any).Telegram?.WebApp : undefined) as any;

export function initTelegramUI() {
  const webApp = (typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : undefined) as any;
  if (!webApp) return;
  try { webApp.ready?.(); } catch {}
  try { webApp.expand?.(); } catch {}
  try { webApp.disableVerticalSwipes?.(); } catch {}
  try { webApp.enableClosingConfirmation?.(); } catch {}
  try { webApp.setHeaderColor?.('secondary_bg_color'); } catch {}
  try { webApp.setBackgroundColor?.('#0b0f10'); } catch {}
}

/** Open the Telegram support chat (defaults to @artilectsupport) using the best available method. */
export function openTelegramSupport(username: string = 'artilectsupport') {
  const webUrl = `https://t.me/${username}`;
  // Prefer Telegram WebApp API when available (inside Telegram)
  try {
    const webApp = (typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : undefined) as any;
    if (webApp && typeof webApp.openTelegramLink === 'function') {
      webApp.openTelegramLink(webUrl);
      return;
    }
  } catch {}
  // Try tg:// deep link first; fallback to https if blocked
  try {
    if (typeof window !== 'undefined') {
      (window.location as any).href = `tg://resolve?domain=${username}`;
      setTimeout(() => { try { window.location.href = webUrl; } catch {} }, 500);
      return;
    }
  } catch {}
  if (typeof window !== 'undefined') {
    try { window.location.href = webUrl; } catch {}
  }
}
