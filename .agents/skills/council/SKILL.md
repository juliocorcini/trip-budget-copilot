---

## name: council
description: >-
  Multi-perspective analysis using parallel Codex subagents with different expert roles.
  Supports modes: council (general), debate, review, assess, brainstorm.
  Use when the user asks: /council, /debate, /review, /assess, /brainstorm,
  /conselho, /debata, /revise, /avalie, /ideias,
  consulte o council, debate entre perspectivas, análise multi-ângulo,
  quero múltiplas perspectivas, analise de vários ângulos,
  multiple perspectives, council analysis, multi-angle review, devil's advocate,
  or any request for diverse viewpoints on a decision or topic.

# Council — Multi-Perspective Analysis

## Overview

Council launches **parallel subagents** via the Task tool, each adopting a different expert role.
The main agent then synthesizes all responses into a unified analysis.

**No external AI providers needed.** Everything runs inside Codex using its native Task tool.

---

## Modes and Roles

### `/council` — General Analysis (default)

Launches **4 parallel subagents**:


| Role           | Perspective          | Thinks about...                                                       |
| -------------- | -------------------- | --------------------------------------------------------------------- |
| **Strategist** | Business & long-term | Market position, opportunity cost, strategic alignment, growth impact |
| **Architect**  | Technical depth      | Feasibility, scalability, patterns, technical debt, maintainability   |
| **Critic**     | Devil's advocate     | Weaknesses, risks, edge cases, hidden costs, failure modes            |
| **Advocate**   | User/customer        | User experience, adoption barriers, simplicity, real-world usage      |


### `/debate` — Structured Debate

Launches **3 subagents** sequentially-ish:


| Role          | Perspective                                                             |
| ------------- | ----------------------------------------------------------------------- |
| **Proponent** | Strongest case FOR the proposition                                      |
| **Opponent**  | Strongest case AGAINST the proposition                                  |
| **Judge**     | Evaluates both arguments, identifies strongest points, delivers verdict |


### `/review` — Multi-Angle Review

Launches **4 parallel subagents** (best for code, architecture, or feature review):


| Role                | Focus                                                       |
| ------------------- | ----------------------------------------------------------- |
| **Correctness**     | Logic errors, edge cases, bugs, spec compliance             |
| **Performance**     | Speed, memory, scalability bottlenecks, optimization        |
| **Security**        | Vulnerabilities, data exposure, input validation, auth gaps |
| **Maintainability** | Readability, patterns, coupling, testability, documentation |


### `/assess` — Decision Assessment

Launches **4 parallel subagents**:


| Role                  | Focus                                                  |
| --------------------- | ------------------------------------------------------ |
| **Risk Analyst**      | What can go wrong, probability, severity, mitigations  |
| **Opportunity Scout** | What can go right, upside potential, strategic wins    |
| **Cost Analyst**      | Financial and resource costs, TCO, hidden expenses     |
| **Timeline Realist**  | How long it really takes, dependencies, parallel paths |


### `/brainstorm` — Creative Ideation

Launches **4 parallel subagents**:


| Role           | Thinking Style                                                            |
| -------------- | ------------------------------------------------------------------------- |
| **Visionary**  | Bold, unconventional, 10x ideas, "what if we could..."                    |
| **Analyst**    | Data-driven, evidence-based, benchmarked against what works               |
| **Connector**  | Draws analogies from other industries/domains, cross-pollination          |
| **Simplifier** | Reduces to essence, minimum viable approach, "what's the simplest way..." |


---

## Execution Flow

### Step 1: Determine Mode

Based on the `/` command or natural language, select the mode. Default is `council`.

### Step 2: Gather Context

Before launching subagents, collect relevant context using native tools:

- **Read** key files mentioned by the user
- **Grep/Glob** for related code or documents
- **Read brain files** if the question relates to a project with a brain folder

Compile a **context brief** (max ~500 words) summarizing what each subagent needs to know.

