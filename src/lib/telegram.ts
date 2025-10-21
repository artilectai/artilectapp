export const tg = (typeof window !== "undefined" ? (window as any).Telegram?.WebApp : undefined) as any;

export function initTelegramUI() {
  const webApp = (typeof window !== 'undefined' ? (window as any).Telegram?.WebApp : undefined) as any;
  if (!webApp) return;
  const apply = () => {
    try { webApp.ready?.(); } catch {}
    try { webApp.expand?.(); } catch {}
    // Be permissive: if requestFullscreen exists, call it; version checks vary by client
    try { if (typeof webApp.requestFullscreen === 'function') { webApp.requestFullscreen(); } } catch {}
    try { webApp.disableVerticalSwipes?.(); } catch {}
    try { webApp.enableClosingConfirmation?.(); } catch {}
    try { webApp.setHeaderColor?.('secondary_bg_color'); } catch {}
    try { webApp.setBackgroundColor?.('#0b0f10'); } catch {}
  };
  apply();
  // Re-apply on common lifecycle events
  const onVis = () => apply();
  const onFocus = () => apply();
  try {
    webApp.onEvent?.('viewportChanged', () => {
      try { webApp.expand?.(); } catch {}
      try { if (typeof webApp.requestFullscreen === 'function' && !webApp.isFullscreen) { webApp.requestFullscreen(); } } catch {}
      apply();
    });
  } catch {}
  try {
    webApp.onEvent?.('fullscreenChanged', () => {
      try {
        if (!webApp.isFullscreen && typeof webApp.requestFullscreen === 'function') {
          webApp.requestFullscreen();
        }
      } catch {}
    });
  } catch {}
  try { document.addEventListener('visibilitychange', onVis); } catch {}
  try { window.addEventListener('focus', onFocus); } catch {}
  // Expose a manual trigger for debugging
  try { (window as any).__tgApply = apply; } catch {}
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
