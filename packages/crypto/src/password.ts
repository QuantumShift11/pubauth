import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { sha256Hex } from './hash.js';

const PASSWORD_SCHEME = 'scrypt';
const SECRET_SCHEME = 'scrypt-secret-v1';
const LEGACY_SECRET_SCHEME = 'sha256';
const SCRYPT_KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  return hashProtectedValue(password, PASSWORD_SCHEME);
}

export function verifyPassword(password: string, passwordHash: string): boolean {
  return verifyProtectedValue(password, passwordHash, [PASSWORD_SCHEME]);
}

export function hashSecret(secret: string): string {
  return hashProtectedValue(secret, SECRET_SCHEME);
}

export function verifySecret(secret: string, secretHash: string): boolean {
  if (verifyProtectedValue(secret, secretHash, [SECRET_SCHEME, PASSWORD_SCHEME])) {
    return true;
  }

  const [scheme, expectedHex] = secretHash.split(':');
  if (scheme === LEGACY_SECRET_SCHEME && expectedHex) {
    return timingSafeHexEqual(sha256Hex(secret), expectedHex);
  }

  if (/^[a-f0-9]{64}$/u.test(secretHash)) {
    return timingSafeHexEqual(sha256Hex(secret), secretHash);
  }

  return false;
}

function hashProtectedValue(value: string, scheme: string): string {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(value, salt, SCRYPT_KEY_LENGTH).toString('hex');
  return `${scheme}:${salt}:${derivedKey}`;
}

function verifyProtectedValue(value: string, protectedHash: string, acceptedSchemes: string[]): boolean {
  const [scheme, salt, expectedHex] = protectedHash.split(':');
  if (!acceptedSchemes.includes(scheme) || !salt || !expectedHex) {
    return false;
  }

  const actual = scryptSync(value, salt, SCRYPT_KEY_LENGTH);
  const expected = Buffer.from(expectedHex, 'hex');
  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

function timingSafeHexEqual(leftHex: string, rightHex: string): boolean {
  const left = Buffer.from(leftHex, 'hex');
  const right = Buffer.from(rightHex, 'hex');
  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}