### Step 3: Launch Parallel Subagents

Use the **Task tool** with `subagent_type: "generalPurpose"` and `readonly: true`.

**CRITICAL: Launch ALL subagents in a SINGLE message** (parallel tool calls) for speed.

Each subagent prompt follows this template:

```
You are the [ROLE NAME] in a multi-perspective council analysis.

## Your Role
[Role description and what you focus on]

## Context
[The context brief from Step 2]

## Question
[The user's original question]

## Instructions
- Analyze ONLY from your role's perspective
- Be specific and actionable — no vague generalities
- If you see risks, name them concretely with severity (HIGH/MEDIUM/LOW)
- If you recommend something, explain WHY from your role's angle
- Keep your analysis to 200-400 words
- End with a clear "Bottom Line" in 1-2 sentences

## Output Format
### [Role Name] Perspective

[Your analysis]

**Bottom Line:** [1-2 sentence summary of your position]
```

### Step 4: Synthesize

After all subagents return, create the unified synthesis:

```markdown
## 🏛️ Council Analysis: [Topic]

**Mode:** [council/debate/review/assess/brainstorm]
**Perspectives consulted:** [list of roles]

---

### Consenso (All Agree)
- [Points where all perspectives converge]

### Divergências (Disagree)
- [Point of disagreement] — **[Role A]** argues X, while **[Role B]** argues Y

### Síntese & Recomendação
[Balanced recommendation weighing all perspectives. Be clear about which perspective
carries the most weight for THIS specific question and why.]

### Confiança
- **[HIGH/MEDIUM/LOW]** — [Why this confidence level]

---

<details>
<summary>Full Perspectives (click to expand)</summary>

[Include each subagent's full response here]

</details>
```

---

## Role Prompt Templates

### General Analysis Roles

**Strategist:**

> You are the Strategist. You think about long-term business impact, market positioning, opportunity costs, and strategic alignment. You ask "Does this move us toward our goals? What are we giving up by choosing this? How does this position us in 6-12 months?" You care about competitive advantage and sustainable growth.

**Architect:**

> You are the Architect. You think about technical architecture, system design, scalability, and engineering patterns. You ask "Will this scale? What's the technical debt impact? What patterns fit here? How does this integrate with the existing system?" You care about clean design and long-term technical health.

**Critic:**

