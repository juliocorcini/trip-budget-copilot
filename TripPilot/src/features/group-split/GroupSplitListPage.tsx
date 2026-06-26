import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { useAppData } from '@/hooks/useAppData';
import { groupSplitRepository, peerLinkRepository } from '@/data/repositories';
import { createGroupSplit, sendGroupInvite } from '@/domain/orchestrators';
import {
  computeGroupBalances,
  groupTotalCents,
  buildPeoplePicker,
  filterPeoplePicker,
  collectRecentGroupNames,
  type PeoplePickerCandidate,
} from '@/domain/group-split';
import { buildConnectionViews } from '@/domain/connections';
import { publishGroupSplit, saveGroupLive, listJoinedGroups, type JoinedGroup } from './group-link';
import { formatMoney } from '@/domain/money';
import { Icon } from '@/components/Icon';
import { ConceptHint } from '@/components/ConceptHint';
import { showToast } from '@/components/Toast';
import type { PeerLink } from '@/domain/types/peer-link';
import type { GroupSplitRecord } from '@/domain/types/group-split-record';

/** Suggestions shown before the "ver mais" search reveals the full deduped list. */
const PICKER_PREVIEW = 6;

/** Case/accent-insensitive name key, to dedupe a typed name against a picked one. */
function nameKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

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
  // F24/DEC-355 — groups I was INVITED to and accepted (I'm a guest, read-only
  // creds). They live beside the groups I own so /groups stays the ONE list (DEC-360).
  const [joinedGroups, setJoinedGroups] = useState<JoinedGroup[]>([]);
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
  // F24/DEC-355 — the people picker: pick existing/connected/trip people (linked by
  // real id, invited accept-first) instead of re-typing a wall of names.
  const [peerLinks, setPeerLinks] = useState<PeerLink[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [pickerQuery, setPickerQuery] = useState('');
  const [showAllPicker, setShowAllPicker] = useState(false);

  const ownerName =
    participants.find((p) => p.isOwner)?.name ?? t('onboarding.default_owner_name');

  useEffect(() => {
    void groupSplitRepository.listEvents().then(setRecords);
    void peerLinkRepository.getAll().then(setPeerLinks);
    setJoinedGroups(listJoinedGroups());
  }, []);

  // F24/DEC-355 — the deduped, intent-ranked candidates: connected friends, this
  // trip's participants, then recently-used names (the same person once).
  const candidates = useMemo(
    () =>
      buildPeoplePicker({
        connections: buildConnectionViews(peerLinks, Date.now()),
        tripParticipants: participants.map((p) => ({
          id: p.id,
          name: p.name,
          isOwner: p.isOwner,
          linkedActorId: p.linkedActorId ?? null,
        })),
        recentNames: collectRecentGroupNames((records ?? []).map((r) => r.event)),
      }),
    [peerLinks, participants, records],
  );
  const filteredCandidates = useMemo(
    () => filterPeoplePicker(candidates, pickerQuery),
    [candidates, pickerQuery],
  );
  const visibleCandidates =
    showAllPicker || pickerQuery.trim().length > 0
      ? filteredCandidates
      : filteredCandidates.slice(0, PICKER_PREVIEW);
  const selectedCandidates = candidates.filter((c) => selectedKeys.has(c.key));

  const toggleCandidate = (candidate: PeoplePickerCandidate) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(candidate.key)) next.delete(candidate.key);
      else next.add(candidate.key);
      return next;
    });
  };

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
    setSelectedKeys(new Set());
    setPickerQuery('');
    setShowAllPicker(false);
  };

  // F24/DEC-355 — after the event exists, the connected picks get an accept-first
  // group invite. It needs the published `/g/` creds, so we publish once (storing
  // the owner creds so the detail screen reuses the SAME link) and seal in parallel.
  const inviteConnectedPicks = async (
    event: Awaited<ReturnType<typeof createGroupSplit>>,
    invitees: PeoplePickerCandidate[],
  ): Promise<number> => {
    const creds = await publishGroupSplit(event, 1);
    saveGroupLive(event.id, creds);
    const results = await Promise.all(
      invitees.map((inv) =>
        sendGroupInvite({
          peerActorId: inv.actorId as string,
          shareId: creds.shareId,
          key: creds.key,
          groupName: event.name,
        }),
      ),
    );
    return results.filter((r) => r.delivered).length;
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (submitting || trimmed.length === 0) return;
    setSubmitting(true);
    try {
      const owner = participants.find((p) => p.isOwner) ?? null;
      // Fold a half-typed name in the field so it is never silently dropped, and
      // drop any typed name that duplicates a picked person (one slot per person).
      const pending = newPerson.trim();
      const typedNames = pending.length > 0 ? [...people, pending] : people;
      const pickedNameKeys = new Set(selectedCandidates.map((c) => nameKey(c.name)));
      const peopleNames = typedNames.filter((n) => !pickedNameKeys.has(nameKey(n)));
      // Picked people are seeded as connected slots, linked by real id ONLY when the
      // participant is on THIS trip (a cross-trip link would mis-key the ledger).
      const linkedPeople = selectedCandidates.map((c) => ({
        name: c.name,
        linkedParticipantId:
          c.participantId && participants.some((p) => p.id === c.participantId)
            ? c.participantId
            : null,
      }));
      const event = await createGroupSplit({
        name: trimmed,
        currency,
        ownerName,
        tripId: trip?.id ?? null,
        ownerLinkedParticipantId: owner?.id ?? null,
        linkedPeople,
        peopleNames,
      });

      const invitees = selectedCandidates.filter((c) => c.canInvite && c.actorId);
      if (invitees.length > 0) {
        try {
          const delivered = await inviteConnectedPicks(event, invitees);
          showToast(
            delivered > 0
              ? t('group_split.invites_sent', { count: delivered })
              : t('group_split.invites_queued', { count: invitees.length }),
            delivered > 0 ? 'success' : 'info',
          );
        } catch {
          // The event is created regardless; the link can still be shared manually.
          showToast(t('group_split.created'), 'success');
        }
      } else {
        showToast(t('group_split.created'), 'success');
      }
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

      {/* DEC-358: the "which split mode" explainer, mounted at this door. */}
      <ConceptHint current="group" />

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
          {/* F24/DEC-355 — pick existing/connected/trip people (no giant list): a
              short ranked preview, "ver mais" reveals search; connected picks get
              an accept-first invite to their real device on create. */}
          {candidates.length > 0 && (
            <div>
              <label className="text-xs text-on-surface-faint block mb-2">
                {t('group_split.picker_title')}
              </label>
              {(showAllPicker || pickerQuery.trim().length > 0) && (
                <input
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  placeholder={t('group_split.picker_search_ph')}
                  className="bg-surface-high rounded-lg px-3 py-2 text-sm text-on-surface outline-none w-full mb-2"
                />
              )}
              <div className="flex flex-wrap gap-2">
                {visibleCandidates.map((c) => {
                  const selected = selectedKeys.has(c.key);
                  return (
                    <button
                      key={c.key}
                      type="button"
                      onClick={() => toggleCandidate(c)}
                      className={`flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-lg text-sm font-medium btn-press border ${
                        selected
                          ? 'bg-primary/20 text-primary border-primary/40'
                          : 'bg-surface-high text-on-surface-dim border-transparent'
                      }`}
                    >
                      <Icon
                        name={selected ? 'check_circle' : 'add_circle'}
                        size={15}
                        className={selected ? 'text-primary' : 'text-on-surface-faint'}
                      />
                      <span className="truncate max-w-[10rem]">{c.name}</span>
                      {c.source === 'connected' && (
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: c.canInvite ? 'var(--success)' : 'var(--warning)' }}
                          aria-label={t('group_split.picker_connected')}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
              {pickerQuery.trim().length === 0 && filteredCandidates.length > PICKER_PREVIEW && (
                <button
                  type="button"
                  onClick={() => setShowAllPicker((v) => !v)}
                  className="mt-2 text-xs font-semibold text-primary btn-press"
                >
                  {showAllPicker
                    ? t('common.show_less')
                    : t('group_split.picker_more', { count: filteredCandidates.length - PICKER_PREVIEW })}
                </button>
              )}
            </div>
          )}
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

      {/* F24/DEC-355 — groups I joined via an invite (read-only guest board). Tapping
          opens the live `/g/` board with the stored read creds, exactly like the link. */}
      {joinedGroups.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-on-surface-faint mt-2">{t('group_split.joined_title')}</p>
          {joinedGroups.map((g) => (
            <button
              key={g.shareId}
              onClick={() => navigate(`/g/${encodeURIComponent(g.shareId)}#k=${g.key}`)}
              className="bg-surface-container rounded-xl p-4 flex items-center gap-3 text-left btn-press"
            >
              <div className="w-10 h-10 rounded-full bg-surface-high flex items-center justify-center shrink-0">
                <Icon name="groups" size={20} className="text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-on-surface truncate">{g.name}</p>
                <p className="text-[11px] text-on-surface-faint truncate">
                  {t('group_split.joined_meta', { name: g.invitedByName })}
                </p>
              </div>
              <Icon name="chevron_right" size={20} className="text-on-surface-faint shrink-0" />
            </button>
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
