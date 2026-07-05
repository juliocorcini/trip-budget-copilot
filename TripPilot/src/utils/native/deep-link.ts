import { isNativeApp } from './platform';

/**
 * B2 (Onda 4 / DEC-215): App Links handoff for `/pair` and `/s/:id`.
 *
 * On the web/PWA these links already resolve in the browser. In the native
 * shell Android delivers them as an `appUrlOpen` intent (the WebView loads
 * LOCAL assets, not the remote URL), so we parse the incoming URL and route
 * the SPA to the matching screen — crucially PRESERVING the `#fragment`, where
 * the `/s/:id` end-to-end key (`#k=…`) and the `/pair` identity both live.
 */

const APP_LINK_HOSTS = new Set(['trippilot.pages.dev']);

// Only these prefixes are owned by the app; anything else is ignored so the
// listener never hijacks an unrelated intent.
// DEC-459: /quick-add is fired by the home widget "+" and the QS tile.
// DEC-468: the widget suite deep-links to the converter, receipt scanner,
// outing start and expense list (each widget's tap target).
const DEEP_LINK_PREFIXES = [
  '/pair',
  '/s/',
  '/quick-add',
  '/converter',
  '/receipt/scan',
  '/outings/new',
  '/expenses',
] as const;

/**
 * Turns an incoming App Link URL into the in-app target (path + query + hash)
 * to navigate to, or `null` when it is not a TripPilot deep link. Pure — safe
 * to unit test and to call on any platform.
 */
export function parseDeepLink(rawUrl: string | null | undefined): string | null {
  if (!rawUrl) return null;
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (!APP_LINK_HOSTS.has(url.hostname)) return null;
  const owned = DEEP_LINK_PREFIXES.some(
    (prefix) => url.pathname === prefix || url.pathname.startsWith(prefix),
  );
  if (!owned) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

type DeepLinkNavigate = (to: string) => void;

/**
 * Wires native App Links to the router (native only). Handles both the
 * cold-start launch URL and every warm `appUrlOpen`. No-op on the web, where
 * links keep resolving in the browser/PWA. Returns a disposer.
 *
 * `@capacitor/app` is imported lazily so the web bundle and the unit tests
 * never load native code.
 */
export function initDeepLinks(navigate: DeepLinkNavigate): () => void {
  if (!isNativeApp()) return () => {};
  let disposed = false;
  let removeListener: (() => void) | null = null;

  const handle = (rawUrl: string | null | undefined): void => {
    const target = parseDeepLink(rawUrl);
    if (target) navigate(target);
  };

  void (async () => {
    try {
      const { App } = await import('@capacitor/app');
      const launch = await App.getLaunchUrl();
      if (!disposed) handle(launch?.url);
      const listener = await App.addListener('appUrlOpen', (event) => handle(event.url));
      if (disposed) listener.remove();
      else removeListener = () => listener.remove();
    } catch {
      // best-effort; the web/PWA path never reaches here (isNativeApp guard).
    }
  })();

  return () => {
    disposed = true;
    removeListener?.();
  };
}
