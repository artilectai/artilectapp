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

  // Initialize Telegram WebApp
  useEffect(() => {
    const tg = (window as any)?.Telegram?.WebApp as any;
    if (!tg) return;
    try {
      tg.ready?.();
      tg.expand?.();
    } catch {}
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
