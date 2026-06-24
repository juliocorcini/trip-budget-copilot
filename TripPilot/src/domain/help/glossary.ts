/**
 * DEC-289 (M05) — the tap glossary. A single registry mapping a money concept
 * to a short gloss (i18n) and the help article that documents it in full. The
 * UI (`<InfoDot>`) renders the gloss on tap and deep-links to `/help?a=<id>`.
 *
 * Vocabulary was scattered as inline hints; this is the one place a term is
 * defined, so the same words mean the same thing everywhere. Every entry MUST
 * point at a real `HELP_ARTICLES` id (a unit test guards there are no orphans).
 * The registry is a seed — new money concepts are added here, not re-explained
 * ad hoc in components.
 */
export interface GlossaryEntry {
  /** Stable id; also the i18n fragment: `glossary.<id>.{term,gloss}`. */
  id: string;
  /** Help article that documents this concept (must exist in HELP_ARTICLES). */
  articleId: string;
}

export type GlossaryTermId = 'free_to_spend' | 'protected_reserve' | 'plan_reserve';

export const GLOSSARY: Record<GlossaryTermId, GlossaryEntry> = {
  free_to_spend: { id: 'free_to_spend', articleId: 'funds' },
  protected_reserve: { id: 'protected_reserve', articleId: 'funds' },
  plan_reserve: { id: 'plan_reserve', articleId: 'planner' },
};

export const GLOSSARY_ENTRIES: GlossaryEntry[] = Object.values(GLOSSARY);

export function getGlossaryEntry(id: GlossaryTermId): GlossaryEntry {
  return GLOSSARY[id];
}

export function glossaryTermKey(id: GlossaryTermId): string {
  return `glossary.${id}.term`;
}

export function glossaryGlossKey(id: GlossaryTermId): string {
  return `glossary.${id}.gloss`;
}

/** Deep-link to the help article that documents the concept (opens it expanded). */
export function glossaryHelpRoute(id: GlossaryTermId): string {
  return `/help?a=${GLOSSARY[id].articleId}`;
}
