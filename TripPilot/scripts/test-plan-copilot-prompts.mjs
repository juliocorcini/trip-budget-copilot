/**
 * test-plan-copilot-prompts.mjs
 *
 * Tests the AI Copilot Planning prompts (DEC-492) against the Groq API
 * with 5 real destinations and validates price accuracy + JSON structure.
 *
 * Usage:
 *   GROQ_API_KEY=gsk_... node scripts/test-plan-copilot-prompts.mjs    # real API
 *   node scripts/test-plan-copilot-prompts.mjs --mock                   # validation only
 *
 * The GROQ_API_KEY is stored as a Cloudflare Worker secret. To get it:
 *   - Go to dash.cloudflare.com → Workers → trippilot-sync → Settings → Variables
 *   - Or create a new key at console.groq.com/keys
 *
 * 5 real destinations tested:
 *   1. Amsterdam (8d, €1200, party)    — expensive European, nightlife-heavy
 *   2. Bangkok (21d, $1500, backpacker) — cheap Asian, street food
 *   3. Lisboa (10d, €600, budget)       — mid-range European, tascas
 *   4. Barcelona (12d, €900, cultural)  — mid-range European, tapas
 *   5. London (5d, £800, quick)         — expensive, pubs, short trip
 *
 * Each destination runs both the "analyze" and "generate" prompts.
 * The script validates:
 *   1. JSON structure (correct fields, types)
 *   2. Question quality (relevant, not too many, has "why")
 *   3. Price accuracy (within expected ranges from real-world 2026 data)
 *   4. Budget safety (total plan ≤ free budget, margin ≥ 15%)
 */

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';
const API_KEY = process.env.GROQ_API_KEY;
const MOCK_MODE = process.argv.includes('--mock');

