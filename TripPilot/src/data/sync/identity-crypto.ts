import { appSettingsRepository } from '@/data/repositories/app-settings-repository';
import { getInstallationId } from '@/utils/entity-factory';
import {
  generateIdentityKeyPair,
  publicKeyJwkToRawB64,
  seal,
  open,
} from '@/domain/sync/ecies';
import type { DeviceIdentity } from '@/domain/types/app-settings';

/**
 * FIELD item 8: stateful wrapper over the pure ECIES core. Owns the device's
 * long-lived identity (load-or-create, persisted in AppSettings so it travels
 * with the backup) and exposes seal/open against it.
 */

let cached: DeviceIdentity | null = null;

/** Load-or-create the device identity. actorId is bound to the install id at
 * creation; the keypair is persisted so a restore keeps the pairing. */
export async function getDeviceIdentity(): Promise<DeviceIdentity> {
  if (cached) return cached;
  const settings = await appSettingsRepository.get();
  if (settings.deviceIdentity) {
    cached = settings.deviceIdentity;
    return cached;
  }
  const { publicKeyJwk, privateKeyJwk } = await generateIdentityKeyPair();
  const identity: DeviceIdentity = { actorId: getInstallationId(), publicKeyJwk, privateKeyJwk };
  await appSettingsRepository.update({ deviceIdentity: identity });
  cached = identity;
  return identity;
}

/** Clears the in-memory cache (after a restore swaps the identity, or a reset). */
export function clearDeviceIdentityCache(): void {
  cached = null;
}

/** The device's public key as base64url raw — embedded in the identity QR. */
export async function getDevicePublicKeyB64(): Promise<string> {
  const identity = await getDeviceIdentity();
  return publicKeyJwkToRawB64(identity.publicKeyJwk);
}

/** Seals a plaintext for a peer's public key (base64url). */
export async function sealForPeer(peerPublicKeyB64: string, plaintext: string): Promise<string> {
  return seal(peerPublicKeyB64, plaintext);
}

/** Opens a blob addressed to this device. Returns null when it is not for us. */
export async function openForMe(sealedB64: string): Promise<string | null> {
  const identity = await getDeviceIdentity();
  return open(identity.privateKeyJwk, sealedB64);
}
