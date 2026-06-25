import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { useAppData, notifyAppDataChanged } from '@/hooks/useAppData';
import { compressImageFile, blobToDataUrl, type CompressedImage } from '@/utils/image/compress';
import { extractReceiptViaCloud, type ReceiptOcrError } from '@/utils/ai-ocr';
import {
  buildSplitCommitPlan,
  buildSplitFromReceipt,
  computeSplitTotals,
  detectUnclaimed,
  itemsSubtotalCents,
  serviceChargeAmountCents,
  toggleEqualClaim,
  setClaimUnits,
  claimedUnits,
  addParticipant,
  promoteAdhocToParticipant,
  createSplitParticipant,
  createSplitItem,
  createSplitSession,
  reduceGuestClaims,
  type ServiceChargeMode,
  type SplitClaimResponse,
  type SplitItem,
  type SplitMode,
  type SplitSession,
} from '@/domain/split';
import { commitSplit, undoSplitCommit } from '@/domain/orchestrators';
import { createParticipant } from '@/domain/splitting';
// B2 (coherence §2.2): reuse a known friend (persisted peerLink) when dividing,
// instead of re-scanning a QR. Pure view layer over the global peerLinks table.
import { buildConnectionViews, type ConnectionView } from '@/domain/connections';
import { useSplitLiveLink, type SplitLiveLink } from './useSplitLiveLink';
import { LiveStatusBadge } from './LiveStatusBadge';
import { loadOwnerLive, clearOwnerLive, fetchSplitTable } from './live-link';
import { takeReceiptSplitHandoff, hasPendingReceiptSplitHandoff } from './receipt-split-handoff';
import { takeOutingSplitHandoff, hasPendingOutingSplitHandoff } from './outing-split-handoff';
import { newAttachment } from '@/features/attachments/attachment-utils';
import { attachmentRepository, appSettingsRepository, participantRepository, peerLinkRepository } from '@/data/repositories';
import { resolveActivePhase, sortPhasesByOrder } from '@/domain/dates';
import { selectActivePhasePool } from '@/domain/budget';
import { formatMoney, toCents, convertToBaseCents, resolveFrozenRate } from '@/domain/money';
import { getCategoryIcon } from '@/utils/category-icons';
import { Icon } from '@/components/Icon';
import { DataErrorScreen } from '@/components/DataErrorScreen';
import { BottomSheet } from '@/components/BottomSheet';
import { useImageSourceChooser } from '@/components/ImageSourceChooser';
import { PhaseChargePicker } from '@/features/shared/PhaseChargePicker';
import { SplitHistorySheet } from './SplitHistorySheet';
import { PassThePhoneSheet } from './PassThePhoneSheet';
import { QrCodeDisplay } from '@/components/QrCodeDisplay';
import { shareOrCopyLink } from '@/utils/native/link-share';
import { requestSplitNotificationPermission } from '@/utils/split-notification';
import { showToast } from '@/components/Toast';
import { useSplitBudgetReading } from './useSplitBudgetReading';

type Phase = 'capture' | 'reading' | 'divide';

const SPLIT_MODES: SplitMode[] = ['itemized', 'equal', 'mine'];
const TAX_MODES: ServiceChargeMode[] = ['proportional', 'per_head'];

const SPLIT_CATEGORIES = [
  'restaurant',
  'bar',
  'market',
  'transport',
  'accommodation',
  'entertainment',
  'gifts',
  'other',
];

const VERDICT_STYLE: Record<string, { icon: string; className: string }> = {
  ok: { icon: 'check_circle', className: 'text-success' },
  attention: { icon: 'error', className: 'text-warning' },
  risk: { icon: 'warning', className: 'text-error' },
};

