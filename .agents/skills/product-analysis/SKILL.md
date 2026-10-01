---
name: events-product-analysis
description: >-
  Analyze features, prioritize scope, and evaluate product decisions for the Events project.
  Use when the user asks: analise essa feature, o que priorizar, vale adicionar X ao V1,
  analyze feature, should we add X, prioritize, scope analysis, V1 vs V2 decision,
  feature evaluation, or product trade-off.
---

# Events Product Analysis

## Before Analyzing Any Feature

1. Read `Events/brain/events-product-spec.md` for current V1 scope and locked rules
2. Read `Events/brain/decision-log.md` for what has been decided and what is superseded
3. Read `Events/brain/pricing-and-plans.md` for plan limits and feature availability
4. Read `Events/brain/marketing-insights.md` for market-driven priorities

## Analysis Framework

For any feature or scope question, evaluate across these 6 dimensions:

### 1. Market Impact
- Does this feature increase the addressable market?
- Which buyer clusters benefit?
- Does it reduce churn or increase conversion?

### 2. Development Cost
- Estimated effort in the context of a small team (1 dev + AI assistance)
- Does it require new infrastructure or can it reuse existing?
- Does it add testing/maintenance burden?

### 3. Scope Risk
- Does adding this to V1 endanger the 12-week timeline?
- Does it create dependencies on other unfinished work?
- Can it be cleanly separated as V2 without rework?

### 4. Commercial Value
- Does it justify a price increase or new tier differentiation?
- Does it protect margin or create new cost pressure?
- Does it enable upsell to higher plans?

### 5. Competitive Position
- Do key competitors already offer this?
- Is the absence of this a dealbreaker for target clusters?
- Reference: see `Events/brain/competitive-landscape.md`

### 6. Alignment with V1 Vision
- Does it align with "branded event hub" positioning?
- Does it conflict with any locked product rule?
- Does it support the primary audience (creators, communities, schools)?

## Output Template

```
## Feature: [Name]

**Recommendation**: [INCLUDE IN V1 / MOVE TO V2 / REJECT / NEEDS MORE DATA]

| Dimension | Score (1-5) | Notes |
|---|---|---|
| Market impact | | |
| Development cost | | |
| Scope risk | | |
| Commercial value | | |
| Competitive position | | |
| V1 alignment | | |

**Reasoning**: [2-3 sentences]
**Dependencies**: [if any]
**If V2**: [what is needed to add it later cleanly]
```

## Key Constraints to Remember

- The block is closed. Only critical, adjacent changes approved by Julio.
- 12-week timeline with 1 developer
- No admins, subaccounts, or agency features
- Paid events is the top post-V1 priority (higher than white-label expansion)
