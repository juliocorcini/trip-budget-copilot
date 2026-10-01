# Dev Log — TripPilot Implementation

## Wave "Itinerary Visual Redesign" (2026-07-13) — `2.13.2-rc` → `2.15.x-rc` — ⏳ IN PROGRESS

> Orquestrador: `brain/documents/2026-07-13-itinerary-visual-redesign-orchestrator.md`
> 21 wireframes Stitch → 10 gates (G0–G9) across 3 waves
> DECs: 470–474

### Current State

| Field | Value |
|-------|-------|
| **Gate** | G9 — Second visual pass + finalization |
| **Milestone** | M9.4 — Suite complete (G9 DONE) |
| **Version** | 2.13.4-rc |
| **Tests** | 331 files / 3419 passed / 2 failed (pre-existing split-live-loop) |
| **Build** | OK |
| **tsc** | 0 errors |
| **Risks** | None |
| **Last commit** | — (pending G2 commit) |

### Baseline

- Tests: 331 files / 3419 passed / 2 failed (pre-existing split-live-loop)
- Build: OK
- tsc: 0 errors
- Version: 2.13.2-rc

### Decisions

- **DEC-470:** Timeline vertical ONLY for transit days. Full days: HeroBanner + agenda.
- **DEC-471:** No city images. Hero uses gradient per dayType. `imageUrl` field reserved (not implemented).
- **DEC-472:** Conditional rendering by dayType in ItineraryPage.
- **DEC-473:** PVV: Playwright screenshots (375×812) + checklist + 3 scenarios + side-by-side.
- **DEC-474:** Keep design system (tokens.css). Wireframes define layout, not tokens.

| Gate | Scope | Version | Status |
|------|-------|---------|--------|
| G0 | Setup & Baseline | 2.13.2-rc | ✅ |
| G1 | TimelineView + HeroBanner + BudgetStatusBadge + SkeletonLoader | — | ✅ |
| G2 | ItineraryPage redesign | 2.14.0-rc | ✅ |
| G3 | ItineraryContextCard redesign | 2.14.1-rc | ✅ |
| G4 | BookingChecklistPage redesign | 2.14.2-rc | ✅ |
| G5 | LegFormSheet redesign | 2.14.3-rc | ✅ |
| G6 | CopilotFlow redesign (5 stages) | 2.14.4-rc | ✅ |
| G7 | ItineraryMapPage split view | 2.14.5-rc | ✅ |
| G8 | Settings + QuickAdd + Extras | 2.15.0-rc | ✅ |
| G9 | Second visual pass + finalization | 2.15.x-rc | ✅ |

### G0 — Setup & Baseline

- **M0.1**: Baseline documented: 331 files / 3419 passed / 2 failed (pre-existing). Build OK. tsc 0 errors.
- **M0.2**: Created `e2e/visual-verification.spec.ts` — Playwright screenshot scaffold at 375×812 viewport.
- **M0.3**: dev-log seeded with new wave, DECs 470–474.
- **M0.4**: Screenshots "before" — deferred (state documented in code).

### G9 — Second Visual Pass + Finalization
- **M9.1**: VIS-1 compliance scan — all edited files use design tokens exclusively. No hardcoded colors.
- **M9.2**: VIS-2 compliance scan — removed last emoji in QuickAddPage (companions section 👥→Icon group). Cleaned transport_reminder_body emoji param from i18n (3 locales).
- **M9.3**: VIS-4 compliance — no transition-all found in any edited file.
- **M9.4**: Suite complete — 331 files / 3419 passed / 2 failed (pre-existing split-live-loop). tsc: 0 errors. Build: OK.
- **M9.5**: Deploy — 2.13.4-rc deployed to Cloudflare Pages (SW v115). OTA bundle 2.13.4-rc.zip generated.
- Pending: M9.6 (brain sync — project-status.md, decision-log).

### G8 — Settings + QuickAdd + Extras
- **M8.1**: Settings — Transport Reminder card redesigned with icon circle (directions_bus), toggle switch, and 3-option segmented control (30min/1h/2h) replacing dropdown.
- **M8.2**: QuickAdd — itinerary context badge: mono "DAY X IN {CITY} · BUDGET: €XX" with location_on icon + AI tip pill with auto_awesome icon and ai glow.
- **M8.3**: In-app notification — InAppNotificationOverlay component: full-screen blur overlay + centered card with icon circle, title, body, dismiss button. Mounted in RootLayout. Transport reminder fires it when app is in foreground.
- **M8.4**: LIVE badge — pulsating red badge on agenda events happening NOW (within 60min window). Uses error color with subtle background tint. Active card gets accent border-left.
- Transport reminder emojis replaced with Material Symbols (TRANSPORT_ICON mapping). VIS-2 compliant.
- All styles via tokens. VIS-1 compliant.
- i18n: Added quickadd_context in pt-BR/en/es.
- tsc: 0 errors.

