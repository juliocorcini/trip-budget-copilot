---
name: events-research-organizer
description: >-
  Organize research outputs, update the Events brain knowledge base, and maintain decision records.
  Use when the user asks: organize essa pesquisa, salve isso no brain, atualize as decisoes,
  organize research, save to brain, update decisions, update project status, registrar decisao,
  atualizar status, or maintain knowledge base.
---

# Events Research Organizer

## Core Responsibility

Keep the Events brain (`Events/brain/`) accurate, current, and well-organized. This includes saving new research, updating decisions, and maintaining project status.

## When Saving New Research

1. Create a new file in `Events/brain/research/` with format: `YYYY-MM-DD-topic-name.md`
2. Use this structure for the research file:

```markdown
# [Research Topic]

> Date: YYYY-MM-DD
> Methodology: [conjoint / persona panel / competitive analysis / etc.]
> Scope: [what was analyzed]

## Key Findings
- [Finding 1]
- [Finding 2]

## Data / Tables
[Include relevant data]

## Recommendations
[Actionable recommendations]

## Decisions Made (if any)
- [Decision and status]

## Impact on Brain Files
- [Which brain files were updated as a result]
```

3. After saving research, update relevant brain files:
   - If findings change positioning → update `marketing-insights.md`
   - If findings affect pricing → update `pricing-and-plans.md`
   - If findings affect product scope → update `events-product-spec.md`
   - If findings affect competitive view → update `competitive-landscape.md`

## When Updating Decisions

1. Open `Events/brain/decision-log.md`
2. If a decision is being replaced:
   - Mark the old one as `[SUPERSEDED]` with note
   - Add the new decision with `[APPROVED]` or `[PENDING]`, who decided, and date
3. If a new decision is being added:
   - Add it in the appropriate section (Product / Commercial / Strategic / Technical)
   - Include who decided and the reasoning
   - If the decision came from a meeting, include `Source: MTG-YYYY-MM-DD`

## When Updating Project Status

1. Open `Events/brain/project-status.md`
2. Mark completed tasks with `[x]`
3. Add any new tasks that emerged
4. Update the "Open Decisions" section if anything changed
5. Update the "Next Immediate Steps" section
6. Update the `> Last updated` date
7. If the task was from a meeting, also mark it as `[x]` in `Events/brain/meetings-log.md`
8. New action items should include: `@assignee due:YYYY-MM-DD (from MTG-YYYY-MM-DD)` when from a meeting

## When Updating Any Brain File

- Always update the `> Last updated: YYYY-MM-DD` line
- Keep the file under 200 lines
- Maintain facts-only style (no conversation or narrative)
- Use cross-references: `See [filename.md](filename.md)`
- Follow the decision status format: `[APPROVED]`, `[PENDING]`, `[SUPERSEDED]`

## Truth Policy Reminder

When sources conflict, this is the priority:
1. Latest explicit clarifications from Julio in conversation
2. Brain knowledge files (this folder)
3. brain/sources/events_ai_brain_v2.json
4. Older sources (mainResearch.md, marketingStudy.md) for context only
