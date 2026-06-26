import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { groupSplitRepository } from '@/data/repositories';
import { createGroupSplit } from '@/domain/orchestrators';
import { computeGroupBalances, groupTotalCents } from '@/domain/group-split';
import { formatMoney } from '@/domain/money';
import { Icon } from '@/components/Icon';
import { showToast } from '@/components/Toast';
import type { GroupSplitRecord } from '@/domain/types/group-split-record';

const CURRENCIES = ['EUR', 'USD', 'BRL', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY'];

/**
 * C23 / DEC-297 — the Tricount home: every group split (events with many
 * expenses/payers), newest first, plus an inline "new group" form. Tap a row to
 * open the event. Standalone groups and trip-linked groups live together here.
 */
export function GroupSplitListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { trip, participants, settings } = useAppData();

  const [records, setRecords] = useState<GroupSplitRecord[] | null>(null);
  // D03 · DEC-310: the "Dividir" chooser deep-links here with `?new=1` to open
  // the create form straight away (the "start a group split" intent).
  const [creating, setCreating] = useState(() => searchParams.get('new') === '1');
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState(
    () => trip?.baseCurrency ?? settings?.defaultCurrency ?? 'EUR',
  );
  // A01/DEC-338 — optional people seeded inline at creation, with focus-advance add.
  const [people, setPeople] = useState<string[]>([]);
  const [newPerson, setNewPerson] = useState('');
  const newPersonRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);

  const ownerName =
    participants.find((p) => p.isOwner)?.name ?? t('onboarding.default_owner_name');

  useEffect(() => {
    void groupSplitRepository.listEvents().then(setRecords);
  }, []);

  const addPerson = () => {
    const trimmed = newPerson.trim();
    if (trimmed.length === 0) return;
    setPeople((prev) => [...prev, trimmed]);
    setNewPerson('');
    // A02 — keep the keyboard and bounce focus back for the next name.
    newPersonRef.current?.focus();
  };

  const removePerson = (index: number) => {
    setPeople((prev) => prev.filter((_, i) => i !== index));
  };

  const cancelCreate = () => {
    setCreating(false);
    setPeople([]);
    setNewPerson('');
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (submitting || trimmed.length === 0) return;
    setSubmitting(true);
    try {
      const owner = participants.find((p) => p.isOwner) ?? null;
      // Fold a half-typed name in the field so it is never silently dropped.
      const pending = newPerson.trim();
      const peopleNames = pending.length > 0 ? [...people, pending] : people;
      const event = await createGroupSplit({
        name: trimmed,
        currency,
        ownerName,
        tripId: trip?.id ?? null,
        ownerLinkedParticipantId: owner?.id ?? null,
        peopleNames,
      });
      showToast(t('group_split.created'), 'success');
      navigate(`/groups/${event.id}`);
    } catch (err) {
      console.error('[group-split] create failed', err);
      showToast(t('group_split.create_error'), 'danger');
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 py-6">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="btn-press p-1" aria-label={t('common.back')}>
          <Icon name="arrow_back" size={24} className="text-on-surface" />
        </button>
        <h1 className="text-heading font-bold text-on-surface">{t('group_split.title')}</h1>
      </div>
      <p className="text-xs text-on-surface-faint -mt-2">{t('group_split.subtitle')}</p>

      {creating ? (
        <div className="bg-surface-container rounded-xl p-4 flex flex-col gap-3">
          <div>
            <label className="text-xs text-on-surface-faint block mb-1">{t('group_split.form_name')}</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('group_split.form_name_ph')}
              autoFocus
              className="bg-transparent text-sm text-on-surface outline-none w-full"
            />
          </div>
          <div>
            <label className="text-xs text-on-surface-faint block mb-2">{t('onboarding.currency')}</label>
            <div className="flex flex-wrap gap-2">
              {CURRENCIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCurrency(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium btn-press ${
                    currency === c ? 'bg-primary text-on-surface' : 'bg-surface-high text-on-surface-dim'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          {/* A01/DEC-338 — seed people inline; owner is added automatically. */}
          <div>
            <label className="text-xs text-on-surface-faint block mb-2">{t('group_split.people_title')}</label>
            {people.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {people.map((p, i) => (
                  <span
                    key={`${p}-${i}`}
                    className="flex items-center gap-1 pl-3 pr-1.5 py-1 rounded-lg bg-surface-high text-on-surface text-sm font-medium"
                  >
                    {p}
                    <button
                      type="button"
                      onClick={() => removePerson(i)}
                      aria-label={t('group_split.remove_person')}
                      className="btn-press"
                    >
                      <Icon name="close" size={14} className="text-on-surface-faint" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                ref={newPersonRef}
                value={newPerson}
                onChange={(e) => setNewPerson(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPerson()}
                placeholder={t('group_split.add_person_ph')}
                className="bg-surface-high rounded-lg px-3 py-2 text-sm text-on-surface outline-none flex-1"
              />
              <button
                type="button"
                onClick={addPerson}
                disabled={newPerson.trim().length === 0}
                className="btn-press px-3 py-2 rounded-lg bg-primary text-on-surface text-sm font-semibold disabled:opacity-40"
              >
                {t('common.add')}
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={cancelCreate}
              className="flex-1 py-2.5 rounded-xl bg-surface-high text-on-surface-dim font-semibold btn-press"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleCreate}
              disabled={name.trim().length === 0 || submitting}
              className="flex-1 py-2.5 rounded-xl bg-primary text-on-surface font-semibold btn-press disabled:opacity-40"
            >
              {submitting ? t('group_split.creating') : t('group_split.create')}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          className="bg-primary text-on-surface rounded-xl p-3.5 flex items-center justify-center gap-2 font-semibold btn-press"
        >
          <Icon name="add" size={20} className="text-on-surface" />
          {t('group_split.new')}
        </button>
      )}

      {records === null ? null : records.length === 0 ? (
        <div className="bg-surface-container rounded-xl p-6 text-center">
          <Icon name="group" size={32} className="text-on-surface-faint mx-auto mb-2" />
          <p className="text-sm text-on-surface-dim">{t('group_split.empty')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {records.map((r) => (
            <GroupRow key={r.id} record={r} onOpen={() => navigate(`/groups/${r.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

function GroupRow({ record, onOpen }: { record: GroupSplitRecord; onOpen: () => void }) {
  const { t } = useTranslation();
  const { event } = record;
  const total = groupTotalCents(event);
  const peopleCount = event.participants.length;
  const settled = event.status === 'settled';
  // The owner's own net frames the row ("you get back" / "you owe").
  const ownerNet = computeGroupBalances(event).find((b) => b.participantId === event.ownerParticipantId)?.netCents ?? 0;

  return (
    <button
      onClick={onOpen}
      className="bg-surface-container rounded-xl p-4 flex items-center gap-3 text-left btn-press"
    >
      <div className="w-10 h-10 rounded-full bg-surface-high flex items-center justify-center shrink-0">
        <Icon name="group" size={20} className="text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-on-surface truncate">{event.name}</p>
        <p className="text-[11px] text-on-surface-faint">
          {t('group_split.row_meta', {
            people: peopleCount,
            total: formatMoney(total, event.currency),
          })}
        </p>
      </div>
      <div className="text-right shrink-0">
        {settled ? (
          <span className="text-[11px] font-semibold text-success">{t('group_split.status_settled')}</span>
        ) : ownerNet !== 0 ? (
          <span className={`text-xs font-bold ${ownerNet > 0 ? 'text-success' : 'text-on-surface'}`}>
            {ownerNet > 0
              ? t('group_split.row_you_get', { amount: formatMoney(ownerNet, event.currency) })
              : t('group_split.row_you_owe', { amount: formatMoney(-ownerNet, event.currency) })}
          </span>
        ) : (
          <span className="text-[11px] text-on-surface-faint">{t('group_split.status_open')}</span>
        )}
      </div>
    </button>
  );
}
