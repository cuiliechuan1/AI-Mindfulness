const INTERNAL_AUTH_PUBLIC_KEY_SPKI_B64 = 'MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE+/sHwHle85MAWWJ+QHU/N75i9W6eTZKUUQEKp9vLO2O6n9+AqrWB0NbZJ/2qfm6kGMXk77FwQV3CJpLPs64mpg==';
const SESSION_COOKIE = 'mied_internal_session';
const SESSION_MAX_SECONDS = 8 * 60 * 60;
const PUBLIC_PATHS = new Set([
  '/internal-login.html',
  '/api/internal-auth',
  '/robots.txt',
  '/favicon.ico',
]);

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function readCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=');
    if (separator < 0) continue;
    const key = pair.slice(0, separator).trim();
    if (key === name) return pair.slice(separator + 1).trim();
  }
  return '';
}

async function hasValidSession(request) {
  const token = readCookie(request, SESSION_COOKIE);
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;
  if (INTERNAL_AUTH_PUBLIC_KEY_SPKI_B64.includes('PLACEHOLDER')) return false;

  try {
    const claimsText = new TextDecoder().decode(decodeBase64Url(parts[0]));
    const claims = JSON.parse(claimsText);
    const now = Math.floor(Date.now() / 1000);
    if (
      claims.v !== 1 ||
      !Number.isInteger(claims.iat) ||
      !Number.isInteger(claims.exp) ||
      typeof claims.nonce !== 'string' ||
      claims.nonce.length < 16 ||
      claims.iat > now + 60 ||
      claims.exp <= now ||
      claims.exp - claims.iat > SESSION_MAX_SECONDS
    ) return false;

    const key = await crypto.subtle.importKey(
      'spki',
      decodeBase64Url(INTERNAL_AUTH_PUBLIC_KEY_SPKI_B64),
      {name: 'ECDSA', namedCurve: 'P-256'},
      false,
      ['verify'],
    );
    return crypto.subtle.verify(
      {name: 'ECDSA', hash: 'SHA-256'},
      key,
      decodeBase64Url(parts[1]),
      new TextEncoder().encode(parts[0]),
    );
  } catch {
    return false;
  }
}

function buildLoginUrl(requestUrl) {
  const loginUrl = new URL('/internal-login.html', requestUrl.origin);
  for (const key of ['eo_token', 'eo_time']) {
    const value = requestUrl.searchParams.get(key);
    if (value) loginUrl.searchParams.set(key, value);
  }
  loginUrl.searchParams.set('return', `${requestUrl.pathname}${requestUrl.search}`);
  return loginUrl.toString();
}

export async function middleware(context) {
  const url = new URL(context.request.url);
  if (PUBLIC_PATHS.has(url.pathname)) return context.next();
  if (await hasValidSession(context.request)) return context.next();
  return context.redirect(buildLoginUrl(url), 302);
}