### G7 — ItineraryMapPage Split View
- **M7.1**: Split layout — map ~45vh top, scrollable leg list bottom, dark CartoDB tiles, rounded top for list panel.
- **M7.2**: City pins — outer ring + inner dot, current=large accent, past=small muted, future=ai-purple. City labels below pins.
- **M7.3**: Route lines — past=solid primary, future=dashed ai-purple. Consistent with wireframe.
- **M7.4**: Leg list — cards with timeline dots, mono "DAYS X-Y" labels, city bold, active card = primary border + highlight bar.
- **M7.5**: Synchronization — tap card → flyTo pin. Tap pin → scroll list.
- Dark tile layer added to tile-layers.ts (CartoDB dark_all). MapLayerKind union extended.
- Removed old legend overlay — split view list replaces it.
- i18n: Added map_days_label, map_current in pt-BR/en/es.
- VIS-1 compliant: all tokens via CSS variables.
- VIS-2 compliant: zero emojis.
- tsc: 0 errors.

### G6 — CopilotFlow Redesign (5 stages)
- **M6.1**: Choice — "COPILOT" mono header, 2 option cards with icon circles, AI card with glow effect and --ai shadow.
- **M6.2**: Guided — Progress bar + "PERGUNTA X DE 6" mono label, Material Symbol icons in circles replacing emojis, sticky input.
- **M6.3**: Free text — Character counter "0/500", sparkle button with auto_awesome icon, Copilot mono header.
- **M6.4**: Loading — SVG animated ring with auto_awesome center icon, 3-step simulated checklist (routes, accommodation, optimizing).
- **M6.5**: Preview — "AI" pill badge with ai glow, inline refinement textarea (replaced BottomSheet), sparkle send button.
- All emojis removed from GUIDED_STEPS (VIS-2 compliant).
- All Tailwind color classes → design tokens (VIS-1 compliant).
- i18n: Added guided_step_label, loading_step_routes/accommodation/optimizing in pt-BR/en/es.
- tsc: 0 errors.

### G5 — LegFormSheet Redesign
- **M5.1**: Header with title + subtitle in BottomSheet. Sections with icon + colored title (location=primary, transport=ai, accommodation=warning).
- **M5.2**: Layout grid — dates side-by-side, times side-by-side. Labels mono uppercase tracking-wider via font-mono.
- **M5.3**: ChipGroup for dayType — selectable chips with icon + label instead of select dropdown.
- **M5.4**: Section toggles — styled switch for Transport/Accommodation with animated knob.
- **M5.5**: Footer 3 buttons — Delete (error ghost border) + Cancel (text ghost) + Save (primary solid). Transport type as 4-col icon grid.
- All emojis removed. VIS-2 compliant.
- All styles via tokens. VIS-1 compliant.
- i18n: Added leg_form_subtitle, section_basic_info, field_transport_mode, field_accommodation_type in pt-BR/en/es.
- tsc: 0 errors.

### G4 — BookingChecklistPage Redesign
- **M4.1**: Large display title + subtitle.
- **M4.2**: Section headers with colored glowing dots + name + helper description text.
- **M4.3**: Rich cards with Material Symbol icons in circles, bold name, mono ref, mono date, right-aligned price.
- **M4.4**: Contextual action buttons per status: booked→"Mark as Purchased" (neutral), priced→"Record Purchase" (primary), estimated→"Finalize & Buy" (outline+edit), none→"Update Details" (outline+add).
- Removed all emojis (TRANSPORT_EMOJI → TRANSPORT_ICON). VIS-2 compliant.
- All styles via tokens. VIS-1 compliant.
- i18n: Added checklist_subtitle, desc keys, action keys in pt-BR/en/es.
- tsc: 0 errors.

### G3 — ItineraryContextCard Redesign
- **M3.1**: 2-col grid transport/accommodation with icon circles, mono labels. Sub-cards with border-subtle.
- **M3.2**: Mini-timeline with mono timestamps, colored dots (primary=active, outline=normal, transport-tint). Item active detection by time.
- **M3.3**: GPS detecting skeleton — pulse ring animation, SkeletonLoader for city/day, "Finding your city..." message, Detecting badge.
- **M3.4**: Budget progress — "Orçamento do Dia" mono label + values + colored bar (primary/<70%, warning/70-90%, error/>90%).
- **M3.5**: "Ver agenda" repositioned to header, aligned right. Summary view also gets it in header.
- Removed all emojis (TRANSPORT_EMOJI → TRANSPORT_ICON). VIS-2 compliant.
- All styles via tokens. VIS-1 compliant.
- i18n: Added gps_detecting_city, to in pt-BR/en/es.
- tsc: 0 errors.

