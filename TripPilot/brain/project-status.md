# TripPilot — Project Status

> Last updated: 2026-06-26 — **v1.4.3-rc** (**Grupos Confiáveis & Acerto Claro wave COMPLETE** — gates G0→G9 in one continuous session over base 1.3.0-rc: G1 group-split UX, G2 images plaintext-on-R2 [L-IMG], G3 live shared board [L-LIVE], G4 identity/connect/QR-zoom, G5 every-QR-is-a-URL, G6 real-time peer-ping + notifications [L-RT], G7 payment-fairness state machine + history, G8 people-at-creation + a new `group_invite` P2P kind, **G9 settle-up Variante O + unified Pessoas + Viagem divisions entry + concept explainers [L-IA]** — **all four §16 locks shipped**; DEC-348→360 APPROVED; **ledger-math invariance held throughout** (the arithmetic never changed — only when/where truth propagates and how it is shown). See the dev-log "Grupos Confiáveis & Acerto Claro wave" section. Prior: **v1.1.3-rc** (**Discovery & Clarity wave COMPLETE** — gates G0→G6 in one continuous session: help mirrors the product (`guide ⊆ help ⊆ router`, group-split added), Amigo Sincero = voice-only (factual → insights), the FAB always closes on a context switch, a home discovery hub with intent search, a unified "Dividir" chooser, day-money clarity (one saving destination + documented cofrinho rule, **no math change** Â11), phase-scoped pots (off-phase pots leave the Home focus but stay selectable; create separates Event × Pote/Fundo), and per-item price history on the expense detail (what you paid before, base-currency, offline). DEC-307→320 all **APPROVED**; the optional G6/D07 was taken on (D05 already finished in G3). See the "Discovery & Clarity wave" section below. Prior: **v1.0.0-rc** (**Coherence & Tricount wave COMPLETE** — gates G0→G8 in one continuous session: every screen tells the same story (grouped outing×item reading, actionable outing detail, copilot↔planner reconciled, red only on real risk, balanced simple-mode nav, contextual Amigo Sincero, piggy clarity, settlement/connected states) **plus the new group-split feature (Tricount, DEC-297)** — a persistent multi-expense/multi-payer event with manual + AI/receipt entry, equal **and** custom split, a public `/g/` claim board (pick your name, see your balance, mark paid — no app needed), and a read-only settle-up bridge into the trip (DEC-306). DEC-295→306 all **APPROVED**; the state dictionary (DEC-304) is finalized. See the "Coherence & Tricount wave" section below. Prior: **v0.99.57** (**UI/UX pass G1→G7 COMPLETE** — legibility · a11y · first-minute · social-trust; DEC-285→294 all APPROVED; see the "UI/UX pass" section below). Prior: **v0.99.14** (**AI Quick Entry — split-accuracy hardening**, DEC-246 amendment, web/OTA + Worker): a field input — *"Bruno pagou 12,80 pelas tortilhas, dividimos entre ele, eu e a Débora"* — was being recorded as `someone_paid` (I owed the **full €12.80** instead of my **€4.27** share). Fixed end-to-end after a QA pass over 20+ entry types: **(1)** the Worker **planner prompt** now decides SPLIT first (someone-else-paid-AND-divided → `split_expense`/`payer:"other"`/`person:<payer>`/`participants:[sharers]`), resolves pronouns ("ele"→the name), never lists the user (`eu`) as a participant, reads comma/thousands decimals, and **stops guessing a currency that wasn't spoken** (→ null → device base); **(2)** device `plan.ts` honors a **named non-owner payer** (and counts them as a sharer) + a **safety-net reroute** so any `someone_paid` carrying extra sharers becomes the correct equal split (a misclassification can **never** overcharge), plus a shared `equalSplit`, self/pronoun filtering, multi-person `i_paid_for`, and a whole-trip fallback; **(3)** `intent.ts coerceNumber` parses `"12,80"→12.8`, `"1.250,00"→1250`, `"1,250.00"→1250`. The on-device math (`resolvePayerExpense` → 3 equal shares, each non-payer owes the payer) was already correct, so once the planner emits the right op the debts compute correctly. Verified: **+16 assistant unit tests (57 total green)**, full suite green except the 2 pre-existing `split-live-loop` env tests (Web Crypto + network), `tsc` app+worker + `vite build` green, i18n pt-BR/en/es. **Deployed**: Worker `wrangler deploy` (version `96b494f1`) + **live re-probe** confirms the exact bug input → `split_expense`/`payer:other`/`Bruno`/`["Bruno","Débora"]`/`12.8`; device fixes ship web/OTA (version.json 0.99.14, sw `trippilot-v56`). Prior: **v0.99.13** (**Copilot "Trip Wrapped" — end-of-trip retrospective**, DEC-247, web/OTA): a pure `buildTripWrapped` reuses the existing copilot-insights derivations into a celebratory recap (total · biggest day · #1 category · social · peak hour · discipline streak), each stat self-censoring on thin data; `TripWrappedSheet` opens from the top of `/copiloto` (gated on real spend), reachable any time as a **preview** until the trip ends, sharing via the DEC-133 card. 7 new unit tests + e2e; **deployed + verified** (version.json 0.99.13, bundle 0.99.13.zip 803,485 B, /copiloto 200, APK byte-identical 0.56.0). Prior: **v0.99.12** (**AI Quick Entry — natural-language router (text + voice) wired to every core action**, DEC-246, web/OTA — **SHIPPED + deployed**: Pages OTA + Worker `/assistant`+`/transcribe` live reusing the existing GROQ_API_KEY, live probe → `someone_paid`/Bruno/€2/i_owe 200): one fast box ("o Bruno me pagou uma cerveja de 2 euros") read by a cloud **planner** (Groq `llama-3.3-70b-versatile`, JSON mode) into a typed `AiIntent` (action + entities **by name**, never ids/math), then resolved + executed **on-device** through the SAME engines as QuickAdd — `log_expense` / `someone_paid` (I owe) / `i_paid_for` (they owe me) / `split_expense` / `record_income` / `transfer` / `withdraw` / `settle_debt` / `plan_purchase`, plus navigate-actions (bill split, receipt scan, outing, plan, simulator, screens) — with a one-tap **preview→confirm**, a tap-loop for clarifications (add/disambiguate a person), **undo** (DEC-126) and a graceful manual fallback on any failure/offline. Voice is first-class (Web Speech + Groq **Whisper** fallback for the APK). Privacy (ÂNCORA 8): opt-out master switch `aiQuickEntryEnabled` (default **ON** for the owner's headline tool) + opt-in `aiQuickEntryPrivateNames`; only first names/labels reach the cloud — **never** amounts, balances, ids or history; all financial math/persistence stay on-device. New pure module `src/domain/assistant/` (intent/context/resolve/plan/dispatch) + stateless Worker `/assistant`+`/transcribe` proxies next to `/ocr` + a global `AssistantSheet` opened from a new gradient **AI hero** at the base of the FAB. Verified: **41 new unit tests** (intent/resolve/plan), full suite **1655 passing** (the only 2 fails are the pre-existing `split-live-loop` *real-worker* integration test — needs Web Crypto + network, untouched here), `tsc --noEmit` app + worker green, `vite build` green, i18n pt-BR/en/es complete. **Deploy DONE** — committed (`ef7793f`), pushed, CI-deployed; the Worker `/assistant`+`/transcribe` routes shipped via `wrangler deploy` (reusing `GROQ_API_KEY`) and **live-probed 200** (`someone_paid`/Bruno/€2/`i_owe`). Plan + 5 inline councils: `documents/ai-quick-entry-natural-language-router-plan-2026-06-20.md`. Prior: **v0.99.7** (**Debt deep-dive · G3 — Lembrar/Cobrar Pix-ready post-commit + debt legibility**, DEC-241/DL-5, web/OTA → **"está me devendo" epic COMPLETE, G1+G2+G3**): right after a split, `SplitShareNudgeSheet` now offers **"Lembrar"** per debtor (ready-to-send "você me deve {amount}" via the OS share sheet, amounts passed only when the owner is the payer), the pt-BR remind copy is **Pix-ready** ("me manda no Pix?"; the stored Pix key/QR stays the G4 future epic), and the `/shared` debt rows now lead with the **bold amount**. Verified: FULL suite **1552/173** green, tsc/build clean, Playwright `share-link` 3/3 vs the live worker + `shared-confirm` + `quick-add`, deployed `0a97c841.trippilot.pages.dev` (`version.json` 0.99.7, bundle 0.99.7.zip, sw `trippilot-v55`, APK byte-identical 0.56.0). Prior — **v0.99.6** (**Debt deep-dive · G2 — "Acerto de contas" hub redesign**, DEC-241/DL-3·DL-4, web/OTA): `/shared` now opens with the answer — an **A receber / A pagar / net hero** (pure `summarizeOwnerDebts` over `calculateDebts`), per-debt **Lembrar** (ready-to-send message) beside **Liquidar**, connected-pending shown display-only as **"Aguardando aceite"**, and the P2P machinery demoted into a **collapsed "Conexões"** that stays mounted (live mirror sockets never drop). The Home gains a **"Acerto de contas" (A receber/A pagar) card** and the legacy pendências card auto-gated by G1 now reads "Aguardando aceite"; settle-up vocabulary unified across entry points (pt-BR/en/es). Demo gained connected friend **"Beto"** (born-pending) so both the offline-confirmed (Ana) and awaiting-acceptance paths show at once. Verified: FULL suite **1552/173** green (+7 `owner-debt-summary`), tsc/build clean, Playwright incl. `share-link` 3/3 vs the live worker, deployed to `trippilot.pages.dev`. **G3 (v0.99.7) shipped — see the v0.99.7 line above.** Prior status line below kept for history. — **v0.99.5** (**Debt deep-dive · G1 — "está me devendo" now becomes real from the owner's ledger**, DEC-241/DL-1, web/OTA): the deep-dive found the core asymmetry — owner-authored third-party shares were born `pending` and `calculateDebts` counts only `confirmed`, so an **offline friend's debt was invisible** until someone confirmed it through a channel an app-less friend never has. Fix: a pure `resolveShareBirthStatus` makes the owner/payer **and every non-connected person born `confirmed`** (debt real instantly), keeping `pending` only for **connected** counterparties (paired device / live link) so the mirror confirm/reject still works — threaded into `resolvePayerExpense` (QuickAdd/Outing) and `commitSplit` (via `actorId`). `calculateDebts` untouched, so `/shared`, the dashboard and Copiloto surface offline-friend debts at once and the "pendências" card now lists only connected-pending. **G2 (v0.99.6 "Acerto de contas" hub redesign) + G3 (v0.99.7 remind/cobrar) pending.** Full plan: `brain/documents/debt-and-split-ux-deep-dive-and-plan-2026-06-19.md`. Verified: FULL suite 1545/172 green (+ new born-status + connected-case tests), sync/mirror suite preserved, tsc/lint/build clean, deployed to `trippilot.pages.dev`. Prior status line below kept for history. — **v0.99.4** (**Bill Split "saída de bar" hardening batch COMPLETE**, DEC-240, web/OTA): the full **who-got-what history** reads both ways — **Por pessoa** (each person's lines + how they joined: você / link sem conta / você adicionou na mão / app dela / acompanhante) and **Por item** ("esse item foi pra quem"), with the unclaimed "ninguém pegou · cai em você" orphans always shown so it's "a conta toda"; the owner's personal cost is a prominent **"O que é meu"** hero at register time; a single **persistent live-split notification** (Service Worker on web + Capacitor ongoing on native) mirrors the active table and deep-links back on tap (permission asked on the go-live gesture); and a new **pass-the-phone (round-the-table) mode** — hand the device around, each person names themselves (or is matched to an app companion) and marks their items → "próximo" — built as a thin wizard over the existing adhoc-participant + equal-share-claim domain (rides the live link untouched, dup-name guarded). The history sheet is reachable from the live split AND the committed expense. Verified: tsc clean, 142 split-domain + 162 notification-area unit tests, ALL split Playwright E2E green incl. the two-device live-sync re-confirmation and a new pass-the-phone spec. Built on the **v0.96.0→v0.99.3** bill-split epic (G1 single-device → G2 live table → G3 promote/two-way → v0.99.0–0.99.2 server-truth + Service-Worker sync fix proven on two real devices → v0.99.3 active-split persistence). Prior status line below kept for history. — **v0.90.0** (**UX Clarity Package #4 · GATE 14 — P3 clarity polish COMPLETE; Package #4 and the whole UX-clarity backlog CLOSED**: onboarding now recommends a starting mode + explains "reserva protegida" with a money example; the Trip editor explains "ritmo da fase" / "dias de pico" / evento×sub-destino; the Overview declares its role ("resumo só-leitura; edite na Viagem") and the Phase Preview names the "renda planejada só alimenta a projeção" nuance inline; Settings gained a dedicated **"Conexões e compartilhamento"** group (pairing/mailbox/cloud-OCR) split out of "Backup e segurança", and "Visão avançada" was confirmed already housed (Package #1 GATE 6). Zero behaviour change. DEC-234, web/OTA. See the "UX Clarity Package #4 · GATE 14" section below.) Prior: **v0.89.0** (**UX Clarity Package #4 · GATE 13 — Home insight cap + "why shown" COMPLETE**: the complete-mode Home insight carousel — which auto-accumulated up to 12 reads — is now capped to the **top 4** (already priority-sorted, warnings first) with a one-tap **"Ver mais N"** that reveals the rest in place; nothing removed. The other "contextual warnings" are user-configurable cards or single gated banners (the user already owns that cap), and simple mode was already capped to one warning — so only the carousel needed a forced cap. The P3 "por que apareceu?" was confirmed already answered by the existing **"Como cheguei nisso"** insight-detail sheet. Zero behaviour change. DEC-233, web/OTA. See the "UX Clarity Package #4 · GATE 13" section below.) Prior: **v0.88.0** (**UX Clarity Package #4 · GATE 12 — Saída opener + contextual SOS COMPLETE**: the Outing start screen now opens with a one-line "what an outing is" explainer; the shared "amigo sincero" card surfaces a "Plano de resgate" CTA → /rescue, but only in the dire `alert` tone (reserve at risk); the SOS "is a simulation" P3 was confirmed already present in the rescue intro/note. Zero behaviour change. DEC-232, web/OTA. See the "UX Clarity Package #4 · GATE 12" section below.) Prior: **v0.87.0** (**UX Clarity Package #4 · GATE 11 — Single split explainer COMPLETE**: the split model — shown in four screens (QuickAdd/Receipt/Shared/Wise) with drifting wording — now has ONE reusable `SplitExplainer` ("Como funciona a divisão", collapsed → 3 steps) reading from a single `split.*` i18n namespace, mounted on the three first-class surfaces (QuickAdd/Receipt/Shared); the expense detail's "fluxo financeiro × custo pessoal" gained a one-line caption; Wise (power-user allocation sheet) deferred P3. Zero behaviour change. DEC-231, web/OTA. See the "UX Clarity Package #4 · GATE 11" section below.) Prior: **v0.86.0** (**UX Clarity Package #4 · GATE 10 — Planner guided microcopy COMPLETE**: the app's most conceptual surface gains four plain-language captions — a header intro, a "margem livre × alocado" explainer, a presets hint, and a classification hint — **zero behaviour change**; the "esconder no modo simples" goal was confirmed already satisfied by the existing `ModeGuard` on `/planner`. DEC-230, web/OTA. See the "UX Clarity Package #4 · GATE 10" section below.) Prior: **v0.85.0** (**UX Clarity Package #4 · GATE 9 — Expense-list filter clarity COMPLETE**: the Expenses filter chips — which mixed categoria/lugar/perfil in one unlabelled row — now sit behind a collapsible **"Filtros (N)"** toggle, split into labelled groups **Categorias / Lugares / Outros**, with the active scope always visible as a removable summary; the **"Saídas"** tab gained a one-line explainer; nothing removed, header strictly shorter. DEC-229, web/OTA. See the "UX Clarity Package #4 · GATE 9" section below.) Prior: **v0.84.0** (**UX Clarity Package #3 · G8 — "Perfis" → "Atividades" rename COMPLETE**: the activity-profile feature's user-facing label is now **"Atividades"** across pt-BR/en/es — page title, add/empty/updated/remove copy, the TripHub "Estrutura" tile, the Planner section, the Settings entry, templates and hints — **UI strings only** (every i18n key, the `{{profile}}` variable and all code identifiers unchanged); the broader **Trecho/Pote funds-vocab migration is deliberately scoped to a dedicated future pass** (the happy path already speaks Trecho/Pote; the residual "Fundo" jargon stays confined to the advanced editor — a blanket relabel is ambiguous and regression-prone). DEC-228, web/OTA. See the "UX Clarity Package #3 · G8" section below.) Prior: **v0.83.0** (**UX Clarity Package #3 · G7 — Copiloto prioritized COMPLETE**: the ~18 self-censoring reads are now organized into four collapsible theme groups — **Agora / Para onde vai / Padrões / Pessoas** — with the first non-empty group open by default and a count badge on the collapsed ones; nothing removed (G3/§4.6, DEC-227, web/OTA). See the "UX Clarity Package #3" section below.) Prior: **v0.82.0** (**UX Clarity Package #2 — Captura COMPLETE**: FAB reorganized for the thumb [heroes at the base + "Outros registros"/"Planejar" expanders, all 9 actions kept] and Quick Add progressive disclosure [valor/categoria/descrição up front; date/local/fundo/carteira/anexos under "Detalhes"; fundo hidden when there's only one] — DEC-226, web/OTA; first package from the UX-clarity audit, does not touch Package #1. See the "UX Clarity" section below.) Prior: **v0.81.0** (**Budget Model Reform / "budget model v2" — Implementation Package #1 COMPLETE** across 6 autonomous web/OTA gates v0.76.0→v0.81.0: canonical Trecho/Pote/Evento/Compra model, dashboard follows the active phase, 1 trecho = 1 dedicated pool, unified Pote with D8 visibility, first-class Events + single planning door, progressive wallet tracking, and the "Visão avançada da viagem" — reconciles DEC-007×089×153 into DEC-219→225; **1380 unit tests / 155 files**. See the "Budget Model Reform" section below). Prior: **v0.75.0** (Device-Test Force-Task Ondas 1–4 + 4C close-out shipped web/OTA, 1299 tests / 144 files; Onda 5 native+sync is device-pending — see DEC-217 / DEC-218 and the "Device-Test Force-Task" status section directly below). Prior milestone context retained below. — **v0.58.0 — Shared Participant Link epic COMPLETE incl. real-time (DEC-207 IMPLEMENTED): share a split via `…/s/:id#k=<key>` to someone with no app; they see only their slice (owner/mirror), confirm/reject + mark paid; E2E (key in URL `#fragment`, server stores ciphertext only in Cloudflare KV); real-time S7 = `ShareSignal` Durable Object WS relay (live owner↔guest, app-open; async pull is the floor). Delivery report `brain/documents/delivery-report-shared-link-and-realtime-2026-06-16.md`. Prior v0.56.0 — receipt OCR/AI epic [G1,G2,G4 cloud + 40-item rollup + AI entry; on-device G3 REMOVED per DEC-209 "didn't read well"] + receipt split now an explicit participant picker (DEC-208) + native APK self-update (DEC-210, installer plugin, APK 21MB→8MB); prior milestone v0.40.0 — Wise CSV statement import: turn each card purchase into an expense with category/city/phase guessed, cross-source dedupe via `externalRef`, editable review + undo. Caps the native-Android arc v0.28.0→v0.40.0: Capacitor shell + safe-areas + back-button + haptics + permissions, app-wide motion system, the post-animation regression fixes, the active-outing height + FAB redesign, and the rich active-outing notification with no-open quick-add buttons.)

## Current Phase

**Implementation — D1–D5 + gap-fix R1..R3 + P2P sync R4 + reliability R5 + full-fix R6 + field review R4 + field feedback fixes + brainstorm features v0.8.0/v0.8.1 + stability hardening v0.8.2 + Feature Expansion Package 1 v0.8.3→v0.10.1 (Phases 1 & 2) + Feature Expansion Package 2 v0.10.2→v0.12.1 (Phases 3 & 4) + Feature Expansion Package 3 v0.12.2→v0.14.1 (Phases 5 & 6) + UX Polish Pass v0.14.2→v0.14.5 + UX Feedback & Continuity Pass R2 v0.14.6→v0.14.10 + Budget Model Reform v0.76.0→v0.81.0 + UX Clarity Packages #2–#4 v0.82.0→v0.90.0 + Device-Test gates v0.91.0→v0.95.0 + Bill Split epic v0.96.0→v0.99.4 + Debt deep-dive v0.99.5→v0.99.7 + payment-methods/backlog v0.99.8→v0.99.11 + AI Quick Entry v0.99.12 + Copilot Trip Wrapped v0.99.13 deployed** ✅ — **V1 EXPANDED COMPLETE** (Fase 7 = V2)

### Grupos Confiáveis & Acerto Claro wave (base v1.3.0-rc → v1.4.3-rc) — 2026-06-26 — ✅ COMPLETE (G0→G9 shipped, web/OTA)
- **Source**: `brain/documents/2026-06-26-group-reliability-settle-redesign-orchestrator.md` (single execution truth) — change-set **F01–F28**, decisions **DEC-348→360**, gates **G0→G9**. Answers Julio's **3rd field review** (the 1.3.0-rc device test). Mostly bug-fixes + two **reversals** of the predecessor wave (image E2E → access-controlled plaintext on R2; owner-as-reducer pending-gate → a **live shared board**) + a **deep settle-up IA redesign** (Variante O). All four §16 forks **L-IMG / L-LIVE / L-RT / L-IA LOCKED by Julio** then **all shipped**. One continuous session, one deploy per gate; **ledger-math invariance held throughout**.
- **Reliability gates (G1→G8)**: **G1** group-split UX (F01–F05, F28) → 1.3.1-rc; **G2** images plaintext-on-R2 + persistence + multi-photo (F06–F09, **L-IMG**, +`wrangler deploy`) → 1.3.2-rc; **G3** live group board + delete-recalc + owner=moderator (F10–F12, **L-LIVE**) → 1.3.3-rc; **G4** onboarding name + bilateral connect + Android QR zoom (F13–F15) → 1.3.4-rc; **G5** every QR is a URL (F16) → 1.3.5-rc; **G6** real-time peer-ping (reused the deployed `ShareSignal` DO — **no Worker diff**) + notification center + home pending card + native notif (F17–F19, **L-RT**) → 1.4.0-rc; **G7** payment state machine (unpaid→marked→confirmed, *marked is neutral, never red*) + receiver-confirms + append-only activity timeline + who-paid panel (F20–F23) → 1.4.1-rc; **G8** people-at-creation — a new P2P **`group_invite`** kind (read-creds only, accept-first) + a pure people-picker wired into create (F24, DEC-355) → 1.4.2-rc.
- **G9 — settle-up IA v2 (the last gate, L-IA) → 1.4.3-rc**: the ~2240-line `/shared` recomposed into the locked **Variante O** via CSS `order-[N]` (DOM untouched) — sticky header · "Resolver agora" action band · unified **Pessoas** preview + connect row · group-divisions pointer · "Mais" (collapsed shared-expenses, **backup moved to `/sync`**); a pure **unified people view-model** (`domain/connections/people-view.ts`, one badge vocabulary, deduped by actorId/name — DEC-357); a full **Pessoas** experience as a sanctioned full-screen sheet (search + connect + status sections + pagination — DEC-359); a Viagem-grid **"Divisões em grupo (N)"** tile + "Participantes"→"Acerto de contas" rename + the FAB group door now lands on the `/groups` **list** not `?new=1` (DEC-360); and one reusable **`<ConceptHint>`** at `/split` + `/groups` (DEC-358). **No ledger/orchestrator change — pure recomposition.** DEC-356/357/358/359/360 APPROVED.
- **Quality**: unit **2491 pass / 2493** (only the 2 documented WebCrypto `split-live-loop` baseline fails — they pass on CI Node 22), `tsc --noEmit` clean, `vite build` green (`index` 418.98 KB < 500 KB). Each gate deployed to Cloudflare Pages (`master`) with a `version.json` bump (1.3.1-rc→1.4.3-rc) + release notes pt/en/es. Per-milestone detail in `src/dev-log.md`.
- **⏳ remaining**: the on-device **manual smoke matrix** (sandbox WSL has no device/Playwright browsers, so validate on the OTA 1.4.3-rc build — each AC is already covered by unit/build/tsc); optional **G_last** (P2 trims: richer organizer-override audit, an "auto-aceitar de {nome}" toggle).

### Discovery & Clarity wave (v1.0.1-rc → v1.1.3-rc) — 2026-06-25 — ✅ COMPLETE (G0→G6 shipped, web/OTA)
- **Source**: `brain/documents/2026-06-25-discovery-clarity-implementation-orchestrator.md` — the single execution truth for the **second review briefing** (function discovery, flow clarity, concept fixes). Change-set **D01→D15** (+ optional D07), councils **C-A→C-J**, gates **G0→G6**. The §16 lock was **waived by Julio**; the council recommendations were **adopted in block**; decisions **DEC-307→320** all **APPROVED** as each gate shipped. One continuous session, one deploy per gate; per-milestone detail in `src/dev-log.md`.
- **Theme**: the app has many good functions but users risk not discovering them, not knowing where they are, or confusing look-alike functions. The wave was about **discoverability, flow organization, and concept clarity** — not big new features. **ÂNCORA 11 held: no cofrinho/insights/total math changed** (exposure + clarity only).
- **P0 (shipped)**: **D01** guide+help re-audited vs router, `group_split` added, `guide ⊆ help ⊆ router` hardened by test (G2/1.0.3-rc); **D06** Amigo Sincero = voice only, factual extras → insights (G1/1.0.2-rc); **D09** FAB closes on any context switch (G1); **D11–D14** day-money clarity — one saving destination, cofrinho rule (Model B `buildPiggyLedger`) documented (`product-spec.md` §30), "De onde vem?" covers the day (G4/1.1.1-rc); **D15** phase-scoped pots — off-phase pots out of the Home focus into a collapsed "Potes de outras fases", still selectable; create flow separates Event × Pote/Fundo (G5/1.1.2-rc).
- **P1 (shipped)**: **D02** home discovery hub `/descobrir` (intent search reusing the local 0-token `searchHelp`); **D03** unified "Dividir" chooser (entry only; bill-split & group-split code stay separate); **D04** group-split visibility (FAB + guide + hub); **D08** FAB reorg (mode-aware) — all G3/1.1.0-rc; **D10** compact "Posso gastar" chip (G4).
- **P2 (G6, shipped)**: **D07** per-item price history — pure `domain/shopping/price-history.ts` (`buildPriceHistory`, base-currency, offline, no schema) renders a min/avg/max + "vs your average" card on the expense detail when the same item (normalized name) has ≥2 buys (**DEC-320**; 12 tests). **D05** groups-screen finishing was already delivered in G3 (single door, "Ver todas" link) — no further low-risk work warranted.
- **Shipped versions**: 1.0.2-rc (G1) · 1.0.3-rc (G2) · 1.1.0-rc (G3, discovery hub milestone) · 1.1.1-rc (G4) · 1.1.2-rc (G5) · **1.1.3-rc (G6)**. Suite 2312 pass (2 WebCrypto baseline), tsc clean, build green, Cloudflare Pages auto-build per gate.

### Coherence & Tricount wave (v0.99.58→v1.0.0-rc) — 2026-06-24 — ✅ COMPLETE (G0→G8 shipped, web/OTA)
- **Source**: `brain/documents/2026-06-24-coherence-implementation-orchestrator.md` (the single execution truth) — change-set C01→C25, councils C-A→C-D, gates G0→G8. The §16 questions were answered & locked by Julio; decisions **DEC-295→306** all **APPROVED** as each gate deployed. One continuous session, one deploy per gate; the whole `dev-log.md` Coherence section has the per-milestone detail.
- **Coherence (G1→G7, 0.99.58→0.99.64)**: C03 zero visible scrollbar + C12/DEC-299 bar color = real risk only + C14/C15/C16/C25 hygiene (G1); C01/DEC-296 an outing is ONE entity in every summary, only text search itemises (G2); C02/DEC-302 actionable outing detail + item→outing back-link (G3); C04/DEC-304 copilot↔planner speak one language + C09/C10/DEC-300 piggy fixed section with honest state labels + C21/C22 (G4); C07/C08/DEC-301 Amigo Sincero contextual CTA + home de-dupe (G5); C11 settlement/connected stages + C05/DEC-303 universal share feedback (G6); C06/DEC-298 balanced 2+2 simple-mode nav + C17/C18/C19/C20 structure/clarity + C13 complete help re-audit + C24 (G7).
- **Tricount group-split (G8 → 1.0.0-rc, DEC-297, full scope)**: a brand-new `domain/group-split/*` aggregate (separate from the single-bill split; money in cents, pure math) — `GroupSplitEvent` with participants (named / connected / no-app), expenses (manual + AI + receipt), equal **and** custom split, multi-payer; balances + greedy min-transfer settle (Â11 preserved). UI: `/groups` list + `/groups/:id` detail with the `GroupExpenseEditor`. **Public link**: `/g/:id` `GroupClaimPage` reusing the exact encrypted `/share` transport/crypto/claim (worker unchanged) — a guest picks their name, sees their net + the exact transfer, marks paid; the owner confirms (marked[amber] → confirmed[green], never red). **Data**: Dexie V12 `groupSplitEvents` table + backup v8 (history persists/restores). **Settle-up bridge (DEC-306)**: a pure `groupSplitToDebts` projects a trip-linked group's transfers into trip-participant space (linked-only, drop confirmed, currency-guarded), surfaced **read-only** on `SharedExpensesPage` — the trip money ledger is never mutated (the settle action stays in the group). Tricount help article added.
- **Quality**: every gate green — final unit **2266 collected / 2264 pass** (only the 2 documented WebCrypto `split-live-loop` baseline fails, which pass in CI Node 22), `tsc --noEmit` clean, `vite build` green (`index` ≈406 KB < 500 KB). Each gate deployed to Cloudflare Pages (`master`) with a `version.json` bump (0.99.58→1.0.0-rc) + release notes pt/en/es.
- **⏳ remaining**: the on-device **manual smoke matrix** (orchestrator §15, incl. the Tricount create→link→claim→mark-paid→settle journey) — the sandbox WSL has no device/Playwright browsers, so validate on the OTA 1.0.0-rc build (each AC is already covered by unit/build). Promotion from **1.0.0-rc → 1.0.0** is the explicit next step after that device smoke.

### UI/UX pass — legibility · a11y · first-minute · trust (v0.99.51→v0.99.57) — 2026-06-24 — ✅ COMPLETE (G1→G7 shipped, web/OTA)
- **Source**: `brain/documents/2026-06-24-ui-ux-implementation-orchestrator.md` (the single execution truth) + scope `documents/ui-ux-change-checklist-2026-06-23.md` + the 2026-06-24 validation (real telemetry + expert walkthrough). The §16 questions were answered & locked by Julio; the gate order was ratified by **Council C5** (single continuous session). Decisions **DEC-285→294** — all **APPROVED** as each gate deployed.
- **G1 — foundations a11y (0.99.51, DEC-285/286/287)**: global `:focus-visible` ring (keyboard-only); AA contrast on faint text / primary CTA (white-on-terracotta) / error; `aria-current` on the active nav tab; the AI accent **tokenized** (`--ai*`) and de-hard-coded across 9 files; **0 `transition-all`** (exact animated props).
- **G2 — one "viagem" surface (0.99.52, DEC-288)**: the duplicate `TripOverviewPage` retired into the Viagem Hub (share card migrated verbatim), `/trip`→`/viagem` redirect (no dead links), discovery keywords absorbed; 18 orphan i18n keys removed.
- **G3 — multi-space onboarding (0.99.53, DEC-290)**: the Welcome now forks **trip × day-to-day** at first run (reusing the onboarding machinery via `?kind=ongoing`), with backup/receive/demo **demoted, not removed** (Â9) + a value line + legible demo entry (M20/M23).
- **G4 — first minute / Dashboard (0.99.54, DEC-293/289)**: the top notices collapse into ONE **rotating carousel** (nothing gone, demo never shows fear banners); "Livre hoje" promoted (one "free" per screen) + an "posso gastar?" shortcut; a reassuring line replaces a bare phase €0; the context chip shows the **mode**; a tap **glossary** ⓘ → Help (M05).
- **G5 — voice & moments (0.99.55, DEC-291/292)**: the four Amigo Sincero tones **actually differ** now (full phrase-bank rewrite ×3 langs, distinctness tests); ending an outing shows a warm **light recap** sheet reusing `OutingReviewPage` (pure `buildOutingRecap`).
- **G6 — tools & polish (0.99.56, M13/M22/M21/M24/M25)**: Planner legend (essential/optional) + "why locked" microcopy + "Modo: manual"; Converter defaults to the **home currency** + example placeholders; a discreet **"works offline"** seal (Converter + Comparator); a capture tip in the photo Comparator (frame the price tag).
- **G7 — split legibility + seal (0.99.57, DEC-294)**: the per-person "recebe/deve" + owner receivable/payable hero stay always legible; a pure `resolveSettlementStanding` drives a proud **"Tudo acertado ✓"** seal that shows exactly when the group balance zeros after real splitting (never on a fresh trip).
- **Quality**: every gate green — unit **2166/2168** (only the 2 documented WebCrypto baseline fails in `split-live-loop`, which pass in CI Node 22), `tsc --noEmit` clean, `vite build` green (`index` ≈400 KB < 500 KB), `build:pages` OK per gate. Each gate deployed to Cloudflare Pages (`master`) with a `version.json` bump (0.99.50→0.99.57) + release notes pt/en/es.
- **⏳ remaining**: the on-device **manual test matrix** (orchestrator §15) — sandbox WSL has no device/Playwright browsers, so validate on the OTA 0.99.57 APKs (each AC is already covered by unit/build). **Backlog parked** (out of this batch): M07/M08 (FAB hierarchy), M16-density, M14, the full "closing screen" M17 (post-validation).

### Copilot "Trip Wrapped" — end-of-trip retrospective (v0.99.13) — 2026-06-20 — ✅ SHIPPED + DEPLOYED (commit 4869bf6, web/OTA)
- **Source**: ranked backlog (DEC-245 bucket C / Copilot module H — the last unbuilt Copilot read), taken as the autonomous next step; decision **DEC-247**.
- **Build**: pure `domain/copilot/wrapped.ts` (`buildTripWrapped`) orchestrates trip-wide superlatives by reusing the existing copilot-insights derivations (home total, top category, social vs solo, peak hour, discipline streak) + `biggestSpendingDay`/`countActiveDays`; `isTripEnded` flags preview vs final; every stat self-censors on thin data (no fabrication). `features/copilot/TripWrappedSheet.tsx` renders a hero total + conditional stat cards, opened from a gradient row at the top of `/copiloto` (gated on `hasAnySignal && totalCents>0`), reachable any time as a **preview** until the trip ends. Share reuses the DEC-133 share card. i18n `wrapped.*` pt-BR/en/es. Additive; no schema/worker change.
- **Quality + deploy**: 7 new unit tests (`wrapped.test.ts`), full suite green, tsc app+worker clean, vite build green, `e2e/copilot-wrapped.spec.ts` (entry → sheet + screenshot `test-results/audit/wrapped-sheet.png`). Deployed + verified: version.json 0.99.13, bundle 0.99.13.zip 803,485 B (200), /copiloto 200, APK byte-identical 0.56.0.

### AI Quick Entry — natural-language router (text + voice) → every core action (v0.99.12) — 2026-06-20 — ✅ SHIPPED + DEPLOYED (commit ef7793f, Pages OTA + Worker redeploy c2219e8f)
- **Source**: Julio — field pain at a bar: "toda vez que pego a bebida ir lá e marcar… parece que perco tempo marcando o que foi, onde foi". Wanted one fast box (text **and** voice) — "o Bruno me pagou uma cerveja de 2 euros" — that infers place/time/person, asks only when needed (add/disambiguate a person), and routes to the right existing function. "Expor todas as funções para a IA." Then: "implementar tudo agora de uma vez sem parar." Full plan + 5 inline councils: `brain/documents/ai-quick-entry-natural-language-router-plan-2026-06-20.md`; decision **DEC-246**.
- **Architecture — planner (cloud) / executor (device)**: the cloud model is a pure **router** only. Groq `llama-3.3-70b-versatile` (JSON mode) returns ONE typed `AiIntent` = an action + entities **by name/label** (never ids, never amounts-math). The **device** owns the rest: resolve names→ids (`resolve.ts`), plan the concrete op (`plan.ts` → ready `ExecOp` | `navigate` | `needs` clarification | `unsupported`), and run it through the SAME orchestrators QuickAdd uses (`dispatch.ts` — `resolvePayerExpense`, `registerExpense`, `registerIncome`, `transferBetweenWallets`, `withdrawCash`, `createSettlement`, `createPlannedPurchase`), each returning an **undo**. New pure domain module `src/domain/assistant/` (intent/context/resolve/plan/dispatch + barrel), unit-tested in isolation.
- **Worker**: stateless `/assistant` (chat→JSON) + `/transcribe` (Whisper `whisper-large-v3-turbo`) proxies added next to `/ocr` — the Groq key never leaves the Worker; the device sends only the text + a names-only context pack.
- **UX**: a single global `AssistantSheet` (mounted in `AppShell`, opened via an `assistant-bus`) launched from a new gradient **AI hero** at the base of the FAB (the new #1 action). Flow = type/speak → **preview → confirm** in one tap; ambiguity becomes a tap-loop ("Adicionar Bruno?" / "Qual Bruno?"); success shows an **undo** toast; any failure/offline falls back to manual QuickAdd. Voice: Web Speech first, Groq Whisper fallback for the APK.
- **Privacy (ÂNCORA 8)**: opt-out master switch `aiQuickEntryEnabled` (default **ON** — owner's headline low-friction tool, degrades gracefully when the key/network is absent) + opt-in `aiQuickEntryPrivateNames` (withholds people/wallet names → device always asks "who?"). Context pack = first names/labels + place label + language + base currency + category list; **never** amounts, balances, ids or history. New `AppSettings` flags backfill ON / private-off; Settings toggles added.
- **Correctness**: "o Bruno me pagou uma cerveja" → `someone_paid` → `resolvePayerExpense` row 4 (payer = Bruno, not split) → I owe the full amount, no wallet move; a non-connected Bruno's debt is born **confirmed** (DEC-241). i18n pt-BR/en/es complete.
- **Quality**: 3 new pure test files (intent/resolve/plan, **41 tests**), full suite **1655 passing** (only the pre-existing `split-live-loop` real-worker integration test fails — needs Web Crypto + network, untouched), `tsc --noEmit` app + worker green, `vite build` green. **Deployed + verified**: commit `ef7793f` (Pages OTA) + Worker `wrangler deploy` `c2219e8f` — `/assistant`+`/transcribe` live reusing the existing GROQ_API_KEY; live probe "o Bruno me pagou uma cerveja de 2 euros" → `someone_paid`/Bruno/€2/EUR/i_owe (200). version.json 0.99.12, bundle 801,429 B, APK byte-identical 0.56.0, no schema change. Detail in `src/dev-log.md`.

### Debt deep-dive — "está me devendo" / settle-up overhaul (v0.99.5→v0.99.7) — 2026-06-19 — ✅ COMPLETE (G1+G2+G3 shipped, web/OTA)
- **Source**: Julio — "a função de 'a pessoa está me devendo' ainda não está boa o bastante; pesquisa profunda com vários conselhos (UX + fluxo), documento extremamente aprofundado e já implementa por gates, sem gerar bug". Full plan + 4 inline council passes: `brain/documents/debt-and-split-ux-deep-dive-and-plan-2026-06-19.md`; decision **DEC-241** (DL-1..DL-6).
- **Root cause**: a confirmation asymmetry (DEC-071) — owner-authored third-party shares born `pending`, `calculateDebts` counts only `confirmed` → "alguém me deve" invisible for an offline friend; contradictory "Em dia" balance next to a "Pendente" slice, owner nagged to confirm their own splits.
- **G1 (v0.99.5) — SHIPPED ✅**: pure `resolveShareBirthStatus(participantId, isPayerOrOwner, connectedSet)` — owner/payer + non-connected born `confirmed`, connected (`linkedActorId`/`actorId`) stay `pending`; threaded `connectedParticipantIds` into `resolvePayerExpense` (QuickAdd + OutingPage) and a self-derived `actorId` set into `commitSplit`. `calculateDebts`/statements/settlements/mirror untouched (ÂNCORA 9) so offline-friend debts surface immediately in `/shared` + dashboard + Copiloto and `findPendingConfirmationShares` lists only connected-pending (DL-2 at the data layer). FULL suite **1545/172** green incl. new born-status + connected-case tests; deployed.
- **G2 (v0.99.6) — SHIPPED ✅**: `/shared` reframed as **"Acerto de contas"** — an answer-first **hero** (A receber / A pagar / net, calm "Tudo em dia" empty-state) from a new pure `summarizeOwnerDebts` (derived from `calculateDebts`, 7 unit tests); per-debt **Lembrar** (ready-to-send message via new `shareOrCopyText`) next to **Liquidar**; visible **Pessoas**; connected-pending surfaced display-only as **"Aguardando aceite"**; P2P machinery (my-QR + receive + `MirroredStatementsSection`) demoted into a **collapsed "Conexões"** kept CSS-hidden/mounted so the mirror's live sockets never drop; dashboard gains a **`debt_summary`** card ("A receber/A pagar" → `/shared`) and the legacy pendências card auto-gated by G1 now reads **"Aguardando aceite"**; consistent settle-up rename across entry points (pt-BR/en/es). Demo gained **"Beto"** (connected, born-pending) so both paths show at once (Ana offline-confirmed vs Beto awaiting). FULL suite **1552/173** green; Playwright incl. `share-link` 3/3 vs the live worker (retargeted to Beto); deployed.
- **G3 (v0.99.7) — SHIPPED ✅**: the **post-commit moment becomes the cobrar point** — `SplitShareNudgeSheet` (fired by `QuickAddPage` after a split gives someone a slice) now offers per debtor **"Lembrar"** beside **"Enviar link"**: a ready-to-send "você me deve {amount}" via the OS share sheet (clipboard fallback, `shareOrCopyText`), reusing the G2 `shared.remind_*` copy. Amounts (`amountByParticipantId`+`currency`+`tripName`) are built from the persisted `shares` and passed **only when the owner is the payer** so a third-party-paid split never shows a wrong charge. **Pix-ready** pt-BR remind copy ("…me manda no Pix? 🙏"; en/es neutral) — the stored Pix key/QR stays the G4 future epic (T6/§16), not V1. **Polish**: `/shared` debt rows now lead with the bold amount (names demoted to caption); "simplify debts" left as-is (already shown only when ≥3 people AND it reduces transfers). FULL suite **1552/173** green (UI+i18n only; `release-notes` re-run at 0.99.7); Playwright `share-link` 3/3 + `shared-confirm` + `quick-add`; deployed `https://0a97c841.trippilot.pages.dev`.

### Bill Split — "Dividir conta" epic + "saída de bar" hardening (v0.96.0→v0.99.4) — 2026-06-19 — ✅ COMPLETE (web/OTA)
- **Source**: `brain/documents/bill-split-implementation-support-2026-06-18.md` (G1–G3, decisions T1–T17) + `bill-split-feature-brainstorm-and-council-2026-06-18.md`; field follow-ups from Julio's two-device testing; decision **DEC-240** (the final hardening batch). The whole feature: scan/enter a bill → divide it (itemized "cada um o seu" / equal / mine, with service charge + couvert/discount) → everyone claims their part (single device, a live link, OR pass-the-phone) → commit as one expense that mints real debts for app-linked people.
- **Epic gates (shipped)**: **G1 (v0.96.0)** single-device capture→split→commit with owner-absorbs-orphans; **G2 (v0.97.0)** live table link (`/t/:id#k=`, owner publishes, guests claim on their own phone, reuses the DEC-207 encrypted share channel); **G3 (v0.98.0)** two-way propagation + promote adhoc→trip Participant + no-app onboarding door; **v0.98.1** fixed the `localhost` share link (`getShareOrigin`) + foreground re-sync; **v0.99.0–0.99.2** the resilience core — **server is the single source of truth** (Durable Object `ShareStore`, deterministic client-side reduction so the table survives the organizer going offline), honest live connection status, owner auto-resume, and the **Service-Worker fix** (the real two-device blocker: the old `cacheFirst` cached the first empty poll — now cross-origin live-share polls always hit the network) + a 3-option share sheet (QR / copy / native share); **v0.99.3** active-split persistence (home card + floating chip + FAB resume-or-new + clear "Encerrar").
- **v0.99.4 — this batch (DEC-240)**: full who-got-what **history** (Por pessoa / Por item, channel attribution, unclaimed "cai em você") reachable from the live split AND the committed expense; the **"O que é meu"** hero at register time; the **persistent live-split notification** (SW web + native ongoing, gesture-gated, deep-links back); the **pass-the-phone** round-the-table wizard (adhoc + app-companion merge, dup-name guarded, syncs out via the live link).
- **Proven on real hardware**: the live two-device sync is confirmed working on Julio's two phones ("funcionou Muito bom"); the suite re-confirms it (`split-live-2device` E2E + the production-worker integration loop).
- **Quality (v0.99.4)**: tsc `--noEmit` clean; 142 split-domain unit tests (incl. the item-first history suite) + 162 notification-area unit tests green; ALL split Playwright E2E green (flow, persistence, share-sheet, pass-phone, live, **live-2device**, explainer, receipt). Web/OTA only; no schema/worker change in this batch; APK byte-identical at the verified 0.56.0 shell. Detail in `src/dev-log.md`.

### UX Clarity — Implementation Package #4 · GATE 14 (P3 clarity polish — FINAL, v0.90.0) — 2026-06-18 — ✅ COMPLETE (web/OTA) — **Package #4 + UX-clarity backlog CLOSED**
- **Source**: `brain/documents/ux-clarity-audit-2026-06-17.md` §4.1 (P3 onboarding), §4.11 (P3 Trip-Edit + "renda planejada" + G7 `/viagem`×`/trip` role), §4.17 (P3 Settings split + house "Visão avançada"); decision **DEC-234**. The last gate of Package #4 — the remaining P3 polish on screens the audit rates 4–4.5/5, so it's deliberately microcopy + one low-risk Settings reorg.
- **M14a — onboarding (§4.1)**: the mode step badges **"Começar simples"** as **"Recomendado"** (safe first-timer default) and the budget step explains **"reserva protegida"** with a money example; "dá pra mudar depois" was already present (`mode_subtitle`). "Colapsar template/tipo" DEFERRED (structural, risks the fast path).
- **M14b — Trip-Edit term softening (§4.11)**: one plain line each under **"Ritmo da fase"**, **"Dias de pico"**, and the **evento × sub-destino** picker.
- **M14c — `/trip` role + planned income (§4.11/G7)**: the Overview declares its read-only-summary role (and points to the Viagem hub for editing), complementing the Hub's existing "plano e estrutura" subtitle — clarifying G7 without the still-open full merge; the Phase Preview surfaces the "planned income only feeds the projection" nuance inline.
- **M14d — Settings split (§4.17)**: a new **"Conexões e compartilhamento"** category (`connections`, icon `hub`) owns pairing/links + mailbox + cloud receipt OCR; **"Backup e segurança"** keeps backup/reminder/lock/restore/reset; search keywords rebalanced so nothing is lost. **"Visão avançada"** CONFIRMED already housed (Package #1 GATE 6 → `AdvancedTripView`).
- **Anti-regression**: pure-additive microcopy + a presentational Settings re-group (moved sections keep their exact logic; only their `CollapsibleGroup id` changed; no deep-link expected the old location — verified). 1393 unit tests unchanged; new permanent `e2e/settings-connections.spec.ts` (3) + `e2e/onboarding.spec.ts` extended (recommended badge). Targeted E2E 14/14 across the touched areas.
- **Quality**: 1393 unit tests / 158 files, tsc 0, web build green; E2E 14/14 (settings split + onboarding + home-cap + budget golden + dashboard); Playwright visual QA (393×851) — onboarding, Trip-Edit hints, Overview role line, and the Settings split (new Conexões page with 3 sections; Backup & segurança reduced to its core) — all correct. **APK hygiene unchanged**: `/trippilot.apk` republished byte-identical at the verified 0.56.0 shell. Detail in `src/dev-log.md`.
- **Package #4 wrap**: GATEs 9–14 shipped (v0.85.0→v0.90.0). With Packages #1 (budget model reform), #2 (capture), #3 (Copiloto + Atividades) and #4 (P2/P3 polish) all delivered, the UX-clarity audit's full P0→P3 backlog is closed; the only deliberately-deferred items are the open-decision ones (full `/viagem`×`/trip` merge — §6 Q3; the Trecho/Pote "Fundo" vocab migration — DEC-228; Wise split explainer — DEC-231) and the structural "collapse onboarding options" (low value vs. risk).

### UX Clarity — Implementation Package #4 · GATE 13 (Home insight cap + "why shown", v0.89.0) — 2026-06-18 — ✅ COMPLETE (web/OTA)
- **Source**: `brain/documents/ux-clarity-audit-2026-06-17.md` §4.2 (P2 "teto/ordem de no máx. N avisos por vez"; P3 "por que esse card apareceu?"); decision **DEC-233**. Fifth gate of Package #4. The audit rates the Home **4.5/5 — "a área mais saudável do app"**, so this is a deliberately light touch.
- **M13a — cap/order (§4.2 P2)**: the complete-mode insight carousel auto-accumulated up to 12 reads (long dot strip + endless rotation). New pure helper **`features/dashboard/home-insights.ts` → `capHomeInsights`** caps it to the **top 4** at rest (insights arrive priority-sorted from `buildDashboardInsights`, warnings first → the visible slice is always the most important — a cap, not a filter) and surfaces a **"Ver mais N"** that reveals the rest **in place** (nothing dropped). Auto-rotation + dot pager now key off the *visible* slice.
- **Scope — only the carousel is force-capped**: the other "avisos contextuais" the audit names (storage / phase leftover / value suggestion / priors) are **user-configurable cards** (`DashboardConfigPage`) or **single gated banners** (storage-eviction; DEC-176 already moved the routine reminder off Home) — the user already owns that cap. **Simple mode** is already capped to one warning (`SimpleHome`). So only the auto-stacking carousel needed a forced cap.
- **M13b — "why shown" (§4.2 P3) — CONFIRMED present**: tapping an analytical insight already opens the **"Como cheguei nisso"** (`InsightDetail`) sheet with a per-kind breakdown + explainer paragraph (`detail_*_explainer`); kept, not restated.
- **Anti-regression**: pure additive — `buildDashboardInsights` ordering/`INSIGHT_SAFETY_CAP` and the detail sheets untouched; the cap is a presentational slice on local `showAllInsights` state, and the pager reads the visible length so it can't desync. New deterministic unit suite `home-insights.test.ts` (6 tests) → **1393 total**; new permanent `e2e/home-insights-cap.spec.ts`.
- **Quality**: 1393 unit tests / 158 files, tsc 0, web build green; targeted E2E 6/6 (home-insights-cap + dashboard); Playwright visual QA (393×851) — dashboard carousel renders calm/correct with the cap in place (demo has ≤4 insights, so the overflow/"ver mais" path is proven by the unit suite). **APK hygiene unchanged**: `/trippilot.apk` republished byte-identical at the verified 0.56.0 shell. Detail in `src/dev-log.md`.
- **Next in Package #4**: GATE 14 (P3 polish: onboarding mode rec + collapse + "reserva protegida" example; Settings split Conexões; Trip-Edit term softening; G7 role-clarifying microcopy — deferring the full /viagem×/trip merge as an open decision).

### UX Clarity — Implementation Package #4 · GATE 12 (Saída opener + contextual SOS, v0.88.0) — 2026-06-18 — ✅ COMPLETE (web/OTA)
- **Source**: `brain/documents/ux-clarity-audit-2026-06-17.md` §4.12 (P2 Saída opener) + §4.8 (P2 contextual SOS; P3 "is a simulation"); decision **DEC-232**. Fourth gate of Package #4.
- **M12a — Saída opener (§4.12)**: the Outing start screen opens with one plain line naming the concept ("uma saída é um rolê com teto — uma noite, um passeio; registre cada rodada em 1 toque…"), above the existing type picker. Nothing else changes.
- **M12b — contextual SOS (§4.8)**: the shared `AmigoSinceroCard` (Home + Copiloto) now renders a **"Plano de resgate"** CTA → `/rescue`, but **only in the dire `alert` tone** (over plan/pace AND pace projects into the protected reserve); calmer tones keep it hidden. New optional `onRescue` prop on both render sites.
- **SOS "is a simulation" (§4.8 P3) — CONFIRMED present**: `rescue.intro` + `rescue.note` already say "nada é gravado / é uma calculadora"; kept, not restated.
- **Anti-regression**: pure additive — rescue engine, honest-friend math and outing flow untouched. New permanent `e2e/outing-explainer.spec.ts` + component test `amigo-sincero-card.test.tsx` (+3 unit tests) → 1387 total.
- **Quality**: 1387 unit tests / 157 files, tsc 0, web build green; E2E outing-explainer 1/1 + regression set 11/11; Playwright visual QA (393×851) — outing opener + amigo card (neutral tone in demo, alert CTA correctly hidden) — both correct. **APK hygiene unchanged**: `/trippilot.apk` republished byte-identical at the verified 0.56.0 shell. Detail in `src/dev-log.md`.
- **Next in Package #4**: GATE 13 (Home warning cap + "why shown", §4.2), GATE 14 (P3 polish: onboarding/Settings/Trip-Edit + G7 role-clarifying).

### UX Clarity — Implementation Package #4 · GATE 11 (Single split explainer, v0.87.0) — 2026-06-18 — ✅ COMPLETE (web/OTA)
- **Source**: `brain/documents/ux-clarity-audit-2026-06-17.md` G9 + §4.15 (P2 "um explicador único 'como funciona a divisão'"; P3 consistency), §4.13 (P3 align receipt split), §4.5 (P3 flow/cost microcopy); decision **DEC-231**. Third gate of Package #4.
- **M11 — one explainer, one copy source**: the split model surfaced in four screens (QuickAdd/Receipt/Shared/Wise) with drifting wording. A reusable **`features/shared/SplitExplainer.tsx`** now owns it — collapsed-by-default "**Como funciona a divisão**" → 3 numbered steps (quem pagou → a sua parte vira saldo → acertar depois), reading from a single new **`split.*`** namespace (pt-BR/en/es) so it reads identically everywhere. Mounted on the three first-class surfaces: **QuickAdd** (top of "Quem pagou?"), **Receipt** (top of "dividir com"), **Shared** (under the header).
- **M11b — flow/cost microcopy (§4.5)**: the expense detail's "Fluxo financeiro" × "Custo pessoal" rows gained a one-line plain caption when shared (same namespace).
- **Wise — DEFERRED (P3)**: its split is inside the per-transfer allocation sheet (power-user; audit marks it P3 "manter como fluxo avançado") — deeper/riskier to thread; noted, single copy source ready.
- **Anti-regression**: pure additive UI — the splitting domain (`resolvePayerExpense`/`calculateDebts`/shares/settlements) untouched; explainer holds only local state. New permanent `e2e/split-explainer.spec.ts`; 1384 unit tests unchanged (presentational, no logic to unit-test).
- **Quality**: 1384 unit tests / 156 files, tsc 0, web build green; targeted E2E 4/4; Playwright visual QA (393×851) — QuickAdd collapsed/expanded + Shared — both render the identical explainer copy. **APK hygiene unchanged**: `/trippilot.apk` republished byte-identical at the verified 0.56.0 shell. Detail in `src/dev-log.md`.
- **Next in Package #4**: GATE 12 (Saída/SOS microcopy + contextual SOS, §4.8/4.12), GATE 13 (Home warning cap + "why shown", §4.2), GATE 14 (P3 polish: onboarding/Settings/Trip-Edit + G7 role-clarifying).

### UX Clarity — Implementation Package #4 · GATE 10 (Planner guided microcopy, v0.86.0) — 2026-06-18 — ✅ COMPLETE (web/OTA)
- **Source**: `brain/documents/ux-clarity-audit-2026-06-17.md` §4.9 (P2 "tratar Planner como avançado + modo guiado leve"; P2 "microcopy dos termos margem/alocação"); decision **DEC-230**. Second gate of Package #4.
- **M10 — guided microcopy** (pure additive, zero behaviour change): a header **intro**, a budget-card **summary hint** ("margem livre = o que sobra do fundo desta fase; alocado = quanto o seu plano soma"), a **presets hint** ("pontos de partida rápidos — depois ajuste item a item"), and a **classification hint** in the category menu (what essential/planned/optional controls). pt-BR/en/es.
- **Advanced-gating CONFIRMED pre-existing**: `/planner` is already `<ModeGuard>`-wrapped (M20 → "recurso avançado / abrir mesmo assim" in simple mode) and flagged `advanced` in nav/FAB; the route stays (ÂNCORA 9) and entries stay visible (the reversible "open anyway" is the soft treatment), so GATE 10 ships microcopy + confirms gating. The "(P1) porta única de planejamento" was delivered by Package #1 GATE 4 (DEC-221).
- **Anti-regression**: nothing removed — scenario math/persistence/recommendation/presets/lock/per-phase classification untouched. New permanent assertion in `e2e/planner.spec.ts`; 1384 unit tests unchanged (no new logic to test).
- **Quality**: 1384 unit tests / 156 files, tsc 0, web build green; full E2E 52/52; Playwright visual QA (Pixel 5) — Planner intro/summary/presets hints + category-menu classification hint — all correct. **APK hygiene unchanged**: `/trippilot.apk` republished byte-identical at the verified 0.56.0 shell. Detail in `src/dev-log.md`.
- **Next in Package #4**: GATE 11 (single split explainer G9, §4.15), GATE 12 (Saída/SOS microcopy + contextual SOS, §4.8/4.12), GATE 13 (Home warning cap + "why shown", §4.2), GATE 14 (P3 polish: onboarding/Settings/Trip-Edit + G7 role-clarifying).

### UX Clarity — Implementation Package #4 · GATE 9 (Expense-list filter clarity, v0.85.0) — 2026-06-18 — ✅ COMPLETE (web/OTA)
- **Source**: `brain/documents/ux-clarity-audit-2026-06-17.md` §4.4 (P2 "agrupar/rotular chips por tipo e permitir recolher"; P2 "microcopy do que é 'Saída'"; P3 edge-swipe); decision **DEC-229**. First gate of **Package #4** — the audit's remaining P2/P3 polish backlog (§5). Does NOT alter Packages #1–#3.
- **M9.1 — grouped/collapsible filter chips**: the Expenses list's filter chips (which mixed category + place + the active profile/no-wallet flag in one unlabelled scroll row on an already-dense header) now live behind a single **"Filtros (N)"** toggle (collapsed by default → short header). When a scope is active, a compact **removable summary** of the active chips stays visible and the toggle carries a **count badge**; expanded, the chips split into labelled groups **"Categorias" / "Lugares" / "Outros"**. Pure `expense-filters.ts` (`countActiveFilters`/`hasActiveFilter`).
- **M9.2 — "Saídas" tab explainer**: a one-line description of what an outing is (pt-BR/en/es), naming the previously-unannounced model.
- **M9.3 — edge-swipe discoverability (P3)**: DEFERRED (needs a one-time coachmark that doesn't exist; persistent hint UI would re-clutter the header). Noted, not shipped.
- **Anti-regression**: nothing removed (ÂNCORA 9) — every scope filter still reachable one tap away; rollup/income/search/multi-select untouched; header strictly shorter at rest. New permanent `e2e/expense-list-filters.spec.ts`; +4 unit tests.
- **Quality**: 1384 unit tests / 156 files, tsc 0, web build green; full E2E 51/51; Playwright visual QA (Pixel 5) — collapsed/expanded/active-filter/Saídas — all correct. **APK hygiene unchanged**: `/trippilot.apk` republished byte-identical at the verified 0.56.0 shell. Detail in `src/dev-log.md`.
- **Next in Package #4**: GATE 10 (Planner as advanced + term microcopy, §4.9), GATE 11 (single split explainer G9, §4.15), GATE 12 (Saída/SOS microcopy + contextual SOS, §4.8/4.12), GATE 13 (Home warning cap + "why shown", §4.2), GATE 14 (P3 polish: onboarding/Settings/Trip-Edit + G7 role-clarifying).

### UX Clarity — Implementation Package #3 · G8 ("Perfis"→"Atividades" rename, v0.84.0) — 2026-06-18 — ✅ COMPLETE (web/OTA)
- **Source**: `brain/documents/ux-clarity-audit-2026-06-17.md` §5 (P2 "Renomear 'Perfis'→'Categorias/Atividades'") + §2 (G1 "estender vocabulário a todo o app"); decision **DEC-228**. Julio's pick = **"Atividades"** (not "Categorias", which would collide with the expense-category field). Third gate from the UX-clarity audit; does NOT alter Package #1 or #2.
- **G8 — "Perfis" → "Atividades" (P2, SHIPPED)**: the activity-profile feature's **user-facing label** is renamed **"Perfis/Perfil" → "Atividades/Atividade"** (pt-BR), **"Profiles/Profile" → "Activities/Activity"** (en), **"Perfiles/Perfil" → "Actividades/Actividad"** (es) — page title, add/empty/updated/remove/in-use copy, the TripHub "Estrutura" tile, the Planner section, the Settings "Atividades e típicos" entry, the template summaries, the mode-complete description and the outing/onboarding hints, with grammar/gender adjusted (e.g. "atividade … removida/desabilitada"). **UI strings only** — every i18n **key** (`profiles.*`, `more.profiles`, `planner.profiles`…), the `{{profile}}` interpolation **variable**, the `/profiles` route and all code identifiers (`ActivityProfile`, `activityProfileId`, repositories) are **unchanged**.
- **Trecho/Pote funds vocab (P1, SCOPED/DEFERRED)**: a blanket "Fundo"→Trecho/Pote rename is **not** done here. The happy path already speaks Trecho/Pote (Package #1), and the residual "Fundo" jargon is intentionally confined to the advanced `/funds` editor + QuickAdd picker; since a pool can be a trecho OR a pote, a single generic relabel is ambiguous and a half-done one would be *inconsistent* with the editor/dashboard cards. Per the Package #1 "nunca forçado" principle (DEC-225), the full migration is deferred to a dedicated, coherent pass rather than forced as a risky partial rename.
- **Anti-regression**: nothing removed (ÂNCORA 9) — the activity-profile capability (typical values, per-phase frequency, presets, planner integration, outing start) is untouched; only the word changed. `budget-model-golden.spec.ts` updated to assert the new "Atividades" heading.
- **Quality**: 1380 unit tests / 155 files (UI-only package), tsc 0, web build green; full E2E green (the `receipt-split` parallel flake passes single-worker); Playwright visual QA (Pixel 5) confirmed `/profiles` ("Atividades" + "Adicionar atividade") and the TripHub "Estrutura" tile. **APK hygiene unchanged**: `/trippilot.apk` republished byte-identical at the verified 0.56.0 shell. Detail in `src/dev-log.md`.
- **Next from the audit**: Package #4 (G7 trip surfaces, Planner-as-advanced, split explainer G9, Home warning cap, Saída/SOS microcopy, expense-list chips, onboarding mode rec, Settings category split, trip-edit term softening).

### UX Clarity — Implementation Package #3 · G7 (Copiloto prioritized, v0.83.0) — 2026-06-18 — ✅ COMPLETE (web/OTA)
- **Source**: `brain/documents/ux-clarity-audit-2026-06-17.md` §2 (G3 "parede de cards") + §4.6 (P1 "priorizar 3–5 seções-chave + ver mais" / P2 "agrupar por tema: Agora / Para onde vai / Padrões / Pessoas colapsável"); decision **DEC-227**. Second package from the UX-clarity audit; does NOT alter Package #1 or #2.
- **G7 — Copiloto theme groups**: the ~18 reads are grouped into four **collapsible** themes — **"Agora"** (verdict · ontem · amigo sincero · âncora da viagem · sequência de disciplina), **"Para onde vai"** (projeção · correção de rota · runway · ritmo da fase · vs fase anterior), **"Padrões"** (de onde veio · mapa do mês · dia da semana · hora de pico · eficiência de saída), **"Pessoas"** (social × solo · dinheiro × cartão · acertos). The **first non-empty group opens by default**; the others are one tap away, each header carrying a **count badge** of its non-empty reads; an **empty group never renders**. The tools grid (Impacto/Simular/Resgate/Guia) stays in the footer.
- **Anti-regression**: nothing removed (ÂNCORA 9) — every read keeps its JSX, render guard and i18n; only the containers changed. New permanent **`e2e/copilot-groups.spec.ts`** (first group open · others collapse content · every group collapsible · tools footer survives).
- **Quality**: 1380 unit tests / 155 files (UI-only package), tsc 0, web build green; full E2E 49/49; Playwright visual QA (Pixel 5) on demo data — default (Agora open, 3 collapsed with counts), fully-expanded, collapsed-Agora — all correct. **APK hygiene unchanged**: `/trippilot.apk` republished byte-identical at the verified 0.56.0 shell. Detail in `src/dev-log.md`.
- **Next from the audit**: Package #3 · G8 (Trecho/Pote vocabulary extension + "Perfis"→"Atividades" rename, P2), then Package #4 (G7 trip surfaces, Planner-as-advanced, split explainer G9, Home warning cap, Saída/SOS microcopy, expense-list chips, onboarding mode rec, Settings category split, trip-edit term softening).

### UX Clarity — Implementation Package #2 (Captura, v0.82.0) — 2026-06-18 — ✅ COMPLETE (web/OTA)
- **Source**: `brain/documents/ux-clarity-audit-2026-06-17.md` (diagnosis) §3 (P0 — FAB) + §4.3 (P1 — Quick Add); decision **DEC-226**. First package from the UX-clarity audit; companion of (and does NOT alter) Package #1.
- **P2-A — FAB reorganized for the thumb (Julio's call: "manter as 9, só reorganizar")**: keeps all 9 actions + the visual language; heroes ("Registrar gasto", "Escanear nota") moved to the **base** of the sheet (thumb zone), capture chips above, and the rarer entries collapse behind expanders **"Outros registros…"** (Transferência/Saque/Receita) and **"Planejar"** (Planejar compra/Simular). Short at rest, nothing removed (ÂNCORA 9), simple mode still hides advanced.
- **P2-B — Quick Add progressive disclosure (G2)**: only **valor + categoria + descrição** by default; date/local/fundo/carteira/anexos collapse under **"Detalhes"**; the fund picker is hidden when there's nothing to choose (1 fund → auto, read-only; >1 → inside Detalhes, forced open when a choice is required). Typical expense ≈ 3 taps. Wallet stays progressive (DEC-222); transfers keep their full flow; split stays first-class.
- **Quality**: 1380 unit tests / 155 files (UI-only package), tsc 0, web build green; full E2E green (the `receipt-split` parallel flake passes single-worker), **new `e2e/capture-disclosure.spec.ts`**, `wallet-tracking.spec.ts` updated for the disclosure; Playwright visual QA (Pixel 5) on FAB + Quick Add. **APK hygiene unchanged**: `/trippilot.apk` republished byte-identical at the verified 0.56.0 shell. Detail in `src/dev-log.md`.
- **Next from the audit**: Package #3 (Copiloto prioritized + single-planning-door polish + Trecho/Pote vocabulary, G7/G8), Package #4 (P3 polish — onboarding mode rec, Settings category split, trip-edit term softening, misc P2 microcopy).

### Budget Model Reform — Implementation Package #1 (v0.76.0 → v0.81.0) — 2026-06-18 — ✅ COMPLETE (web/OTA, "budget model v2" RC)
- **Mandate** (Julio): implement the full budget-model reform researched in `brain/documents/budget-model-master-decision-2026-06-17.md` (decisions D1–D19) + `budget-model-implementation-prompt-2026-06-17.md` (6 gates) — autonomously, with tests + Playwright + commits + Cloudflare deploys between steps, no regressions. Root cause it fixes: the app carried **two opposing money eras** (DEC-007 shared-pool ↔ DEC-089 per-phase-fund), the dashboard read the wrong fund (`linkedPools[0]`), and ~10 backend terms leaked to the user.
- **Shipped gate-by-gate (apex `trippilot.pages.dev`, OTA to the 0.56.0 shell)**:
  - **GATE 1 (0.76.0)** — dashboard follows the **active phase**'s pool (DEC-219/D3).
  - **GATE 2 (0.77.0)** — **Trecho** = 1 dedicated budget (Phase+Pool+Link atomic); sequential non-overlapping phases, boundary day → starting trecho (DEC-223); trip total = sum of trechos (DEC-224).
  - **GATE 3 (0.78.0)** — unified **Pote** (global pool + optional date/goal, Dexie v10), D8 Home visibility (`selectVisiblePots`), "Potes e planejados" section (DEC-220).
  - **GATE 4 (0.79.0)** — first-class **Eventos** + single "Planejar um gasto" door + 3 funding options (`routePlannedExpense`/`createPlannedExpense`), D8 event visibility (DEC-221).
  - **GATE 5 (0.80.0)** — **progressive wallet tracking** (`isWalletTrackingActive`, auto-on with 2+ wallets/Wise + manual override in Settings) (DEC-222).
  - **GATE 6 (0.81.0)** — **"Visão avançada da viagem"** in Settings (raw funds/links/envelopes/wallets, reuses `/funds`+`/wallets` editors, DEC-219/D17) + **anti-regression audit** (rhythm/peak/events/activities all still reachable, D16/§8) + **decision-log reconciliation** (DEC-219→225 supersede/reconcile DEC-007/089/153) + golden-path E2E.
- **Anti-regression (DEC-219/D16, permanent rule)**: simplification was of **nomenclature & information architecture**, never **capability** — phase rhythm/peak (DEC-075), activity profiles, multi-currency (DEC-158), Wise import (DEC-200), outings all remain, just no longer mandatory/visible on the happy path. **Sub-trecho aninhado = V2 / radar** (DEC-225; `sub_destination` is the seed).
- **Quality**: **1380 unit tests / 155 files**, tsc 0, web build green, full E2E green + Playwright visual QA per gate. **APK hygiene unchanged**: `/trippilot.apk` re-fetched from the live apex and republished **byte-identical** at the verified **0.56.0** shell every deploy; `requiredNativeVersion` 0.50.0 / `latestNativeVersion` 0.56.0 unchanged. Per-gate detail in `src/dev-log.md`.

### Device-Test Force-Task (v0.71.0 → v0.75.0) + Master Fix & Skipped-Features (v0.65.0 → v0.70.0) — 2026-06-17 — ✅ WEB/OTA WAVES COMPLETE · 🟠 Onda 5 device-pending
- **Current shipped: v0.75.0** (web/OTA, apex `trippilot.pages.dev`). **1299 unit tests / 144 files**, tsc 0, web build green, **E2E 33/33**, Playwright (Pixel 5) visual QA per wave. The 0.50.0 APK runs the 0.75.0 bundle over OTA.
- **Device-Test Force-Task (DEC-217)** — Julio field-tested the 0.50–0.70 builds (`brain/documents/device-test-results-2026-06-17.md`), triaged into `brain/documents/device-test-fixes-masterplan-2026-06-17.md`. Four web/OTA waves shipped: **Onda 1 (0.71.0)** canonical link-origin + iOS no-zoom + single search-× + scrollbar; **Onda 2 (0.72.0)** front/back QR camera + pinch photo viewer + outing photos; **Onda 3 (0.73.0)** calm "steady" honest tone + income shows in the list but never in spent (`expense-feed.ts`) + statement credit→income + place picker on expense edit; **Onda 4 (0.74.0)** Home session rollup, PIN auto-unlock, expense→planned link, compact € in calendar/heatmap, receive-QR door in People & debts, tab-order animation direction, BottomSheet body drag-close, clearer split microcopy, phase-preview door on Viagem, native share-or-copy; **Onda 4C (0.75.0) close-out** a merchant-less scanned receipt is titled by its dominant category ("Mercado"/"Restaurante") instead of "Nota" (D-IMP-05 slice; D-IMP-07 + note-category metadata found already-covered / deferred). Per-item detail in `src/dev-log.md`.
- **Master Fix & Skipped-Features (DEC-212→216)** — prior, already shipped web/OTA: income transaction type (0.67.0), biometric **web** layer + Copilot v3 (0.68.0), E2E-in-CI + atomic fund pool-creation (0.70.0). Native batch B1+B2+B3 (DEC-215) is code-complete as APK **0.69.0 but NOT promoted** (device-pending).
- **🟠 Onda 5 — device-pending (DEC-218)**: native biometric unlock (D-DEC-C, over PIN), QR pairing "connects then stops" + mailbox "delivered but nothing received" (D-BUG-19/09 — needs **two physical devices** to reproduce + the `Mailbox`/`ShareSignal` DO relay), device re-confirmation of D-BUG-07 (scrollbar) / D-BUG-15 (full-bleed margins) / D-BUG-01 (App-Link `#fragment`), and **promotion of the device-pending native APK** only after device OK. This is a **Julio device-QA session**, deliberately outside the autonomous web/OTA loop.
- **APK hygiene**: every web/OTA deploy re-fetches `/trippilot.apk` from the live apex and republishes it **byte-identical** at the verified **0.56.0** shell (8,283,527 B), so the unverified 0.69.0 native APK is never accidentally promoted; `requiredNativeVersion` 0.50.0 / `latestNativeVersion` 0.56.0 unchanged.

### Field Feedback Round 2 (v0.50.0 → v0.64.0) — 2026-06-17 — ✅ ALL WAVES COMPLETE
- **Mandate** (Julio): a 22-item field list (round 2). Plan `brain/documents/improvements-master-plan-2026-06-16-round2.md`; council ran inline; decisions locked via AskQuestion. Order **F→A→B→C→D→E** (native first). Per-wave detail in `src/dev-log.md`. **All waves shipped** (DEC-205 native + DEC-211 web A–E + F14 web).
- **Shipped (native APK, 0.50.0 — Wave F)**: **F12** QR camera permission (manifest `CAMERA`; Capacitor 8 already requests the runtime grant), **F1** backup → public Downloads (native `DeviceFile` plugin via `MediaStore.Downloads`, fallback Documents), **F13** no overscroll stretch (WebView `OVER_SCROLL_NEVER`). APK versionCode **16** / 0.50.0 (8.26 MB). `requiredNativeVersion` 0.50.0. See DEC-205.
- **Shipped (web waves A–E, OTA — DEC-211)**: **A (0.59.0)** home/UX quick wins + F10 interactive drag; **B (0.60.0)** phase map (2-tab calendar/heatmap + free+reserved day math); **C (0.61.0)** Settings categories→subpages + pair-by-link + connections hub; **D (0.62.0)** phase preview + planned income per phase (ÂNCORA 11 proven); **E (0.63.0)** smart Wise import — reimbursement bridge (F16a), create-phase inline (F16b), ticketing/festival category guess (F16c).
- **Shipped (F14 web, OTA — 0.64.0)**: active-outing **place picker parity** — the place sheet now has the same intelligence as the expense flow (pure `buildPlaceSuggestions` unifies online nearby + offline recent history into one accent-insensitive searchable list; + reverse-geocode "find name online"). The web part the plan had deferred from waves A/B (only the native GPS grant was Wave F). Final: **1147 tests / 128 files**, E2E 34/34, apex 0.64.0, commit `8a6c923`. **Deferred (native batch):** App Links for `/pair`+`/s/:id`; F15 receive-`.csv` intent; F14 native GPS-grant part only.
- **🚧 PIVOT (2026-06-16)**: Waves A–E **PAUSED**. New top-priority epic = **Receipt OCR/AI → items → split** (DEC-206 + addendum). After Julio's constraints (app NOT on Play Store; iOS users are web-only), the plan went **CLOUD-FIRST**: **G1 ✅ shipped (0.51.0, OTA)** attach photos to any expense (schema v8 `attachments`, device-local, never in backup) → **G2 ✅ shipped (0.53.0, OTA)** cloud extraction (Groq via Worker `/ocr`) → review/split → Outing (universal iOS+web+Android) → **G4 ✅ shipped (0.54.0)** whole-bill split modes + match-to-total → **G3 ✅ shipped (0.55.1, APK)** on-device OCR (ML Kit **bundled** = no Play Services/Store + tesseract.js web; private/offline; `parseReceiptText`; arm64-only APK 21 MB). Research/spec `brain/documents/receipt-ocr-item-split-research-2026-06-16.md`.
- **✅ Receipt epic (0.53→0.56)** — cloud extraction (Groq via Worker `/ocr`) + **Groq cost-opt** (leaner prompt, `temperature:0`, `response_format:json_object`, `max_tokens:4096`); **40-item rollup** (a receipt/outing session collapses to ONE feed row in Expenses while browsing, itemized only when searching/filtering); **AI entry elevated** (featured "Scan receipt" card in the FAB + accented labelled pill in the Expenses header).
- **✅ 0.56.0 field-feedback fixes** (Julio tested 0.55.1): (a) **DEC-208 receipt split = explicit participant picker** — "Dividir com quem?" chips; choosing a subset splits equally among the selected set; no more auto-everyone. (b) **DEC-209 on-device OCR REMOVED** — cloud-AI ("funcionou 100%") is the only scan engine; the local read "não leu nada certo" → dropped `@jcesarmobile/capacitor-ocr` + `tesseract.js` + `device-ocr.ts`/`parse-text.ts`, **APK 21 MB → 8 MB**. (c) **DEC-210 native APK self-update** — manifest `latestNativeVersion`, a native `ApkInstaller` plugin (download + system installer hand-off, `REQUEST_INSTALL_PACKAGES`), boot/Settings one-tap prompt, and the build always copies the APK to the dev Downloads folder. Web OTA confirmed working by Julio.
- **✅ SHIPPED epic — Shared Participant Link + real-time (DEC-207 IMPLEMENTED; 0.57.0 async + 0.58.0 S7 live, web-only OTA)**: a link a participant opens **without the app** (`…/s/:id#k=<key>`) to see **only their slice** (what they owe/are owed), **approve** expenses and **mark settled** (guest proposes → **owner confirms**); guest is a **permanent signup-less user** ("Compartilhadas comigo", `BootGate` routes a no-trip guest there), optional **"start my own trip"** upgrade. **E2E**: AES key in the URL `#fragment` (never reaches the server); server stores **ciphertext only**. **Two honest deltas from the plan** (both preserve zero-cost + portability): storage = **Cloudflare KV (`SHARE_STORE`)** not D1 (deploy token lacked `d1` scope; KV is a simpler portable `id→ciphertext` store); real-time = a new **`ShareSignal` Durable Object** (the SyncRoom *pattern*, not the same instance) — a pure WS fanout relay carrying only `{t:'upd'|'resp'}` go-pull pings, payload stays E2E in KV. Owner/mirror settle (DEC-106). Verified: **1096 unit tests** (incl. real AES-GCM cycle) + worker lifecycle smoke + **Playwright** owner→guest→owner + S7 live toast. **Honest limits / deferred to S8 (next native bump):** app-closed push (no FCM), iOS-web real-time (no web push) → async pull floor; Android App Links `/s/:id` + foreground LocalNotification. Plan + council + gates **S0–S9** in `brain/documents/shared-participant-link-research-and-plan-2026-06-16.md`; full delivery report in `brain/documents/delivery-report-shared-link-and-realtime-2026-06-16.md`.
- **Waves A–E + F14 — DELIVERED (web, OTA to the 0.50.0 APK)**: A (UX quick wins + interactive drag F10 → 0.59.0), B (phase calendar maps + per-day math F4/F20/F22 → 0.60.0), C (settings Samsung-style F11 + connection hub + link pairing F19-web → 0.61.0), D (future-phase income F17 + phase preview F18 → 0.62.0), E (smart Wise import F16a/b/c → 0.63.0), F14 (outing place picker parity: search + recent history + find-online → 0.64.0). **F15 (receive `.csv` share-target), native App Links, and F14's native GPS-grant part remain for the next native APK batch.**
- **Quality (0.64.0)**: **1147 unit tests green (128 files)**; tsc 0; web build clean; **E2E 34/34** (**Node 22 required**). All web/OTA — no APK rebuild (the 0.50.0 APK runs the 0.64.0 bundle).
- **Build env note**: this machine defaults to Node v18 (no `globalThis.crypto.subtle` → 6 ecies tests fail); run tests/build/cap/gradle under Node 22 (`nvm`).

### Field Feedback Round (v0.41.0 → v0.49.0) — 2026-06-16 — ✅ ALL 20 ITEMS LANDED
- **Mandate** (Julio): a 20-item field list after the native+Wise arc. Plan `brain/documents/improvements-master-plan-2026-06-16.md`; gates G1→G8. Detail per gate lives in `src/dev-log.md`.
- **Shipped (web)**: G1 navigation/swipe/scroll/recents (0.41), G2 home numbers — true-free + check-in lens (0.42–0.43), G3 Wise import visibility + TRANSFER intelligence/split (0.43–0.44), FIELD-19 per-day allowance map (0.45), G4 settings overhaul + savings goal on card + 2-up grid (0.46), G5 P2P encrypted mailbox (0.47), G6 reset-app (item 3) + G8a version awareness (item 20) (0.48).
- **Shipped (one native APK, 0.49)**: **G6 native backup share/save** (`@capacitor/share`+`@capacitor/filesystem`, items 6/7), **G7** active-outing notif-value→screen (item 10, native `quickAdd` event) + zoom/shake (item 11, `--native-zoom` height), **G8b live-update** (`@capgo/capacitor-updater` self-hosted; OTA bundle + manifest on Pages; cold-start apply, gated by `requiredNativeVersion`). APK versionCode **15** / 0.49.0 (8.2 MB). See DEC-204.
- **Quality**: 1038 unit tests green (117 files); tsc 0; web build + `cap sync` (8 plugins) + `assembleDebug` all green.
- **OTA from here**: web-only releases ship over the internet to APK ≥0.49 (bump version → `npm run build` → `cap sync` → `node scripts/make-ota-bundle.mjs` → deploy `--branch=master`); only native changes need a new APK (+`requiredNativeVersion`/versionCode).
- **Device-pending ACs** (need a physical Android): native share sheet + save-to-Documents, notif quick-add live reflection, no outing zoom/shake, Capgo download/apply on the next web-only release.
- **⚠️ Deploy topology (since 0.48)**: the Pages PRODUCTION branch is **`master`** (apex `trippilot.pages.dev`); CLI deploys to `--branch=main` are **Preview** (`main.trippilot.pages.dev`). Deploy production with **`--branch=master`** (apex serves the current bundle + `/version.json` + `/bundles/<v>.zip` + `/trippilot.apk`). See DEC-203.

### Native Android arc + Wise import (v0.28.0 → v0.40.0) — 2026-06-15 ✅ SHIPPED TO PRODUCTION
- **Mandate** (Julio): make the web PWA a real Android app for the Play Store, with first-class native touches (widgets, Spotify/Samsung-Now-Bar-style notifications), then a fluid/professional motion layer, then fix the regressions it introduced, and finally import the real Wise card statements as expenses. Delivered gate-by-gate (commit → deploy → APK) per the team workflow.
- **Native shell (v0.28.0→v0.35.0)**: Capacitor 8 Android wrapper; CSS-driven safe-areas (`--safe-top/--safe-bottom`, opaque status band, light/dark icons); hardware back-button stack; softened haptics; runtime GPS + notification permission flows; persistent storage; DPI/zoom pass. Native Live Update (Android 16 `ProgressStyle`) + a rich fallback path. Crash fix: `LocalNotifications.then()` (plugin proxy made non-thenable).
- **Motion system (v0.36.0, DEC-194)**: CSS-first page transitions (transform/opacity only, M3 curves, global `prefers-reduced-motion`), staggered lists, FAB/sheet/toast/nav/money micro-interactions; FAB shortcut overlap fixed.
- **Post-animation fixes (v0.37.0→v0.39.0, DEC-195…199/201)**: detail sheets back at the viewport bottom (portal + `transform:none` rest); first-entry transition (RouteView inside Suspense); bidirectional swipe with directional slide (Expenses + Viagem); active-outing fits one screen; FAB speed-dial redesign; active-outing notification with quick-add **value buttons that log without opening the app** (native `OutingNotifier` plugin + broadcast receiver + queue reconciliation) and a rich fallback.
- **Wise import (v0.40.0, DEC-200)**: `/import/wise` — pick the .csv files, the app parses (RFC4180, locale-robust amounts), dedupes cross-file by `TransferWise ID`, guesses category/city, assigns phase by date, flags already-imported / possible-manual-dup, and commits atomically with undo. Additive `Transaction.externalRef` (no migration). i18n ×3.
- **Quality**: 968 unit tests green (110 files; +24 import tests against the 3 real statements); tsc -b 0; web build + cap sync + `assembleDebug` all green; APK `Downloads/TripPilot-0.40.0-debug.apk` (versionCode 14).
- **Deploy**: every gate to **Production** via `--branch=main` → `trippilot.pages.dev` (latest `main.trippilot.pages.dev`), 0.29.0 → 0.40.0 live.
- **Device-pending** (by design, needs a physical Android): Android 16 Live Update promotion visuals + the One UI 7 no-open notification tap-to-log; motion feel on the S23.

### Planned Purchases — earmark known future buys (v0.17.0, DEC-175) — 2026-06-14 ✅ SHIPPED TO PRODUCTION
- **Mandate** (Julio): "vou fazer uma compra que sei que preciso… colocar como algo que já vai sair do orçamento para ver o que realmente posso gastar" — creams across pharmacy/Primor/Druni, clothes "at some point". No clean home existed; the user was confused as a user. Chose direction `lista_earmark`, scope "função madura, completa".
- **What shipped**: a new `PlannedPurchase` entity (Dexie **V6**, backup **V6**) with two modes via one toggle — **Reserve ON** subtracts the estimate from free-to-spend now (new `plannedPurchasesCents` term + FTS breakdown line; reserve shrinks by real linked spend, no double count) and **Track only** records the intention without touching FTS. **"Comprei"** logs a real expense (standard expense/payer path), links it, optionally closes — with **undo**; multi-store is first-class (tap per store, keep open, reserve draws down). Surfaces: `/planned` page (list, add/edit, progress, `estimated − spent = remaining` breakdown, Done bucket), dashboard card `planned_purchases` (hidden when empty), FAB "Plan a purchase", More-menu entry, 5-topic help screen, and a **simulator target** reusing the event-reserve mechanic & copy (no new verdict/fact kinds).
- **Reuse, not reinvention**: FTS deduction (event reserves DEC-072), `Breakdown` (DEC-172), `EmptyState` (DEC-171), expense orchestration. **Cut**: a redundant QuickAdd-prefill route for "Comprei" (the in-page sheet is fewer taps and already links+closes); retroactive linking of arbitrary pre-existing expenses deferred.
- **Quality**: 898 unit tests green (+ planned-purchases domain/orchestrator/FTS/simulator suites); tsc 0; build OK (PlannedPurchasesPage chunk 17 kB). i18n ×3 for every string.
- **Deploy**: shipped to **Production** via `--branch=main` → `trippilot.pages.dev` as 0.17.0 (SW cache `trippilot-v34`).

### Stability hardening + UX Gates V–Y (v0.15.0 / v0.16.0) — 2026-06-14 ✅ SHIPPED TO PRODUCTION
- **v0.15.0 (DEC-170)**: permanent mitigation for the critical "Não foi possível carregar seus dados" lockup (WebKit/Safari IndexedDB stalls) — layered self-healing (watchdog timeouts, background reconnect, internal restart, working retry/reload, emergency backup) so the user never hits a dead-end recovery screen.
- **v0.16.0 (DEC-171/172/173/174 — Gates V·W·X·Y)**: interaction feedback with undo (edit/delete expense, outing rounds, wallet reconcile); spread the "where this number comes from" breakdown (funds, planner margin); friendly first-use empty states (`EmptyState`); deepened active-outing + end-of-outing recap. app-lock crypto test pinned to the node env.

### UX Feedback & Continuity Pass (Round 2, Gates A–E) — 2026-06-14 ✅ SHIPPED TO PRODUCTION
- **Mandate** (Julio): "quero sentir que tudo que faço tem motivo e resultado — visual, explicado, sentido"; fix the page that "reloads and jumps to top" on in-page taps (e.g. the new collapse button); give the daily check-in a real, visible function ("mexo nele e não vejo nada mudando"). Informed by a 4-role council brainstorm (Visionary/Analyst/Connector/Simplifier) that converged on the same root causes. Full state file: `src/ux-polish-log.md` (RODADA 2).
- **Gate A (continuity, app-wide)** v0.14.6: `useAppData.reload()` always flipped `loading=true`, so every in-page mutation remounted the page tree at the top (scroll jump + "reloaded" feeling). Split into `runLoad({showLoading})`: only the first load + explicit recovery show the loader; every in-page reload is now SILENT → component tree stays mounted, scroll preserved. One fix, whole app. (Playwright `ux-scroll.mjs`: scroll 1203→1203, no loader flash.)
- **Gate B (check-in result)** v0.14.7: the check-in only highlighted a button (dead toggle). Added a read-only framing line (`getCheckInFraming`) that reframes the day's real `freeTodayCents` by intent (calm/outing/night) — never changes the budget (ÂNCORA 12). +CSS `checkin-reveal`.
- **Gate C (invisible money actions)** v0.14.8: value-suggestion accept + phase-leftover move now fire contextual confirmation toasts (amount + destination).
- **Gate D (the #1 action)** v0.14.9: saving an expense was SILENT (`QuickAddPage` was the only mutating page with no `showToast`). Now a success toast "<amount> registered" WITH undo (reuses DEC-126 `softDeleteTransactionsBatch`; `registerExpense` only inserts so the undo is symmetric); the dashboard already shows the new "free today" in place (Gate A).
- **Gate E (consistency + instant)** v0.14.10: transfers/withdrawals confirm too; the check-in is now OPTIMISTIC (framing shows on tap, reconciles after persist). A consistency sweep confirmed nearly all other mutating pages already had toasts — the broad "várias partes na mesma forma" was the scroll/reload (Gate A).
- **Deliberately NOT done** (over-engineering / honesty risk): animated hero count-up (shows transient false values on the most important number + the navigation remount breaks its main trigger), tone-engine per intent, scroll-restoration library.
- **Quality**: 820 unit tests green (+1 check-in framing vs UX Polish's 819); tsc 0; lint 0; build no chunk >500KB; i18n ×3 for every string.
- **Deploy**: EVERY gate shipped to **Production** via `--branch=main` → `trippilot.pages.dev`: 0.14.6 (SW v16), 0.14.7 (v17), 0.14.8 (v18), 0.14.9 (v19), 0.14.10 (v20). Latest production deploy: https://b5383138.trippilot.pages.dev

### UX Polish Pass (Gates 0–7) — 2026-06-14 ✅ SHIPPED TO PRODUCTION
- **Mandate**: reorganize for clarity/density/hierarchy — **ZERO functionality removed**, design system untouched, protected zone (insights carousel DEC-077/091/150 + occasion counters DEC-076) preserved. Visual loop: Playwright mobile screenshots BEFORE/AFTER per change (`src/ux-polish-log.md` is the full state file with the BEFORE×AFTER table).
- **Gate 2 (Dashboard)** v0.14.2 (DEC-162): consolidated the two data-safety banners to one-at-a-time; reordered cards (actionable on top); grouped the 3 read-only analytics into one collapsible "Trip analytics" drawer (collapsed by default, persisted in `AppSettings.collapsedDashboardCards`, no migration).
- **Gate 3 (Capture)** v0.14.3 (DEC-163): QuickAdd Cancel/Save pinned to a sticky bottom bar (no scroll to save). Active outing / `/outings/new` / expense-list density reviewed, left as-is.
- **Gate 4 (Planning/finance)**: planner, simulator, funds, wallets reviewed — already clean, NO change (no bump).
- **Gate 5 (Secondary)** v0.14.4 (DEC-164): Settings flat list grouped into 7 labeled sections (order preserved). Backup/Shared/About/More/Dashboard-config already consistent, left as-is.
- **Gate 6 (Navigation)** v0.14.5 (DEC-165): unified the back-button + title style of the 2 outliers (Notifications, ImpactDetail) to the 16-page majority (sticky preserved). Bottom nav, padding token, empty states audited — already consistent.
- **Gate 7 (Verification)**: final screenshot pass over all 21 routes (no screen worse than Gate 1 baseline); 9/9 interaction smoke checks green (analytics collapse persists across reload; bottom nav reaches every tab; simple↔complete toggles advanced surfaces); mock lives only in the ephemeral Playwright IndexedDB — never in the build/deploy.
- **Quality**: 819 unit tests green (+5 dashboard-collapse helpers vs Package 3's 814); tsc 0; build no chunk >500KB; i18n ×3 for every new string.
- **Deploy**: EVERY gate with code shipped to **Production** via `--branch=main` → `trippilot.pages.dev`: 0.14.2 (SW v12), 0.14.3 (v13), 0.14.4 (v14), 0.14.5 (v15). Latest production deploy: https://65c3082b.trippilot.pages.dev

### Feature Expansion Package 3 (Phases 5 & 6) — 2026-06-13 ✅ SHIPPED TO PRODUCTION
- **Phase 5 (location & time + multi-currency)** v0.12.2→v0.13.0: opt-in on-device location + sticky place + nearby reverse-geocode (online) + offline recents + manual name + time/place on list/detail + spend-by-place (DEC-157); multi-currency expenses (original preserved + base-currency budget), currency-aware wallet debit, opt-in frozen FX snapshot (DEC-158).
- **Phase 6 (data security & sharing + Share Target)** v0.13.1→v0.14.0: local daily snapshots + restore-to-yesterday — the package's ONE Dexie migration v4→v5 `localSnapshots` (DEC-159); vault via share sheet + read-only self-contained HTML trip report (DEC-160); opt-in PIN app lock (PBKDF2/Web Crypto, off by default, recovery never trapped; biometrics deferred) + Web Share Target pre-fill (DEC-161).
- **Quality**: 814 unit tests green (+106 vs Package 2 baseline of 708); tsc 0; build no chunk >500KB. ÂNCORA invariants held: location is opt-in/on-device, original currency preserved, budget routed through base, the lock never traps recovery, Share Target only pre-fills.
- **Deploy**: EVERY gate shipped to **Production** via `--branch=main` → `trippilot.pages.dev` (per Julio's request): 0.12.2, 0.12.3, 0.13.0, 0.13.1, 0.13.2, 0.14.0, 0.14.1.

### Feature Expansion Package 2 (Phases 3 & 4) — 2026-06-13 ✅ SHIPPED TO PRODUCTION
- **Phase 3 (insights v2 + check-in + phase cycle)** v0.10.2→v0.11.0: insights uncapped + priority-ordered + auto-rotation (DEC-150); calibrated builders category-rhythm/dangerous-day/end-of-day, anti-spam (DEC-151); daily check-in card + responsive notification (DEC-152); phase leftover sheet + atomic move (preserves total) + countdown (DEC-153).
- **Phase 4 (motivation + continuity)** v0.11.1→v0.12.0: savings goal + piggy bank (read-only, never touch free-to-spend — DEC-154); in-trip occasion-average value suggestion, accept-only (DEC-155); end-of-trip priors + save/apply trip templates (DEC-156).
- **Quality**: 708 unit tests green (+94 vs Package 1 baseline of 614); tsc 0; build no chunk >500KB. All ÂNCORA invariants proven by tests (free-to-spend untouched by goal/piggy; learning never auto-writes; templates mint new ids).
- **Deploy**: Phase 4 (v0.12.0) + final (v0.12.1) shipped to **Production** via `--branch=main` → `trippilot.pages.dev`; intermediate gates (0.10.2→0.11.2) were Preview (`master.trippilot.pages.dev`).

## Status Summary

| Area | Status | Notes |
|------|--------|-------|
| Project structure | ✅ DONE | Cursor workspace with Director + Febracorp methodology |
| Product spec | ✅ DONE | Full MVP specification + R2 features (events, rhythm, per-phase activities) |
| Technical direction | ✅ DONE | Stack locked: React/TS/Vite/Dexie/Cloudflare + Router v7 + i18next |
| Competitive analysis | ✅ DONE | TravelSpend gap analysis, positioning defined |
| Decision log | ✅ DONE | DEC-001..DEC-211 logged (gap DEC-185–199/201 = native arc — see reconciliation note in decision-log.md); superseded: DEC-063→071, DEC-059/064→180, DEC-164→211 |
| Implementation phases | ✅ DONE | D1–D6 delivered (D6 = native arc v0.28→v0.50) + Expansion Phases 1–6 + field rounds 1–2 (V1 expanded complete) |
| Data model | ✅ DONE | Dexie schema **v9**; device-local tables (not in backup): `localSnapshots` (v5), `plannedPurchases` (v6), `mailboxQueue` (v7), `attachments` (v8), `shareLinks` (v9); non-indexed location + multi-currency + app-lock + planned-income fields. `TransactionType = expense\|transfer\|settlement\|adjustment` (no income type — see master-fix plan B8) |
| Domain rules | ✅ DONE | Forecasting, three-limit system, learning, rhythm weighting, event reserves, insights |
| Design system | ✅ DONE | Theme v4; BottomSheet/Toast primitives; zero native dialogs; zero hardcoded colors (tokens only) |
| Implementation D1–D6 | ✅ DONE | All deliveries implemented and deployed to Cloudflare Pages |
| Gap analysis R1 2026-06-09 | ✅ RESOLVED | 36/36 gaps fixed (see `src/gap-fix-log.md`) |
| Gap analysis R2 2026-06-09 | ✅ RESOLVED | 23/23 items fixed: 7 field bugs + 9 R2 gaps + 7 planning features (see `src/gap-fix-log-r2.md`) |
| Field review R3 2026-06-10 | ✅ RESOLVED | 26/26 requirements implemented in 7 gates (see `src/gap-fix-log-r3.md`) |
| P2P sync R4 2026-06-10 | ✅ DONE | 14/14 requirements in 7 gates (see `src/gap-fix-log-r4-p2p-sync.md`); DEC-103..108 |
| Reliability R5 2026-06-10 | ✅ DONE | 9/9 requirements in 4 gates (see `src/gap-fix-log-r5.md`); DEC-109..113 |
| Full-fix R6 2026-06-10 | ✅ DONE | 25/25 items in 7 gates: 4 audit bugs + 6 partials + 8 field-test findings + simulator v3 (see `src/gap-fix-log-r6.md`) |
| Field review R4 2026-06-11 | ✅ DONE | 12/12 requirements in 10 gates: payer truth table, occasions=sessions, simulator v3 contextual, outing zones, multi-select, configurable dashboard, PWA notification, help mode (see `src/gap-fix-log-r4.md`); DEC-114..123 |
| Brainstorm features 2026-06-12 | ✅ DONE | 9/9 features (F1–F9): bar mode + wake lock, universal undo, PWA shortcuts, mental anchor, burndown card, heatmap card, recap card, rescue mode, share card; DEC-126..134 |
| i18n | ✅ DONE | pt-BR + en + es complete and synchronized (recovery/restore/PWA-update keys added in v0.8.2) |
| Tests | ✅ DONE | **1147 unit tests (128 files) + 34 Playwright e2e**, all green (Node 22 required — 6 ecies tests need `crypto.subtle`) |
| Deploy | ✅ DONE | **v0.64.0** web/OTA on Cloudflare Pages (apex) + `trippilot-sync` Worker + KV `SHARE_STORE`; latest APK **0.56.0** (min required 0.50.0; web/OTA runs ahead of the APK by design). ⚠️ Production branch is **`master`** (apex `trippilot.pages.dev`); `--branch=main` lands as Preview (DEC-203). Deploy production with **`--branch=master`** |
| Repository | ✅ DONE | GitHub `juliocorcini/trip-budget-copilot` (ssh) |

## Gap-Fix Session R2 (2026-06-09)

All 23 items from `documents/gap-analysis-r2-2026-06-09.md` were resolved in a
9-gate session (full log in `src/gap-fix-log-r2.md`). Highlights:

- **Distribution fixed (GAP-R2-001 / DEC-082)**: SW now network-first for navigation with cache fallback; persistent "new version" toast triggers skipWaiting + reload — deploys finally reach users
- **Light theme everywhere (DEC-083)**: 12 hardcoded colors replaced by tokens; `data-theme` + language applied at router root (covers /quick-add, /outings/*, /simulator); dynamic meta theme-color
- **Mobile feel (DEC-081)**: global user-select none (inputs preserved), transparent tap-highlight, touch-action manipulation
- **Dexie v3 unified migration**: share `confirmationStatus`, new `phaseProfileSettings` table, `Phase.rhythmPreset/peakDays`, rich `PlannedOccurrence` (endDate, kind, reservedCents, linkedSessionId); backup v3 with v2 import
- **Share confirmation (DEC-071)**: third-party shares born pending; debts count only confirmed; dashboard card with confirm/reject/adjust sheet (Julio's sister scenario covered by tests)
- **Fund/phase CRUD (DEC-080)**: edit/delete with safety rules (reassign or block), soft-delete cascades via orchestrators
- **Per-phase activities (DEC-074)**: 16-preset catalog + custom; `phaseProfileSettings` drives Planner/counters/outing start; kills cross-phase contamination
- **Phase rhythm (DEC-075)**: intensity presets + peak days; weighted free-to-spend per day with peak microcopy
- **Planned events (DEC-072/073)**: events/sub-destinations per phase with reserves deducting from free-to-spend until confirmed; dashboard day card (start now / postpone); one-off sessions create occurrences, not profiles
- **Rich outing (DEC-078/079)**: post-add enrichment stepper (category → payer → split, skippable, never blocks logging); outing history tab + read-only review
- **Final dashboard (DEC-076/077)**: counters carousel ordered by usage; rotating insights (6 V1 builders with significance rules) persisting daily `forecastSnapshots`; exact 11-position layout
- **Quality**: aria-labels across icon buttons; 7 new e2e tests (29 total); timezone bug fixed (UTC vs local date on day card)

## Gap-Fix Session R3 (2026-06-10)

All 26 requirements from Julio's field review were resolved in a 7-gate session
(full log in `src/gap-fix-log-r3.md`). Highlights:

- **App feel (DEC-084..087)**: sticky headers (Dashboard/Expenses/Planner), unified
  `--page-padding-x` margins, invisible scrollbars (root cause: `no-scrollbar` was never
  defined), no pull-to-refresh in installed PWA
- **Subtractive daily budget (DEC-088)**: "livre hoje" fixed at day start, drops with each
  expense (€6,00 − €2,00 = €4,00), can go negative; average is secondary
- **Notifications center (DEC-090)**: bell → /notifications with 5 derived notification types
- **Honest Friend v2 (DEC-092)**: plan-based (planned vs done vs fits-in-margin) — kills the
  "197 saídas" bug; projects reserve-consumption date; /impact detail page (DEC-093)
- **Multi-metric simulator (DEC-094)**: total + daily + plan perspectives, worst verdict wins
- **Expense taxonomy (DEC-095..097)**: ~110 subcategories, proximity-sorted stepper, 2-level
  event flow, 10s auto-dismiss with interaction reset, split flow enrichment
- **Planner overhaul (DEC-098..101)**: live margin, top over-budget warning, category menu
  (edit value / remove from phase / per-phase classification), real lock, event deep links,
  profile editing with safe removal
- **Debt statement (DEC-102)**: participant tap → itemized breakdown matching the debts engine
- **Clickability sweep (R-26)**: all 22 screens audited; orphan cards now navigate

## P2P Sync Session R4 (2026-06-10)

All 14 requirements from the P2P council session (DEC-103..108, MTG-2026-06-10)
were implemented in 7 gates (full log in `src/gap-fix-log-r4-p2p-sync.md`). Highlights:

- **Sync domain (pure TS)**: actor identity QR, wire protocol (manifest/chunk/ack
  with deflate + CRC32, 12 KB chunks), QR codec (`TPSYNC1:` envelope, 1.6 K char
  budget), statement + migration payloads
- **Worker `trippilot-sync` (DEC-107)**: ephemeral 2-peer rooms (Durable Object,
  SQLite class), opaque relay, 10-min alarm expiry, zero storage — deployed at
  `https://trippilot-sync.trippilot.workers.dev`
- **Transports (DEC-103)**: AES-GCM 256 E2E (key only in the QR), WebRTC DataChannel
  with automatic encrypted-relay fallback after 8 s, offline two-QR manual signaling
- **Device migration (DEC-104)**: BackupPage "send/receive to another device" +
  Welcome "receive from another device"; reuses backup pipeline + import preview
- **Pairing (DEC-105)**: "My QR" + "Add by QR" + retroactive "Connect by QR" +
  link badge; typing a name remains the default path
- **Mirrored debts (DEC-106)**: owner sends read-only statement; mirror confirms/
  rejects lines; responses flow back on the same session or queue offline and flush
  next time; financial truth never merges bidirectionally
- **Data**: Dexie v4 (peerLinks, mirroredStatements), backup v4 with v1-v3 import
  normalization; 35 new unit tests (299 total)

## Reliability Session R5 (2026-06-10)

All 9 requirements from Julio's v0.4/v0.5 field test were resolved in 4 gates
(full log in `src/gap-fix-log-r5.md`). The reported "total data loss" was
diagnosed as: IndexedDB failures being treated as empty state (redirect to
welcome) + an iOS-unsafe blob export that froze the standalone PWA. Highlights:

- **DB failure ≠ empty data (DEC-109)**: `useAppData` error state + 10 s
  watchdog; `DataErrorScreen` ("your data was NOT deleted" + retry that reopens
  Dexie); welcome redirect only after a SUCCESSFUL load; auto-retry on
  visibilitychange
- **iOS-safe export (DEC-110)**: `navigator.share({files})` first, fallback
  anchor `target=_blank` with 10 s deferred `revokeObjectURL`; try/catch +
  busy state on all backup handlers
- **Storage durability (R5-03)**: `requestPersistentStorage()` at boot +
  dashboard banner when not persisted; `repairDemoTripIfNeeded` date rewrite
  gated to `isDemo` (DEC-111 — it was corrupting real future/finished trips)
- **Onboarding keyboard (R5-04)**: `interactive-widget=resizes-content` +
  `useKeyboardInset` (visualViewport) + 100dvh layout — footer buttons stay
  above the keyboard
- **Onboarding details (R5-05)**: dedicated phase step (dates validated in trip
  range, rhythm preset, peak days)
- **Planner (DEC-112)**: itemized "you added 16 transporte, 5 mercado e 2 café"
  headline (was mislabeling the total); deficit = `-liveMargin` so the
  recommendation card survives leaving/re-entering the Planner
- **Outing gauge (DEC-113)**: piecewise `calculateGaugePosition` (spent 40 of
  35/45/55 now lands between meta and teto) + clamped value-pill marker
- **Tests**: +18 unit (317 total), e2e updated for the 5-step onboarding

## Full-Fix Session R6 (2026-06-10)

All 25 items from the full-coverage audit (`documents/full-coverage-audit-2026-06-10.md`)
plus Julio's field-test findings (`documents/field-test-checklist-r3-r5.md`) were resolved
in a 7-gate session (full log in `src/gap-fix-log-r6.md`, prompt in
`documents/r6-full-fix-prompt.md`). Highlights:

- **Timezone bugs killed (BUG-001/002, PAR-006)**: every "which day was this?" projection
  now goes through `localDayOf` (UTC instants no longer shift evening expenses to the next
  day); phase end dates fully inclusive; `resolveActivePhase` replaces `phases[0]` fallbacks
- **Debts engine (BUG-003)**: multi-creditor allocation respects remaining credits
- **Shared edit (BUG-004)**: editing a shared expense re-applies DEC-071 rejected-share math
- **P2P sync reliable on the 1st attempt (P2P-09/12/13)**: sender consumes the receiver's
  hello symmetrically (was erroring on EVERY successful send) + channels buffer messages
  arriving before the app listens (was silently dropping the first attempt)
- **QR scanner (P2P-06/07)**: camera switch button (remembers choice) + zoom chips —
  unblocks the offline 2-QR mode on multi-lens iPhones
- **Dashboard carousel (R-02)**: exactly 3 cards per page + mediterranean per-category colors
- **Outing gauge (R5-09)**: labels/ticks anchored at the real 3:2:1:1 segment boundaries
- **Honest iOS persistence (R5-03)**: install-to-home-screen guidance instead of the
  impossible "enable" CTA; installed PWA no longer alarmed
- **Keyboard viewport (R5-04)**: forced restore on keyboard close
- **Locale formatting (PAR-001/002/004/005)**: dates/numbers/onboarding names/wallet types
  follow the active language via a domain locale bridge
- **Simulator v3 (R-12)**: each metric shows its math, quick chips, post-verdict CTAs;
  learning prior keeps the preset estimate (PAR-003a)
- **Tests**: +26 unit (343 total)

R7 candidate (deferred, product decision): per-category simulation weighting when the
category plan is already blown.

## Field Review Session R4 (2026-06-11)

All 12 requirements from Julio's in-trip audio review were resolved in a 10-gate
session (full log in `src/gap-fix-log-r4.md`, prompt in
`documents/gap-fix-r4-implementation-prompt.md`). Decisions DEC-114..123. Highlights:

- **Payer math fixed (DEC-114, the critical one)**: "Ana paid €15 and we didn't split"
  no longer erases the cost — it stays MY expense AND creates a €15 debt to Ana.
  Single truth-table function `resolvePayerExpense` reused by QuickAdd, outing stepper
  and outing split; end-of-session batch wallet skips items paid by others;
  reconciliation adjusts over the personal total preserving debts
- **Occasions = sessions (DEC-115)**: a 9-item bar night counts as ONE bar occasion
  everywhere (dashboard counters, Honest Friend with new `over_plan` kind, impact,
  simulator) via `countProfileOccasions`
- **Contextual simulator v3 (DEC-116)**: asks WHERE the money goes; explained verdicts
  ("consumes ≈2 of your 4 dinners", "the €60 reserve covers it", "≈4 days of your daily
  free") — zero unlabeled numbers, old raw-equation displays removed
- **Honest outing zones (DEC-117)**: copy/color change AT the target; "can still spend
  comfortably: €0" eliminated; next-drink hint is honest per zone; progressive alerts
  re-anchored (50% target / target / ceiling / max)
- **Multi-select (DEC-118)**: long-press in expense/outing lists → selection bar with
  batch delete / move pool / change category (atomic Dexie orchestrators)
- **Configurable dashboard (DEC-119)**: long-press a card → quick action / hide /
  configure; /settings/dashboard reorder + visibility persisted in AppSettings
- **PWA outing notification (DEC-120, best effort)**: persistent notification with
  +€X quick-add buttons and "what was it?" follow-up; superseded by DEC-124 (v0.7.1):
  the SW now always writes straight to IndexedDB and re-renders itself; research
  VERIFIED 2026-06-11 in `documents/pwa-notification-research.md`; true
  ongoing/media-style → Capacitor backlog (DEC-017)
- **Help mode (DEC-121)**: "?" on 6 complex screens → overlay highlighting the real
  elements with concrete travel examples ×3 languages
- **UI polish (DEC-122)**: carousel opens aligned (3 cards), insights advance one per
  gesture, category chip labels never overflow, `<html lang>` follows the language
- **QuickAdd payer-first (DEC-123)**: "Who paid?" as first-level question with debt hints
- **Tests**: +66 unit (409 total)

### Same-day field feedback on v0.7.0 (→ v0.7.1)

- **Notification v2 (DEC-124)**: SW handles action clicks alone (direct IndexedDB
  write + re-render from fresh DB + broadcast) — v1 window delegation died on
  Android frozen tabs (stuck €0); Settings toggle + outing-screen enable banner +
  boot/refocus re-sync; rich body (total vs target, remaining, ≈N drinks); "open"
  fixed to /outings/active
- **Overlay stacking fix (DEC-125)**: SelectionBar and help overlay portaled to
  <body> (sticky headers trapped them under the bottom nav); help card draggable

## Brainstorm Features Session (2026-06-12, v0.8.0)

Nine features from the creative brainstorm council, all approved by Julio and
implemented in one session. Decisions DEC-126..134. Highlights:

- **Universal undo (DEC-126)**: deletes (single/batch/outing) show a 6s toast with
  "Desfazer" — restore orchestrators clear `deletedAt` on the full cascade;
  `trippilot:data-changed` event refreshes any open page
- **Bar Mode (DEC-127)**: fullscreen dark view for the active outing (huge total,
  giant quick-add buttons, wake lock keeps the screen on); quick-adds skip the
  stepper and offer undo instead
- **Mental anchor (DEC-128)**: "€20 ≈ R$ 124" hints in QuickAdd/detail/bar mode
  with a manual offline rate configured in Settings
- **Dashboard insight cards (DEC-129/130/131)**: yesterday recap (spent vs
  reconstructed allowance + streak), phase burn-down (SVG, rhythm-aware ideal
  line), month heatmap (calendar grid, tap day → transactions sheet) — all
  movable/hideable via DEC-119 infrastructure
- **Rescue mode (DEC-132)**: `/rescue` calculator — "guardar €X" → new daily
  allowance + greedy occasion-skip suggestions; nothing persisted
- **Share card (DEC-133)**: trip overview exports a 1080×1350 PNG via canvas +
  Web Share sheet (local only — DEC-011 stands, no social surface)
- **PWA shortcuts (DEC-134)**: launcher long-press → quick-add / outing / simulator
- **Tests**: +42 unit (456 total); sync-crypto suite moved to node environment
  (jsdom lacks SubtleCrypto)

### Same-day field feedback on v0.8.0 (→ v0.8.1)

- **Install + update controls (DEC-135)**: "Add to home screen" button in More +
  Settings (captured beforeinstallprompt); Settings "App" section shows the real
  version and a "Check for update" button that forces the SW update and reloads —
  covers the "Chrome updated but the installed app is stale" case
- **Burn-down follows the full plan (DEC-136)**: dated events/sub-destinations
  now appear as steps on the ideal line on their planned day (multi-day spread
  evenly); pending reserves added back to the chart envelope; +4 unit tests (460)
- **Width fix**: pending-shares card (and active-outing card) gained `w-full` —
  buttons shrink-to-fit unlike the div cards
- **Repo**: project pushed to GitHub (`juliocorcini/trip-budget-copilot`)

## Stability Fix Session (2026-06-13, v0.8.2)

All 20 bugs from `documents/stability-audit-2026-06-13.md` were fixed in a 7-gate
session (prompt `documents/stability-fix-prompt.md`, full log in
`src/stability-fix-log.md`). Decision DEC-137. The deployed app had become
unusable — cold starts with real data landed on onboarding and transient
IndexedDB hiccups looked like total data loss. Highlights:

- **Boot/onboarding P0 (Gate 1 — BUG-001/003/004/009/014)**: `BootGate` routes
  cold starts (dashboard / recovery / welcome) and only reaches Welcome after a
  SUCCESSFUL empty load; `appSettings.get()` is non-destructive (no default-row
  write); every data screen renders `DataErrorScreen` on error with declarative
  `<Navigate>` — no `navigate()` in the render body (it crashed under React 19).
  New `BootGate`, `TripRecoveryScreen`, `LoadingScreen`.
- **Safety net (Gate 2 — BUG-005/010/016/017/018)**: `safeLocalStorage` helper
  (in-memory fallback, zero direct `localStorage` elsewhere); `formatMoney` and
  `toSafeIsoDate` never throw; root `ErrorBoundary` keeps a crash-log buffer and
  shows a persistent recovery screen after ≥4 crashes (clear-cache / export)
  instead of looping; `window` error + unhandledrejection handlers.
- **SW hardening (Gate 3 — BUG-006/011)**: the Service Worker opens IndexedDB
  version-less, aborts empty-DB creation, rejects on `onblocked`, closes on
  `onversionchange`, guards `hasStores()` before any transaction; SW reloads are
  deferred while an outing is active (`sw-reload.ts`). CACHE_NAME v7→v8.
- **iOS persistence + integrity (Gate 4 — BUG-002/013/015)**: emergency JSON
  snapshot to `localStorage` (every 5 expenses + on outing end); empty DB +
  snapshot → `EmergencyRestoreScreen` (one-tap restore); onboarding wrapped in
  one atomic Dexie transaction (`createTripFromOnboarding`, `activeTrip` flips
  only after commit); demo repair gated by `isDemo` so real trips are untouched.
- **Performance (Gate 5 — BUG-007/008/012/019/020)**: `AppDataProvider` runs the
  loader ONCE (context consumer `useAppData`); `DashboardPage` 1607 → 267 lines
  with heavy math/async moved to a single-memo `useDashboardModel`; Vite
  `manualChunks` (index 729 → 156 KB, QR libs stay lazy, no >500 KB warning);
  foreground auto-retry throttled (30s cooldown, max 3, no `db.close` storm);
  Android back button no longer exits the PWA on home routes.
- **Tests**: +44 unit (460 → 504), all green; build + typecheck clean.

## Feature Expansion Package 1 (2026-06-13, v0.8.3 → v0.10.1)

Phases 1 & 2 of `documents/feature-expansion-master-plan-2026-06-13.md` were built
autonomously in 8 gates (prompt `documents/phase-package-1-capture-simple-mode.md`,
log in `src/phase-1-2-log.md`). Decisions DEC-138..149. A version + deploy + "what's
new" entry per gate. Highlights:

- **What's New screen (DEC-138, M0)**: About lists the current version's notes +
  expandable history; `release-notes.ts` with pt/en/es copy, one entry per gate.
- **Phase 1 — fast capture (DEC-139..142, v0.8.4)**: amount field is a safe
  calculator (`evaluateAmountExpression`, no `eval`); description memory +
  frequent favorites (zero-AI, derived from history); round-trip transport
  duplication; ≥3× median anomaly confirm (never blocks — DEC-053).
- **Phase 1 — outing v2 (DEC-143, v0.8.5)**: amount buttons learn the last value;
  repeat-last-item; round (N × price, atomic); fair payer-rotation hint; "time to
  ceiling" projection. All reuse the atomic session orchestrators; suggestions only.
- **Phase 1 — extras (DEC-144/145, v0.9.0 — Phase 1 complete)**: optional voice
  quick-add (Web Speech behind a support-detected boundary; `parseVoiceExpense`);
  simulator "borrow from tomorrow" honest notice (fits the phase but overflows today).
- **Phase 2 — simple mode (DEC-146, v0.9.1→0.9.2)**: non-indexed `appMode`
  (default complete, backfilled, not merged on import); lean `SimpleHome`
  ("free today" + register); data-driven `visibleInMode` hides Planner/Outing/
  Simulator; `ModeGuard` on advanced routes with a per-visit "open anyway" escape;
  live Settings toggle. Only HIDES — never deletes data or routes (ÂNCORA 9).
- **Phase 2 — smart start (DEC-147/148, v0.9.1)**: one-question onboarding (atomic
  via `createTripFromOnboarding`) with a "customize everything" door to the
  preserved 5-step flow, both ending on the mode choice; trip presets
  (Urban/Family/Festival) seed rhythm/peak days/reserve as editable suggestions.
- **Phase 2 — adaptive reveal (DEC-149, v0.10.0 — Phase 2 complete)**: after ≥5
  expenses in simple mode, a one-time dismissible card offers to unlock complete
  mode; `shouldOfferModeReveal` + `simpleRevealDismissed` flag.
- **Tests**: +110 unit (504 → 614), all green; typecheck + build clean (no >500 KB
  chunk warning). M11 (voice) shipped, not deferred.
- **Deploy note**: all gate deploys (0.8.3→0.10.0) used `--branch master` and
  therefore landed as **Preview** (`master.trippilot.pages.dev`); the 0.10.1 final
  was deployed with `--branch main` to update Production (`trippilot.pages.dev`).

## Registered Technical Debts

| Debt | Origin | Notes |
|------|--------|-------|
| Full orchestrator refactor of untouched pages | DEC-067 (D-H) | Orchestrators exist for expense/outing/wallet/backup/share/CRUD flows; some older pages still call repositories directly |
| Automatic future floor calculation | DEC-069 (D-I) | Manual floor per phase link implemented; automatic calculation is D3+ |
| SW precache via build plugin | GAP-036 | Current approach parses index.html at install; a Workbox/Vite plugin would be more robust |
| E2E (Playwright) in CI | DEC-054 | 29 e2e tests run locally; CI requires browser install |
| Biometric app lock (WebAuthn) | DEC-161 (M20 cut) | PIN-only shipped; WebAuthn platform authenticator deferred — PIN is the baseline |
| ~~Nearby POI list (Overpass)~~ | DEC-157 → DEC-166 | DONE — nearby establishments picker shipped (DEC-166); row kept for history |

## Next Steps

**The active plan is `documents/master-fix-and-skipped-features-plan-2026-06-17.md`** — a full
repasse of the brain + code cataloguing everything skipped/deferred/stale, with per-item fix
plans, inline council and gates. Locked decisions (2026-06-17):

1. **Brain hygiene (Onda 0) — applied 2026-06-17**: README, project-status, implementation-phases,
   product-spec, technical-direction and decision-log reconciled (this update is part of it).
2. **Quick wins (Onda 1, web/OTA)**: B9 link existing expense to a planned purchase; B12 R7
   per-category simulation; B17 Planner empty state; B7 automatic future-floor suggestion.
3. **Income type (B8) — DECIDED: build a full `TransactionType = 'income'`** that grows the
   budget (its own gate; touches FTS/breakdown/wallet/backup/learning — invariance tests required).
4. **Push posture (B5) — DECIDED: sideload-first, no FCM**; "money lands on the other phone" is
   served by a share/copy-link nudge + the async pull floor + S7 (app-open). The app does not
   assume the Play Store.
5. **Native batch (Onda 4, 1 APK + device session)**: B1 receive `.csv`, B2 App Links
   `/pair`+`/s/:id`, B3 native GPS grant, and validate the `[device]`-pending backlog (B18).
6. **Shared link (B4) — DECIDED: leave as-is for now** (Julio will rework it; no S9 work yet).
7. Deferred by design: P2P V2 (DEC-108), close-connection-on-background (DEC-170 prevention).

## Blockers

- None.

## Key Decisions Reference

All decisions documented in [decision-log.md](decision-log.md). R2 session added
DEC-071..DEC-083 (approved 2026-06-09); R3 session added DEC-084..DEC-102
(approved 2026-06-10); R4 session added DEC-103..DEC-108 (approved 2026-06-10);
R5 session added DEC-109..DEC-113 (approved 2026-06-10); field review R4 session
added DEC-114..DEC-123 (approved 2026-06-11); brainstorm session added
DEC-126..DEC-134 (approved 2026-06-12); v0.8.1 field feedback added DEC-135/136
(approved 2026-06-12); stability hardening added DEC-137 (approved 2026-06-13);
Feature Expansion Package 1 (Phases 1 & 2) added DEC-138..DEC-149 (approved 2026-06-13);
Feature Expansion Package 2 (Phases 3 & 4) added DEC-150..DEC-156 (approved 2026-06-13);
Feature Expansion Package 3 (Phases 5 & 6) added DEC-157..DEC-161 (approved 2026-06-13).
