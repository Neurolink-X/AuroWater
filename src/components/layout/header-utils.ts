import { useEffect } from 'react';

/**
 * Small client-side cache used by the header.
 *
 * Format:
 * {
 *   value: unknown,
 *   expiresAt: number
 * }
 */

type CacheEnvelope<T> = {
  value: T;
  expiresAt: number;
};

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function readCache<T>(
  key: string,
  ttlMs: number
): T | null {
  if (!isBrowser()) return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CacheEnvelope<T>>;

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.expiresAt !== 'number'
    ) {
      window.localStorage.removeItem(key);
      return null;
    }

    if (parsed.expiresAt <= Date.now()) {
      window.localStorage.removeItem(key);
      return null;
    }

    return parsed.value ?? null;
  } catch {
    return null;
  }
}

export function writeCache<T>(
  key: string,
  value: T,
  ttlMs = 10 * 60 * 1000
): void {
  if (!isBrowser()) return;

  try {
    const payload: CacheEnvelope<T> = {
      value,
      expiresAt: Date.now() + Math.max(0, ttlMs),
    };

    window.localStorage.setItem(key, JSON.stringify(payload));
  } catch {
    // Storage may be unavailable, full, or blocked.
  }
}

/**
 * Run non-critical work when the browser is idle.
 *
 * Falls back to a short timeout for browsers without
 * requestIdleCallback.
 */
export function whenIdle(
  callback: () => void,
  timeout = 1500
): () => void {
  if (!isBrowser()) {
    return () => undefined;
  }

  const idleWindow = window as Window & {
    requestIdleCallback?: (
      callback: () => void,
      options?: { timeout: number }
    ) => number;
    cancelIdleCallback?: (handle: number) => void;
  };

  if (typeof idleWindow.requestIdleCallback === 'function') {
    const handle = idleWindow.requestIdleCallback(callback, {
      timeout,
    });

    return () => {
      idleWindow.cancelIdleCallback?.(handle);
    };
  }

  const handle = window.setTimeout(callback, 0);

  return () => {
    window.clearTimeout(handle);
  };
}

/**
 * Close a popup when the user clicks outside it or
 * presses Escape.
 */
export function useDismiss(
  open: boolean,
  onDismiss: () => void,
  containerRef: React.RefObject<HTMLElement | null>
): void {
  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const container = containerRef.current;
      const target = event.target;

      if (!container || !(target instanceof Node)) return;

      if (!container.contains(target)) {
        onDismiss();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onDismiss();
      }
    };

    document.addEventListener(
      'pointerdown',
      handlePointerDown
    );

    document.addEventListener(
      'keydown',
      handleKeyDown
    );

    return () => {
      document.removeEventListener(
        'pointerdown',
        handlePointerDown
      );

      document.removeEventListener(
        'keydown',
        handleKeyDown
      );
    };
  }, [open, onDismiss, containerRef]);
}
