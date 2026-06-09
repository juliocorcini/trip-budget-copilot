export {
  createEqualShares,
  createCustomShares,
  buildSharesWithPayer,
  calculatePersonalCost,
  calculateDebts,
  createSettlement,
  suggestSimplifiedSettlements,
  createParticipant,
  scaleSharesToTotal,
  calculateParticipantBalances,
  findPendingSharedTransactions,
} from './splitting';
export type { DebtEntry, DebtSummary, BuildSharesInput } from './splitting';
