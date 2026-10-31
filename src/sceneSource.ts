import { requestFromUrl, type SceneRequest } from "./scene";

/**
 * Where the first scene's request comes from: a URL that says anything wins,
 * otherwise the browser remembers the last one (ADR 0040). What is kept is
 * the request's own query string (`queryFor`), so the URL's vocabulary and
 * its checks are the only ones — a remembered request is read exactly as a
 * typed one.
 */

/** The localStorage key the last request is kept under. */
export const REMEMBERED = "db-hd-remake.scene";

export interface FirstRequest {
  request: SceneRequest | string;
  /** Why the remembered request was not used, when it was not. */
  notice?: string;
}

export function firstRequest(url: URL, remembered: string | null): FirstRequest {
  if (url.search !== "" || remembered === null) return { request: requestFromUrl(url) };
  const request = requestFromUrl(new URL(remembered, url));
  // A remembered request nobody can fix from the address bar is dropped, not shouted.
  if (typeof request === "string") return { request: requestFromUrl(new URL(url.pathname, url)), notice: `forgot the last scene: ${request}` };
  return { request };
}

