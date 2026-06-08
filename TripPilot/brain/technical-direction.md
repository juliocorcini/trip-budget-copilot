# TripPilot — Technical Direction

> Last updated: 2026-06-08

## Stack

*(To be decided — use `/council` to evaluate options)*

### Candidates to evaluate:
- **Frontend**: React/Next.js, SvelteKit, or similar
- **Backend**: Node.js/Express, Next.js API routes, or similar
- **Database**: PostgreSQL (Supabase), SQLite, or similar
- **Auth**: NextAuth, Supabase Auth, Clerk, or similar
- **Hosting**: Vercel, Railway, Fly.io, or similar
- **Styling**: Tailwind CSS, shadcn/ui components

## Architecture Principles

1. Start simple, scale when needed
2. Server-side data fetching where possible
3. Type safety end-to-end (TypeScript)
4. Database schema designed upfront (full schema early, features added progressively)
5. API-first design (even if monorepo initially)

## Development Methodology

- Tier 3 velocity standard (brain + phases + AI = ~3.3× compression)
- Phase-delivery packages with gate checkpoints
- Director-style delegation (Carol plans → specialists implement)
- Milestone-based audit cycles

## Database Guidelines

- Schema designed in Phase 1 with all entities
- Migrations managed via Prisma or equivalent
- Jessica reviews all schema decisions before implementation
- No raw queries in application code — use ORM/query builder

---

*Stack decisions pending. Run `/council` with your preferences to evaluate options.*
