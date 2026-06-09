import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256Base64Url } from '../dist/packages/crypto/src/index.js';
import { isValidCodeVerifier, verifyPkceS256 } from '../dist/packages/oidc/src/index.js';

test('PKCE S256 verifier matches generated challenge', () => {
  const verifier = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~abc';
  const challenge = sha256Base64Url(verifier);

  assert.equal(isValidCodeVerifier(verifier), true);
  assert.equal(verifyPkceS256(verifier, challenge), true);
  assert.equal(verifyPkceS256(`${verifier}x`, challenge), false);
});
