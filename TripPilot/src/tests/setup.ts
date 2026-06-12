import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';

// Node 18 does not expose WebCrypto on the global scope. Only fill the gap
// when crypto is fully absent (node environment) — replacing jsdom's crypto
// with Node's would break cross-realm TypedArray checks.
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
}
