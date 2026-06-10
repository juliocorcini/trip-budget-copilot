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
  findPendingConfirmationShares,
  calculateOwnerPersonalCost,
} from './splitting';
export type { DebtEntry, DebtSummary, BuildSharesInput, PendingShareEntry } from './splitting';
