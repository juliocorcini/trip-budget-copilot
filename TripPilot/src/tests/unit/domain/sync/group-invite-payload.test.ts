import { describe, it, expect } from 'vitest';
import {
  buildGroupInvitePayload,
  parseGroupInvitePayload,
} from '@/domain/sync/group-invite-payload';
import {
  buildMailboxEnvelope,
  packEnvelope,
  unpackEnvelope,
} from '@/domain/sync/mailbox-envelope';

// F24 / DEC-355 (G8): a `group_invite` carries the owner's live `/g/` READ
// credentials (shareId + AES key) sealed inside the mailbox blob — never the
// writeToken. It lands from the network, so it must validate strictly and survive
// the envelope round-trip the Worker forwards as opaque ciphertext.

const ACTOR = 'a1b2c3d4-0000-4000-8000-000000000001';

describe('buildGroupInvitePayload (DEC-355)', () => {
  it('carries the share id, read key, and group name at v1', () => {
    const payload = buildGroupInvitePayload({
      shareId: 'g_abc123',
      key: 'AESKEYbase64url',
      groupName: 'Trip to Lisbon',
    });
    expect(payload).toEqual({
      v: 1,
      shareId: 'g_abc123',
      key: 'AESKEYbase64url',
      groupName: 'Trip to Lisbon',
    });
  });

  it('trims and caps the group name, falling back when blank', () => {
    const long = 'x'.repeat(200);
    const capped = buildGroupInvitePayload({ shareId: 's', key: 'k', groupName: `  ${long}  ` });
    expect(capped.groupName).toHaveLength(120);
    expect(capped.groupName.startsWith(' ')).toBe(false);

    const blank = buildGroupInvitePayload({ shareId: 's', key: 'k', groupName: '   ' });
    expect(blank.groupName).toBe('Grupo');
  });

  it('never carries a write token (read capability only)', () => {
    const payload = buildGroupInvitePayload({ shareId: 's', key: 'k', groupName: 'G' });
    expect(payload).not.toHaveProperty('writeToken');
  });
});

describe('parseGroupInvitePayload (DEC-355)', () => {
  it('accepts a well-formed payload', () => {
    const payload = buildGroupInvitePayload({ shareId: 's1', key: 'k1', groupName: 'G1' });
    expect(parseGroupInvitePayload(JSON.parse(JSON.stringify(payload)))).toEqual(payload);
  });

  it('rejects a wrong version, empty id/key/name, or garbage (fails closed)', () => {
    expect(parseGroupInvitePayload({ v: 2, shareId: 's', key: 'k', groupName: 'G' })).toBeNull();
    expect(parseGroupInvitePayload({ v: 1, shareId: '', key: 'k', groupName: 'G' })).toBeNull();
    expect(parseGroupInvitePayload({ v: 1, shareId: 's', key: '', groupName: 'G' })).toBeNull();
    expect(parseGroupInvitePayload({ v: 1, shareId: 's', key: 'k', groupName: '' })).toBeNull();
    expect(parseGroupInvitePayload(null)).toBeNull();
    expect(parseGroupInvitePayload('garbage')).toBeNull();
  });
});

describe('group_invite envelope round-trip (DEC-355 transport)', () => {
  it('packs and unpacks a group_invite envelope, preserving the payload', () => {
    const payload = buildGroupInvitePayload({
      shareId: 'g_xyz',
      key: 'read-key-789',
      groupName: 'Weekend',
    });
    const envelope = buildMailboxEnvelope({
      kind: 'group_invite',
      fromActorId: ACTOR,
      fromName: 'Julio',
      data: payload,
    });
    const unpacked = unpackEnvelope(packEnvelope(envelope));
    expect(unpacked).not.toBeNull();
    expect(unpacked!.kind).toBe('group_invite');
    expect(parseGroupInvitePayload(unpacked!.data)).toEqual(payload);
  });
});
