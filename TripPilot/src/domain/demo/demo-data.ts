import { v4 as uuidv4 } from 'uuid';
import type { Trip } from '@/domain/types/trip';
import type { Phase } from '@/domain/types/phase';
import type { BudgetPool } from '@/domain/types/budget-pool';
import type { BudgetPoolPhaseLink } from '@/domain/types/budget-pool-phase-link';
import type { Envelope } from '@/domain/types/envelope';
import type { Participant } from '@/domain/types/participant';
import type { Wallet } from '@/domain/types/wallet';
import type { Transaction } from '@/domain/types/transaction';
import type { ActivityProfile } from '@/domain/types/activity-profile';
import type { ParticipantShare } from '@/domain/types/participant-share';
import type { Session, SessionItem } from '@/domain/types/session';
import type { Settlement } from '@/domain/types/settlement';

interface DemoData {
  trip: Trip;
  phases: Phase[];
  pools: BudgetPool[];
  links: BudgetPoolPhaseLink[];
  envelopes: Envelope[];
  participants: Participant[];
  wallets: Wallet[];
  transactions: Transaction[];
  profiles: ActivityProfile[];
  shares: ParticipantShare[];
  sessions: Session[];
  sessionItems: SessionItem[];
  settlements: Settlement[];
}

function meta(deviceId: string, overrides?: { id?: string }) {
  const now = new Date().toISOString();
  return {
    id: overrides?.id ?? uuidv4(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null as string | null,
    revision: 1,
    sourceDeviceId: deviceId,
  };
}

function dayOffset(base: Date, days: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function generateDemoData(deviceId: string): DemoData {
  const tripId = uuidv4();
  const phase1Id = uuidv4();
  const phase2Id = uuidv4();
  const pool1Id = uuidv4();
  const pool2Id = uuidv4();
  const wallet1Id = uuidv4();
  const wallet2Id = uuidv4();
  const ownerId = uuidv4();
  const friendId = uuidv4();

  const now = new Date();
  const tripStart = dayOffset(now, -13);
  const phase1End = dayOffset(now, 10);
  const phase2Start = dayOffset(now, 11);
  const tripEnd = dayOffset(now, 33);

  const trip: Trip = {
    ...meta(deviceId),
    id: tripId,
    name: 'Eurotrip Espanha 2026',
    baseCurrency: 'EUR',
    startDate: tripStart,
    endDate: tripEnd,
    status: 'active',
    notes: null,
  };

  const phases: Phase[] = [
    {
      ...meta(deviceId),
      id: phase1Id,
      tripId,
      name: 'Burgos antes da eurotrip',
      startDate: tripStart,
      endDate: phase1End,
      order: 0,
      rhythmPreset: null,
      peakDays: null,
      notes: null,
    },
    {
      ...meta(deviceId),
      id: phase2Id,
      tripId,
      name: 'Madrid',
      startDate: phase2Start,
      endDate: tripEnd,
      order: 1,
      rhythmPreset: null,
      peakDays: null,
      notes: null,
    },
  ];

  const pools: BudgetPool[] = [
    {
      ...meta(deviceId),
      id: pool1Id,
      tripId,
      name: 'Fundo Burgos + Madrid',
      scope: 'linked_phases',
      totalAmountCents: 150000,
      currency: 'EUR',
      notes: null,
    },
    {
      ...meta(deviceId),
      id: pool2Id,
      tripId,
      name: 'Compras pessoais',
      scope: 'global',
      totalAmountCents: 30000,
      currency: 'EUR',
      notes: null,
    },
  ];

  const links: BudgetPoolPhaseLink[] = [
    {
      ...meta(deviceId),
      budgetPoolId: pool1Id,
      phaseId: phase1Id,
      futureFloorCents: null,
    },
    {
      ...meta(deviceId),
      budgetPoolId: pool1Id,
      phaseId: phase2Id,
      futureFloorCents: 20000,
    },
  ];

  const envelopes: Envelope[] = [
    {
      ...meta(deviceId),
      budgetPoolId: pool1Id,
      kind: 'protected_reserve',
      name: 'Reserva de emergência',
      amountCents: 15000,
      notes: null,
    },
    {
      ...meta(deviceId),
      budgetPoolId: pool1Id,
      kind: 'allocation',
      name: 'Alimentação',
      amountCents: 60000,
      notes: null,
    },
    {
      ...meta(deviceId),
      budgetPoolId: pool1Id,
      kind: 'allocation',
      name: 'Lazer',
      amountCents: 40000,
      notes: null,
    },
  ];

  const participants: Participant[] = [
    {
      ...meta(deviceId),
      id: ownerId,
      tripId,
      name: 'Julio',
      nickname: null,
      isOwner: true,
      email: null,
      linkedUserAccountId: null,
    },
    {
      ...meta(deviceId),
      id: friendId,
      tripId,
      name: 'Ana',
      nickname: null,
      isOwner: false,
      email: null,
      linkedUserAccountId: null,
    },
  ];

  const wallets: Wallet[] = [
    {
      ...meta(deviceId),
      id: wallet1Id,
      tripId,
      name: 'Wise',
      walletType: 'digital',
      currency: 'EUR',
      initialBalanceCents: 120000,
      isDefault: true,
      notes: null,
    },
    {
      ...meta(deviceId),
      id: wallet2Id,
      tripId,
      name: 'Dinheiro EUR',
      walletType: 'cash',
      currency: 'EUR',
      initialBalanceCents: 30000,
      isDefault: false,
      notes: null,
    },
  ];

  const categories = ['bar', 'restaurant', 'market', 'transport', 'outing'];
  const descriptions = [
    'Cervejas no centro', 'Almoço tapas', 'Compras no Mercadona',
    'Ônibus Burgos centro', 'Passeio Catedral', 'Jantar no bairro',
    'Café da manhã', 'Sorvete artesanal', 'Entrada museu',
    'Uber aeroporto',
  ];

  // GAP-035 (DEC-038): the demo showcases split, debts and outing sessions.
  const sharedIndexes = new Set([2, 5]);
  const transactions: Transaction[] = [];
  for (let i = 0; i < 10; i++) {
    const daysAgo = 13 - i;
    const txDate = dayOffset(now, -daysAgo);
    const amount = [350, 1200, 2500, 280, 1500, 900, 450, 350, 800, 1500][i]!;
    const isSharedTx = sharedIndexes.has(i);
    transactions.push({
      ...meta(deviceId),
      tripId,
      phaseId: phase1Id,
      budgetPoolId: i === 7 ? pool2Id : pool1Id,
      walletId: i % 3 === 0 ? wallet2Id : wallet1Id,
      sessionId: null,
      type: 'expense',
      amountCents: amount,
      personalCostCents: isSharedTx ? Math.round(amount / 2) : amount,
      currency: 'EUR',
      baseCurrencyAmountCents: amount,
      exchangeRate: null,
      category: categories[i % categories.length]!,
      subcategoryId: null,
      description: descriptions[i]!,
      date: `${txDate}T${String(10 + i).padStart(2, '0')}:00:00.000Z`,
      isShared: isSharedTx,
      paidByParticipantId: isSharedTx ? ownerId : null,
      activityProfileId: null,
      isSpecialOccasion: false,
      excludeFromLearning: false,
      sourceWalletId: null,
      targetWalletId: null,
      settlementId: null,
      adjustmentReason: null,
      notes: null,
    });
  }

  // Equal split for each shared expense: owner + friend, friend's half unpaid.
  const shares: ParticipantShare[] = transactions
    .filter((tx) => tx.isShared)
    .flatMap((tx) => {
      const half = Math.round(tx.amountCents / 2);
      return [
        {
          ...meta(deviceId),
          transactionId: tx.id,
          participantId: ownerId,
          shareAmountCents: tx.amountCents - half,
          shareType: 'equal' as const,
          isPaid: true,
          confirmationStatus: 'confirmed' as const,
          notes: null,
        },
        {
          ...meta(deviceId),
          transactionId: tx.id,
          participantId: friendId,
          shareAmountCents: half,
          shareType: 'equal' as const,
          isPaid: false,
          confirmationStatus: 'pending' as const,
          notes: null,
        },
      ];
    });

  const barProfileId = uuidv4();
  const profiles: ActivityProfile[] = [
    { ...meta(deviceId, { id: barProfileId }), tripId, name: 'Bar', category: 'bar', iconName: 'local_bar', color: '#C75B39', typicalValueCents: 1500, safeValueCents: 2000, confidence: 'medium', dataPointCount: 3, expectedFrequencyPerPhase: 5, isCustom: false, defaultTargetCents: 1500, defaultCeilingCents: 2500, defaultMaxCents: 3500, defaultAvgDrinkPriceCents: 350, quickAddValuesCents: null, notes: null },
    { ...meta(deviceId), tripId, name: 'Restaurante', category: 'restaurant', iconName: 'restaurant', color: '#D4A843', typicalValueCents: 1200, safeValueCents: 1800, confidence: 'medium', dataPointCount: 2, expectedFrequencyPerPhase: 4, isCustom: false, defaultTargetCents: null, defaultCeilingCents: null, defaultMaxCents: null, defaultAvgDrinkPriceCents: null, quickAddValuesCents: null, notes: null },
    { ...meta(deviceId), tripId, name: 'Mercado', category: 'market', iconName: 'shopping_cart', color: '#6B8F71', typicalValueCents: 2500, safeValueCents: 3500, confidence: 'low', dataPointCount: 1, expectedFrequencyPerPhase: 3, isCustom: false, defaultTargetCents: null, defaultCeilingCents: null, defaultMaxCents: null, defaultAvgDrinkPriceCents: null, quickAddValuesCents: null, notes: null },
  ];

  // One completed bar session with three quick-add items (4 days ago).
  const sessionId = uuidv4();
  const sessionDay = dayOffset(now, -4);
  const sessionAmounts = [700, 700, 1000];
  const sessionTransactions: Transaction[] = sessionAmounts.map((amount, i) => ({
    ...meta(deviceId),
    tripId,
    phaseId: phase1Id,
    budgetPoolId: pool1Id,
    walletId: wallet2Id,
    sessionId,
    type: 'expense' as const,
    amountCents: amount,
    personalCostCents: amount,
    currency: 'EUR',
    baseCurrencyAmountCents: amount,
    exchangeRate: null,
    category: 'bar',
    subcategoryId: i === 2 ? 'bar_food' : 'bar_drink',
    description: `Rodada ${i + 1}`,
    date: `${sessionDay}T${String(21 + i).padStart(2, '0')}:00:00.000Z`,
    isShared: false,
    paidByParticipantId: null,
    activityProfileId: barProfileId,
    isSpecialOccasion: false,
    excludeFromLearning: false,
    sourceWalletId: null,
    targetWalletId: null,
    settlementId: null,
    adjustmentReason: null,
    notes: null,
  }));
  transactions.push(...sessionTransactions);

  const sessions: Session[] = [
    {
      ...meta(deviceId, { id: sessionId }),
      tripId,
      phaseId: phase1Id,
      budgetPoolId: pool1Id,
      activityProfileId: barProfileId,
      status: 'completed',
      name: 'Noite no bar — Plaza Mayor',
      targetCents: 1500,
      ceilingCents: 2500,
      maxCents: 3500,
      startedAt: `${sessionDay}T20:30:00.000Z`,
      endedAt: `${sessionDay}T23:45:00.000Z`,
      quickAddValuesCents: [300, 500, 700, 1000, 1500],
      avgDrinkPriceCents: 350,
      firedAlertPercents: [50, 75],
      overMaxConfirmedAt: null,
      notes: null,
    },
  ];

  const sessionItems: SessionItem[] = sessionTransactions.map((tx, i) => ({
    ...meta(deviceId),
    sessionId,
    transactionId: tx.id,
    order: i,
  }));

  // Ana already settled part of her debt — keeps a visible pending balance.
  const settlements: Settlement[] = [
    {
      ...meta(deviceId),
      tripId,
      debtorParticipantId: friendId,
      creditorParticipantId: ownerId,
      amountCents: 600,
      currency: 'EUR',
      settledAt: `${dayOffset(now, -2)}T18:00:00.000Z`,
      linkedTransactionId: null,
      notes: null,
    },
  ];

  return {
    trip,
    phases,
    pools,
    links,
    envelopes,
    participants,
    wallets,
    transactions,
    profiles,
    shares,
    sessions,
    sessionItems,
    settlements,
  };
}
