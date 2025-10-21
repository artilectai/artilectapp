import { useEffect } from "react";

/**
 * Dynamically adjusts a container's height when text inputs are focused to make room for the on-screen keyboard.
 * Uses VisualViewport when available; falls back to a fixed pixel offset.
 *
 * Safety: Skips when the focused element is inside an aria-modal dialog (e.g. SlideUpModal) to avoid conflicts
 * with the sheet's own keyboard-aware behavior.
 */
export function useDynamicKeyboardHeight(
  containerRef: React.RefObject<HTMLElement | null>,
  options?: { fallbackPx?: number }
) {
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof window === 'undefined') return;

    const fallback = Math.max(0, Math.floor(options?.fallbackPx ?? 300));
    const vv: VisualViewport | undefined = (window as any).visualViewport as any;
    let baseline = Math.max(window.innerHeight, document.documentElement.clientHeight);
    let focused = false;

    const computeShrink = () => {
      try {
        if (!vv) return fallback;
        const vh = vv.height + vv.offsetTop; // visible region height relative to layout viewport
        let shrink = Math.max(0, baseline - vh);
        if (shrink === 0 && vv.height < baseline - 80) {
          shrink = baseline - (vv.height + vv.offsetTop);
        }
        return Math.max(0, Math.round(shrink));
      } catch {
        return fallback;
      }
    };

    const applyHeight = () => {
      if (!focused) return;
      const shrink = computeShrink();
      el.style.height = `calc(100vh - ${shrink}px)`;
    };

    const resetHeight = () => {
      el.style.height = '';
    };

    const isTextual = (t: HTMLElement | null) => !!t && !!t.matches && t.matches('input[type="text"], input[type="search"], input[type="email"], input[type="tel"], input[type="url"], input:not([type]), textarea, [role="textbox"], [contenteditable="true"]');

    const skipIfModal = (t: HTMLElement | null) => !!t && !!t.closest && !!t.closest('[role="dialog"][aria-modal="true"]');

    const onFocusIn = (e: Event) => {
      const t = e.target as HTMLElement | null;
      if (!isTextual(t)) return;
      if (skipIfModal(t)) return; // Let SlideUpModal handle its own keyboard logic
      focused = true;
      // Re-capture a stable baseline when first focusing (ignoring keyboard)
      baseline = Math.max(window.innerHeight, document.documentElement.clientHeight);
      // Apply soon so layout settles with keyboard animation
      setTimeout(applyHeight, 50);
    };

    const onFocusOut = (_e: Event) => {
      // If another input is immediately focused, keep adjusted height
      setTimeout(() => {
        const a = document.activeElement as HTMLElement | null;
        if (isTextual(a) && !skipIfModal(a)) {
          focused = true;
          applyHeight();
          return;
        }
        focused = false;
        resetHeight();
      }, 50);
    };

    const onVVResize = () => applyHeight();
    const onWindowResize = () => {
      // When the window resizes (mobile keyboard toggles or UI bars change),
      // reapply if focused; otherwise clear inline height and let CSS fill.
      if (focused) {
        applyHeight();
      } else {
        resetHeight();
      }
    };
    const onOrientation = () => {
      // Allow bars to settle, then update baseline and height if needed
      setTimeout(() => {
        baseline = Math.max(window.innerHeight, document.documentElement.clientHeight);
        applyHeight();
      }, 150);
    };

    document.addEventListener('focusin', onFocusIn, true);
    document.addEventListener('focusout', onFocusOut, true);
  vv?.addEventListener('resize', onVVResize);
    vv?.addEventListener('scroll', onVVResize);
  window.addEventListener('resize', onWindowResize);
    window.addEventListener('orientationchange', onOrientation);

    return () => {
      document.removeEventListener('focusin', onFocusIn, true);
      document.removeEventListener('focusout', onFocusOut, true);
      vv?.removeEventListener('resize', onVVResize);
      vv?.removeEventListener('scroll', onVVResize);
      window.removeEventListener('resize', onWindowResize);
      window.removeEventListener('orientationchange', onOrientation);
      resetHeight();
    };
  }, [containerRef, options?.fallbackPx]);
}
