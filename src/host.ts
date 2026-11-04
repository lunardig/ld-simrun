/**
 * The host origin this page was told to talk to (`?host=`), or the game, when the value
 * is not an origin a host can have: `https:` anywhere, `http:` on localhost only, and
 * nothing but the origin. Anyone can link to this page with any `?host=`, so the value
 * is not trusted to be a URL at all (SECURITY-REVIEW-ldcp F-11).
 */
export const GAME_ORIGIN = "https://lunardig.com";

export function hostOriginFrom(value: string | null | undefined, fallback = GAME_ORIGIN): string {
  if (typeof value !== "string" || !value) return fallback;
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return fallback;
  }
  const local = u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]";
  if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) return fallback;
  if (u.username || u.password || (u.pathname !== "/" && u.pathname !== "") || u.search || u.hash) return fallback;
  return u.origin;
}
