'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { hasBackActions, peekBackAction } from '@/lib/telegram-backstack';

// A small bridge that:
// - Initializes Telegram WebApp on mount
// - Tracks client-side navigation depth in sessionStorage
// - Shows Telegram BackButton (replacing Close) when depth > 1
// - Navigates back on back button click, otherwise Close remains available
export default function TelegramBridge() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const backHandlerRef = useRef<(() => void) | null>(null);

  // Helper: apply Telegram guards repeatedly (idempotent)
  const applyTgGuards = () => {
    const tg = (window as any)?.Telegram?.WebApp as any;
    if (!tg) return false;
    try {
      tg.ready?.();
      tg.expand?.();
      tg.disableVerticalSwipes?.();
      tg.enableClosingConfirmation?.();
      return true;
    } catch {
      return false;
    }
  };

  // Note: Avoid global touch guards that can block content scrolling; rely on Telegram guards.

  // Initialize Telegram WebApp
  useEffect(() => {
    // First attempt immediately
    applyTgGuards();

    // Re-apply a few times shortly after mount (covers late SDK availability)
    let attempts = 0;
    const interval = window.setInterval(() => {
      attempts += 1;
      const ok = applyTgGuards();
      if (ok || attempts > 10) {
        window.clearInterval(interval);
      }
    }, 250);

    // Re-apply when viewport changes (e.g., iOS safe-area / Telegram expanding)
    const tg = (window as any)?.Telegram?.WebApp as any;
    const handleViewportChanged = () => {
      applyTgGuards();
    };
    try { tg?.onEvent?.('viewportChanged', handleViewportChanged); } catch {}

    // Re-apply on tab visibility/focus changes
    const handleVis = () => applyTgGuards();
    const handleFocus = () => applyTgGuards();
    document.addEventListener('visibilitychange', handleVis);
    window.addEventListener('focus', handleFocus);

    return () => {
      try { tg?.offEvent?.('viewportChanged', handleViewportChanged); } catch {}
  document.removeEventListener('visibilitychange', handleVis);
  window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Manage BackButton visibility and behavior based on history depth and backstack
  useEffect(() => {
  const tg = (window as any)?.Telegram?.WebApp as any;
    if (!tg) return;

    const key = 'tg_history_stack_v1';
    const current = pathname + (searchParams?.toString() ? `?${searchParams.toString()}` : '');

    // Read stack
    let stack: string[] = [];
    try {
      stack = JSON.parse(sessionStorage.getItem(key) || '[]');
    } catch {
      stack = [];
    }

    // Update stack
    const last = stack[stack.length - 1];
    const prev = stack[stack.length - 2];
    if (!stack.length) {
      stack = [current];
    } else if (current === last) {
      // no-op
    } else if (current === prev) {
      // navigated back, pop last
      stack.pop();
    } else {
      // forward navigation
      stack.push(current);
    }

    sessionStorage.setItem(key, JSON.stringify(stack));

    // Toggle BackButton
    const canGoBack = stack.length > 1 || hasBackActions();
    try {
      if (canGoBack) tg?.BackButton?.show?.(); else tg?.BackButton?.hide?.();
    } catch {}

    // Bind back action
    const handleBack = () => {
      // Prefer handling via top-most back action (e.g., a modal close)
      const top = peekBackAction();
      if (top) {
        try { top(); return; } catch {}
      }
      // Else, go back one step in app history; if cannot, try closing
      try { router.back(); } catch {}
      try { if (stack.length <= 1) tg.close?.(); } catch {}
    };

    // Keep a ref to remove handler if supported
    if (backHandlerRef.current && tg?.BackButton?.offClick) {
      try { tg.BackButton.offClick(backHandlerRef.current); } catch {}
    }
    backHandlerRef.current = handleBack;
    try { tg?.BackButton?.onClick?.(handleBack); } catch {}

    return () => {
      if (backHandlerRef.current && tg?.BackButton?.offClick) {
        try { tg.BackButton.offClick(backHandlerRef.current); } catch {}
      }
    };
  }, [pathname, searchParams, router]);

  return null;
}
