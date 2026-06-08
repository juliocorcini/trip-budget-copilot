---
name: events-marketing-research
description: >-
  Run marketing research and analysis for any app (Events, Streaming, Learn, Community).
  Supports two depth modes: Standard (executive summary) and Technical/Richard-ready (full data + derivation).
  Use when the user asks for: pesquisa de marketing, análise de personas, teste posicionamento,
  simule compradores, conjoint, análise competitiva, pricing sensitivity, risk matrix,
  marketing research, analyze personas, test positioning, run conjoint, buyer simulation,
  funnel analysis, feature prioritization, segment sizing, or any marketing-related analysis.
---

# Marketing Research & Analysis

## Two Output Modes

### Standard Mode (default)
When the user asks casually — executive summary, clean tables, key recommendations.

### Technical / Richard-ready Mode
When the user says "para o Richard", "detalhado", "técnico", "mostre como chegou", "completo", or similar.
This mode MUST include:
- **Raw data tables** with all numbers per cluster/persona
- **Derivation chains**: numbered steps showing Dado → Dado → SE → Impacto → Conclusão
- **Per-cluster breakdowns** with exact percentages and evidence source
- **Methodology section** explaining how the research was designed and why
- **Cross-references** between multiple data sources (conjoint × financial × competitive)
- **Risk matrix** with probability × impact × evidence columns
- **Colored alert boxes** for risks (red), opportunities (green), warnings (yellow), actions (blue), insights (purple)
- **No unsupported conclusions** — every recommendation must trace back to a data point

## Before Starting Any Analysis

1. Read `{App}/brain/marketing-insights.md` for existing research baseline
2. Read `{App}/brain/competitive-landscape.md` for competitor context
3. Read `{App}/brain/pricing-and-plans.md` for commercial structure
4. Read `{App}/brain/events-product-spec.md` (or equivalent) for scope
5. Read `{App}/brain/financial-model.md` for revenue/cost context
6. Check `{App}/brain/research/` for previous analyses to build on

## Available Analysis Frameworks

### 1. Conjoint Simulation
Test feature/price combinations against synthetic buyer personas.
- Define attributes and levels to test
- Run through existing 6 clusters (or define new ones)
- Output: utility scores, preference shares, willingness-to-pay
- When to use: evaluating new features, pricing changes, plan restructuring

### 2. Persona Panel
Run a specific question through each buyer cluster and get differentiated answers.
- Each cluster "responds" based on their known profile, motivations, and dealbreakers
- Output: per-cluster opinion, agreement %, and reasoning
- When to use: validating messaging, testing feature ideas, checking assumptions

### 3. Positioning Test
Test taglines/messaging against competitors and personas.
- Compare proposed messaging with competitor positioning
- Check for dissonance between messaging and actual product capabilities
- Output: fit score per cluster, risk of expectation mismatch
- When to use: before launch, before campaigns, after feature changes

### 4. Pricing Sensitivity
Analyze willingness-to-pay and tier transition friction.
- Map price elasticity per cluster
- Identify jump points where conversion drops
- Output: optimal price points, cannibalization risk, revenue impact
- When to use: pricing changes, new tiers, LTD campaigns

### 5. Competitive Gap Analysis
Map feature gaps vs specific competitors with cluster impact.
- Feature-by-feature comparison with "who cares" mapping
- Output: gap severity by cluster, competitive advantages, vulnerabilities
- When to use: new competitor appears, competitor changes pricing, pre-campaign

### 6. Risk-Opportunity Matrix
Structured assessment with evidence chain.
- Each risk/opportunity has: description, probability, impact, evidence source, mitigation/action
- Output: prioritized matrix with action items
- When to use: pre-launch review, quarterly planning, stakeholder meetings

### 7. Funnel Analysis
Analyze conversion bottlenecks at each stage.
- Map the buyer journey (awareness → consideration → decision → purchase → onboarding)
- Identify where each cluster is most likely to drop off
- Output: per-stage conversion estimates, improvement actions
- When to use: launch planning, optimizing campaigns

### 8. Cannibalization Analysis
Test if new features/plans steal from existing ones.
- Model how a new tier/feature shifts purchase intent between existing options
- Output: revenue shift matrix, net impact
- When to use: adding tiers, changing plan features, bundle considerations

### 9. Segment Sizing
Estimate addressable market size per cluster.
- Use existing user base + campaign potential + competitive market data
- Output: TAM/SAM/SOM per cluster, revenue potential
- When to use: business planning, investor presentations, expansion decisions

### 10. Feature Prioritization (Impact Matrix)
Rank features by cross-cluster impact weighted by market size.
- Each feature scored by impact on each cluster × cluster market weight
- Output: prioritized feature list with ROI reasoning
- When to use: roadmap planning, V2 scoping, deciding what to build next

## Research Output Structure

Every analysis follows this structure:

### For Standard Mode:
1. Research question
2. Key findings (3-5 bullets)
3. Summary table
4. Recommendations
5. Save: md + PDF

### For Technical / Richard-ready Mode:
1. Research question
2. Methodology (design, parameters, why)
3. Raw data tables (all numbers, per cluster)
4. Derivation chains (numbered logic steps)
5. Cross-references with other data sources
6. Alert boxes (risk/opportunity/insight/action)
7. Risk matrix
8. Recommendations with evidence column
9. Impact on brain files
10. Save: md + PDF with full styling (alert boxes, derivation blocks)

## Saving Results

ALL analyses are saved to:
- `{App}/brain/research/YYYY-MM-DD-topic-name.md` — permanent reference
- PDF via `.cursor/tools/doc-generator/` — auto-copied to Windows Downloads

## Existing Research Baseline (Events)

A hybrid synthetic conjoint was run with 120 respondents (10 tasks × 3 options + "would not buy").
6 clusters identified. See `Events/brain/marketing-insights.md` for full baseline.

### 6 Buyer Clusters (Events)

| Cluster | Weight | Tier | Key trait |
|---|---|---|---|
| Creator solo | ~20% | Guest Pass $89 | Price-sensitive, values agenda + replay |
| Community/school | ~25% | Event Board $199 | Recurring events, values agenda + embed |
| Brand/mid project | ~20% | Main Table $299 | Wants branding removal + custom domain |
| GoBrunch-first | ~15% | Any | Buys for GoBrunch integration |
| Small agency | ~10% | Private Room+ | Needs subaccounts (poor V1 fit) |
| Operational org. | ~10% | Exclusive Venue | Needs volume + permissions (poor V1 fit) |

### Key Attribute Weights

| Attribute | Weight |
|---|---|
| Price | 25.6% |
| Agenda + embed | High (est. 18-22%) |
| Replay/materials | Medium-high (est. 12-15%) |
| Branding removal | Medium (est. 10-14%) |
| Custom domain | Medium (est. 8-12%) |
| GoBrunch integration | Medium (est. 8-10%) |
| Active events | Medium-low (est. 5-8%) |

## Proactive Suggestions

When the user is working on marketing decisions, suggest relevant analyses:
- Feature change → "Quer um teste de impacto com as 6 personas?"
- Pricing change → "Quer simulação de como afeta tier mix e revenue?"
- Competitive news → "Quer análise de como muda posicionamento?"
- Pre-meeting Richard → "Quer versão técnica com dados para a reunião?"
- Quarterly review → "Quer uma risk-opportunity matrix atualizada?"
- Roadmap discussion → "Quer um feature prioritization com as personas?"
