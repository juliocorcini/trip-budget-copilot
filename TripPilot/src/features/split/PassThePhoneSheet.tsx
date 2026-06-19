import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/BottomSheet';
import { Icon } from '@/components/Icon';
import { formatMoney } from '@/domain/money';
import { computeSplitTotals, type SplitParticipant, type SplitSession } from '@/domain/split';

/** Avatar initials for the round-the-table chips. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

interface Companion {
  id: string;
  name: string;
}

/**
 * "Passar o celular pela mesa" — the guided round-the-table flow the owner runs
 * on a single device: each person says their name (or is matched to an app
 * companion), marks the items they had, then hands the phone to the next person.
 *
 * It is a thin orchestration over the SAME session mutations the manual board
 * uses (add participant + toggle claim), so everything it produces is identical
 * to a hand-built division — it also rides the live link untouched (adhoc people
 * the owner adds here sync out to guests because the owner stays the source of
 * truth). Merge-with-app-users is the companion shortcut on the "who" step.
 */
type Step = 'who' | 'pick';

export function PassThePhoneSheet({
  open,
  onClose,
  session,
  companions,
  currency,
  ownerName,
  onAddPerson,
  onPickCompanion,
  onToggleItem,
}: {
  open: boolean;
  onClose: () => void;
  session: SplitSession | null;
  companions: Companion[];
  currency: string;
  ownerName: string;
  /** Adds an ad-hoc person and returns their new participant id. */
  onAddPerson: (name: string) => string | null;
  /** Adds (or reuses) the linked participant for an app companion. */
  onPickCompanion: (realId: string, name: string) => string | null;
  onToggleItem: (itemId: string, participantId: string) => void;
}) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('who');
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');

  // Each (re)open starts a fresh round at the "who" step.
  useEffect(() => {
    if (open) {
      setStep('who');
      setCurrentId(null);
      setNameDraft('');
    }
  }, [open]);

  const totals = useMemo(() => (session ? computeSplitTotals(session) : null), [session]);
  if (!session) return null;

  const trimmed = nameDraft.trim();
  // Dup guard: a name already at the table reuses that person instead of making
  // a second "João" — the council's anti-duplicate rule for the shared device.
  const dupMatch: SplitParticipant | undefined = trimmed
    ? session.participants.find(
        (p) => p.kind !== 'owner' && p.name.trim().toLowerCase() === trimmed.toLowerCase(),
      )
    : undefined;

  // App companions not yet at the table — tapping merges their slice into the app.
  const availableCompanions = companions.filter(
    (c) => !session.participants.some((p) => p.linkedParticipantId === c.id),
  );

  // People already done this round (everyone but the owner), for the progress row.
  const seated = session.participants.filter((p) => p.kind !== 'owner');

  const goPick = (id: string | null) => {
    if (!id) return;
    setCurrentId(id);
    setNameDraft('');
    setStep('pick');
  };

  const startWithName = () => {
    if (dupMatch) {
      goPick(dupMatch.id);
      return;
    }
    if (!trimmed) return;
    goPick(onAddPerson(trimmed));
  };

  const current = currentId ? session.participants.find((p) => p.id === currentId) ?? null : null;
  const currentTotalCents =
    currentId !== null ? totals?.totals.find((x) => x.participantId === currentId)?.totalCents ?? 0 : 0;
  const currentName = current ? (current.kind === 'owner' ? ownerName : current.name) : '';

  return (
    <BottomSheet open={open} onClose={onClose} title={t('passPhone.title')}>
      {step === 'who' ? (
        <div className="flex flex-col gap-4 pb-2">
          <p className="text-[12px] text-on-surface-dim leading-relaxed">{t('passPhone.who_hint')}</p>

          <div className="flex flex-col gap-2">
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') startWithName();
              }}
              placeholder={t('passPhone.name_placeholder')}
              className="w-full rounded-xl px-3.5 py-3 text-sm font-semibold text-on-surface bg-surface-high outline-none placeholder:text-on-surface-faint"
            />
            {dupMatch && (
              <p className="text-[11px] font-semibold text-warning pl-1">
                {t('passPhone.dup_hint', { name: dupMatch.name })}
              </p>
            )}
            <button
              onClick={startWithName}
              disabled={!trimmed}
              className="w-full rounded-xl py-3 text-sm font-bold btn-press bg-primary text-on-surface disabled:opacity-40"
            >
              {dupMatch ? t('passPhone.continue_with', { name: dupMatch.name }) : t('passPhone.start_person')}
            </button>
          </div>

          {availableCompanions.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-faint">
                {t('passPhone.from_app')}
              </p>
              <div className="flex flex-wrap gap-2">
                {availableCompanions.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => goPick(onPickCompanion(c.id, c.name))}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold btn-press bg-surface-high text-on-surface flex items-center gap-1.5"
                  >
                    <Icon name="smartphone" size={13} className="text-primary" />
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {seated.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-faint">
                {t('passPhone.seated', { count: seated.length })}
              </p>
              <div className="flex flex-col gap-1.5">
                {seated.map((p) => {
                  const pt = totals?.totals.find((x) => x.participantId === p.id);
                  return (
                    <button
                      key={p.id}
                      onClick={() => goPick(p.id)}
                      className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 btn-press bg-surface-container text-left"
                    >
                      <span className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold bg-surface-high text-on-surface shrink-0">
                        {initials(p.name)}
                      </span>
                      <span className="flex-1 min-w-0 text-[13px] font-semibold text-on-surface truncate">
                        {p.name}
                      </span>
                      <span className="text-[12px] font-bold text-on-surface-dim tabular shrink-0">
                        {formatMoney(pt?.totalCents ?? 0, currency)}
                      </span>
                      <Icon name="edit" size={14} className="text-on-surface-faint shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full rounded-xl py-3 text-sm font-bold btn-press bg-surface-high text-on-surface"
          >
            {t('passPhone.done')}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 pb-2">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-bold bg-primary text-on-surface shrink-0">
              {initials(currentName)}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-on-surface truncate">{currentName}</p>
              <p className="text-[11px] text-on-surface-faint">{t('passPhone.pick_hint')}</p>
            </div>
            <span className="text-base font-extrabold text-on-surface shrink-0 tabular">
              {formatMoney(currentTotalCents, currency)}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            {session.items.map((item) => {
              const claimers = item.claims.map((c) => c.participantId);
              const mine = currentId !== null && claimers.includes(currentId);
              const sharedCount = claimers.length;
              return (
                <button
                  key={item.id}
                  onClick={() => currentId && onToggleItem(item.id, currentId)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 btn-press text-left transition-colors"
                  style={{
                    background: mine ? 'var(--primary)' : 'var(--surface-high)',
                    color: mine ? 'var(--on-surface)' : 'var(--on-surface)',
                  }}
                >
                  <Icon
                    name={mine ? 'check_circle' : 'radio_button_unchecked'}
                    size={20}
                    className={mine ? 'text-on-surface' : 'text-on-surface-faint'}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-bold truncate">
                      {item.qty > 1 && <span className="opacity-70">{item.qty}× </span>}
                      {item.description || t('split.unnamed_item')}
                    </p>
                    {mine && sharedCount > 1 && (
                      <p className="text-[10px] font-semibold opacity-80">
                        {t('passPhone.split_among', { count: sharedCount })}
                      </p>
                    )}
                  </div>
                  <span className="text-[13px] font-bold tabular shrink-0">
                    {formatMoney(item.amountCents, currency)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                setStep('who');
                setCurrentId(null);
              }}
              className="w-full rounded-xl py-3.5 text-sm font-bold btn-press bg-primary text-on-surface flex items-center justify-center gap-2"
            >
              <Icon name="swap_horiz" size={18} className="text-on-surface" />
              {t('passPhone.next_person')}
            </button>
            <button
              onClick={onClose}
              className="w-full rounded-xl py-3 text-sm font-bold btn-press bg-surface-high text-on-surface"
            >
              {t('passPhone.finish')}
            </button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
