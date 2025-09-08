// Simple global back-action stack for Telegram WebApp integration.
// Components (e.g., modals, sheets) can register a back action so that
// Telegram's BackButton closes those first, before navigating or closing the app.

export type BackAction = () => void;

// Module-level stack; SSR-safe guards when referenced in browser only.
const stack: BackAction[] = [];

export function pushBackAction(action: BackAction) {
  if (typeof window === 'undefined') return;
  stack.push(action);
}

export function popBackAction(action?: BackAction) {
  if (typeof window === 'undefined') return;
  if (!action) {
    stack.pop();
    return;
  }
  // Remove the last matching instance
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i] === action) {
      stack.splice(i, 1);
      break;
    }
  }
}

export function peekBackAction(): BackAction | undefined {
  if (typeof window === 'undefined') return undefined;
  return stack[stack.length - 1];
}

export function hasBackActions() {
  if (typeof window === 'undefined') return false;
  return stack.length > 0;
}

export function backStackSize() {
  if (typeof window === 'undefined') return 0;
  return stack.length;
}
