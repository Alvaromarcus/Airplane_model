/**
 * Google Analytics 4 events (gtag is loaded in index.html). Page views are
 * automatic — and since each language has its own URL (/pt/, /en/…), GA4
 * already splits visits by language page. These events add what people DO.
 */
type Gtag = (cmd: 'event', name: string, params?: Record<string, string | number | boolean>) => void;

export function track(name: string, params: Record<string, string | number | boolean> = {}) {
  try {
    const g = (window as unknown as { gtag?: Gtag }).gtag;
    if (typeof g === 'function') g('event', name, { ui_language: document.documentElement.lang, ...params });
  } catch { /* analytics must never break the app */ }
}
