import { sha256Base64Url } from '../../crypto/src/index.js';

export function verifyPkceS256(codeVerifier: string, expectedChallenge: string): boolean {
  return sha256Base64Url(codeVerifier) === expectedChallenge;
}

export function isValidCodeVerifier(value: string): boolean {
  return /^[A-Za-z0-9._~-]{43,128}$/.test(value);
}
