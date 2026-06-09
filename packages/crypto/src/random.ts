import { randomBytes } from 'node:crypto';
import { base64UrlEncode } from './base64url.js';

export function randomToken(bytes = 32): string {
  return base64UrlEncode(randomBytes(bytes));
}
