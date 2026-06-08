# TripPilot

Travel budget planning copilot — plan, track, and optimize your trip budgets with confidence.

## Workspace Structure

```
trip-budget-copilot/
├── .cursor/                    # AI orchestration layer
│   ├── techlead.md             # Tech lead playbook (main agent = orchestrator)
│   ├── scope-template.md      # Template for new scoped work
│   ├── agents/                 # 11 specialist subagents
│   │   ├── carol.md           # System planner
│   │   ├── carla.md           # Backend developer
│   │   ├── marcelo.md         # Frontend developer
│   │   ├── jessica.md         # Database specialist
│   │   ├── daniel.md          # OOP/design architect
│   │   ├── denise.md          # Security advisor
│   │   ├── pedro.md           # Debugger
│   │   ├── paula.md           # Use-case diagram architect
│   │   ├── rafael.md          # Class diagram architect
│   │   ├── lucas.md           # Test creator
│   │   └── bruno.md           # Test executor
│   ├── rules/                  # Always-on AI behavior rules
│   ├── skills/                 # Workflow skills (council, phases, design, etc.)
│   ├── tools/                  # Document generators (PDF, DOCX, XLSX)
│   └── docs/                   # Plans, reports, scopes, diagrams
├── .agents/skills/             # 27 UI/UX design quality skills
├── TripPilot/brain/            # Source of truth (product spec, decisions, status)
└── src/                        # Application code (created during implementation)
```

## How It Works

### Planning Phase (current)
1. **Define the product** — Fill `TripPilot/brain/product-spec.md`
2. **Research competitors** — Use `/research` command
3. **Choose tech stack** — Use `/council` for multi-perspective analysis
4. **Design the app** — Use `/design` for wireframes
5. **Break into phases** — Use `/phases` for implementation ordering

### Implementation Phase
1. **Generate phase package** — Use `/deliver` to create self-contained phase folder
2. **Execute** — Tech lead delegates to Carol (plan) → specialists (implement)
3. **Test** — Lucas creates tests, Bruno executes them
4. **Report** — Tech lead writes final report to `.cursor/docs/reports/`

## Available Commands

| Command | Purpose |
|---------|---------|
| `/council` | Multi-perspective analysis (4 experts) |
| `/debate` | Structured pro vs con argument |
| `/review` | Multi-angle code/architecture review |
| `/assess` | Risk + opportunity + cost + timeline |
| `/brainstorm` | Creative ideation (4 thinking styles) |
| `/product` | Feature/scope analysis |
| `/research` | Marketing & competitive research |
| `/finance` | Financial modeling |
| `/design` | Visual design & wireframes |
| `/phases` | Implementation phasing |
| `/deliver` | Generate phase delivery package |
| `/report` | Process developer phase report |
| `/diagrams` | Use case & class diagrams |
| `/doc` | Generate PDF/DOCX/XLSX documents |
| `/brain` | Manage knowledge base |

## Key Principles

- **Brain = Source of Truth** — All product decisions live in `TripPilot/brain/`
- **Tech Lead Never Codes** — Main agent delegates to specialist subagents
- **Carol Plans First** — Before any implementation, Carol produces the plan
- **Tier 3 Velocity** — Structured delivery achieves ~3.3× time compression
- **Gate Checkpoints** — Tests must pass between implementation gates
