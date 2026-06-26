/**
 * DEC-228 (deferred half / OD-2) — resolve a pool's user-facing *nature* so the
 * UI can name it by what it actually is, retiring the pre-reform umbrella word
 * "Fundo".
 *
 * A pool is a **Trecho** when it is tied to a phase/leg (`linked_phases`) and a
 * **Pote** when it stands apart from any single phase (`global` — the savings-pot
 * shape from GATE 3 / D7). `generic` is a defensive fallback for a pool whose
 * scope is not one of the known values: the resolver is total and never throws,
 * it simply reads the neutral word ("Reserva").
 *
 * Kept deterministic and scope-driven on purpose (per the OD-2 council): never a
 * blanket "Fundo"→"Trecho". This is a UI-vocabulary resolver ONLY — code
 * identifiers (`BudgetPool`, `pool`, `/funds`, repositories) are unchanged, the
 * same discipline as DEC-228's shipped "Perfis"→"Atividades" rename.
 */
export type PoolNature = 'trecho' | 'pote' | 'generic';

/**
 * Map a pool's `scope` to its nature. Accepts a minimal `{ scope }` shape (and a
 * widened string) so the generic fallback stays reachable and testable.
 */
export function poolNature(pool: { scope: string }): PoolNature {
  if (pool.scope === 'linked_phases') return 'trecho';
  if (pool.scope === 'global') return 'pote';
  return 'generic';
}

/** i18n key fragment for a nature's noun: `funds.nature_<nature>`. */
export function poolNatureLabelKey(nature: PoolNature): string {
  return `funds.nature_${nature}`;
}
