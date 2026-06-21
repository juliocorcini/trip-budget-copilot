/**
 * AI Quick Entry (DEC-246) — the in-sheet "what can I ask?" helper. A flat list
 * of capability GROUPS (id + icon only); the human-facing group title and the
 * example phrases live in i18n (`assistant.examples.groups.<id>.title` +
 * `.items`, an array) so they are localized and a pt-BR user sees pt-BR examples.
 *
 * The order mirrors how often a traveler reaches for each (quick spend first,
 * navigation last). Tapping an example just pre-fills the input box — the user
 * sends or edits it — so the helper teaches by doing, never a dead wall of text.
 */
export interface AssistantExampleGroup {
  id: string;
  /** Material symbol name shown next to the group title. */
  icon: string;
}

export const ASSISTANT_EXAMPLE_GROUPS: AssistantExampleGroup[] = [
  { id: 'quick_expense', icon: 'payments' },
  { id: 'someone_paid', icon: 'call_received' },
  { id: 'i_paid_for', icon: 'call_made' },
  { id: 'split', icon: 'groups' },
  { id: 'multi', icon: 'auto_awesome' },
  { id: 'income', icon: 'savings' },
  { id: 'wallets', icon: 'account_balance_wallet' },
  { id: 'debts', icon: 'handshake' },
  { id: 'plan', icon: 'edit_calendar' },
  { id: 'open', icon: 'apps' },
];
