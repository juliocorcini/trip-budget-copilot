import { db } from '@/data/db/database';
import type { Wallet } from '@/domain/types/wallet';
import { BaseRepository } from './base-repository';

class WalletRepository extends BaseRepository<Wallet> {
  constructor() {
    super(db.wallets);
  }

  async getByTripId(tripId: string): Promise<Wallet[]> {
    return this.table
      .where('tripId')
      .equals(tripId)
      .filter((w) => w.deletedAt === null)
      .toArray();
  }

  async getDefault(tripId: string): Promise<Wallet | undefined> {
    const wallets = await this.table
      .where('tripId')
      .equals(tripId)
      .filter((w) => w.deletedAt === null && w.isDefault)
      .toArray();
    return wallets[0];
  }

  async clearDefaults(tripId: string): Promise<void> {
    const defaults = await this.table
      .where('tripId')
      .equals(tripId)
      .filter((w) => w.isDefault)
      .toArray();
    for (const w of defaults) {
      await this.table.update(w.id, { isDefault: false } as Partial<Wallet>);
    }
  }
}

export const walletRepository = new WalletRepository();
