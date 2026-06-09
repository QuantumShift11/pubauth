import { createHash } from 'node:crypto';
import { base64UrlEncode } from './base64url.js';

export function sha256(input: string): Buffer {
  return createHash('sha256').update(input).digest();
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function sha256Base64Url(input: string): string {
  return base64UrlEncode(sha256(input));
}