if (!API_KEY && !MOCK_MODE) {
  console.error('ERROR: Set GROQ_API_KEY environment variable, or use --mock to test validation only');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Prompts (will become Worker constants)
// ---------------------------------------------------------------------------

const ANALYZE_SYSTEM_PROMPT = `You are a travel budget planning copilot. The user is setting up a trip
and wants an AI-assisted spending plan. You will receive their trip details
and must return:

1. A summary of what you understood
2. What you already know about the destination (local prices, tips)
3. QUESTIONS you need answered to create an accurate plan

MANDATORY FIRST QUESTION — spending style:
Your FIRST question MUST always be about spending style. Use exactly these 4 options
(translated to the user's language):
  - "budget": save as much as possible (cook at home, free activities, cheap transport)
  - "balanced": mix of saving and enjoying (some restaurants, some markets, some outings)
  - "comfortable": eat out often, nicer venues, more experiences, less worrying
  - "flexible": enjoy freely, choose the best options without much limit
Default selection should be "balanced". Each option should have a 1-line description of what
it means for daily spending (e.g. "Maioria das refeições econômicas, algumas saídas").

OPTIONAL SECOND QUESTION — priority category:
If relevant, ask "Where would you like to spend MORE?" with multi-select options:
  Food, Bars & nightlife, Tours & attractions, Transport comfort, Shopping, Distribute equally

RULES FOR REMAINING QUESTIONS:
- Ask ONLY what you NEED to create a good plan (don't ask for fun)
- Each question must have single_choice options with emoji + label
- Each question must explain WHY you're asking (1 sentence)
- Max 5 questions for trips ≤7 days, max 6 for longer trips (including the mandatory ones)
- Always include allow_custom: true (the user can type anything)
- Adapt questions to the context:
  - 3-day city trip? Skip accommodation, ask vibe + food style
  - 30-day multi-country? Ask about pace, accommodation, cooking
  - Festival trip? Ask about ticket costs, drinking habits
- Options should be in the user's language (see "language" field)
- Never ask about things the user already told you

Return JSON only with this exact structure:
{
  "understood": { "summary": "...", "destination_recognized": true/false, "destination_details": "..." },
  "questions": [
    { "id": "q1", "text": "...", "why": "...", "type": "single_choice",
      "options": [{ "id": "opt1", "label": "...", "emoji": "..." }], "allow_custom": true }
  ],
  "already_known": ["fact about destination prices", ...]
}`;

const GENERATE_SYSTEM_PROMPT = `You are a travel budget planning copilot. Given the trip details and the
user's answers to your questions, generate a complete spending plan.

WHAT EACH ACTIVITY TYPE COSTS (the FULL occasion per person, NOT a single item):
- "bar": a full night out — 3-5 drinks, maybe a snack, maybe cover or entrance.
  IMPORTANT: In expensive European cities, a bar night costs 4000-5500 cents. In cheap cities, 1400-2800 cents.
- "market": a full grocery shopping trip — enough food for 1-2 days of home cooking.
  This is NOT street food. Street food counts as "restaurant". Market = supermarket groceries.
  Typical range: 1500-2500 cents in Europe, 850-1700 cents in SE Asia.
- "restaurant": a complete meal — main dish + drink, possibly dessert.
  Typical range: 2500-4000 cents in expensive cities, 1000-2000 cents in mid-range, 400-1500 cents in cheap cities.
- "outing": a day activity — museum/attraction ticket, possibly with transport to get there.
  Typical range: 1500-3000 cents in expensive cities, 500-1500 cents in mid-range, 300-1500 cents in cheap cities.
- "transport": a FULL DAY of getting around the city (day pass or daily cap on public transit).
  Typical range: 700-1000 cents in Europe, 280-570 cents in SE Asia, 525-890 cents in London.
- "festival": a festival day — ticket + food + drinks at the venue.
- "special": a one-off experience (concert, show, special dinner).

REMINDER: All costs are in CENTS. 1 EUR = 100 cents. A bar night costing 40 euros = 4000 cents.
Never output values like 40 or 55 for a bar night — those would be 0.40 or 0.55 in the currency.

SPENDING LEVEL affects both PRICE and QUANTITY:
- "budget": cheapest valid option. More market trips, fewer restaurants, fewer bar nights.
- "balanced": moderate. Mix of market and restaurants, some bar nights.
- "comfortable": nicer venues. More restaurants, fewer markets, cocktail bars.
- "flexible": high-end. Most meals out, premium venues, more experiences.
If the budget cannot support the chosen spending level honestly, set confidence to "low" and
explain in insights. NEVER artificially lower prices below real local costs.

RULES:
- Every activity in selected_activities MUST appear with suggested_quantity >= 1 and typical_cost_cents > 0
- NEVER output typical_cost_cents = 0 or suggested_quantity = 0 for any activity
- Use the reference prices above as guidance — adjust for the specific destination
- ARITHMETIC (mandatory — follow BEFORE writing JSON):
  Step 1: For each activity, line_total = suggested_quantity × typical_cost_cents
  Step 2: total_planned_cents = sum of ALL line_totals
  Step 3: margin_cents = free_budget_cents − total_planned_cents
  Step 4: margin_percent = (margin_cents / free_budget_cents) × 100
  VERIFY: total_planned_cents equals the sum from step 2 (no rounding, no extra costs)
  DO NOT include accommodation, flights, or any cost outside the activities array
- total_planned_cents < free_budget_cents AND margin_percent between 15 and 40
- Each activity needs a "spending_level" field
- Reasoning explains WHY that price for THIS destination at THIS spending level
- 2-3 practical tips about the destination
- Output in the user's language (see "language")
- Costs in CENTS (integer)

Return JSON only:
{
  "plan": {
    "activities": [
      { "type": "bar|market|restaurant|outing|transport|festival|special",
        "spending_level": "budget|balanced|comfortable|flexible",
        "suggested_quantity": N, "typical_cost_cents": N, "reasoning": "..." }
    ],
    "total_planned_cents": N,
    "free_budget_cents": N,
    "margin_cents": N,
    "margin_percent": N
  },
  "context_used": {
    "destination": "...",
    "duration_days": N,
    "currency": "...",
    "spending_level_used": "budget|balanced|comfortable|flexible",
    "user_preferences_summary": "..."
  },
  "insights": ["...", "..."],
  "confidence": "low|medium|medium-high|high"
}`;

// ---------------------------------------------------------------------------
// Test scenarios (5 real destinations)
// ---------------------------------------------------------------------------

const SCENARIOS = [
  {
    name: 'Amsterdam — 8 days, €1200, party-focused',
    analyzeInput: {
      destination: 'Amsterdam, Netherlands',
      start_date: '2026-08-15',
      end_date: '2026-08-22',
      total_budget_cents: 120_000,
      free_budget_cents: 96_000,
      protected_reserve_cents: 24_000,
      currency: 'EUR',
      selected_activities: ['bar', 'market', 'restaurant', 'outing'],
      language: 'pt-BR',
    },
    generateAnswers: {
      spending_style: 'balanced',
      priority_categories: ['bars_nightlife'],
      bar_style: 'Casual, brown cafés e pubs',
      cooking: 'Cozinho metade dos dias, como fora na outra metade',
      nightlife_frequency: '4-5 noites por semana',
      food_preference: 'Mix de comida local e street food',
      outing_interests: 'Museus e passeios de barco',
    },
    expectedRanges: {
      bar: { min: 4000, max: 5500, label: '€40-55/noite (3-5 drinks + snack)' },
      market: { min: 1500, max: 2500, label: '€15-25/ida (1-2 dias de comida)' },
      restaurant: { min: 2500, max: 4000, label: '€25-40/refeição casual' },
      outing: { min: 1500, max: 3000, label: '€15-30/passeio (museu+transporte)' },
    },
  },
  {
    name: 'Bangkok — 21 days, $1500, backpacker',
    analyzeInput: {
      destination: 'Bangkok, Thailand',
      start_date: '2026-11-01',
      end_date: '2026-11-21',
      total_budget_cents: 150_000,
      free_budget_cents: 120_000,
      protected_reserve_cents: 30_000,
      currency: 'USD',
      selected_activities: ['bar', 'market', 'restaurant', 'outing', 'transport'],
      language: 'pt-BR',
    },
    generateAnswers: {
      spending_style: 'budget',
      priority_categories: ['food'],
      bar_style: 'Bares locais e rooftop bars ocasionais',
      cooking: 'Não cozinho, como street food e restaurantes locais',
      nightlife_frequency: '2-3 noites por semana',
      food_preference: 'Comida local thai, street food',
      transport_style: 'BTS/MRT e Grab taxi ocasional',
    },
    expectedRanges: {
      bar: { min: 1400, max: 2800, label: '$14-28/noite (฿500-1000, 3-5 drinks)' },
      market: { min: 850, max: 1700, label: '$8.50-17/ida (฿300-600, compras básicas)' },
      restaurant: { min: 400, max: 1500, label: '$4-15/refeição' },
      outing: { min: 300, max: 1500, label: '$3-15/passeio' },
      transport: { min: 280, max: 570, label: '$2.80-5.70/dia (฿100-200, BTS/MRT)' },
    },
  },
  {
    name: 'Lisboa — 10 days, €600, budget-conscious',
    analyzeInput: {
      destination: 'Lisbon, Portugal',
      start_date: '2026-09-10',
      end_date: '2026-09-19',
      total_budget_cents: 60_000,
      free_budget_cents: 48_000,
      protected_reserve_cents: 12_000,
      currency: 'EUR',
      selected_activities: ['bar', 'market', 'restaurant', 'outing'],
      language: 'pt-BR',
    },
    generateAnswers: {
      spending_style: 'budget',
      priority_categories: ['distribute_equally'],
      bar_style: 'Cerveja em tascas e bares de bairro',
      cooking: 'Cozinho a maioria dos dias',
      nightlife_frequency: '2-3 noites por semana',
      food_preference: 'Tascas locais, prato do dia',
      outing_interests: 'Caminhadas pela cidade, mirantes gratuitos',
    },
    expectedRanges: {
      bar: { min: 2000, max: 3500, label: '€20-35/noite (cerveja €3, 3-5 drinks)' },
      market: { min: 1800, max: 2500, label: '€18-25/ida (compras 1-2 dias)' },
      restaurant: { min: 1000, max: 2000, label: '€10-20/refeição (tasca/prato do dia)' },
      outing: { min: 500, max: 1500, label: '€5-15/passeio (mirantes gratuitos a museus)' },
    },
  },
  {
    name: 'Barcelona — 12 days, €900, cultural',
    analyzeInput: {
      destination: 'Barcelona, Spain',
      start_date: '2026-10-05',
      end_date: '2026-10-16',
      total_budget_cents: 90_000,
      free_budget_cents: 72_000,
      protected_reserve_cents: 18_000,
      currency: 'EUR',
      selected_activities: ['bar', 'market', 'restaurant', 'outing'],
      language: 'pt-BR',
    },
    generateAnswers: {
      spending_style: 'balanced',
      priority_categories: ['tours_attractions', 'food'],
      bar_style: 'Bares de tapas e terraços',
      cooking: 'Cozinho uns 40% dos dias',
      nightlife_frequency: '3 noites por semana',
      food_preference: 'Tapas, mercados, restaurantes casuais',
      outing_interests: 'Sagrada Família, Gaudí, praias',
    },
    expectedRanges: {
      bar: { min: 2500, max: 4000, label: '€25-40/noite (cerveja €3.50-4)' },
      market: { min: 1500, max: 2500, label: '€15-25/ida (compras 1-2 dias)' },
      restaurant: { min: 2200, max: 3500, label: '€22-35/refeição casual' },
      outing: { min: 1200, max: 2500, label: '€12-25/passeio (Sagrada €26)' },
    },
  },
  {
    name: 'London — 5 days, £800, quick city trip',
    analyzeInput: {
      destination: 'London, United Kingdom',
      start_date: '2026-12-20',
      end_date: '2026-12-24',
      total_budget_cents: 80_000,
      free_budget_cents: 64_000,
      protected_reserve_cents: 16_000,
      currency: 'GBP',
      selected_activities: ['bar', 'restaurant', 'outing', 'transport'],
      language: 'pt-BR',
    },
    generateAnswers: {
      spending_style: 'comfortable',
      priority_categories: ['bars_nightlife', 'tours_attractions'],
      bar_style: 'Pubs tradicionais',
      cooking: 'Não cozinho, só como fora',
      nightlife_frequency: '3-4 noites',
      food_preference: 'Pubs, mercados, restaurantes casuais',
      outing_interests: 'Museus gratuitos, West End show, mercados de Natal',
      transport_style: 'Oyster card / contactless',
    },
    expectedRanges: {
      bar: { min: 4000, max: 5500, label: '£40-55/noite (pint £7, 3-5 drinks)' },
      restaurant: { min: 2500, max: 4500, label: '£25-45/refeição' },
      outing: { min: 1500, max: 3500, label: '£15-35/passeio' },
      transport: { min: 525, max: 890, label: '£5.25-8.90/dia (bus cap a Oyster Z1-2)' },
    },
  },
];

// ---------------------------------------------------------------------------
// Groq API caller
// ---------------------------------------------------------------------------

async function callGroq(systemPrompt, userContent, retries = 4) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(GROQ_CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: typeof userContent === 'string' ? userContent : JSON.stringify(userContent) },
          ],
          temperature: 0.3,
          max_tokens: 4096,
          response_format: { type: 'json_object' },
        }),
      });

      if (res.status === 429) {
        if (attempt === retries) throw new Error('Rate limited after all retries');
        const wait = Math.min(Math.pow(2, attempt + 1) * 1000, 30000);
        console.log(`  ⏳ Rate limited, waiting ${wait / 1000}s...`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('Empty response from Groq');

      const usage = data.usage;
      return { parsed: JSON.parse(content), tokens: usage?.total_tokens ?? 0 };
    } catch (err) {
      if (attempt === retries) throw err;
      const wait = Math.pow(2, attempt + 1) * 1000;
      console.log(`  ⚠️  Attempt ${attempt + 1} failed: ${err.message}. Retrying in ${wait / 1000}s...`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

function validateAnalyzeResponse(parsed, scenario) {
  const issues = [];
  const warnings = [];

  if (!parsed.understood) issues.push('Missing "understood" object');
  else {
    if (typeof parsed.understood.summary !== 'string') issues.push('understood.summary is not a string');
    if (typeof parsed.understood.destination_recognized !== 'boolean')
      issues.push('understood.destination_recognized is not a boolean');
    if (!parsed.understood.destination_recognized)
      warnings.push('AI did not recognize the destination');
    if (typeof parsed.understood.destination_details !== 'string')
      issues.push('understood.destination_details is not a string');
  }

  if (!Array.isArray(parsed.questions)) issues.push('Missing "questions" array');
  else {
    const maxQ = scenario.analyzeInput.start_date && scenario.analyzeInput.end_date
      ? (daysBetween(scenario.analyzeInput.start_date, scenario.analyzeInput.end_date) <= 7 ? 5 : 6)
      : 6;

    if (parsed.questions.length > maxQ)
      warnings.push(`Too many questions: ${parsed.questions.length} (max ${maxQ})`);
    if (parsed.questions.length < 2)
      warnings.push(`Too few questions: ${parsed.questions.length}`);

    const hasSpendingStyleQ = parsed.questions.some(q =>
      q.id?.includes('spend') || q.id?.includes('style') || q.id?.includes('estilo') ||
      q.text?.toLowerCase().includes('gastar') || q.text?.toLowerCase().includes('spending') ||
      q.text?.toLowerCase().includes('estilo de viagem') || q.text?.toLowerCase().includes('orçamento')
    );
    if (!hasSpendingStyleQ)
      warnings.push('Missing mandatory spending style question (should be first question)');

    for (const q of parsed.questions) {
      if (!q.id) issues.push('Question missing "id"');
      if (!q.text) issues.push('Question missing "text"');
      if (!q.why) issues.push(`Question "${q.id}" missing "why" field`);
      if (!Array.isArray(q.options) || q.options.length < 2)
        issues.push(`Question "${q.id}" has fewer than 2 options`);
      if (q.allow_custom !== true)
        warnings.push(`Question "${q.id}" should have allow_custom: true`);
    }
  }

  if (!Array.isArray(parsed.already_known)) issues.push('Missing "already_known" array');
  else if (parsed.already_known.length === 0)
    warnings.push('No "already_known" facts about destination');

  return { issues, warnings };
}

function validateGenerateResponse(parsed, scenario) {
  const issues = [];
  const warnings = [];

  if (!parsed.plan) {
    issues.push('Missing "plan" object');
    return { issues, warnings };
  }

  const { plan } = parsed;
  if (!Array.isArray(plan.activities)) {
    issues.push('Missing "plan.activities" array');
    return { issues, warnings };
  }

  const validTypes = ['bar', 'market', 'restaurant', 'outing', 'transport', 'festival', 'special'];
  const validLevels = ['budget', 'balanced', 'comfortable', 'flexible'];
  let computedTotal = 0;

  for (const a of plan.activities) {
    if (!validTypes.includes(a.type))
      warnings.push(`Unknown activity type: "${a.type}"`);
    if (typeof a.suggested_quantity !== 'number' || a.suggested_quantity < 1)
      issues.push(`Activity "${a.type}" has invalid quantity: ${a.suggested_quantity}`);
    if (typeof a.typical_cost_cents !== 'number' || a.typical_cost_cents < 1)
      issues.push(`Activity "${a.type}" has invalid typical_cost_cents: ${a.typical_cost_cents}`);
    if (!a.spending_level || !validLevels.includes(a.spending_level))
      warnings.push(`Activity "${a.type}" missing or invalid spending_level: "${a.spending_level}"`);
    if (!a.reasoning || a.reasoning.length < 10)
      warnings.push(`Activity "${a.type}" has weak reasoning`);

    const expected = scenario.expectedRanges[a.type];
    if (expected) {
      if (a.typical_cost_cents < expected.min)
        warnings.push(`Activity "${a.type}" cost ${a.typical_cost_cents}c is BELOW expected min ${expected.min}c (${expected.label})`);
      if (a.typical_cost_cents > expected.max)
        warnings.push(`Activity "${a.type}" cost ${a.typical_cost_cents}c is ABOVE expected max ${expected.max}c (${expected.label})`);
    }

    computedTotal += (a.suggested_quantity || 0) * (a.typical_cost_cents || 0);
  }

  if (typeof plan.total_planned_cents !== 'number')
    issues.push('Missing plan.total_planned_cents');
  if (typeof plan.free_budget_cents !== 'number')
    issues.push('Missing plan.free_budget_cents');

  const freeBudget = scenario.analyzeInput.free_budget_cents;
  if (plan.total_planned_cents > freeBudget)
    issues.push(`Plan EXCEEDS budget: ${plan.total_planned_cents}c > ${freeBudget}c free budget`);

  const computedMarginPct = ((freeBudget - computedTotal) / freeBudget) * 100;
  if (computedMarginPct < 10)
    warnings.push(`Margin too tight: ${computedMarginPct.toFixed(1)}% (target ≥15%)`);
  if (computedMarginPct > 60)
    warnings.push(`Margin too generous: ${computedMarginPct.toFixed(1)}% (might be underplanning)`);

  const reportedTotal = plan.total_planned_cents;
  if (Math.abs(computedTotal - reportedTotal) > 100)
    issues.push(`Math mismatch: computed total ${computedTotal}c vs reported ${reportedTotal}c (diff: ${Math.abs(computedTotal - reportedTotal)}c = ${((Math.abs(computedTotal - reportedTotal) / computedTotal) * 100).toFixed(1)}%)`);

  if (!Array.isArray(parsed.insights) || parsed.insights.length < 2)
    warnings.push('Expected at least 2 insights');

  if (!parsed.confidence)
    warnings.push('Missing confidence level');

  return { issues, warnings };
}

function daysBetween(a, b) {
  return Math.ceil((new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

function printReport(results) {
  console.log('\n' + '='.repeat(80));
  console.log('  PLAN COPILOT PROMPT TEST REPORT');
  console.log('='.repeat(80));

  let totalPass = 0;
  let totalFail = 0;
  let totalWarn = 0;
  let totalTokens = 0;

  for (const r of results) {
    const analyzeOk = r.analyze.issues.length === 0;
    const generateOk = r.generate.issues.length === 0;
    const pass = analyzeOk && generateOk;

    console.log(`\n${'─'.repeat(72)}`);
    console.log(`  ${pass ? '✅' : '❌'} ${r.scenario}`);
    console.log(`${'─'.repeat(72)}`);

    console.log(`\n  ANALYZE (${r.analyzeTokens} tokens)`);
    if (r.analyze.issues.length)
      r.analyze.issues.forEach(i => console.log(`    ❌ ${i}`));
    if (r.analyze.warnings.length)
      r.analyze.warnings.forEach(w => console.log(`    ⚠️  ${w}`));
    if (!r.analyze.issues.length && !r.analyze.warnings.length)
      console.log('    ✅ All checks passed');

    if (r.analyzeData?.already_known?.length) {
      console.log('    📍 Destination knowledge:');
      r.analyzeData.already_known.slice(0, 3).forEach(f => console.log(`       - ${f}`));
    }
    if (r.analyzeData?.questions?.length) {
      console.log(`    ❓ ${r.analyzeData.questions.length} questions asked:`);
      r.analyzeData.questions.forEach(q => console.log(`       - ${q.text.slice(0, 70)}...`));
    }

    console.log(`\n  GENERATE (${r.generateTokens} tokens)`);
    if (r.generate.issues.length)
      r.generate.issues.forEach(i => console.log(`    ❌ ${i}`));
    if (r.generate.warnings.length)
      r.generate.warnings.forEach(w => console.log(`    ⚠️  ${w}`));
    if (!r.generate.issues.length && !r.generate.warnings.length)
      console.log('    ✅ All checks passed');

    if (r.generateData?.plan?.activities?.length) {
      console.log('    📊 Generated plan:');
      const currency = r.scenarioObj.analyzeInput.currency;
      const sym = currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$';
      for (const a of r.generateData.plan.activities) {
        const cost = (a.typical_cost_cents / 100).toFixed(0);
        const total = ((a.suggested_quantity * a.typical_cost_cents) / 100).toFixed(0);
        const expected = r.scenarioObj.expectedRanges[a.type];
        const inRange = expected
          ? (a.typical_cost_cents >= expected.min && a.typical_cost_cents <= expected.max ? '✅' : '⚠️')
          : '❔';
        console.log(`       ${inRange} ${a.type}: ${a.suggested_quantity}× ${sym}${cost} = ${sym}${total}`);
      }
      const total = (r.generateData.plan.total_planned_cents / 100).toFixed(0);
      const free = (r.generateData.plan.free_budget_cents / 100).toFixed(0);
      const margin = r.generateData.plan.margin_percent;
      console.log(`       TOTAL: ${sym}${total} / ${sym}${free} (margin: ${margin?.toFixed?.(1) ?? '?'}%)`);
    }

    if (r.generateData?.confidence)
      console.log(`    🎯 Confidence: ${r.generateData.confidence}`);

    if (pass) totalPass++;
    else totalFail++;
    totalWarn += r.analyze.warnings.length + r.generate.warnings.length;
    totalTokens += r.analyzeTokens + r.generateTokens;
  }

  let pricesOk = 0;
  let mathOk = 0;
  let apiOk = 0;
  for (const r of results) {
    const noApiError = !r.analyze.issues.some(i => i.includes('API call')) &&
                       !r.generate.issues.some(i => i.includes('API call'));
    if (noApiError) apiOk++;

    const noMathFail = !r.generate.issues.some(i => i.includes('Math mismatch'));
    if (noMathFail && noApiError) mathOk++;

    const noPriceFail = !r.generate.issues.some(i => i.includes('invalid typical_cost') || i.includes('invalid quantity'));
    const noPriceWarn = !r.generate.warnings.some(w => w.includes('BELOW expected') || w.includes('ABOVE expected'));
    if (noPriceFail && noPriceWarn && noApiError) pricesOk++;
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`  SUMMARY`);
  console.log(`  Overall: ${totalPass}/${results.length} fully passed, ${totalFail} had issues, ${totalWarn} warnings`);
  console.log(`  API calls: ${apiOk}/${results.length} completed (rate limit failures: ${results.length - apiOk})`);
  console.log(`  Price accuracy: ${pricesOk}/${apiOk} within expected ranges`);
  console.log(`  Math accuracy: ${mathOk}/${apiOk} correct totals (known LLM limitation → server computes)`);
  console.log(`  Analyze quality: ${results.filter(r => r.analyze.issues.length === 0).length}/${results.length} perfect`);
  console.log(`  TOTAL TOKENS: ${totalTokens.toLocaleString()}`);
  console.log(`${'='.repeat(80)}\n`);
}

// ---------------------------------------------------------------------------
// Mock responses (for --mock mode: validates structure without API calls)
// ---------------------------------------------------------------------------

function mockAnalyzeResponse(scenario) {
  const dest = scenario.analyzeInput.destination;
  const lang = scenario.analyzeInput.language;
  return {
    understood: {
      summary: `Trip to ${dest} for budget planning`,
      destination_recognized: true,
      destination_details: `${dest} is a popular destination with well-documented price ranges.`,
    },
    questions: [
      {
        id: 'q_bar_style', text: 'Qual seu estilo de bar?', why: 'O custo por noite varia muito entre bares locais e baladas.',
        type: 'single_choice',
        options: [
          { id: 'casual', label: 'Casual / pubs locais', emoji: '🍺' },
          { id: 'club', label: 'Baladas / clubs', emoji: '🎶' },
          { id: 'rooftop', label: 'Rooftop bars', emoji: '🌃' },
        ],
        allow_custom: true,
      },
      {
        id: 'q_cooking', text: 'Você vai cozinhar durante a viagem?', why: 'Cozinhar reduz significativamente o custo de alimentação.',
        type: 'single_choice',
        options: [
          { id: 'mostly', label: 'Maioria dos dias', emoji: '🍳' },
          { id: 'half', label: 'Metade dos dias', emoji: '⚖️' },
          { id: 'never', label: 'Nunca, só como fora', emoji: '🍽️' },
        ],
        allow_custom: true,
      },
      {
        id: 'q_nightlife', text: 'Com que frequência pretende sair à noite?', why: 'Bares são geralmente o maior gasto variável em viagens.',
        type: 'single_choice',
        options: [
          { id: 'rarely', label: '1-2 noites por semana', emoji: '🌙' },
          { id: 'moderate', label: '3-4 noites por semana', emoji: '🍻' },
          { id: 'often', label: 'Quase toda noite', emoji: '🎉' },
        ],
        allow_custom: true,
      },
    ],
    already_known: [
      `Beer in ${dest.split(',')[0]} typically costs between local and tourist prices`,
      `Grocery shopping at local supermarkets is significantly cheaper than restaurants`,
    ],
  };
}

function mockGenerateResponse(scenario) {
  const activities = [];
  const ranges = scenario.expectedRanges;
  let total = 0;
  const days = daysBetween(scenario.analyzeInput.start_date, scenario.analyzeInput.end_date);

  for (const [type, range] of Object.entries(ranges)) {
    const midCost = Math.round((range.min + range.max) / 2);
    const freq = type === 'bar' ? 0.4 : type === 'market' ? 0.5 : type === 'restaurant' ? 0.3 : 0.15;
    const qty = Math.max(1, Math.round(days * freq));
    activities.push({
      type,
      suggested_quantity: qty,
      typical_cost_cents: midCost,
      reasoning: `Based on average prices in ${scenario.analyzeInput.destination.split(',')[0]} for a ${type} occasion.`,
    });
    total += qty * midCost;
  }

  const free = scenario.analyzeInput.free_budget_cents;
  if (total > free * 0.85) {
    const scale = (free * 0.75) / total;
    for (const a of activities) {
      a.suggested_quantity = Math.max(1, Math.round(a.suggested_quantity * scale));
    }
    total = activities.reduce((s, a) => s + a.suggested_quantity * a.typical_cost_cents, 0);
  }

  return {
    plan: {
      activities,
      total_planned_cents: total,
      free_budget_cents: free,
      margin_cents: free - total,
      margin_percent: ((free - total) / free) * 100,
    },
    context_used: {
      destination: scenario.analyzeInput.destination,
      duration_days: days,
      currency: scenario.analyzeInput.currency,
      user_preferences_summary: 'Mock preferences based on test answers',
    },
    insights: [
      `Tip 1 for ${scenario.analyzeInput.destination.split(',')[0]}`,
      `Tip 2 for ${scenario.analyzeInput.destination.split(',')[0]}`,
    ],
    confidence: 'medium',
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`🚀 Testing Plan Copilot prompts with 5 real destinations${MOCK_MODE ? ' (MOCK MODE)' : ''}...\n`);

  const results = [];

  for (const scenario of SCENARIOS) {
    console.log(`\n📍 Testing: ${scenario.name}`);

    let analyzeData, analyzeTokens, generateData, generateTokens;

    if (MOCK_MODE) {
      // --- Mock mode: test validation logic without API ---
      console.log('  → Mock analyze...');
      analyzeData = mockAnalyzeResponse(scenario);
      analyzeTokens = 0;
      console.log('  → Mock generate...');
      generateData = mockGenerateResponse(scenario);
      generateTokens = 0;
    } else {
      // --- Step 1: Analyze ---
      console.log('  → Calling analyze...');
      try {
        const analyzeResult = await callGroq(ANALYZE_SYSTEM_PROMPT, scenario.analyzeInput);
        analyzeData = analyzeResult.parsed;
        analyzeTokens = analyzeResult.tokens;
        console.log(`  ← Got response (${analyzeTokens} tokens)`);
      } catch (err) {
        console.log(`  ❌ Analyze FAILED: ${err.message}`);
        results.push({
          scenario: scenario.name, scenarioObj: scenario,
          analyzeData: null, analyzeTokens: 0,
          analyze: { issues: [`API call failed: ${err.message}`], warnings: [] },
          generateData: null, generateTokens: 0,
          generate: { issues: ['Skipped (analyze failed)'], warnings: [] },
        });
        continue;
      }
      await new Promise(r => setTimeout(r, 6000));

      // --- Step 2: Generate ---
      console.log('  → Calling generate...');
      const generateInput = { ...scenario.analyzeInput, user_answers: scenario.generateAnswers };
      try {
        const generateResult = await callGroq(GENERATE_SYSTEM_PROMPT, generateInput);
        generateData = generateResult.parsed;
        generateTokens = generateResult.tokens;
        console.log(`  ← Got response (${generateTokens} tokens)`);
      } catch (err) {
        console.log(`  ❌ Generate FAILED: ${err.message}`);
        results.push({
          scenario: scenario.name, scenarioObj: scenario,
          analyzeData, analyzeTokens,
          analyze: validateAnalyzeResponse(analyzeData, scenario),
          generateData: null, generateTokens: 0,
          generate: { issues: [`API call failed: ${err.message}`], warnings: [] },
        });
        continue;
      }
      await new Promise(r => setTimeout(r, 6000));
    }

    const analyzeValidation = validateAnalyzeResponse(analyzeData, scenario);
    const generateValidation = validateGenerateResponse(generateData, scenario);

    results.push({
      scenario: scenario.name, scenarioObj: scenario,
      analyzeData, analyzeTokens, analyze: analyzeValidation,
      generateData, generateTokens, generate: generateValidation,
    });
  }

  printReport(results);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
