import type { LinkProps } from './link-component';
import type { RouteActionValue, SimpleURL } from './types';
import { QACTION_KEY } from './constants';

/**
 * Gets an absolute url path string (url.pathname + url.search + url.hash)
 */
export const toPath = (url: SimpleURL) => url.pathname + url.search + url.hash;

/**
 * Create a URL from a string and baseUrl
 */
export const toUrl = (url: string, baseUrl: { href: string }) => new URL(url, baseUrl.href);

/**
 * Checks only if the origins are the same.
 */
export const isSameOrigin = (a: SimpleURL, b: SimpleURL) => a.origin === b.origin;

/**
 * Checks only if the pathname + search are the same for the URLs.
 */
export const isSamePath = (a: SimpleURL, b: SimpleURL) =>
  a.pathname + a.search === b.pathname + b.search;

/**
 * Checks only if the pathnames are the same for the URLs (doesn't include search and hash)
 */
export const isSamePathname = (a: SimpleURL, b: SimpleURL) => a.pathname === b.pathname;

/**
 * Same origin, but different pathname (doesn't include search and hash)
 */
export const isSameOriginDifferentPathname = (a: SimpleURL, b: SimpleURL) =>
  isSameOrigin(a, b) && !isSamePath(a, b);

export const getClientDataPath = (
  pathname: string,
  pageSearch?: string,
  action?: RouteActionValue
) => {
  let search = pageSearch ?? '';
  if (action) {
    search += (search ? '&' : '?') + QACTION_KEY + '=' + encodeURIComponent(action.id);
  }
  return pathname + (pathname.endsWith('/') ? '' : '/') + 'q-data.json' + search;
};

export const getClientNavPath = (props: Record<string, any>, baseUrl: { href: string }) => {
  const href = props.href;
  if (typeof href === 'string' && href.trim() !== '' && typeof props.target !== 'string') {
    try {
      const linkUrl = toUrl(href, baseUrl);
      const currentUrl = toUrl('', baseUrl)!;
      if (isSameOrigin(linkUrl, currentUrl)) {
        return toPath(linkUrl);
      }
    } catch (e) {
      console.error(e);
    }
  }
  return null;
};

export const getPrefetchDataset = (
  props: LinkProps,
  clientNavPath: string | null,
  currentLoc: { href: string }
) => {
  if (props.prefetch === true && clientNavPath) {
    const prefetchUrl = toUrl(clientNavPath, currentLoc);
    if (!isSamePathname(prefetchUrl, toUrl('', currentLoc))) {
      return '';
    }
  }
  return null;
};
