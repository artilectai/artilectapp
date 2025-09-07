'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';

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
  const touchStartYRef = useRef<number | null>(null);
  const touchTargetRef = useRef<EventTarget | null>(null);

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

  // Helper: find nearest scrollable parent (to decide if a downward swipe would overscroll root)
  const getScrollableParent = (el: Element | null): HTMLElement | null => {
    let node: HTMLElement | null = el as HTMLElement | null;
    while (node && node !== document.body) {
      const style = window.getComputedStyle(node);
      if (/(auto|scroll|overlay)/.test(style.overflowY)) {
        return node;
      }
      node = node.parentElement;
    }
    return null;
  };

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

    // Touch guard: prevent pull-to-dismiss gesture when content is at top and user swipes down
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches && e.touches.length === 1) {
        touchStartYRef.current = e.touches[0].clientY;
        touchTargetRef.current = e.target;
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (touchStartYRef.current == null || e.touches.length !== 1) return;
      const dy = e.touches[0].clientY - touchStartYRef.current;
      if (dy <= 0) return; // not swiping down
      const targetEl = (touchTargetRef.current as Element | null) || null;
      const scrollable = targetEl ? getScrollableParent(targetEl) : null;
      const atTop = !scrollable || (scrollable.scrollTop <= 0);
      if (atTop) {
        // Stop iOS "pull down to dismiss" from engaging
        e.preventDefault();
      }
    };
    // Use non-passive to allow preventDefault()
    window.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });

    return () => {
      try { tg?.offEvent?.('viewportChanged', handleViewportChanged); } catch {}
      document.removeEventListener('visibilitychange', handleVis);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('touchstart', onTouchStart as any);
      window.removeEventListener('touchmove', onTouchMove as any);
    };
  }, []);

  // Manage BackButton visibility and behavior based on history depth
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
    const canGoBack = stack.length > 1;
    try {
      if (canGoBack) tg?.BackButton?.show?.(); else tg?.BackButton?.hide?.();
    } catch {}

    // Bind back action
    const handleBack = () => {
      // Go back one step inside app
      router.back();
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