> You are the Critic (devil's advocate). Your job is to find weaknesses, risks, and failure modes that others miss. You ask "What could go wrong? What assumptions are we making? What's the worst case? What are the hidden costs?" You are NOT negative for the sake of it — you protect the team from blind spots.

**Advocate:**

> You are the User Advocate. You think about the end-user experience, adoption, simplicity, and real-world usage. You ask "Would a real user understand this? What friction does this create? Is this solving a real pain? What's the learning curve?" You care about making things that people actually want to use.

### Debate Roles

**Proponent:**

> You are the Proponent. Make the STRONGEST possible case FOR the proposition. Use evidence, logic, and concrete examples. Acknowledge weaknesses only to preemptively address them. Your goal is to convince, not to be balanced.

**Opponent:**

> You are the Opponent. Make the STRONGEST possible case AGAINST the proposition. Use evidence, logic, and concrete examples. Acknowledge strengths only to explain why they're insufficient. Your goal is to expose flaws, not to be balanced.

**Judge:**

> You are the Judge. You've heard both sides. Evaluate the strength of each argument point by point. Identify which side made stronger arguments and where each side was weakest. Deliver a clear verdict with reasoning. You ARE balanced — but you MUST pick a side or explain why neither position is clearly superior.

### Review Roles

**Correctness:**

> You are reviewing for Correctness. Look for logic errors, edge cases, bugs, off-by-one errors, null handling, spec violations, and incorrect assumptions. Be specific — point to exact issues with line references when possible.

**Performance:**

> You are reviewing for Performance. Look for scalability bottlenecks, N+1 queries, unnecessary allocations, missing caches, slow algorithms, and resource leaks. Estimate impact where possible (O(n) vs O(n²), etc.).

**Security:**

> You are reviewing for Security. Look for injection points, auth gaps, data exposure, missing validation, CSRF/XSS vectors, secrets in code, and insecure defaults. Rate each finding by severity.

**Maintainability:**

> You are reviewing for Maintainability. Look for readability issues, unclear naming, tight coupling, missing abstractions, untestable code, and poor documentation. Consider "Would a new developer understand this in 6 months?"

### Assessment Roles

**Risk Analyst:**

> You are the Risk Analyst. Identify every meaningful risk — technical, business, timeline, resource, market, legal. Rate each: probability (HIGH/MEDIUM/LOW) × impact (HIGH/MEDIUM/LOW). Propose mitigations for the top risks.

**Opportunity Scout:**

> You are the Opportunity Scout. Find the upside — strategic wins, competitive advantages, synergies, market timing, talent growth, platform effects. Rate each opportunity by potential impact and effort required.

**Cost Analyst:**

> You are the Cost Analyst. Calculate total cost of ownership — development, infrastructure, maintenance, opportunity cost, hidden expenses, scaling costs. Compare against alternatives when possible. Be specific with numbers.

**Timeline Realist:**

> You are the Timeline Realist. Estimate realistic timelines including buffer for unknowns. Identify dependencies, critical path, parallel work, and what blocks what. Flag where estimates are likely optimistic. Consider team capacity.

### Brainstorm Roles

**Visionary:**

> You are the Visionary. Think big, unconventional, 10x. Ignore current constraints for a moment — what would the ideal solution look like? What if we had unlimited resources? Then work backward to find achievable versions of bold ideas.

**Analyst:**

> You are the Analyst. Ground the brainstorm in data and evidence. What do benchmarks show? What have others tried? What worked and what didn't? Propose ideas backed by evidence or clear reasoning.

**Connector:**

> You are the Connector. Draw analogies from OTHER industries and domains. How does Spotify solve this? What about gaming? Healthcare? Finance? Cross-pollinate ideas from unexpected places.

**Simplifier:**

> You are the Simplifier. What's the minimum viable version? Strip away complexity. What's the 20% effort that gets 80% of the value? Challenge every feature and ask "Do we really need this?"

---

## Configuration

### Subagent Count

- Default: 4 perspectives (varies by mode)
- If the user asks for a "quick" council: reduce to 2 (Architect + Critic)
- If the user asks for a "deep" council: add 1-2 custom roles relevant to the topic

### Custom Roles

The user can request custom perspectives. Example:

```
/council -roles:legal,marketing,developer should we add GDPR consent flow?
```

Parse the `-roles:` flag and create custom prompts for each named role, adapting the base template.

### Language

- Subagent prompts are always in **English** (better reasoning)
- Final synthesis follows the user's language (Portuguese if asked in Portuguese)
- The `<details>` section keeps original English responses

---

## Limitations

- Each subagent is independent — they don't see each other's responses
- The synthesis depends on the main agent's ability to reconcile perspectives
- For very technical questions, Architect and Correctness roles perform best
- For business questions, Strategist and Risk Analyst perform best
- Subagent quality depends on context quality — gather good context in Step 2

---

## Quick Reference


| Want to...                   | Command                                  |
| ---------------------------- | ---------------------------------------- |
| Get multiple expert opinions | `/council [question]`                    |
| Debate pros vs cons          | `/debate [proposition]`                  |
| Review code/architecture     | `/review [what to review]`               |
| Assess a decision            | `/assess [decision to evaluate]`         |
| Generate creative ideas      | `/brainstorm [topic]`                    |
| Quick 2-perspective check    | `/council quick: [question]`             |
| Custom expert panel          | `/council -roles:role1,role2 [question]` |


