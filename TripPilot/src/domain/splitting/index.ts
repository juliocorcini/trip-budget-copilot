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
  buildParticipantStatement,
} from './splitting';
export type {
  DebtEntry,
  DebtSummary,
  BuildSharesInput,
  PendingShareEntry,
  StatementLine,
  StatementLineKind,
  ParticipantStatement,
} from './splitting';
