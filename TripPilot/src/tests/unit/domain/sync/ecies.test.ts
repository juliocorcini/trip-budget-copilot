// @vitest-environment node
// Real WebCrypto (ECDH/HKDF/AES-GCM) is required here; jsdom only ships a
// non-functional SubtleCrypto stub, so this pure crypto suite runs in node.
import { describe, it, expect } from 'vitest';
import {
  generateIdentityKeyPair,
  publicKeyJwkToRawB64,
  seal,
  open,
} from '@/domain/sync/ecies';
import {
  buildMailboxEnvelope,
  packEnvelope,
  unpackEnvelope,
} from '@/domain/sync/mailbox-envelope';

describe('ECIES mailbox sealing', () => {
  it('round-trips a message to the intended recipient', async () => {
    const recipient = await generateIdentityKeyPair();
    const pub = await publicKeyJwkToRawB64(recipient.publicKeyJwk);

    const sealed = await seal(pub, 'meet at the bar — owes 14.00');
    const opened = await open(recipient.privateKeyJwk, sealed);

    expect(opened).toBe('meet at the bar — owes 14.00');
  });

  it('produces a different blob each time (ephemeral key + iv)', async () => {
    const recipient = await generateIdentityKeyPair();
    const pub = await publicKeyJwkToRawB64(recipient.publicKeyJwk);

    const a = await seal(pub, 'same plaintext');
    const b = await seal(pub, 'same plaintext');

    expect(a).not.toBe(b);
    expect(await open(recipient.privateKeyJwk, a)).toBe('same plaintext');
    expect(await open(recipient.privateKeyJwk, b)).toBe('same plaintext');
  });

  it('cannot be opened by a different device (wrong private key)', async () => {
    const recipient = await generateIdentityKeyPair();
    const eavesdropper = await generateIdentityKeyPair();
    const pub = await publicKeyJwkToRawB64(recipient.publicKeyJwk);

    const sealed = await seal(pub, 'secret');

    expect(await open(eavesdropper.privateKeyJwk, sealed)).toBeNull();
  });

  it('rejects a tampered blob (AES-GCM auth)', async () => {
    const recipient = await generateIdentityKeyPair();
    const pub = await publicKeyJwkToRawB64(recipient.publicKeyJwk);
    const sealed = await seal(pub, 'authentic');

    // Flip the last character of the base64url ciphertext tail.
    const last = sealed.slice(-1) === 'A' ? 'B' : 'A';
    const tampered = sealed.slice(0, -1) + last;

    expect(await open(recipient.privateKeyJwk, tampered)).toBeNull();
  });

  it('returns null for malformed input instead of throwing', async () => {
    const recipient = await generateIdentityKeyPair();
    expect(await open(recipient.privateKeyJwk, 'not-a-real-blob')).toBeNull();
    expect(await open(recipient.privateKeyJwk, '')).toBeNull();
  });
});

describe('mailbox envelope', () => {
  it('packs and unpacks a statement envelope losslessly', () => {
    const envelope = buildMailboxEnvelope({
      kind: 'statement',
      fromActorId: 'actor-a',
      fromName: 'Julio',
      data: { v: 1, lines: [{ shareId: 's1', amountCents: 1400 }] },
    });

    const packed = packEnvelope(envelope);
    const unpacked = unpackEnvelope(packed);

    expect(unpacked).not.toBeNull();
    expect(unpacked!.kind).toBe('statement');
    expect(unpacked!.fromActorId).toBe('actor-a');
    expect(unpacked!.data).toEqual({ v: 1, lines: [{ shareId: 's1', amountCents: 1400 }] });
  });

  it('trims an over-long sender name to 60 chars', () => {
    const envelope = buildMailboxEnvelope({
      kind: 'backup',
      fromActorId: 'actor-a',
      fromName: 'x'.repeat(120),
      data: {},
    });
    expect(envelope.fromName.length).toBe(60);
  });

  it('rejects garbage and unknown kinds', () => {
    expect(unpackEnvelope('garbage')).toBeNull();
    const bad = packEnvelope({
      v: 1,
      // @ts-expect-error — deliberately invalid kind
      kind: 'virus',
      fromActorId: 'a',
      fromName: 'n',
      sentAt: new Date().toISOString(),
      data: {},
    });
    expect(unpackEnvelope(bad)).toBeNull();
  });

  it('survives a full seal → unseal → unpack pipeline', async () => {
    const recipient = await generateIdentityKeyPair();
    const pub = await publicKeyJwkToRawB64(recipient.publicKeyJwk);
    const envelope = buildMailboxEnvelope({
      kind: 'backup',
      fromActorId: 'actor-z',
      fromName: 'Old Phone',
      data: { v: 1, kind: 'backup', data: { version: 4 } },
    });

    const sealed = await seal(pub, packEnvelope(envelope));
    const opened = await open(recipient.privateKeyJwk, sealed);
    expect(opened).not.toBeNull();
    const back = unpackEnvelope(opened!);

    expect(back!.kind).toBe('backup');
    expect(back!.fromName).toBe('Old Phone');
    expect(back!.data).toEqual({ v: 1, kind: 'backup', data: { version: 4 } });
  });
});
