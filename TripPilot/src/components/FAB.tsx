import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { Icon } from './Icon';
import { useAppData } from '@/hooks/useAppData';
import { visibleInMode, type ModeAware } from '@/domain/app-mode';
import { hapticSelection } from '@/utils/haptics';
import { useAnimatedPresence } from '@/hooks/useAnimatedPresence';
import { isOngoing } from '@/domain/spaces/spaces';
import { openAssistant } from '@/features/assistant/assistant-bus';
import { db } from '@/data/db/database';

/**
 * The FAB keeps ALL its actions (ÂNCORA 9 — hide, never delete) and the visual
 * language, but ranks them by VALUE for the thumb. Base of the sheet = the AI +
 * register-expense heroes. Visible "smart tools" grid: plan a spend, simulate,
 * convert currency and — E07 · DEC-327 (Julio 2026-06-25) — the cost-benefit
 * comparator, which returns to the visible grid to fill the 2×2 slot left when
 * "Dividir" merged the two split entries into one chooser. "Registrar mercado"
 * stays a daily-life capture, mode-aware (collapsed on a trip, promoted to the
 * visible grid in a "Dia a dia" space). Simple mode still hides the advanced
 * actions.
 */
type FabGroup = 'capture' | 'plan' | 'other';

interface FabAction extends ModeAware {
  icon: string;
  labelKey: string;
  descKey: string;
  path: string;
  iconBg: string;
  iconColorClass: string;
  group: FabGroup;
}

// The orange hero — the #1 action, rendered full-width at the very base.
const HERO_EXPENSE = {
  icon: 'add_card',
  labelKey: 'fab.register_expense',
  descKey: 'fab.register_expense_desc',
  path: '/quick-add',
};

const GROUPED_ACTIONS: FabAction[] = [
  {
    icon: 'local_bar',
    labelKey: 'fab.start_outing',
    descKey: 'fab.start_outing_desc',
    path: '/outings/new',
    iconBg: '#C75B3918',
    iconColorClass: 'text-primary',
    group: 'capture',
    advanced: true,
  },
  {
    icon: 'edit_calendar',
    labelKey: 'fab.plan_expense',
    descKey: 'fab.plan_expense_desc',
    path: '/viagem?plan=1',
    iconBg: '#6B8F7118',
    iconColorClass: 'text-success',
    group: 'plan',
  },
  {
    icon: 'calculate',
    labelKey: 'fab.simulate_purchase',
    descKey: 'fab.simulate_purchase_desc',
    path: '/simulator',
    iconBg: '#6B8F7118',
    iconColorClass: 'text-success',
    group: 'plan',
    advanced: true,
  },
  {
    // FB-04 (DEC-256): the currency converter — a traveler tool that belongs in
    // the visible "smart tools" row (not buried), and stays in simple mode too
    // (no `advanced`) since converting prices is a beginner's first need abroad.
    icon: 'currency_exchange',
    labelKey: 'fab.converter',
    descKey: 'fab.converter_desc',
    path: '/converter',
    iconBg: '#6B8F7118',
    iconColorClass: 'text-success',
    group: 'plan',
  },
  {
    // D08 · DEC-311: "Registrar mercado" (a "Registrar gasto" pre-filtered to one
    // category) is a daily-life capture. It is MODE-AWARE: in a "Dia a dia" space
    // it stays a visible "smart tools" chip (the component promotes it to `plan`),
    // but on a trip it sits in the collapsed "Mais ações" so the trip's first
    // layer stays focused on register · IA · Dividir · iniciar saída. Base group
    // is therefore `other`; the promotion happens in the component (Julio
    // 2026-06-22 wanted it handy in everyday mode). Stays in simple mode too.
    icon: 'shopping_cart',
    labelKey: 'fab.register_market',
    descKey: 'fab.register_market_desc',
    path: '/quick-add?cat=market',
    iconBg: '#6B8F7118',
    iconColorClass: 'text-success',
    group: 'other',
  },
  {
    // DEC-283/DEC-284: the cost-benefit comparator — "qual vale mais por
    // kg/L/unidade?". E07 · DEC-327 (Julio 2026-06-25): it returns to the visible
    // "smart tools" grid (above "Dividir"), filling the slot freed when the two
    // split entries merged into one "Dividir" chooser. Not `advanced`, so it
    // stays discoverable in simple mode too (a shopping tool, like the converter).
    icon: 'balance',
    labelKey: 'fab.comparator',
    descKey: 'fab.comparator_desc',
    path: '/comparator',
    iconBg: '#6B8F7118',
    iconColorClass: 'text-success',
    group: 'plan',
  },
  {
    icon: 'swap_horiz',
    labelKey: 'fab.register_transfer',
    descKey: 'fab.register_transfer_desc',
    path: '/quick-add?type=transfer',
    iconBg: '#D4A84318',
    iconColorClass: 'text-warning',
    group: 'other',
  },
  {
    icon: 'local_atm',
    labelKey: 'fab.register_withdrawal',
    descKey: 'fab.register_withdrawal_desc',
    path: '/quick-add?type=withdrawal',
    iconBg: '#D4A84318',
    iconColorClass: 'text-warning',
    group: 'other',
  },
  {
    icon: 'savings',
    labelKey: 'fab.register_income',
    descKey: 'fab.register_income_desc',
    path: '/income',
    iconBg: '#6B8F7118',
    iconColorClass: 'text-success',
    group: 'other',
    advanced: true,
  },
];

