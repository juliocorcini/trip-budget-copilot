/**
 * G7 — "Everything you can do" guide. A data-driven catalog of the app's
 * features so nothing stays hidden behind a menu (Julio: "tem muita função que
 * fica escondida — o usuário precisa saber tudo que dá pra fazer"). Each entry
 * names a capability, says in one line what it's for, and links straight to it.
 *
 * Catalog lives in the domain; the page only renders it (Core Rule 8). Routes
 * here MUST exist in the router — a unit test guards that.
 */

export interface GuideEntry {
  id: string;
  icon: string;
  titleKey: string;
  descKey: string;
  /** Where "Abrir" navigates. Mode-gated routes are still listed (the guide
   *  reveals what's possible); ModeGuard handles the simple→complete prompt. */
  route: string;
}

export interface GuideSection {
  id: string;
  titleKey: string;
  entries: GuideEntry[];
}

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'daily',
    titleKey: 'guide.section_daily',
    entries: [
      { id: 'register_expense', icon: 'add', titleKey: 'guide.register_expense_t', descKey: 'guide.register_expense_d', route: '/quick-add' },
      { id: 'expenses', icon: 'receipt_long', titleKey: 'guide.expenses_t', descKey: 'guide.expenses_d', route: '/expenses' },
      { id: 'checkin', icon: 'wb_sunny', titleKey: 'guide.checkin_t', descKey: 'guide.checkin_d', route: '/dashboard' },
      { id: 'outing', icon: 'local_bar', titleKey: 'guide.outing_t', descKey: 'guide.outing_d', route: '/outings/new' },
    ],
  },
  {
    id: 'planning',
    titleKey: 'guide.section_planning',
    entries: [
      { id: 'planner', icon: 'tune', titleKey: 'guide.planner_t', descKey: 'guide.planner_d', route: '/planner' },
      { id: 'planned', icon: 'shopping_bag', titleKey: 'guide.planned_t', descKey: 'guide.planned_d', route: '/planned' },
      { id: 'simulator', icon: 'calculate', titleKey: 'guide.simulator_t', descKey: 'guide.simulator_d', route: '/simulator' },
      { id: 'converter', icon: 'currency_exchange', titleKey: 'guide.converter_t', descKey: 'guide.converter_d', route: '/converter' },
      { id: 'comparator', icon: 'balance', titleKey: 'guide.comparator_t', descKey: 'guide.comparator_d', route: '/comparator' },
    ],
  },
  {
    id: 'trip',
    titleKey: 'guide.section_trip',
    entries: [
      { id: 'spaces', icon: 'workspaces', titleKey: 'guide.spaces_t', descKey: 'guide.spaces_d', route: '/spaces' },
      { id: 'viagem', icon: 'luggage', titleKey: 'guide.viagem_t', descKey: 'guide.viagem_d', route: '/viagem' },
      { id: 'profiles', icon: 'badge', titleKey: 'guide.profiles_t', descKey: 'guide.profiles_d', route: '/profiles' },
      { id: 'wallets', icon: 'account_balance_wallet', titleKey: 'guide.wallets_t', descKey: 'guide.wallets_d', route: '/wallets' },
      { id: 'funds', icon: 'savings', titleKey: 'guide.funds_t', descKey: 'guide.funds_d', route: '/funds' },
      { id: 'income', icon: 'payments', titleKey: 'guide.income_t', descKey: 'guide.income_d', route: '/income' },
    ],
  },
  {
    id: 'people',
    titleKey: 'guide.section_people',
    entries: [
      // Two distinct "dividir" doors, listed side by side so the difference is
      // visible BEFORE choosing (DEC-309): one bill now × a whole group/event.
      { id: 'split', icon: 'splitscreen', titleKey: 'guide.split_t', descKey: 'guide.split_d', route: '/split/scan' },
      { id: 'group_split', icon: 'groups', titleKey: 'guide.group_split_t', descKey: 'guide.group_split_d', route: '/groups' },
      { id: 'shared', icon: 'group', titleKey: 'guide.shared_t', descKey: 'guide.shared_d', route: '/shared' },
    ],
  },
  {
    id: 'copilot',
    titleKey: 'guide.section_copilot',
    entries: [
      { id: 'copilot', icon: 'insights', titleKey: 'guide.copilot_t', descKey: 'guide.copilot_d', route: '/copiloto' },
      { id: 'impact', icon: 'monitoring', titleKey: 'guide.impact_t', descKey: 'guide.impact_d', route: '/impact' },
      { id: 'rescue', icon: 'health_and_safety', titleKey: 'guide.rescue_t', descKey: 'guide.rescue_d', route: '/rescue' },
    ],
  },
  {
    id: 'settings',
    titleKey: 'guide.section_settings',
    entries: [
      { id: 'settings', icon: 'settings', titleKey: 'guide.settings_t', descKey: 'guide.settings_d', route: '/settings' },
      { id: 'customize_home', icon: 'dashboard_customize', titleKey: 'guide.customize_home_t', descKey: 'guide.customize_home_d', route: '/settings/dashboard' },
      { id: 'backup', icon: 'cloud_upload', titleKey: 'guide.backup_t', descKey: 'guide.backup_d', route: '/settings/backup' },
      { id: 'import_wise', icon: 'sync_alt', titleKey: 'guide.import_wise_t', descKey: 'guide.import_wise_d', route: '/import/wise' },
      { id: 'notifications', icon: 'notifications', titleKey: 'guide.notifications_t', descKey: 'guide.notifications_d', route: '/notifications' },
      { id: 'about', icon: 'info', titleKey: 'guide.about_t', descKey: 'guide.about_d', route: '/about' },
    ],
  },
];
