import { db } from '@/data/db/database';
import type { Transaction } from '@/domain/types/transaction';
import { BaseRepository } from './base-repository';

class TransactionRepository extends BaseRepository<Transaction> {
  constructor() {
    super(db.transactions);
  }

  async getByTripId(tripId: string): Promise<Transaction[]> {
    return this.table
      .where('tripId')
      .equals(tripId)
      .filter((t) => t.deletedAt === null)
      .toArray();
  }

  async getByPoolId(poolId: string): Promise<Transaction[]> {
    return this.table
      .where('budgetPoolId')
      .equals(poolId)
      .filter((t) => t.deletedAt === null)
      .toArray();
  }

  async getByPhaseId(phaseId: string): Promise<Transaction[]> {
    return this.table
      .where('phaseId')
      .equals(phaseId)
      .filter((t) => t.deletedAt === null)
      .toArray();
  }

  async getByWalletId(walletId: string): Promise<Transaction[]> {
    return this.table
      .where('walletId')
      .equals(walletId)
      .filter((t) => t.deletedAt === null)
      .toArray();
  }

  async getBySessionId(sessionId: string): Promise<Transaction[]> {
    return this.table
      .where('sessionId')
      .equals(sessionId)
      .filter((t) => t.deletedAt === null)
      .toArray();
  }

  async getRecentByTrip(tripId: string, limit: number = 10): Promise<Transaction[]> {
    const all = await this.getByTripId(tripId);
    return all.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
  }
}

export const transactionRepository = new TransactionRepository();
