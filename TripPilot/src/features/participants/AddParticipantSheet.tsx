import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/Icon';
import { BottomSheet } from '@/components/BottomSheet';
import { participantRepository, peerLinkRepository } from '@/data/repositories';
import { buildConnectionViews, type ConnectionView } from '@/domain/connections';
import {
  resolveParticipantByName,
  resolveParticipantFromConnection,
  availableConnections,
  type ResolvedParticipant,
} from '@/domain/participants';
import type { Participant } from '@/domain/types/participant';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

const STATUS_DOT: Record<ConnectionView['status'], string> = {
  connected: 'var(--success)',
  waiting: 'var(--warning)',
  offline: 'var(--on-surface-faint)',
};

interface AddParticipantSheetProps {
  open: boolean;
  onClose: () => void;
  tripId: string;
  /** Current trip participants — used for idempotency (no duplicate person). */
  participants: Participant[];
  /** Returns the created OR reused participant so the caller can mark it selected. */
  onAdded: (participant: Participant) => void;
}

/**
 * FB-06/FB-24 (C4 / DEC-259) — the ONE reusable "add who took part" sheet.
 *
 * Mounted as a pure overlay (BottomSheet) so the screen underneath — the expense
 * being typed, the receipt being reviewed — NEVER unmounts and no state is lost
 * (the council's hard requirement). Two paths, mirroring Settle-up: tap a
 * connected friend, or type a name to create a local participant on the spot.
 * The pure `@/domain/participants` layer decides reuse-vs-create (idempotent by
 * actor and by normalized name); this component only persists the new case and
 * hands the participant back.
 */
export function AddParticipantSheet({
  open,
  onClose,
  tripId,
  participants,
  onAdded,
}: AddParticipantSheetProps) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [connections, setConnections] = useState<ConnectionView[]>([]);
  const [busy, setBusy] = useState(false);

  // Load known friends only while the sheet is open (cheap, always fresh).
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void peerLinkRepository.getAll().then((links) => {
      if (alive) setConnections(buildConnectionViews(links, Date.now()));
    });
    return () => {
      alive = false;
    };
  }, [open]);

  const commit = async (resolved: ResolvedParticipant) => {
    if (resolved.kind === 'new') {
      await participantRepository.create(resolved.participant);
    }
    onAdded(resolved.participant);
  };

  const addByName = async () => {
    if (busy) return;
    const resolved = resolveParticipantByName(tripId, name, participants);
    if (!resolved) return;
    setBusy(true);
    try {
      await commit(resolved);
      setName('');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const addFriend = async (conn: ConnectionView) => {
    if (busy) return;
    setBusy(true);
    try {
      await commit(resolveParticipantFromConnection(tripId, conn, participants));
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const available = availableConnections(connections, participants);
  const canAdd = name.trim() !== '' && !busy;

  return (
    <BottomSheet open={open} onClose={onClose} title={t('participants.add_title')}>
      <div className="flex flex-col gap-3 pb-2 mt-2">
        {available.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-[11px] font-semibold text-on-surface-faint uppercase tracking-wide">
              {t('participants.friends_title')}
            </p>
            <div className="flex flex-col gap-1.5 max-h-44 overflow-y-auto">
              {available.map((conn) => (
                <button
                  key={conn.actorId}
                  onClick={() => addFriend(conn)}
                  disabled={busy}
                  className="flex items-center gap-2.5 w-full rounded-xl px-3 py-2 bg-surface-high btn-press text-left disabled:opacity-40"
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
                        style={{ background: STATUS_DOT[conn.status] }}
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
              <span className="text-[10px] text-on-surface-faint">{t('participants.friends_or_new')}</span>
              <span className="flex-1 h-px bg-surface-high" />
            </div>
          </div>
        )}

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void addByName();
          }}
          placeholder={t('participants.name_placeholder')}
          className="w-full rounded-xl px-3 py-2.5 text-sm bg-surface-high text-on-surface outline-none"
          autoFocus
        />
        <button
          onClick={() => void addByName()}
          disabled={!canAdd}
          className="w-full py-2.5 rounded-xl text-sm font-bold btn-press bg-primary text-on-surface disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <Icon name="person_add" size={18} />
          {t('participants.add_button')}
        </button>
      </div>
    </BottomSheet>
  );
}
