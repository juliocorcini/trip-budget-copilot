# TripPilot — V1 Screen List

> Last updated: 2026-06-08
> Source: product-spec.md, base.txt research

---

## Screen Inventory

### Core Screens (Mobile-First PWA)

| # | Screen | Route | Layout | Description |
|---|--------|-------|--------|-------------|
| 1 | Welcome | `/` | Auth/Centered | First launch: create trip, import backup, or load demo data |
| 2 | Onboarding Wizard | `/onboarding` | Full-screen stepper | Multi-step: trip → phases → budget pool → activity profiles → preferences |
| 3 | Phase Dashboard | `/dashboard` | App Shell (bottom nav) | Main screen: today's status, occasions remaining, quick actions, pending shared expenses |
| 4 | Trip Overview | `/trip` | App Shell | All phases timeline, total budget, spending summary across phases |
| 5 | Add Expense | `/quick-add` | Bottom Sheet / Modal | Quick form: amount, category, envelope, optional sharing, wallet |
| 6 | Expense Detail | `/expenses/:id` | App Shell | View/edit expense, impact breakdown, shared split details |
| 7 | Outing Mode | `/outings/active` | Immersive/Full-screen | Active session: quick buttons, running total, progressive alerts, next drink impact |
| 8 | Start Outing | `/outings/new` | App Shell or Sheet | Setup: type, name, ideal/safe/max targets, avg drink price, participants |
| 9 | Simulator | `/simulator` | App Shell | "Can I Spend?": input amount → impact on budget, profiles, reserves |
| 10 | Scenario Planner | `/planner` | App Shell | Interactive [-] N [+] per profile, real-time impact, trade-off suggestions |

### Supporting Screens

| # | Screen | Route | Layout | Description |
|---|--------|-------|--------|-------------|
| 11 | Expense List | `/expenses` | App Shell | All expenses, filterable by phase/category/date/wallet/shared |
| 12 | Shared Expenses | `/shared` | App Shell | Shared expense list, pending confirmations, debt summary |
| 13 | Debt Settlement | `/shared/debts` | App Shell | Who owes whom, simplified settlement, mark as paid |
| 14 | Wallets | `/wallets` | App Shell | Wallet list, balances, cash reconciliation |
| 15 | Reports | `/reports` | App Shell | Spending by category, timeline, profile performance, savings equivalence — **D3+ only (DEC-064): not present in V1, no placeholder in the "Mais" menu** |
| 16 | Settings | `/settings` | App Shell | Alert tone, preferences, about |
| 17 | Backup & Data | `/settings/backup` | App Shell | JSON export/import, CSV export, backup status, last backup date |
| 18 | Trip Editor | `/trip/edit` | App Shell | Edit trip, phases, budget pools, envelopes |

---

## Shared Components

| Component | Used In | Description |
|-----------|---------|-------------|
| Bottom Navigation | All App Shell screens | 4-5 tabs: Dashboard, Expenses, Outing, Planner, Settings |
| Quick Add FAB | Dashboard, Expense List | Floating button → opens Add Expense sheet |
| Budget Health Bar | Dashboard, Trip Overview | Visual bar: spent / safe ceiling / max with color zones |
| Alert Toast | Outing Mode, Simulator | Progressive alert messages in "amigo sincero" tone |
| Occasion Counter | Dashboard, Planner | "3 bar nights · 5 markets · 1 outing" with icons |
| Pending Badge | Dashboard, Shared | Indicator for unconfirmed shared expenses |
| Savings Message | Dashboard, Reports | Positive reinforcement: "You saved enough for..." |
| Profile Card | Planner, Dashboard | Activity profile with [-] N [+], estimate, priority badge |
| Split Indicator | Expense Detail, Shared | Who paid, who participated, personal cost vs total |
| Risk Level Badge | Simulator, Outing | comfortable / attention / avoid with semantic color |
| Wallet Selector | Add Expense, Outing | Dropdown: Wise, cash, card |
| Import Preview | Backup & Data | Summary: version, records, conflicts before import |

---

## Screen States

Every screen must account for these states:
- **Empty**: First use, no data yet → guide to create/import
- **Loading**: Skeleton shimmer matching layout
- **Populated**: Normal data view
- **Error**: Clear message with recovery action
- **Offline indicator**: Subtle but visible when no network (informational only, app works fully offline)

---

## Navigation Architecture

```
Bottom Nav (persistent on App Shell screens):
├── Dashboard (Phase Dashboard)
├── Expenses (Expense List)
├── + (Quick Add — opens bottom sheet, not a page)
├── Plan (Scenario Planner)
└── More (Settings, Reports, Wallets, Backup, Trip Editor)

Special flows (replace nav):
├── Welcome → Onboarding Wizard (full-screen, no bottom nav)
├── Outing Mode (immersive full-screen, own nav)
└── Simulator (can be modal or full-screen)
```

---

## Mobile-First Priorities

- Dashboard, Add Expense, Outing Mode: optimized for one-handed use
- Large touch targets (min 44px) especially in Outing Mode
- Quick-add buttons in Outing: 56px+ height, high contrast
- Forms: minimal fields, smart defaults, bottom-aligned actions
- Outing Mode: works in low-light bars (high contrast, no eye strain)