/** Initials avatar text for a participant chip. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function SplitPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // FAB "nova divisão" arrives with ?new=1 — open a fresh capture screen even if
  // a live table is still running (it stays resumable from the home card/chip).
  const forceNew = searchParams.get('new') === '1';
  const { trip, phases, pools, links, participants, settings, loading, error, retry, reload } = useAppData();

  // CC-IMG (DEC-275): shared take-photo/gallery chooser for the receipt scan.
  const receiptChooser = useImageSourceChooser((file) => {
    void processReceiptFile(file);
  });
  const [phase, setPhase] = useState<Phase>('capture');
  const [session, setSession] = useState<SplitSession | null>(null);
  const [compressed, setCompressed] = useState<CompressedImage | null>(null);
  const [activePersonId, setActivePersonId] = useState<string | null>(null);
  const [view, setView] = useState<'item' | 'person'>('item');
  const [busy, setBusy] = useState(false);
  const [askTax, setAskTax] = useState(false);
  const [taxSheetOpen, setTaxSheetOpen] = useState(false);
  const [personSheetOpen, setPersonSheetOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  // "A história do que aconteceu" — the full who-got-what breakdown.
  const [historyOpen, setHistoryOpen] = useState(false);
  // "Passar o celular pela mesa" — the guided round-the-table claim flow.
  const [passPhoneOpen, setPassPhoneOpen] = useState(false);
  // Julio field feedback: the trecho/fase this split charges. null = today's
  // active phase (a live bill happens "now"); a manual pick overrides it.
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);

  const cloudEnabled = settings?.cloudReceiptOcrEnabled ?? false;
  const owner = useMemo(() => participants.find((p) => p.isOwner) ?? null, [participants]);
  const baseCurrency = trip?.baseCurrency ?? settings?.defaultCurrency ?? 'EUR';
  const ownerName = owner?.name ?? t('split.you');

  const companions = useMemo(() => participants.filter((p) => !p.isOwner), [participants]);
  const sortedPhases = useMemo(
    () => sortPhasesByOrder(phases.filter((p) => p.deletedAt === null)),
    [phases],
  );
  const resolvedPhaseId = selectedPhaseId ?? resolveActivePhase(phases)?.id ?? null;

  // B2 (coherence §2.2) — known friends (persisted peerLinks, cross-trip) so the
  // owner can add someone to the bill in one tap instead of re-scanning a QR.
  // Loaded once on mount; the honest status (connected/waiting/offline) is derived
  // by the pure connections layer. Reused via the existing addParticipant(actorId).
  const [connections, setConnections] = useState<ConnectionView[]>([]);
  useEffect(() => {
    let alive = true;
    void peerLinkRepository.getAll().then((peerLinks) => {
      if (alive) setConnections(buildConnectionViews(peerLinks, Date.now()));
    });
    return () => {
      alive = false;
    };
  }, []);

  /** Add a known friend to the split: link to the CURRENT trip's participant when
   *  one already maps to this actor (so commit mints a real debt riding the
   *  mirror); otherwise add carrying the actorId (promote-to-person stays available). */
  const addFriend = (conn: ConnectionView) => {
    setSession((s) => {
      if (!s) return s;
      if (s.participants.some((p) => p.actorId === conn.actorId)) return s;
      const tripParticipant = participants.find((p) => p.linkedActorId === conn.actorId);
      return addParticipant(s, conn.displayName, {
        actorId: conn.actorId,
        linkedParticipantId: tripParticipant?.id ?? null,
      }).session;
    });
  };

  // G2 (live table): guest claims posted to the share channel are folded into
  // the live session by the owner-reducer — owner-authoritative, so a guest can
  // only ever set its own slice, never the owner's. The hook owns the publish/
  // pull/signal lifecycle; this device stays the single source of truth.
  const applyGuestClaims = useCallback((batches: SplitClaimResponse[]) => {
    setSession((current) => (current ? reduceGuestClaims(current, batches) : current));
  }, []);
  const live = useSplitLiveLink(session, applyGuestClaims);
  const resumeLive = live.resume;

  // L2.M5 — on reopen, if a live table was left running, re-fetch it from the
  // server (the source of truth) and resume the SAME link so guests stay
  // connected. A revoked/missing/corrupt table is forgotten silently.
  // B1 — a pending receipt→split handoff is an explicit NEW bill, so it always
  // wins over resume: seed resumedRef true (skip the resume effect) and never
  // show the "Retomando…" spinner for it.
  // B1 (receipt) and C2 (outing) both hand off an explicit NEW bill that must win
  // over resuming a previous live table.
  const hasPendingHandoff = hasPendingReceiptSplitHandoff() || hasPendingOutingSplitHandoff();
  const [resuming, setResuming] = useState(
    () => !forceNew && loadOwnerLive() !== null && !hasPendingHandoff,
  );
  const resumedRef = useRef(hasPendingHandoff);

  // C2 — when this split was promoted from a solo outing, the source outing's
  // session id, so the commit (and its undo) can MOVE the rounds instead of
  // double-counting (the council's "move, not duplicate").
  const supersedeOutingRef = useRef<string | null>(null);

  // B1 (audit §2.1) — a bill scanned in the receipt door chose "Dividir ao vivo".
  // Consume the single-use handoff and open straight on the divide screen with the
  // session prebuilt from the SAME OCR read (no second scan), reusing the exact
  // buildSplitFromReceipt path the manual scan uses. Waits for trip data so the
  // session is tied to the real trip; the photo rides along for the attachment.
  const handoffConsumedRef = useRef(false);
  useEffect(() => {
    if (handoffConsumedRef.current) return;
    if (!hasPendingReceiptSplitHandoff()) return;
    if (!trip) return;
    handoffConsumedRef.current = true;
    const handoff = takeReceiptSplitHandoff();
    if (!handoff) return;
    const draft = buildSplitFromReceipt(handoff.plan, {
      tripId: trip.id,
      phaseId: resolveActivePhase(phases)?.id ?? null,
      ownerName,
      fallbackCurrency: baseCurrency,
      ownerActorId: null,
    });
    setSession(draft.session);
    setActivePersonId(draft.session.participants[0]?.id ?? null);
    setCompressed(handoff.image);
    setAskTax(draft.needsServiceChargePrompt);
    setPhase('divide');
    if (draft.session.items.length === 0) {
      showToast(t('receiptScan.no_items_found'), 'warning', { durationMs: 6000 });
    }
  }, [trip, phases, ownerName, baseCurrency, t]);

  // C2 (coherence §2.1) — a solo outing chose "Dividir esta saída". Consume the
  // single-use handoff and open straight on the divide screen with the session
  // already built from the outing's rounds (buildSplitFromOuting). The source
  // outing's id is held so the commit MOVES the rounds (no double-count).
  const outingHandoffConsumedRef = useRef(false);
  useEffect(() => {
    if (outingHandoffConsumedRef.current) return;
    if (!hasPendingOutingSplitHandoff()) return;
    if (!trip) return;
    outingHandoffConsumedRef.current = true;
    const handoff = takeOutingSplitHandoff();
    if (!handoff) return;
    supersedeOutingRef.current = handoff.supersedeOutingSessionId;
    setSession(handoff.session);
    setActivePersonId(handoff.session.participants[0]?.id ?? null);
    setPhase('divide');
    if (handoff.session.items.length === 0) {
      showToast(t('receiptScan.no_items_found'), 'warning', { durationMs: 6000 });
    }
  }, [trip, t]);

  // Tracks whether THIS screen is still mounted. A plain `cancelled` local is
  // defeated by React 19 StrictMode (and fast remounts): the first run's cleanup
  // cancels it, then the `resumedRef` guard makes the second run a no-op, so the
  // in-flight fetch resolves cancelled and the spinner sticks forever. A ref that
  // is re-armed at the start of every run survives the double-invoke.
  const resumeMountedRef = useRef(true);
  useEffect(() => {
    resumeMountedRef.current = true;
    const markUnmounted = () => {
      resumeMountedRef.current = false;
    };
    if (resumedRef.current) return markUnmounted;
    resumedRef.current = true;
    // "Nova divisão" explicitly skips resume so the user gets a clean start.
    if (forceNew) {
      setResuming(false);
      return markUnmounted;
    }
    const creds = loadOwnerLive();
    if (!creds) {
      setResuming(false);
      return markUnmounted;
    }
    void (async () => {
      try {
        const res = await fetchSplitTable(creds.shareId, creds.key);
        if (!resumeMountedRef.current) return;
        if (res.status === 'ok') {
          setSession(res.payload.session);
          setActivePersonId(res.payload.session.participants[0]?.id ?? null);
          setPhase('divide');
          resumeLive(creds, res.payload.session, res.payload.revision);
        } else if (res.status !== 'error') {
          // revoked / not_found / bad_key → the table is gone or unreadable; drop it.
          clearOwnerLive();
        }
        // transient 'error' → keep creds; a later reopen can retry.
      } catch (err) {
        // Never strand the user on the "Retomando…" spinner: an unexpected
        // failure just falls back to the capture screen (creds are kept so a
        // later reopen can retry the table).
        console.error('[split] resume failed', err);
      } finally {
        if (resumeMountedRef.current) setResuming(false);
      }
    })();
    return markUnmounted;
  }, [resumeLive, forceNew]);

  const totals = useMemo(() => (session ? computeSplitTotals(session) : null), [session]);
  // The authoritative commit numbers (owner absorbs orphans, bill is whole) — used
  // for "minha parte" + the CTA so the screen never lies about what gets logged.
  const plan = useMemo(() => (session ? buildSplitCommitPlan(session, {}) : null), [session]);
  const unclaimed = useMemo(
    () => (session && session.mode === 'itemized' ? detectUnclaimed(session) : []),
    [session],
  );
  const subtotalCents = session ? itemsSubtotalCents(session) : 0;
  const taxCents = session ? serviceChargeAmountCents(session.serviceCharge, subtotalCents) : 0;

  // E8: the owner's slice in the BILL currency, then converted to the trip base
  // for the budget bridge (foreign bills reuse the frozen FX, DEC-instrument).
  const billRate = useMemo(() => {
    if (!session || session.currency === baseCurrency) return null;
    return resolveFrozenRate(settings?.frozenRates ?? null, session.currency, baseCurrency);
  }, [session, baseCurrency, settings]);

  const ownerBillCents = plan?.ownerCostCents ?? 0;
  const ownerBaseCents = billRate !== null && billRate > 0 ? convertToBaseCents(ownerBillCents, billRate) : ownerBillCents;
  const reading = useSplitBudgetReading(ownerBaseCents);

  /* ── capture ─────────────────────────────────────────────────────────── */

  const beginSession = (over: Partial<Parameters<typeof createSplitSession>[0]> = {}): SplitSession =>
    createSplitSession({
      tripId: trip?.id ?? null,
      phaseId: resolveActivePhase(phases)?.id ?? null,
      name: t('split.default_name'),
      currency: baseCurrency,
      ownerName,
      ...over,
    });

  const startManual = () => {
    const first = createSplitItem({ description: '', amountCents: 0, category: 'restaurant' });
    const next = beginSession({ items: [first] });
    setSession(next);
    setActivePersonId(next.participants[0]?.id ?? null);
    setCompressed(null);
    setAskTax(false);
    setPhase('divide');
    setEditingItemId(first.id);
  };

  const enableCloudThenPick = async () => {
    await appSettingsRepository.update({ cloudReceiptOcrEnabled: true });
    await reload();
    receiptChooser.open();
  };

  const processReceiptFile = async (file: File) => {
    setPhase('reading');
    try {
      const image = await compressImageFile(file);
      setCompressed(image);
      const dataUrl = await blobToDataUrl(image.blob);
      const outcome = await extractReceiptViaCloud(dataUrl);
      if (outcome.ok) {
        const draft = buildSplitFromReceipt(outcome.plan, {
          tripId: trip?.id ?? null,
          phaseId: resolveActivePhase(phases)?.id ?? null,
          ownerName,
          fallbackCurrency: baseCurrency,
          ownerActorId: null,
        });
        setSession(draft.session);
        setActivePersonId(draft.session.participants[0]?.id ?? null);
        setAskTax(draft.needsServiceChargePrompt);
        setPhase('divide');
        if (draft.session.items.length === 0) {
          showToast(t('receiptScan.no_items_found'), 'warning', { durationMs: 6000 });
        }
      } else {
        const reason: ReceiptOcrError = outcome.error;
        showToast(t(`receiptScan.error_${reason}`), 'warning', { durationMs: 7000 });
        const next = beginSession({ items: [createSplitItem({ description: '', amountCents: 0, category: 'restaurant' })] });
        setSession(next);
        setActivePersonId(next.participants[0]?.id ?? null);
        setAskTax(false);
        setPhase('divide');
      }
    } catch (err) {
      console.error('[split] read failed', err);
      showToast(t('receiptScan.error_failed'), 'danger');
      setPhase('capture');
    }
  };

  /* ── session mutations ───────────────────────────────────────────────── */

  const setMode = (mode: SplitMode) => setSession((s) => (s ? { ...s, mode } : s));

  const patchItem = (id: string, patch: Partial<SplitItem>) =>
    setSession((s) => (s ? { ...s, items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) } : s));
  const removeItem = (id: string) =>
    setSession((s) => (s ? { ...s, items: s.items.filter((i) => i.id !== id) } : s));
  const addItem = () => {
    const item = createSplitItem({ description: '', amountCents: 0, category: 'restaurant' });
    setSession((s) => (s ? { ...s, items: [...s.items, item] } : s));
    setEditingItemId(item.id);
  };

  // Pass-the-phone (§10): tapping an item toggles a person's claim. A line's
  // claimers share it equally, so 2 claimers = half each, N = 1/N — the
  // "meio-item / qty→N-donos em 1 toque" behaviour comes for free. Routed through
  // the pure `toggleEqualClaim` so deselecting the SOLE claimer actually clears
  // the line (the old inline version passed [] to splitItemBetween, a no-op, so
  // you could only ever untake an item once someone else had also taken it). The
  // functional update form keeps rapid round-the-table taps free of stale state.
  const toggleClaimFor = (itemId: string, participantId: string) => {
    setSession((s) => (s ? toggleEqualClaim(s, itemId, participantId) : s));
  };
  // F5b — set the active person's unit count on a multi-unit line. Used by the
  // per-unit stepper so two people can each take ONE of "2 pedidos" at full unit
  // price, and a sole taker pays for just the unit(s) they took.
  const setUnitsFor = (itemId: string, units: number) => {
    if (activePersonId === null) return;
    setSession((s) => (s ? setClaimUnits(s, itemId, activePersonId, units) : s));
  };
  const toggleClaim = (itemId: string) => {
    if (activePersonId === null) return;
    // On a multi-unit line a tap takes ONE unit (or releases it), never the whole
    // line — that is the qty>1 "I had one of these" gesture. Single-unit lines
    // keep the equal-share toggle (½/½, N-avos) untouched.
    const item = session?.items.find((i) => i.id === itemId);
    if (item && item.qty > 1) {
      const current = claimedUnits(item, activePersonId);
      setUnitsFor(itemId, current > 0 ? 0 : 1);
      return;
    }
    toggleClaimFor(itemId, activePersonId);
  };

  const toggleCompanion = (realId: string, name: string) => {
    setSession((s) => {
      if (!s) return s;
      const existing = s.participants.find((p) => p.linkedParticipantId === realId);
      if (existing) {
        return {
          ...s,
          participants: s.participants.filter((p) => p.id !== existing.id),
          items: s.items.map((i) => ({ ...i, claims: i.claims.filter((c) => c.participantId !== existing.id) })),
        };
      }
      return addParticipant(s, name, { linkedParticipantId: realId }).session;
    });
  };

  const addAdhoc = (name: string) => {
    const clean = name.trim();
    if (clean === '') return;
    setSession((s) => (s ? addParticipant(s, clean).session : s));
  };

  // Pass-the-phone needs the new participant's id immediately to attach claims, so
  // it mints the participant deterministically and appends via a functional update
  // (robust to the rapid add→claim→add cadence of passing the device around).
  const addAdhocReturningId = (name: string): string | null => {
    const clean = name.trim();
    if (clean === '') return null;
    const participant = createSplitParticipant(clean, 'adhoc');
    setSession((s) => (s ? { ...s, participants: [...s.participants, participant] } : s));
    return participant.id;
  };

  const pickCompanionReturningId = (realId: string, name: string): string | null => {
    if (!session) return null;
    const existing = session.participants.find((p) => p.linkedParticipantId === realId);
    if (existing) return existing.id;
    const participant = createSplitParticipant(name, 'linked', { linkedParticipantId: realId });
    setSession((s) => (s ? { ...s, participants: [...s.participants, participant] } : s));
    return participant.id;
  };

  // T5 (G3): turn an ad-hoc name into a real trip Participant. Creates the roster
  // person (linking their device when the slice came from a live-table guest),
  // then re-points the SplitParticipant so commit mints a real debt that rides
  // the existing DEC-106 mirror into their app. Reversible by removing the chip.
  const promoteToTripPerson = async (splitParticipantId: string) => {
    if (!trip || !session || busy) return;
    const sp = session.participants.find((p) => p.id === splitParticipantId);
    if (!sp || sp.kind !== 'adhoc') return;
    setBusy(true);
    try {
      const created = createParticipant(trip.id, sp.name, null);
      const participant = sp.actorId !== null ? { ...created, linkedActorId: sp.actorId } : created;
      await participantRepository.create(participant);
      setSession((s) =>
        s ? promoteAdhocToParticipant(s, splitParticipantId, participant.id, { actorId: sp.actorId }) : s,
      );
      await reload();
      showToast(t('split.promoted_toast', { name: sp.name }), 'success');
    } catch {
      showToast(t('backup.operation_failed'), 'danger');
    } finally {
      setBusy(false);
    }
  };

  const removeParticipant = (id: string) => {
    setSession((s) =>
      s
        ? {
            ...s,
            participants: s.participants.filter((p) => p.id !== id),
            items: s.items.map((i) => ({ ...i, claims: i.claims.filter((c) => c.participantId !== id) })),
          }
        : s,
    );
    setActivePersonId((cur) => (cur === id ? session?.participants[0]?.id ?? null : cur));
  };

  const applyServiceCharge = (charge: { mode: ServiceChargeMode; amountCents: number; percent: number | null }) => {
    setSession((s) =>
      s ? { ...s, serviceCharge: { ...charge, source: 'manual' } } : s,
    );
    setAskTax(false);
    setTaxSheetOpen(false);
  };

  const setTaxMode = (mode: ServiceChargeMode) =>
    setSession((s) => (s ? { ...s, serviceCharge: { ...s.serviceCharge, mode } } : s));

  /* ── commit ──────────────────────────────────────────────────────────── */

  const handleCommit = async () => {
    if (!trip || !owner || !session || busy) return;
    if (subtotalCents <= 0) {
      showToast(t('split.commit_empty'), 'warning');
      return;
    }
    const phaseId = resolvedPhaseId;
    // The split charges the pool dedicated to ITS phase (DEC-219) — not a fixed
    // first `linked_phases` pool, which sent every split to the wrong trecho.
    const operationalPool =
      selectActivePhasePool(pools, links, phaseId) ??
      pools.find((p) => p.scope === 'linked_phases') ??
      pools[0];
    if (!operationalPool || !phaseId) {
      showToast(t('backup.operation_failed'), 'danger');
      return;
    }

    setBusy(true);
    try {
      let attachmentId: string | null = null;
      if (compressed) {
        const attachment = newAttachment(compressed, { sessionId: null, transactionId: null });
        await attachmentRepository.add(attachment);
        attachmentId = attachment.id;
      }

      const participantIdMap: Record<string, string> = {};
      for (const p of session.participants) {
        if (p.linkedParticipantId !== null) participantIdMap[p.id] = p.linkedParticipantId;
      }

      const supersededOutingSessionId = supersedeOutingRef.current;
      const result = await commitSplit({
        session,
        tripId: trip.id,
        phaseId,
        budgetPoolId: operationalPool.id,
        ownerParticipantId: owner.id,
        walletId: null,
        participantIdMap,
        exchangeRate: billRate,
        attachmentId,
        supersededOutingSessionId,
      });

      live.stop();
      await reload();
      showToast(t('split.committed_toast'), 'success', {
        durationMs: 8000,
        actionLabel: t('common.undo'),
        onTap: () => {
          void undoSplitCommit({
            splitRecordId: result.splitRecordId,
            sessionId: result.sessionId,
            transactionId: result.transactionId,
            supersededOutingSessionId,
          }).then(() => {
            notifyAppDataChanged();
            showToast(t('common.undo_done'), 'info');
          });
        },
      });
      navigate('/expenses');
    } catch (err) {
      console.error('[split] commit failed', err);
      showToast(t('backup.operation_failed'), 'danger');
    } finally {
      setBusy(false);
    }
  };

  if (!trip) {
    if (error) return <DataErrorScreen onRetry={retry} />;
    if (loading) return <p className="text-on-surface-dim py-8 text-center">{t('common.loading')}</p>;
    return <Navigate to="/welcome" replace />;
  }

  const currency = session?.currency ?? baseCurrency;
  const editingItem = editingItemId !== null && session ? session.items.find((i) => i.id === editingItemId) : undefined;

  return (
    <div className="max-w-[430px] mx-auto flex flex-col gap-4 px-5 pt-2 pb-28">
      {receiptChooser.element}

      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <div>
          <h1 className="text-heading font-bold text-on-surface leading-tight">{t('split.title')}</h1>
          <p className="text-[11px] text-on-surface-faint">{t('split.subtitle')}</p>
        </div>
      </div>

      {phase === 'capture' && resuming && (
        <div className="flex flex-col items-center gap-3 py-16">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-on-surface-dim">{t('splitTable.resuming')}</p>
        </div>
      )}

      {phase === 'capture' && !resuming && (
        <div className="flex flex-col gap-3">
          {!cloudEnabled ? (
            <div className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: 'var(--surface-container)' }}>
              <div className="flex items-center gap-2">
                <Icon name="auto_awesome" size={20} className="text-primary" />
                <p className="text-sm font-bold text-on-surface">{t('receiptScan.consent_title')}</p>
              </div>
              <p className="text-xs text-on-surface-dim leading-relaxed">{t('receiptScan.consent_body')}</p>
              <button
                onClick={() => void enableCloudThenPick()}
                className="w-full py-3 rounded-2xl bg-primary text-on-surface font-bold btn-press"
              >
                {t('receiptScan.consent_enable')}
              </button>
            </div>
          ) : (
            <button
              onClick={() => receiptChooser.open()}
              className="rounded-2xl p-4 flex items-center gap-3 btn-press text-left"
              style={{ background: 'var(--surface-container)' }}
            >
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'rgba(124,160,255,0.16)' }}>
                <Icon name="auto_awesome" size={24} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-on-surface">{t('split.scan_ai')}</span>
                <span className="block text-[11px] text-on-surface-faint">{t('split.scan_ai_hint')}</span>
              </div>
              <Icon name="chevron_right" size={18} className="text-on-surface-faint shrink-0" />
            </button>
          )}

          <button
            onClick={startManual}
            className="rounded-2xl p-4 flex items-center gap-3 btn-press text-left"
            style={{ background: 'var(--surface-container)' }}
          >
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'var(--surface-high)' }}>
              <Icon name="edit" size={22} className="text-on-surface-dim" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="block text-sm font-bold text-on-surface">{t('split.add_manually')}</span>
              <span className="block text-[11px] text-on-surface-faint">{t('split.add_manually_hint')}</span>
            </div>
            <Icon name="chevron_right" size={18} className="text-on-surface-faint shrink-0" />
          </button>
        </div>
      )}

      {phase === 'reading' && (
        <div className="flex flex-col items-center gap-3 py-16">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-on-surface-dim">{t('receiptScan.reading')}</p>
        </div>
      )}

      {phase === 'divide' && session && totals && (
        <div className="flex flex-col gap-4">
          <input
            value={session.name}
            onChange={(e) => setSession((s) => (s ? { ...s, name: e.target.value } : s))}
            placeholder={t('split.default_name')}
            className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold text-on-surface bg-surface-container outline-none"
          />

          {/* G2: live table link — pass-the-phone OR everyone claims on their own device. */}
          <LiveTableCard
            live={live}
            t={t}
            onCommit={() => void handleCommit()}
            committing={busy}
            canCommit={subtotalCents > 0}
          />

          {/* Service charge (§9) — ask when unknown, otherwise show + tweak. */}
          {askTax ? (
            <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: 'var(--surface-container)' }}>
              <p className="text-sm font-bold text-on-surface">{t('split.tax_ask_title')}</p>
              <p className="text-xs text-on-surface-dim">{t('split.tax_ask_body')}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    applyServiceCharge({ mode: 'none', amountCents: 0, percent: null });
                  }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold btn-press bg-surface-high text-on-surface"
                >
                  {t('split.tax_none')}
                </button>
                <button
                  onClick={() => setTaxSheetOpen(true)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold btn-press bg-primary text-on-surface"
                >
                  {t('split.tax_yes')}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setTaxSheetOpen(true)}
              className="rounded-2xl p-3.5 flex items-center gap-3 btn-press text-left"
              style={{ background: 'var(--surface-container)' }}
            >
              <Icon name="receipt_long" size={20} className="text-on-surface-dim shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-on-surface">{t('split.tax_label')}</p>
                <p className="text-[11px] text-on-surface-faint">
                  {session.serviceCharge.mode === 'none'
                    ? t('split.tax_off')
                    : `${formatMoney(taxCents, currency)} · ${t(`split.tax_mode_${session.serviceCharge.mode}`)}`}
                </p>
              </div>
              <Icon name="tune" size={18} className="text-on-surface-faint shrink-0" />
            </button>
          )}

          {/* Mode fork (§10). */}
          <div className="grid grid-cols-3 gap-2">
            {SPLIT_MODES.map((m) => {
              const active = session.mode === m;
              return (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`py-2.5 rounded-xl text-xs font-bold btn-press ${active ? 'bg-primary text-on-surface' : 'bg-surface-container text-on-surface-dim'}`}
                >
                  {t(`split.mode_${m}`)}
                </button>
              );
            })}
          </div>

          {/* Participants (real companions create debts; ad-hoc are ephemeral). */}
          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-faint">
              {t('split.people_label')}
            </p>
            <div className="flex flex-wrap gap-2">
              {session.participants.map((p) => {
                const isOwnerP = p.kind === 'owner';
                return (
                  <span
                    key={p.id}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 bg-surface-high text-on-surface"
                  >
                    {p.kind === 'linked' && (
                      <Icon name="link" size={11} className="text-primary" aria-hidden />
                    )}
                    {isOwnerP ? t('split.you') : p.name}
                    {p.kind === 'adhoc' && (
                      <button
                        onClick={() => void promoteToTripPerson(p.id)}
                        className="btn-press"
                        aria-label={t('split.promote_aria', { name: p.name })}
                        title={t('split.promote_hint')}
                      >
                        <Icon name="person_add" size={12} className="text-primary" />
                      </button>
                    )}
                    {!isOwnerP && (
                      <button onClick={() => removeParticipant(p.id)} className="btn-press" aria-label={t('common.delete')}>
                        <Icon name="close" size={12} className="text-on-surface-faint" />
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2">
              {companions
                .filter((c) => !session.participants.some((p) => p.linkedParticipantId === c.id))
                .map((c) => (
                  <button
                    key={c.id}
                    onClick={() => toggleCompanion(c.id, c.name)}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold btn-press bg-surface-container text-on-surface-dim flex items-center gap-1"
                  >
                    <Icon name="add" size={13} className="text-on-surface-faint" />
                    {c.name}
                  </button>
                ))}
              <button
                onClick={() => setPersonSheetOpen(true)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold btn-press bg-surface-container text-primary flex items-center gap-1"
              >
                <Icon name="person_add" size={13} className="text-primary" />
                {t('split.add_person')}
              </button>
            </div>
          </div>

          {/* Itemized board (pass-the-phone claim). */}
          {session.mode === 'itemized' && (
            <div className="flex flex-col gap-3">
              {/* Guided round-the-table flow: hand the phone around, each person
                  names themselves and marks their items. */}
              <button
                onClick={() => setPassPhoneOpen(true)}
                className="w-full rounded-2xl p-3.5 flex items-center gap-3 btn-press text-left"
                style={{ background: 'var(--surface-container)' }}
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'color-mix(in srgb, var(--primary) 22%, transparent)' }}
                >
                  <Icon name="swap_horiz" size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-on-surface">{t('passPhone.cta_title')}</p>
                  <p className="text-[11px] text-on-surface-faint">{t('passPhone.cta_subtitle')}</p>
                </div>
                <Icon name="chevron_right" size={18} className="text-on-surface-faint shrink-0" />
              </button>

              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-faint">
                  {t('split.active_person')}
                </p>
                <div className="flex rounded-lg overflow-hidden bg-surface-container">
                  {(['item', 'person'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setView(v)}
                      className={`px-2.5 py-1 text-[11px] font-bold btn-press ${view === v ? 'bg-primary text-on-surface' : 'text-on-surface-dim'}`}
                    >
                      {t(`split.view_${v}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {session.participants.map((p) => {
                  const active = activePersonId === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setActivePersonId(p.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold btn-press flex items-center gap-1.5 ${active ? 'bg-primary text-on-surface' : 'bg-surface-container text-on-surface-dim'}`}
                    >
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] bg-surface-high text-on-surface">
                        {initials(p.kind === 'owner' ? ownerName : p.name)}
                      </span>
                      {p.kind === 'owner' ? t('split.you') : p.name}
                    </button>
                  );
                })}
              </div>

              {view === 'item' ? (
                <div className="flex flex-col gap-2">
                  {session.items.map((item) => {
                    const claimers = item.claims.map((c) => c.participantId);
                    const isMulti = item.qty > 1;
                    const activeUnits = activePersonId !== null ? claimedUnits(item, activePersonId) : 0;
                    const takenUnits = isMulti
                      ? item.claims.reduce((sum, c) => sum + claimedUnits(item, c.participantId), 0)
                      : 0;
                    const freeUnits = Math.max(0, item.qty - takenUnits);
                    const mine = isMulti ? activeUnits > 0 : activePersonId !== null && claimers.includes(activePersonId);
                    const orphan = isMulti ? takenUnits === 0 : claimers.length === 0;
                    return (
                      <div
                        key={item.id}
                        className={`rounded-2xl p-3 flex items-center gap-3 ${orphan ? 'ring-1 ring-warning/40' : ''}`}
                        style={{ background: 'var(--surface-container)' }}
                      >
                        <button onClick={() => toggleClaim(item.id)} className="flex-1 min-w-0 flex items-center gap-3 text-left btn-press">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${mine ? 'bg-primary' : 'bg-surface-high'}`}
                          >
                            <Icon name={mine ? 'check' : getCategoryIcon(item.category)} size={18} className={mine ? 'text-on-surface' : 'text-on-surface-dim'} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-on-surface truncate">
                              {item.description || t('split.unnamed_item')}
                              {isMulti && (
                                <span className="ml-1.5 text-[10px] font-bold text-primary align-middle">
                                  {t('split.qty_badge', { count: item.qty })}
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-on-surface-faint">
                              {isMulti
                                ? `${formatMoney(item.unitAmountCents, currency)} ${t('split.per_unit')}`
                                : formatMoney(item.amountCents, currency)}
                              {isMulti
                                ? freeUnits > 0
                                  ? ` · ${t('split.units_free', { count: freeUnits })}`
                                  : ` · ${t('split.units_all_taken')}`
                                : claimers.length > 1
                                  ? ` · ${t('split.shared_n', { count: claimers.length })}`
                                  : ''}
                              {!isMulti && orphan && ` · ${t('split.unclaimed')}`}
                            </p>
                          </div>
                        </button>
                        {isMulti && activePersonId !== null && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => setUnitsFor(item.id, activeUnits - 1)}
                              disabled={activeUnits <= 0}
                              className="w-7 h-7 rounded-lg flex items-center justify-center btn-press bg-surface-high text-on-surface disabled:opacity-30"
                              aria-label={t('split.unit_minus')}
                            >
                              <Icon name="remove" size={15} className="text-on-surface" />
                            </button>
                            <span className="w-5 text-center text-sm font-bold text-on-surface tabular-nums">{activeUnits}</span>
                            <button
                              onClick={() => setUnitsFor(item.id, activeUnits + 1)}
                              disabled={activeUnits >= item.qty}
                              className="w-7 h-7 rounded-lg flex items-center justify-center btn-press bg-surface-high text-on-surface disabled:opacity-30"
                              aria-label={t('split.unit_plus')}
                            >
                              <Icon name="add" size={15} className="text-on-surface" />
                            </button>
                          </div>
                        )}
                        <div className="flex -space-x-1.5 shrink-0">
                          {claimers.slice(0, 4).map((cid) => {
                            const p = session.participants.find((x) => x.id === cid);
                            return (
                              <span
                                key={cid}
                                className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border border-surface-container bg-surface-high text-on-surface"
                              >
                                {initials(p?.kind === 'owner' ? ownerName : p?.name ?? '?')}
                              </span>
                            );
                          })}
                        </div>
                        <button onClick={() => setEditingItemId(item.id)} className="btn-press p-1 shrink-0" aria-label={t('common.edit')}>
                          <Icon name="edit" size={16} className="text-on-surface-faint" />
                        </button>
                      </div>
                    );
                  })}
                  <button onClick={addItem} className="py-2.5 rounded-xl text-sm font-semibold btn-press bg-surface-container text-primary flex items-center justify-center gap-1.5">
                    <Icon name="add" size={16} className="text-primary" />
                    {t('split.add_item')}
                  </button>
                </div>
              ) : (
                <PersonCards totals={totals} session={session} currency={currency} ownerName={ownerName} t={t} />
              )}

              {unclaimed.length > 0 && (
                <div className="rounded-xl px-3 py-2.5 text-[12px] font-medium text-warning bg-warning/10 flex items-center gap-2">
                  <Icon name="error" size={15} className="text-warning shrink-0" />
                  {t('split.unclaimed_warn', {
                    count: unclaimed.length,
                    amount: formatMoney(unclaimed.reduce((s, i) => s + i.amountCents, 0), currency),
                  })}
                </div>
              )}
            </div>
          )}

          {/* Equal / mine: just show the per-person cards. */}
          {session.mode !== 'itemized' && (
            <PersonCards totals={totals} session={session} currency={currency} ownerName={ownerName} t={t} />
          )}

          {/* Budget bridge + commit. */}
          <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: 'var(--surface-container)' }}>
            {/* "o que eu peguei pra mim" as the hero — the number that matters to
                the owner at commit time — with the whole bill as the quiet anchor. */}
            <div
              className="rounded-xl px-3.5 py-3 flex items-center justify-between gap-3"
              style={{ background: 'var(--surface-high)' }}
            >
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-faint">
                  {t('split.my_part')}
                </p>
                <p className="text-[26px] leading-none font-extrabold text-on-surface mt-1 tabular">
                  {formatMoney(ownerBillCents, currency)}
                </p>
                <p className="text-[11px] text-on-surface-faint mt-1">
                  {t('split.of_bill_total', {
                    total: formatMoney(plan?.grandTotalCents ?? totals.grandTotalCents, currency),
                  })}
                </p>
              </div>
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'var(--primary)' }}
              >
                <Icon name="person" size={20} className="text-on-surface" filled />
              </div>
            </div>
            {reading && <BudgetReading reading={reading} currency={baseCurrency} t={t} />}
            {/* Julio field feedback: pick the trecho/fase this split charges.
                AUTO = today's active phase; hidden when there's a single phase. */}
            <PhaseChargePicker
              phases={sortedPhases}
              value={selectedPhaseId}
              onChange={setSelectedPhaseId}
              label={t('phase_picker.label')}
              autoLabel={t('phase_picker.auto_today')}
              autoResolvedName={
                sortedPhases.find((p) => p.id === resolveActivePhase(phases)?.id)?.name ?? null
              }
            />
            <button
              onClick={() => void handleCommit()}
              disabled={busy || subtotalCents <= 0}
              className="w-full py-3 rounded-2xl bg-primary text-on-surface font-bold btn-press disabled:opacity-50"
            >
              {t('split.commit', { total: formatMoney(plan?.grandTotalCents ?? totals.grandTotalCents, currency) })}
            </button>
            {/* "a conta toda" — the full who-got-what record, one tap from commit. */}
            <button
              onClick={() => setHistoryOpen(true)}
              className="w-full py-2 rounded-xl btn-press flex items-center justify-center gap-1.5 text-on-surface-dim"
            >
              <Icon name="history" size={15} className="text-on-surface-dim" />
              <span className="text-[12px] font-semibold">{t('splitHistory.see_full')}</span>
            </button>
          </div>
        </div>
      )}

      <ItemEditor
        item={editingItem}
        currency={currency}
        onClose={() => setEditingItemId(null)}
        onPatch={patchItem}
        onRemove={(id) => {
          removeItem(id);
          setEditingItemId(null);
        }}
        t={t}
      />

      <TaxEditor
        open={taxSheetOpen}
        currency={currency}
        subtotalCents={subtotalCents}
        onClose={() => setTaxSheetOpen(false)}
        onApply={applyServiceCharge}
        t={t}
      />

      <PersonEditor
        open={personSheetOpen}
        onClose={() => setPersonSheetOpen(false)}
        onAdd={(name) => {
          addAdhoc(name);
          setPersonSheetOpen(false);
        }}
        connections={connections}
        existingActorIds={session ? session.participants.map((p) => p.actorId).filter((id): id is string => id !== null) : []}
        onAddFriend={(conn) => {
          addFriend(conn);
          setPersonSheetOpen(false);
        }}
        t={t}
      />

      <SplitHistorySheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        session={session}
        ownerName={ownerName}
      />

      <PassThePhoneSheet
        open={passPhoneOpen}
        onClose={() => setPassPhoneOpen(false)}
        session={session}
        companions={companions}
        currency={currency}
        ownerName={ownerName}
        onAddPerson={addAdhocReturningId}
        onPickCompanion={pickCompanionReturningId}
        onToggleItem={toggleClaimFor}
      />

      {session && session.serviceCharge.mode !== 'none' && phase === 'divide' && (
        <TaxModeFloating mode={session.serviceCharge.mode} onChange={setTaxMode} />
      )}
    </div>
  );
}

/* ── subcomponents ─────────────────────────────────────────────────────── */

type TFn = ReturnType<typeof useTranslation>['t'];

/**
 * G2 — the owner's control for the live table. Before starting it is a single
 * invite button; once live it shows the share affordance + how many guests have
 * joined + an "end" action. The owner keeps editing the bill normally; guest
 * claims merge in automatically (owner-reducer).
 */
function LiveTableCard({
  live,
  t,
  onCommit,
  committing,
  canCommit,
}: {
  live: SplitLiveLink;
  t: TFn;
  onCommit: () => void;
  committing: boolean;
  canCommit: boolean;
}) {
  const [shareOpen, setShareOpen] = useState(false);
  // "Encerrar" is a fork, not a single action: turn the live table into a logged
  // expense, or just stop sharing and keep editing offline.
  const [endOpen, setEndOpen] = useState(false);

  // Going live is the "saída começou" moment — a real user gesture, so it's the
  // right time to ask (once) for notification permission so the persistent
  // "a divisão está rolando" alert can appear while the app is in the background.
  const startLive = () => {
    live.start();
    void requestSplitNotificationPermission();
  };

  if (live.status === 'idle') {
    return (
      <button
        onClick={startLive}
        className="rounded-2xl p-3.5 flex items-center gap-3 btn-press text-left"
        style={{ background: 'var(--surface-container)' }}
      >
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ background: 'rgba(124,160,255,0.16)' }}>
          <Icon name="groups" size={22} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold text-on-surface">{t('splitTable.invite_title')}</p>
          <p className="text-[11px] text-on-surface-faint">{t('splitTable.invite_hint')}</p>
        </div>
        <Icon name="ios_share" size={18} className="text-on-surface-faint shrink-0" />
      </button>
    );
  }

  if (live.status === 'starting') {
    return (
      <div className="rounded-2xl p-3.5 flex items-center gap-3" style={{ background: 'var(--surface-container)' }}>
        <div className="w-5 h-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <p className="text-[13px] font-semibold text-on-surface-dim">{t('splitTable.starting')}</p>
      </div>
    );
  }

  if (live.status === 'error') {
    return (
      <button
        onClick={startLive}
        className="rounded-2xl p-3.5 flex items-center gap-3 btn-press text-left"
        style={{ background: 'var(--surface-container)' }}
      >
        <Icon name="error" size={20} className="text-warning shrink-0" />
        <p className="flex-1 text-[12px] font-semibold text-on-surface-dim">{t('splitTable.start_failed')}</p>
        <span className="text-[12px] font-bold text-primary">{t('splitTable.retry')}</span>
      </button>
    );
  }

  return (
    <div className="rounded-2xl p-3.5 flex flex-col gap-3" style={{ background: 'rgba(124,160,255,0.10)' }}>
      <div className="flex items-center gap-2.5">
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <p className="text-[13px] font-bold text-on-surface">{t('splitTable.live_on')}</p>
            <LiveStatusBadge socketOpen={live.socketOpen} lastSyncAt={live.lastSyncAt} onReconnect={live.reconnect} />
          </div>
          <p className="text-[11px] text-on-surface-faint">
            {live.guestCount > 0
              ? t('splitTable.guests_joined', { count: live.guestCount })
              : t('splitTable.waiting_guests')}
          </p>
        </div>
        <button onClick={() => setEndOpen(true)} className="btn-press text-[12px] font-bold text-error px-2 py-1">
          {t('splitTable.end')}
        </button>
      </div>
      <button
        onClick={() => setShareOpen(true)}
        className="w-full py-2.5 rounded-xl bg-primary text-on-surface font-bold text-sm btn-press flex items-center justify-center gap-2"
      >
        <Icon name="ios_share" size={16} className="text-on-surface" />
        {t('splitTable.share_link')}
      </button>
      <LiveShareSheet open={shareOpen} link={live.link} onClose={() => setShareOpen(false)} t={t} />
      <SplitEndSheet
        open={endOpen}
        onClose={() => setEndOpen(false)}
        onCommit={() => {
          setEndOpen(false);
          onCommit();
        }}
        onStop={() => {
          setEndOpen(false);
          live.stop();
        }}
        canCommit={canCommit}
        committing={committing}
        t={t}
      />
    </div>
  );
}

/**
 * The "Encerrar" fork (Julio: "tem que ter o botão de encerrar para realmente
 * virar um gasto no histórico"). Registering commits the division as an expense
 * (and stops the live table); "só parar de compartilhar" revokes the link but
 * keeps the draft open so the owner can keep editing offline.
 */
function SplitEndSheet({
  open,
  onClose,
  onCommit,
  onStop,
  canCommit,
  committing,
  t,
}: {
  open: boolean;
  onClose: () => void;
  onCommit: () => void;
  onStop: () => void;
  canCommit: boolean;
  committing: boolean;
  t: TFn;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={t('splitTable.end_title')}>
      <div className="flex flex-col gap-3 pb-2">
        <p className="text-xs text-on-surface-dim leading-relaxed">{t('splitTable.end_body')}</p>
        <button
          onClick={onCommit}
          disabled={!canCommit || committing}
          className="w-full p-3.5 rounded-2xl flex items-center gap-3 btn-press text-left bg-primary disabled:opacity-50"
        >
          <Icon name="check_circle" size={22} className="text-on-surface shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-on-surface">{t('splitTable.end_register')}</p>
            <p className="text-[11px] text-on-surface/70">{t('splitTable.end_register_hint')}</p>
          </div>
        </button>
        <button
          onClick={onStop}
          className="w-full p-3.5 rounded-2xl flex items-center gap-3 btn-press text-left bg-surface-high"
        >
          <Icon name="link_off" size={22} className="text-on-surface-dim shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-on-surface">{t('splitTable.end_stop')}</p>
            <p className="text-[11px] text-on-surface-faint">{t('splitTable.end_stop_hint')}</p>
          </div>
        </button>
      </div>
    </BottomSheet>
  );
}

/**
 * The share affordance the owner gets the moment the table is live: a QR for
 * phones that are physically together, plus explicit "copy" and "share" actions.
 * D-BUG fix: the old single button silently fell back to the clipboard inside the
 * installed app (no Web Share), so the user thought sharing was "just copying".
 * Here every channel is its own button, so the intent is never ambiguous.
 */
function LiveShareSheet({
  open,
  link,
  onClose,
  t,
}: {
  open: boolean;
  link: string | null;
  onClose: () => void;
  t: TFn;
}) {
  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      showToast(t('splitTable.link_copied'), 'success');
    } catch {
      showToast(link, 'info', { durationMs: 8000 });
    }
  };

  const share = async () => {
    if (!link) return;
    const outcome = await shareOrCopyLink({
      url: link,
      text: t('splitTable.share_text'),
      title: t('splitTable.share_title'),
    });
    if (outcome === 'copied') showToast(t('splitTable.link_copied'), 'success');
    else if (outcome === 'copy_failed') showToast(link, 'info', { durationMs: 8000 });
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={t('splitTable.share_sheet_title')}>
      <div className="flex flex-col gap-4 pb-2">
        {link && <QrCodeDisplay value={link} size={220} />}
        <p className="text-[12px] text-on-surface-dim text-center leading-relaxed">
          {t('splitTable.share_qr_hint')}
        </p>
        {link && (
          <p className="rounded-xl px-3 py-2.5 bg-surface-high text-[11px] text-on-surface-faint break-all text-center">
            {link}
          </p>
        )}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => void copy()}
            className="py-3 rounded-2xl bg-surface-high text-on-surface font-bold text-sm btn-press flex items-center justify-center gap-2"
          >
            <Icon name="content_copy" size={16} className="text-on-surface" />
            {t('splitTable.copy_link')}
          </button>
          <button
            onClick={() => void share()}
            className="py-3 rounded-2xl bg-primary text-on-surface font-bold text-sm btn-press flex items-center justify-center gap-2"
          >
            <Icon name="ios_share" size={16} className="text-on-surface" />
            {t('splitTable.share_link')}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

function PersonCards({
  totals,
  session,
  currency,
  ownerName,
  t,
}: {
  totals: ReturnType<typeof computeSplitTotals>;
  session: SplitSession;
  currency: string;
  ownerName: string;
  t: TFn;
}) {
  return (
    <div className="flex flex-col gap-2">
      {totals.totals.map((pt) => {
        const p = session.participants.find((x) => x.id === pt.participantId);
        const isOwnerP = p?.kind === 'owner';
        return (
          <div key={pt.participantId} className="rounded-2xl p-3.5 flex items-center gap-3" style={{ background: 'var(--surface-container)' }}>
            <span className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold bg-surface-high text-on-surface">
              {initials(isOwnerP ? ownerName : p?.name ?? '?')}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-on-surface">{isOwnerP ? t('split.you') : p?.name}</p>
              <p className="text-[11px] text-on-surface-faint">
                {formatMoney(pt.itemsCents, currency)}
                {pt.serviceCents !== 0 && ` · ${t('split.tax_short')} ${formatMoney(pt.serviceCents, currency)}`}
                {pt.adjustmentsCents !== 0 && ` · ${formatMoney(pt.adjustmentsCents, currency)}`}
              </p>
            </div>
            <span className="text-base font-extrabold text-on-surface">{formatMoney(pt.totalCents, currency)}</span>
          </div>
        );
      })}
    </div>
  );
}

function BudgetReading({
  reading,
  currency,
  t,
}: {
  reading: NonNullable<ReturnType<typeof useSplitBudgetReading>>;
  currency: string;
  t: TFn;
}) {
  const style = VERDICT_STYLE[reading.verdict.tone] ?? VERDICT_STYLE.ok!;
  const daily = reading.facts.find((f) => f.kind === 'daily_fits' || f.kind === 'daily_days');
  const free = reading.facts.find((f) => f.kind === 'free_impact' || f.kind === 'exceeds_free');

  let line: string;
  if (free?.kind === 'exceeds_free') {
    line = t('split.reading_exceeds', { amount: formatMoney(free.missingCents, currency) });
  } else if (daily?.kind === 'daily_fits') {
    line = t('split.reading_fits_today');
  } else if (daily?.kind === 'daily_days') {
    line = t('split.reading_days', { days: daily.days });
  } else if (free?.kind === 'free_impact') {
    line = t('split.reading_left', { amount: formatMoney(free.afterCents, currency) });
  } else {
    line = t('split.reading_ok');
  }

  return (
    <div className="flex items-center gap-2">
      <Icon name={style.icon} size={16} className={`${style.className} shrink-0`} />
      <p className="text-[12px] font-medium text-on-surface-dim">{line}</p>
    </div>
  );
}

function TaxModeFloating({ mode, onChange }: { mode: ServiceChargeMode; onChange: (m: ServiceChargeMode) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 justify-center">
      <span className="text-[11px] text-on-surface-faint">{t('split.tax_split_as')}</span>
      <div className="flex rounded-lg overflow-hidden bg-surface-container">
        {TAX_MODES.map((m) => (
          <button
            key={m}
            onClick={() => onChange(m)}
            className={`px-3 py-1 text-[11px] font-bold btn-press ${mode === m ? 'bg-primary text-on-surface' : 'text-on-surface-dim'}`}
          >
            {t(`split.tax_mode_${m}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

function ItemEditor({
  item,
  currency,
  onClose,
  onPatch,
  onRemove,
  t,
}: {
  item: SplitItem | undefined;
  currency: string;
  onClose: () => void;
  onPatch: (id: string, patch: Partial<SplitItem>) => void;
  onRemove: (id: string) => void;
  t: TFn;
}) {
  return (
    <BottomSheet open={item !== undefined} onClose={onClose} title={t('split.edit_item')}>
      {item && (
        <div className="flex flex-col gap-3 pb-2">
          <label className="text-xs font-semibold text-on-surface">{t('split.item_name')}</label>
          <input
            value={item.description}
            onChange={(e) => onPatch(item.id, { description: e.target.value })}
            className="w-full rounded-xl px-3 py-2.5 text-sm bg-surface-high text-on-surface outline-none"
            autoFocus
          />
          <label className="text-xs font-semibold text-on-surface">{t('split.item_amount')} ({currency})</label>
          <input
            type="number"
            inputMode="decimal"
            defaultValue={item.amountCents > 0 ? (item.amountCents / 100).toString() : ''}
            onChange={(e) => {
              const amountCents = toCents(parseFloat(e.target.value) || 0);
              const qty = item.qty > 0 ? item.qty : 1;
              onPatch(item.id, { amountCents, unitAmountCents: Math.round(amountCents / qty) });
            }}
            className="w-full rounded-xl px-3 py-2.5 text-sm bg-surface-high text-on-surface outline-none"
          />
          <label className="text-xs font-semibold text-on-surface">{t('split.item_qty')}</label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const next = Math.max(1, (item.qty > 0 ? item.qty : 1) - 1);
                onPatch(item.id, { qty: next, unitAmountCents: Math.round(item.amountCents / next) });
              }}
              disabled={item.qty <= 1}
              className="w-9 h-9 rounded-xl flex items-center justify-center btn-press bg-surface-high text-on-surface disabled:opacity-30"
              aria-label={t('split.unit_minus')}
            >
              <Icon name="remove" size={16} className="text-on-surface" />
            </button>
            <span className="w-8 text-center text-base font-bold text-on-surface tabular-nums">{item.qty}</span>
            <button
              onClick={() => {
                const next = (item.qty > 0 ? item.qty : 1) + 1;
                onPatch(item.id, { qty: next, unitAmountCents: Math.round(item.amountCents / next) });
              }}
              className="w-9 h-9 rounded-xl flex items-center justify-center btn-press bg-surface-high text-on-surface"
              aria-label={t('split.unit_plus')}
            >
              <Icon name="add" size={16} className="text-on-surface" />
            </button>
            {item.qty > 1 && (
              <span className="text-[11px] text-on-surface-faint">
                {formatMoney(item.unitAmountCents, currency)} {t('split.per_unit')}
              </span>
            )}
          </div>
          <label className="text-xs font-semibold text-on-surface">{t('split.item_category')}</label>
          <div className="grid grid-cols-4 gap-2">
            {SPLIT_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => onPatch(item.id, { category: cat })}
                className={`py-2 rounded-xl flex flex-col items-center gap-1 btn-press ${item.category === cat ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'}`}
              >
                <Icon name={getCategoryIcon(cat)} size={18} />
                <span className="text-[9px] font-semibold">{t(`categories.${cat}`)}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => onRemove(item.id)} className="flex-1 py-2.5 rounded-xl text-sm font-semibold btn-press bg-surface-high text-error">
              {t('common.delete')}
            </button>
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-bold btn-press bg-primary text-on-surface">
              {t('split.item_done')}
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}

function TaxEditor({
  open,
  currency,
  subtotalCents,
  onClose,
  onApply,
  t,
}: {
  open: boolean;
  currency: string;
  subtotalCents: number;
  onClose: () => void;
  onApply: (charge: { mode: ServiceChargeMode; amountCents: number; percent: number | null }) => void;
  t: TFn;
}) {
  const [tab, setTab] = useState<'amount' | 'percent'>('percent');
  const [value, setValue] = useState('');

  const apply = () => {
    const num = parseFloat(value) || 0;
    if (num <= 0) {
      onApply({ mode: 'none', amountCents: 0, percent: null });
      return;
    }
    if (tab === 'percent') {
      onApply({ mode: 'proportional', amountCents: Math.round((subtotalCents * num) / 100), percent: num });
    } else {
      onApply({ mode: 'proportional', amountCents: toCents(num), percent: null });
    }
    setValue('');
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={t('split.tax_title')}>
      <div className="flex flex-col gap-3 pb-2">
        <div className="flex rounded-xl overflow-hidden bg-surface-high">
          {(['percent', 'amount'] as const).map((tb) => (
            <button
              key={tb}
              onClick={() => setTab(tb)}
              className={`flex-1 py-2 text-sm font-bold btn-press ${tab === tb ? 'bg-primary text-on-surface' : 'text-on-surface-dim'}`}
            >
              {tb === 'percent' ? '%' : currency}
            </button>
          ))}
        </div>
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={tab === 'percent' ? '10' : '0.00'}
          className="w-full rounded-xl px-3 py-2.5 text-sm bg-surface-high text-on-surface outline-none"
          autoFocus
        />
        <div className="flex gap-2">
          <button
            onClick={() => onApply({ mode: 'none', amountCents: 0, percent: null })}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold btn-press bg-surface-high text-on-surface"
          >
            {t('split.tax_none')}
          </button>
          <button onClick={apply} className="flex-1 py-2.5 rounded-xl text-sm font-bold btn-press bg-primary text-on-surface">
            {t('common.confirm')}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

const CONNECTION_STATUS_DOT: Record<ConnectionView['status'], string> = {
  connected: 'var(--success)',
  waiting: 'var(--warning)',
  offline: 'var(--on-surface-faint)',
};

function PersonEditor({
  open,
  onClose,
  onAdd,
  connections,
  existingActorIds,
  onAddFriend,
  t,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (name: string) => void;
  connections: ConnectionView[];
  existingActorIds: string[];
  onAddFriend: (conn: ConnectionView) => void;
  t: TFn;
}) {
  const [name, setName] = useState('');
  // B2 — only offer friends not already on this bill (dedupe by actorId).
  const available = connections.filter((c) => !existingActorIds.includes(c.actorId));
  return (
    <BottomSheet open={open} onClose={onClose} title={t('split.add_person')}>
      <div className="flex flex-col gap-3 pb-2">
        {available.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-semibold text-on-surface-faint uppercase tracking-wide">
              {t('split.friends_title')}
            </p>
            <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto">
              {available.map((conn) => (
                <button
                  key={conn.actorId}
                  onClick={() => onAddFriend(conn)}
                  className="flex items-center gap-2.5 w-full rounded-xl px-3 py-2 bg-surface-high btn-press text-left"
                >
                  <span className="w-8 h-8 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                    {initials(conn.displayName)}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-on-surface truncate">
                      {conn.displayName}
                    </span>
                    <span className="flex items-center gap-1.5 text-[10px] text-on-surface-faint">
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: CONNECTION_STATUS_DOT[conn.status] }}
                      />
                      {t(`connections.status_${conn.status}`)}
                    </span>
                  </span>
                  <Icon name="add" size={18} className="text-primary shrink-0" />
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <span className="flex-1 h-px bg-surface-high" />
              <span className="text-[10px] text-on-surface-faint">{t('split.friends_or_new')}</span>
              <span className="flex-1 h-px bg-surface-high" />
            </div>
          </div>
        )}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('split.person_name')}
          className="w-full rounded-xl px-3 py-2.5 text-sm bg-surface-high text-on-surface outline-none"
          autoFocus
        />
        <button
          onClick={() => {
            onAdd(name);
            setName('');
          }}
          className="w-full py-2.5 rounded-xl text-sm font-bold btn-press bg-primary text-on-surface"
        >
          {t('split.add_person')}
        </button>
      </div>
    </BottomSheet>
  );
}