### G2 — ItineraryPage Redesign
- **M2.1**: Empty state — 3-icon composition with glow/rings, AI gradient button, ghost manual button.
- **M2.2**: GPS opt-in — prominent card with 48px icon, pulse ring, CTA, manual search option.
- **M2.3**: GPS detecting — SkeletonLoader + "Detectando..." + pulsing badge.
- **M2.4**: GPS matched — status bar "GPS ativo · Confirmado" with badge.
- **M2.5**: GPS override — card with city mismatch, "USAR DATA" button.
- **M2.6**: Transit day — TimelineView integration with agendaToTimeline helper. Badges: DEPARTED/NEXT STOP/DESTINATION.
- **M2.7**: Full day — HeroBanner + BudgetStatusBadge in hero. Section labels mono. Notes: read/edit toggle.
- **M2.8**: Calendar + progress bar — migrated from Tailwind color classes to design system tokens via style. DAY_DOT_COLOR mapping for dayType indicators.
- tsc: 0 errors.

### G1 — Components (TimelineView + HeroBanner + BudgetStatusBadge + SkeletonLoader)
- **M1.1**: TimelineView — generic vertical timeline with past/active/future nodes, pulse animation on active, badge + time + ReactNode content.
- **M1.2**: HeroBanner — full-width card with gradient per dayType (DEC-471), city name, badge, children slot.
- **M1.3**: BudgetStatusBadge — pill badge: On Track (success/<80%), Attention (warning/80-100%), Over (error/>100%).
- **M1.4**: SkeletonLoader — shimmer animation divs with configurable lines/widths.
- i18n: Added budget_on_track/attention/over + 15 new keys across pt-BR/en/es.
- skeleton-shimmer CSS keyframes added to globals.css.
- tsc: 0 errors.

---

## Wave "Itinerary Polish" (2026-07-10) — `2.12.0-rc` → `2.13.0-rc` — ⏳ IN PROGRESS

> Orquestrador: `brain/documents/2026-07-10-itinerary-polish-orchestrator.md`
> 16 features: conversational flow + visual + contextual + map + sharing

### Baseline
- Tests: 327 files / 3391 passed / 2 failed (pré-existentes split-live-loop)
- Build: OK
- tsc: 0 errors
- Version: 2.12.0-rc

| Gate | Scope | Version | Status |
|------|-------|---------|--------|
| G0 | Baseline | 2.12.0-rc | ✅ |
| G1 | Core Fix + Visual (P00-P04) | 2.12.1-rc | ⏳ CODE DONE, awaiting deploy |
| G2 | Contextual Intelligence (P05-P08) | 2.12.2-rc | ⬜ |
| G3 | Card & Checklist (P09-P11) | 2.12.3-rc | ⬜ |
| G4 | Map & Location (P12-P13) | 2.12.4-rc | ⬜ |
| G5 | Push & Share (P14-P15) | 2.13.0-rc | ⬜ |

### G1 — Core Fix + Visual Foundation
- **P00**: Conversational Flow — novo stage `guided` com 6 perguntas sequenciais em chat-like UI. Compila respostas e chama buildItinerary. i18n 3 idiomas.
- **P01**: Color coding — getDayTypeStyle() utility, barra de cor no scroll de dias, borda lateral no header, dot colorido no context card.
- **P02**: Progress bar — "Dia N de T" com barra percentual, estados antes/durante/depois.
- **P03**: Timeline visual — barra vertical com nós coloridos por tipo (arrival=teal, departure=amber, accommodation=indigo, highlight=primary).
- **P04**: Swipe animado — touch handlers com threshold 40px, translateX visual, scroll de dias acompanha.
- **Fix**: style-hygiene test failing → `transition-all` → `transition-[width]`.
- Tests: 327 files / 3391 passed / 2 pre-existing. tsc: 0 errors. Build: OK.

---

## Wave "Itinerary Copilot" (2026-07-10) — `2.11.3-rc` → `2.12.0-rc` — ✅ SHIPPED

> **Wave:** Itinerary Copilot · **Start version:** 2.11.3-rc · **Target:** 2.12.0-rc

## Current State

