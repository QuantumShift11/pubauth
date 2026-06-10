import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const PASSWORD_SCHEME = 'scrypt';
const SCRYPT_KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, SCRYPT_KEY_LENGTH).toString('hex');
  return `${PASSWORD_SCHEME}:${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, passwordHash: string): boolean {
  const [scheme, salt, expectedHex] = passwordHash.split(':');
  if (scheme !== PASSWORD_SCHEME || !salt || !expectedHex) {
    return false;
  }

  const actual = scryptSync(password, salt, SCRYPT_KEY_LENGTH);
  const expected = Buffer.from(expectedHex, 'hex');
  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}
