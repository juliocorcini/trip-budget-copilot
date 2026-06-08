---
name: events-financial-analysis
description: >-
  Financial modeling, cost simulation, pricing analysis, and margin calculation for the Events project.
  Use when the user asks: calcule custos, simule receita, analise margem, revise pricing,
  calculate costs, simulate revenue, analyze margin, pricing analysis, financial model,
  cost per plan, or break-even analysis.
---

# Events Financial Analysis

## Before Any Financial Work

1. Read `Events/brain/financial-model.md` for the current year-1 model
2. Read `Events/brain/pricing-and-plans.md` for plan prices and limits

## Current Model Baseline

- 151 target LTD sales/year (91 from base + 60 from campaigns)
- Fee structure: 20% platform + 3% processing + 20% refund allowance
- Annual gross revenue: $43,959
- Annual net revenue: $25,057
- Annual costs: $7,350
- Net margin: 71%
- Main Table is the primary revenue lever

## Cost References

| Service | Current cost basis |
|---|---|
| Email (Resend) | Check current Resend pricing; overage varies by volume |
| Storage (DigitalOcean Spaces) | Check current DO Spaces pricing |
| Future email optimization | Amazon SES at ~$0.10/1000 emails |

## Monthly Cost Per Plan (at full usage)

| Plan | Est. cost/month |
|---|---:|
| Free Trial | $1.50 |
| Guest Pass | $3.50 |
| Event Board | $6.90 |
| Main Table | $19.40 |
| Private Room | $32.20 |
| Exclusive Venue | $64.00 |

## Simulation Template

When asked to simulate pricing or revenue changes, use this structure:

### 1. State the Change
What is being changed? (price, limits, new tier, new add-on, cost change)

### 2. Impact on Revenue
- Recalculate tier mix if sales distribution changes
- Apply fee structure (20% platform + 3% processing + 20% refund)
- Show gross and net per tier

### 3. Impact on Costs
- Recalculate monthly cost per plan if limits change
- Factor in email, storage, embed, and infrastructure costs
- Show cost per phase (dev vs maintenance)

### 4. Impact on Margin
- Calculate new net margin percentage
- Compare with current 71% baseline
- Flag if any tier becomes unprofitable at full usage

### 5. Recommendation
- Is the change financially healthy?
- Which plans benefit, which are at risk?
- What controls are needed (add-ons, limits)?

## Key Rules

- LTD is NOT recurring revenue — it creates ongoing obligation for support, maintenance, storage, email
- Year 1 is LTD-heavy; recurring pricing exists but is not the main engine
- Never model LTD as if it were monthly revenue divided by 12
- Exclusive Venue is the most sensitive to extreme usage
- Add-ons are the margin protection mechanism, not tier jumps