| Field | Value |
|-------|-------|
| **Gate** | G5 COMPLETE — WAVE DONE |
| **Last milestone** | M5.4 — deploy 2.12.0-rc |
| **Tests** | 327 files / 3391 passed / 2 failed (pre-existing split-live-loop) |
| **Build** | OK |
| **tsc** | OK (0 errors) |
| **Deploy** | Pages + Worker verified, apex 2.12.0-rc |

## Milestone Log

### G0 — Setup & Baseline
- **M0.1**: Baseline documented: 325 files / 3338 passed / 2 failed
- **M0.2**: dev-log seeded
- **M0.3**: DECs 505-508 registered in decision-log

### G1 — Schema + Domain + Repository
- **M1.1**: Created `ItineraryLeg` entity (`src/domain/types/itinerary-leg.ts`) with types `TransportType`, `BookingStatus`, `DayType`, `AccommodationType`, `ArrivalTransport`, `LegAccommodation`. Added SCHEMA_V14 (version 15 in Dexie — V14 was a data heal). Table: `itineraryLegs: 'id, tripId, order, arrivalDate, linkedPhaseId'`.
- **M1.2**: Created `itinerary-leg-repository.ts` extending `BaseRepository` with `getByTripId`, `getByTripIdAndDate`, `saveBatch`, `removeAllByTripId`. Exported in index.
- **M1.3**: Created `itinerary-domain.ts` with 5 pure functions: `getCurrentLeg`, `getNextTransport`, `getDayAgenda`, `suggestPhasesFromLegs`, `getTripSummary`. Created Julio eurotrip fixture (13 legs, full real data). 33 domain tests, all passing.
- **+33 tests** (3338 → 3371), **0 new failures**, tsc clean, build green.

### G2 — Worker Endpoints
- **M2.1**: Created `POST /itinerary-copilot/build` in worker with system prompt, Groq integration, and rate limiting (RL_AI).
- **M2.2**: Created `POST /itinerary-copilot/refine` in worker — takes existing legs + user instruction, returns refined set.
- **M2.3**: Created `itinerary-copilot-parser.ts` — defensive client-side parsing with type coercion, client-side ID generation (ÂNCORA-AI-1), and comprehensive tests.
- **+20 parser tests**, tsc clean, build green.

### G3 — UI: Conversa + Confirmação
- **M3.1**: Created `ItineraryCopilotFlow.tsx` — conversational UI with mode selection, text input, loading state, AI interaction via `ai-itinerary-copilot.ts`.
- **M3.2**: Created `ItineraryPreview.tsx` — expandable leg cards with transport/accommodation details, suggested phases display.
- **M3.3**: Phase suggestion flow with 1-tap confirm, save to DB via `itineraryLegRepository.saveBatch()`.
- Routes `/itinerary` and `/itinerary/create` added to router. "Itinerário" entry added to TripHub "Mais" menu.
- Full i18n: pt-BR, en, es — all `itinerary.*` keys.
- tsc clean, build green, all tests passing.

### G4 — Home Card + Agenda
- **M4.1**: Created `ItineraryContextCard.tsx` — live query for legs, shows current city + day N/total + next transport + accommodation. Returns `null` when no legs (ÂNCORA-ITIN-2). Added to DashboardPage after DashboardCards.
- **M4.2**: `ItineraryPage.tsx` — horizontal date scroll (today highlighted), city header with day type + companions, chronological timeline, budget premise section, empty state with CTA.
- **M4.3**: Routes and navigation already wired in G3. Menu "Mais" entry confirmed.
- **M4.4**: i18n complete — all `itinerary.*` keys in pt-BR/en/es including context card strings.
- Tests: 327 files / 3391 passed / 2 failed (pre-existing). tsc: 0 errors. Build: OK.

### G5 — CRUD Manual + Polish + Deploy Final
- **M5.1**: Created `LegFormSheet.tsx` — full form with city, dates, times, day type, companions, collapsible transport and accommodation sections with all fields. Integrated into `ItineraryPage.tsx` — "+" button to create, tap city header to edit, delete from sheet. Empty state has both "Criar com IA" and "Criar manualmente" buttons.
- **M5.2**: Version bump 2.11.3-rc → 2.12.0-rc. Updated `package.json`, `app-version.ts`, `version.json`. Release notes added in 3 languages (5 items each).
- **M5.3**: Full test suite green (327 files / 3391 passed / 2 pre-existing). tsc: 0 errors. Build: OK.
- **M5.4**: Deploy pages + worker via `scripts/deploy.sh`. Production verified: apex shows 2.12.0-rc. OTA bundle downloadable.

## Wave Complete 🎉
All §11 DoD items satisfied. Apex verified at 2.12.0-rc.
