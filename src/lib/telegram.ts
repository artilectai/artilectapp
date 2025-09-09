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