// GATE 18: only the low-value "Outros registros" collapses now — the planning
// tools were promoted to visible chips, so there's no "Planejar" expander.
const OTHER_EXPANDER = { icon: 'more_horiz', labelKey: 'fab.group_other', descKey: 'fab.group_other_desc' };

interface FABMenuProps {
  isOpen: boolean;
  onClose: () => void;
  /** D03 · DEC-309: "Dividir" opens the bill-vs-group chooser, owned by the
   *  BottomNav so it survives the FAB overlay closing. */
  onDivide: () => void;
}

export function FABMenu({ isOpen, onClose, onDivide }: FABMenuProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { settings, trip } = useAppData();
  const { mounted, state } = useAnimatedPresence(isOpen, 180);
  const [otherOpen, setOtherOpen] = useState(false);

  const tripId = trip?.id ?? '';
  const pendingCaptures = useLiveQuery(
    () => (tripId ? db.captureInbox.where({ tripId, status: 'pending' }).count() : Promise.resolve(0)),
    [tripId],
  );


  if (!mounted) return null;
  const closing = state === 'closing';

  // M19: simple mode hides the advanced actions; they stay reachable via their
  // full pages (ÂNCORA 9 — hide, never delete).
  // D08 · DEC-311: in a "Dia a dia" space, promote "Registrar mercado" to the
  // visible smart-tools row; on a trip it stays in the collapsed "Mais ações".
  const ongoing = trip ? isOngoing(trip) : false;
  const actions = visibleInMode(GROUPED_ACTIONS, settings?.appMode ?? 'complete').map((action) =>
    action.path === '/quick-add?cat=market' && ongoing
      ? { ...action, group: 'plan' as FabGroup }
      : action,
  );
  // GATE 18 visible tier: the planning tools lead, then the live-capture leader.
  const captureActions = actions.filter((a) => a.group === 'capture');
  // C15: the lead capture action ("Iniciar saída") pairs 2-up with "Dividir
  // conta"; any remaining capture actions render full-width below (ÂNCORA 9).
  const [primaryCapture, ...restCapture] = captureActions;
  const planActions = actions.filter((a) => a.group === 'plan');
  const otherActions = actions.filter((a) => a.group === 'other');

  const handleAction = (path: string) => {
    hapticSelection();
    onClose();
    navigate(path);
  };

  const toggleOther = () => {
    hapticSelection();
    setOtherOpen((prev) => !prev);
  };

  const renderChip = (action: FabAction) => (
    <button
      key={action.path}
      onClick={(e) => {
        e.stopPropagation();
        handleAction(action.path);
      }}
      className="btn-press p-3.5 rounded-2xl flex flex-col gap-2 text-left h-full"
      style={{ background: 'var(--surface-high)' }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: action.iconBg }}
      >
        <Icon name={action.icon} size={20} className={action.iconColorClass} />
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-bold text-on-surface leading-tight">{t(action.labelKey)}</p>
        <p className="text-[10px] font-semibold text-on-surface-dim leading-snug line-clamp-1 mt-0.5">
          {t(action.descKey)}
        </p>
      </div>
    </button>
  );

  // GATE 18: a full-width leader for the most important secondary action
  // ("Iniciar saída") — heavier than a 2-col chip, sitting just above the heroes.
  const renderWideAction = (action: FabAction) => (
    <button
      key={action.path}
      onClick={(e) => {
        e.stopPropagation();
        handleAction(action.path);
      }}
      className="btn-press w-full p-3.5 rounded-2xl flex items-center gap-3 text-left"
      style={{ background: 'var(--surface-high)' }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: action.iconBg }}
      >
        <Icon name={action.icon} size={20} className={action.iconColorClass} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-bold text-on-surface leading-tight">{t(action.labelKey)}</p>
        <p className="text-[10px] font-semibold text-on-surface-dim leading-snug line-clamp-1 mt-0.5">
          {t(action.descKey)}
        </p>
      </div>
      <Icon name="arrow_forward" size={18} className={`${action.iconColorClass} shrink-0`} />
    </button>
  );

  // D03 · DEC-309: "Dividir" is the star action — the indigo "smart" accent +
  // sparkle so it stands apart from the orange/IA heroes. C15: it pairs 2-up with
  // "Iniciar saída" as a `chip`; in simple mode (no outing) it renders full-`wide`.
  // It opens the bill-vs-group chooser (the single unified door) instead of going
  // straight to a screen, so the two kinds of split stop being confused.
  const handleDivide = () => {
    hapticSelection();
    onClose();
    onDivide();
  };

  const renderSplitBill = (variant: 'chip' | 'wide') => {
    if (variant === 'chip') {
      return (
        <button
          key="split-bill"
          onClick={(e) => {
            e.stopPropagation();
            handleDivide();
          }}
          className="btn-press p-3.5 rounded-2xl flex flex-col gap-2 text-left h-full"
          style={{ background: 'var(--ai-bg-soft)', border: '1px solid var(--ai-border)' }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 relative"
            style={{ background: 'var(--ai-bg)' }}
          >
            <Icon name="splitscreen" size={20} className="text-[var(--ai-2)]" />
            <span
              className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
              style={{ background: 'var(--ai)' }}
            >
              <Icon name="auto_awesome" size={9} className="text-[#ffffff]" />
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-bold text-on-surface leading-tight">{t('fab.divide')}</p>
            <p className="text-[10px] font-semibold text-on-surface-dim leading-snug line-clamp-1 mt-0.5">
              {t('fab.divide_desc')}
            </p>
          </div>
        </button>
      );
    }
    return (
      <button
        key="split-bill"
        onClick={(e) => {
          e.stopPropagation();
          handleDivide();
        }}
        className="btn-press p-4 rounded-2xl flex items-center gap-3.5 text-left"
        style={{ background: 'var(--ai-bg-soft)', border: '1px solid var(--ai-border)' }}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 relative"
          style={{ background: 'var(--ai-bg)' }}
        >
          <Icon name="splitscreen" size={24} className="text-[var(--ai-2)]" />
          <span
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
            style={{ background: 'var(--ai)' }}
          >
            <Icon name="auto_awesome" size={9} className="text-[#ffffff]" />
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-extrabold text-on-surface">{t('fab.divide')}</p>
          <p className="text-[11px] font-semibold text-on-surface-dim">{t('fab.divide_desc')}</p>
        </div>
        <Icon name="auto_awesome" size={18} className="text-[var(--ai-2)] shrink-0" />
      </button>
    );
  };

  const renderOtherExpander = (groupActions: FabAction[]) => {
    if (groupActions.length === 0) return null;
    return (
      <div className="flex flex-col gap-2.5">
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleOther();
          }}
          className="btn-press w-full p-3.5 rounded-2xl flex items-center gap-3 text-left"
          style={{ background: 'var(--surface-high)' }}
          aria-expanded={otherOpen}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--surface-container)' }}
          >
            <Icon name={OTHER_EXPANDER.icon} size={20} className="text-on-surface-dim" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-on-surface leading-tight">
              {t(OTHER_EXPANDER.labelKey)}
            </p>
            <p className="text-[10px] font-semibold text-on-surface-dim leading-snug line-clamp-1 mt-0.5">
              {t(OTHER_EXPANDER.descKey)}
            </p>
          </div>
          <Icon
            name="expand_more"
            size={20}
            className="text-on-surface-faint shrink-0 transition-transform"
            style={otherOpen ? { transform: 'rotate(180deg)' } : undefined}
          />
        </button>
        {otherOpen && <div className="grid grid-cols-2 gap-2.5">{groupActions.map(renderChip)}</div>}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50" data-no-tab-swipe onClick={onClose}>
      <div
        className="absolute inset-0"
        style={{
          background: 'var(--scrim)',
          animation: closing
            ? 'fab-scrim-out 160ms var(--ease-accelerate) both'
            : 'fab-scrim-in 200ms var(--ease-out) both',
        }}
      />

      {/* Anchor the sheet to the bottom, clearing the (taller, safe-area-aware)
          bottom nav + protruding center button so the panel floats above them. */}
      <div
        className="absolute inset-x-0 bottom-0 flex flex-col justify-end"
        style={{
          paddingTop: 'calc(var(--safe-top) + 12px)',
          paddingBottom: 'calc(104px + var(--safe-bottom))',
          maxHeight: '100dvh',
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="mx-3 rounded-[28px] flex flex-col overflow-hidden"
          style={{
            background: 'var(--surface-container)',
            border: '1px solid var(--surface-high)',
            boxShadow: '0 18px 48px -12px rgba(0,0,0,0.55)',
            maxHeight: '100%',
            animation: closing
              ? 'sheet-down 180ms var(--ease-accelerate) both'
              : 'sheet-up 240ms var(--ease-spring) both',
          }}
        >
          {/* Grabber + title — the "this is a sheet you can dismiss" affordance. */}
          <div className="pt-3 pb-1 flex justify-center shrink-0">
            <div className="w-9 h-1 rounded-full" style={{ background: 'var(--surface-high)' }} />
          </div>
          <div className="px-5 pt-1 pb-3 shrink-0">
            <p className="text-[11px] tracking-[0.14em] uppercase font-bold text-on-surface-faint">
              {t('fab.quick_actions')}
            </p>
          </div>

          {/* GATE 18: content flows top→bottom but the sheet is bottom-anchored, so
              the LAST children sit closest to the thumb. Order: collapsed "Outros
              registros" → planning chips → "Iniciar saída" leader → scan hero →
              register-expense hero (the base). */}
          <div className="px-3 pb-3 overflow-y-auto no-scrollbar">
            <div className="flex flex-col gap-2.5 stagger">
              {renderOtherExpander(otherActions)}

              {planActions.length > 0 && (
                <div
                  className={`grid ${planActions.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-2.5`}
                >
                  {planActions.map(renderChip)}
                </div>
              )}

              {/* C15: pair "Iniciar saída" + "Dividir conta" side by side. When
                  the outing capture is present (complete mode) they sit 2-up; in
                  simple mode (outing hidden) "Dividir conta" renders full-width.
                  Any extra capture action stays reachable below (ÂNCORA 9). The
                  orange/IA heroes below keep their full-width prominence. */}
              {primaryCapture ? (
                <>
                  <div className="grid grid-cols-2 gap-2.5">
                    {renderChip(primaryCapture)}
                    {renderSplitBill('chip')}
                  </div>
                  {restCapture.map(renderWideAction)}
                </>
              ) : (
                renderSplitBill('wide')
              )}

              {/* Capture Stack: single entry point to capture inbox (has its own camera button). */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction('/capture');
                }}
                className="btn-press w-full p-3.5 rounded-2xl flex items-center gap-3 text-left relative"
                style={{ background: '#7C5E3A18', border: '1px solid #7C5E3A28' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 relative"
                  style={{ background: '#7C5E3A22' }}
                >
                  <Icon name="add_a_photo" size={20} className="text-primary" />
                  {(pendingCaptures ?? 0) > 0 && (
                    <span
                      className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ background: 'var(--danger)' }}
                    >
                      {pendingCaptures}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-on-surface leading-tight">
                    {t('fab.capture')}
                  </p>
                  <p className="text-[10px] font-semibold text-on-surface-dim leading-snug line-clamp-1 mt-0.5">
                    {t('fab.capture_desc')}
                  </p>
                </div>
                <Icon name="arrow_forward" size={18} className="text-primary shrink-0" />
              </button>

              {/* DEC-201 (N7): the orange hero — the base of the sheet, in the thumb
                  zone (closest to the "+"). */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction(HERO_EXPENSE.path);
                }}
                className="btn-press p-4 rounded-2xl flex items-center gap-3.5 text-left"
                style={{ background: '#C75B3922', border: '1px solid #C75B3940' }}
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                  style={{ background: '#C75B3933' }}
                >
                  <Icon name={HERO_EXPENSE.icon} size={24} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-extrabold text-on-surface">
                    {t(HERO_EXPENSE.labelKey)}
                  </p>
                  <p className="text-[11px] font-semibold text-on-surface-dim">
                    {t(HERO_EXPENSE.descKey)}
                  </p>
                </div>
                <Icon name="arrow_forward" size={18} className="text-primary shrink-0" />
              </button>

              {/* DEC-246: the AI quick-entry hero — the new #1, at the very base
                  (closest to the "+"). One box that turns "o Bruno me pagou uma
                  cerveja de 2 euros" into a saved action. A bold gradient + sparkle
                  sets it apart from the orange/indigo heroes. Opt-out via Settings. */}
              {(settings?.aiQuickEntryEnabled ?? true) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    hapticSelection();
                    onClose();
                    openAssistant();
                  }}
                  className="btn-press p-4 rounded-2xl flex items-center gap-3.5 text-left"
                  style={{
                    background: 'var(--ai-gradient)',
                    boxShadow: '0 10px 28px -10px rgba(99,102,241,0.7)',
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(255,255,255,0.18)' }}
                  >
                    <Icon name="auto_awesome" size={24} className="text-[#ffffff]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-extrabold text-[#ffffff]">{t('assistant.fab_title')}</p>
                    <p className="text-[11px] font-semibold text-[#ffffff] opacity-85">
                      {t('assistant.fab_desc')}
                    </p>
                  </div>
                  <Icon name="arrow_forward" size={18} className="text-[#ffffff] shrink-0" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
