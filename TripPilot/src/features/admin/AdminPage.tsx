import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AdminAuthError,
  deleteInstall,
  fetchAiUsage,
  fetchErrors,
  fetchGhostSignals,
  fetchGovernance,
  fetchInstallDetail,
  fetchInstallErrors,
  fetchInstalls,
  fetchOverview,
  type AdminAiUsageResult,
  type AdminError,
  type AdminErrorsResult,
  type AdminGhostSignal,
  type AdminGhostSignalsResult,
  type AdminGovernance,
  type AdminInstall,
  type AdminInstallDetail,
  type AdminInstallError,
  type AdminOverview,
} from '@/utils/admin-api';
import { usagePct, projectActiveUserCapacity } from '@/domain/admin';
import { safeLocalStorage } from '@/utils/safe-storage';

/**
 * DEC-248 — owner-only usage dashboard (`/admin`). Hidden route, gated by the
 * Worker ADMIN_TOKEN. Shows WHO uses TripPilot (names + per-user history) and HOW
 * (non-monetary feature counts) — never any value or transaction content (the
 * Worker never stores those). UI copy is Portuguese on purpose: this is Julio's
 * internal panel, not a shipped product surface (code stays English).
 */

const TOKEN_KEY = 'trippilot.admin.token';

const COUNTER_LABELS: Record<string, string> = {
  trips: 'Viagens',
  expenses: 'Gastos',
  outings: 'Saídas',
  splits: 'Divisões',
  settlements: 'Acertos',
  plannedPurchases: 'Compras planejadas',
  wallets: 'Carteiras',
  participants: 'Pessoas',
  connections: 'Conexões',
  aiEntries: 'Ações por IA',
  receiptScans: 'Notas lidas',
  crashes: 'Erros',
};

const FLAG_LABELS: Record<string, string> = {
  usesAI: 'Usa IA',
  usesReceiptOcr: 'Lê notas',
  usesSplit: 'Divide contas',
  usesWallets: 'Usa carteiras',
  usesLocation: 'Usa localização',
  usesAppLock: 'Trava do app',
  isNative: 'App nativo',
};

// DEC-251 (Onda B) — AI function labels for the server-authoritative token ledger.
const AI_FN_LABELS: Record<string, string> = {
  assistant: 'Assistente (texto)',
  ocr: 'Leitura de nota',
  transcribe: 'Transcrição (voz)',
};

/** Compact token formatting (1.2k, 3.4M) — token counts dwarf the other KPIs. */
function compactNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
}

function relativeTime(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 0) return 'agora';
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min} min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h atrás`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} d atrás`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} ${mo > 1 ? 'meses' : 'mês'} atrás`;
  const y = Math.floor(mo / 12);
  return `${y} ${y > 1 ? 'anos' : 'ano'} atrás`;
}

function fullDate(ms: number): string {
  return new Date(ms).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function Kpi({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="bg-surface-high rounded-xl p-4 flex flex-col gap-1">
      <span className="text-2xl font-bold text-on-surface tabular-nums">{value.toLocaleString('pt-BR')}</span>
      <span className="text-xs text-on-surface-dim">{label}</span>
      {hint ? <span className="text-[10px] text-on-surface-faint">{hint}</span> : null}
    </div>
  );
}

function Bar({ label, value, max, suffix }: { label: string; value: number; max: number; suffix?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-on-surface-dim">{label}</span>
        <span className="text-on-surface font-semibold tabular-nums">
          {value.toLocaleString('pt-BR')}
          {suffix ?? ''}
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface overflow-hidden">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-surface-container rounded-2xl p-4 flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-on-surface">{title}</h2>
      {children}
    </section>
  );
}

function TokenGate({ onSubmit, error }: { onSubmit: (token: string) => void; error: string | null }) {
  const [value, setValue] = useState('');
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface px-6">
      <form
        className="w-full max-w-sm bg-surface-container rounded-2xl p-6 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (value.trim()) onSubmit(value.trim());
        }}
      >
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-bold text-on-surface">Painel de Administração</h1>
          <p className="text-xs text-on-surface-dim">Acesso restrito. Informe o token de administrador.</p>
        </div>
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="ADMIN_TOKEN"
          autoFocus
          className="bg-surface-high text-on-surface text-sm rounded-lg px-3 py-2 outline-none w-full"
        />
        {error ? <p className="text-xs text-error">{error}</p> : null}
        <button
          type="submit"
          className="btn-press px-4 py-3 rounded-xl bg-primary text-on-surface font-semibold text-sm"
        >
          Entrar
        </button>
      </form>
    </div>
  );
}

export function AdminPage() {
  const [token, setToken] = useState<string | null>(() => safeLocalStorage.get(TOKEN_KEY));
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [installs, setInstalls] = useState<AdminInstall[]>([]);
  const [aiUsage, setAiUsage] = useState<AdminAiUsageResult | null>(null);
  const [governance, setGovernance] = useState<AdminGovernance | null>(null);
  const [errors, setErrors] = useState<AdminErrorsResult | null>(null);
  const [ghosts, setGhosts] = useState<AdminGhostSignalsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // DEC-254: the row a click opened — shows EVERY field telemetry holds for it.
  const [selected, setSelected] = useState<AdminInstall | null>(null);

  const load = useCallback(async (activeToken: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const [ov, list, ai, gov, errs, gs] = await Promise.all([
        fetchOverview(activeToken),
        fetchInstalls(activeToken, 500),
        fetchAiUsage(activeToken, 30),
        fetchGovernance(activeToken),
        fetchErrors(activeToken, 100),
        fetchGhostSignals(activeToken),
      ]);
      setOverview(ov);
      setInstalls(list.installs);
      setAiUsage(ai);
      setGovernance(gov);
      setErrors(errs);
      setGhosts(gs);
    } catch (err) {
      if (err instanceof AdminAuthError) {
        safeLocalStorage.remove(TOKEN_KEY);
        setToken(null);
        setAuthError('Token inválido. Tente novamente.');
      } else {
        setLoadError('Não foi possível carregar os dados. Tente atualizar.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) void load(token);
  }, [token, load]);

  const handleSubmitToken = (next: string) => {
    safeLocalStorage.set(TOKEN_KEY, next);
    setAuthError(null);
    setToken(next);
  };

  const handleLogout = () => {
    safeLocalStorage.remove(TOKEN_KEY);
    setToken(null);
    setOverview(null);
    setInstalls([]);
    setAiUsage(null);
    setGovernance(null);
    setErrors(null);
    setGhosts(null);
  };

  const handleDelete = async (install: AdminInstall) => {
    if (!token) return;
    const name = install.displayName ?? install.installId.slice(0, 8);
    if (!window.confirm(`Remover "${name}" do painel? Os dados de uso desse dispositivo serão apagados.`)) {
      return;
    }
    setDeletingId(install.installId);
    try {
      await deleteInstall(token, install.installId);
      await load(token);
    } catch {
      setLoadError('Falha ao remover. Tente novamente.');
    } finally {
      setDeletingId(null);
    }
  };

  const maxCounter = useMemo(() => {
    if (!overview) return 0;
    return Math.max(1, ...Object.values(overview.counters));
  }, [overview]);

  if (!token) {
    return <TokenGate onSubmit={handleSubmitToken} error={authError} />;
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <div className="max-w-3xl mx-auto px-4 py-5 flex flex-col gap-4">
        <header className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <h1 className="text-lg font-bold">Painel de Administração</h1>
            {overview ? (
              <span className="text-[11px] text-on-surface-faint">
                Atualizado {relativeTime(overview.generatedAt)}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => token && void load(token)}
              disabled={loading}
              className="btn-press text-xs px-3 py-2 rounded-lg bg-surface-high text-on-surface font-medium disabled:opacity-50"
            >
              {loading ? 'Atualizando…' : 'Atualizar'}
            </button>
            <button
              onClick={handleLogout}
              className="btn-press text-xs px-3 py-2 rounded-lg bg-surface-high text-on-surface-dim font-medium"
            >
              Sair
            </button>
          </div>
        </header>

        {loadError ? (
          <p className="text-xs text-error bg-surface-container rounded-xl px-4 py-3">{loadError}</p>
        ) : null}

        {!overview && loading ? (
          <p className="text-sm text-on-surface-dim py-10 text-center">Carregando…</p>
        ) : null}

        {overview ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <Kpi label="Usuários (total)" value={overview.total} hint="desde sempre" />
              <Kpi label="Ativos hoje" value={overview.dau} />
              <Kpi label="Ativos 7 dias" value={overview.wau} />
              <Kpi label="Ativos 30 dias" value={overview.mau} />
              <Kpi label="Novos (7 dias)" value={overview.new7d} />
            </div>

            <Section title="Uso por funcionalidade (soma de todos)">
              <div className="flex flex-col gap-2.5">
                {Object.entries(overview.counters)
                  .sort((a, b) => b[1] - a[1])
                  .map(([key, value]) => (
                    <Bar
                      key={key}
                      label={COUNTER_LABELS[key] ?? key}
                      value={value}
                      max={maxCounter}
                    />
                  ))}
              </div>
            </Section>

            <Section title="Adoção (quantos usuários usam)">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                {Object.entries(overview.flags)
                  .sort((a, b) => b[1] - a[1])
                  .map(([key, value]) => (
                    <Bar
                      key={key}
                      label={FLAG_LABELS[key] ?? key}
                      value={value}
                      max={Math.max(1, overview.total)}
                      suffix={overview.total > 0 ? ` (${Math.round((value / overview.total) * 100)}%)` : ''}
                    />
                  ))}
              </div>
            </Section>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Distribution title="Plataformas" items={overview.platforms} />
              <Distribution title="Versões" items={overview.versions} />
              <Distribution title="Países" items={overview.countries} />
            </div>

            {governance ? <GovernanceSection gov={governance} /> : null}

            {aiUsage ? <AiUsageSection usage={aiUsage} /> : null}

            <Section title={`Usuários (${installs.length})`}>
              {installs.length === 0 ? (
                <p className="text-xs text-on-surface-dim">Nenhum usuário registrado ainda.</p>
              ) : (
                <div className="overflow-x-auto -mx-1">
                  <p className="text-[11px] text-on-surface-faint px-1 pb-2">Toque em um usuário para ver tudo.</p>
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-on-surface-faint border-b border-surface-high">
                        <th className="py-2 px-1 font-medium">Nome</th>
                        <th className="py-2 px-1 font-medium">Última vez</th>
                        <th className="py-2 px-1 font-medium text-right">Dias</th>
                        <th className="py-2 px-1 font-medium">Versão</th>
                        <th className="py-2 px-1 font-medium">Plat.</th>
                        <th className="py-2 px-1 font-medium">País</th>
                        <th className="py-2 px-1 font-medium text-right">Viag.</th>
                        <th className="py-2 px-1 font-medium text-right">Gastos</th>
                        <th className="py-2 px-1 font-medium text-right">Divis.</th>
                        <th className="py-2 px-1 font-medium text-right">IA</th>
                        <th className="py-2 px-1 font-medium text-right">Tokens</th>
                        <th className="py-2 px-1 font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {installs.map((it) => (
                        <tr
                          key={it.installId}
                          onClick={() => setSelected(it)}
                          className="border-b border-surface-high cursor-pointer hover:bg-surface-high/40"
                        >
                          <td className="py-2 px-1">
                            <span className="text-on-surface font-medium">
                              {it.displayName ?? '—'}
                            </span>
                          </td>
                          <td className="py-2 px-1 text-on-surface-dim" title={fullDate(it.lastSeen)}>
                            {relativeTime(it.lastSeen)}
                          </td>
                          <td className="py-2 px-1 text-right tabular-nums text-on-surface-dim">{it.activeDays}</td>
                          <td className="py-2 px-1 text-on-surface-dim">{it.appVersion ?? '—'}</td>
                          <td className="py-2 px-1 text-on-surface-dim">{it.platform ?? '—'}</td>
                          <td className="py-2 px-1 text-on-surface-dim">{it.country ?? '—'}</td>
                          <td className="py-2 px-1 text-right tabular-nums">{it.counters.trips ?? 0}</td>
                          <td className="py-2 px-1 text-right tabular-nums">{it.counters.expenses ?? 0}</td>
                          <td className="py-2 px-1 text-right tabular-nums">{it.counters.splits ?? 0}</td>
                          <td className="py-2 px-1 text-right tabular-nums">{it.counters.aiEntries ?? 0}</td>
                          <td
                            className="py-2 px-1 text-right tabular-nums text-on-surface-dim"
                            title={`${(it.aiTokens ?? 0).toLocaleString('pt-BR')} tokens · ${(it.aiCalls ?? 0).toLocaleString('pt-BR')} chamadas`}
                          >
                            {it.aiTokens ? compactNumber(it.aiTokens) : '—'}
                          </td>
                          <td className="py-2 px-1 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleDelete(it);
                              }}
                              disabled={deletingId === it.installId}
                              className="btn-press text-[11px] px-2 py-1 rounded-md bg-surface-high text-danger font-medium disabled:opacity-50"
                              aria-label={`Remover ${it.displayName ?? 'usuário'}`}
                            >
                              {deletingId === it.installId ? '…' : 'Remover'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            {errors ? <ErrorsSection result={errors} /> : null}

            {ghosts && ghosts.total > 0 ? <GhostSignalsSection result={ghosts} /> : null}

            <p className="text-[10px] text-on-surface-faint text-center pb-6">
              Dados anônimos de uso. Nunca capturamos valores nem o conteúdo dos gastos.
            </p>
          </>
        ) : null}
      </div>
      {selected ? <InstallDetail install={selected} token={token} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

/** DEC-254: full read-only dump of everything telemetry holds for one install.
 *  FB-17/FB-21: on open it ALSO fetches the per-function AI breakdown and the
 *  errors this install hit (both anonymous, no values) for real support/debug. */
function InstallDetail({
  install,
  token,
  onClose,
}: {
  install: AdminInstall;
  token: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<AdminInstallDetail | null>(null);
  const [installErrors, setInstallErrors] = useState<AdminInstallError[] | null>(null);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [d, e] = await Promise.all([
          fetchInstallDetail(token, install.installId),
          fetchInstallErrors(token, install.installId),
        ]);
        if (!alive) return;
        setDetail(d);
        setInstallErrors(e.errors);
      } catch {
        /* best-effort: the modal still shows the row data we already have */
      }
    })();
    return () => {
      alive = false;
    };
  }, [token, install.installId]);

  const meta: { label: string; value: React.ReactNode }[] = [
    { label: 'Plataforma', value: install.platform ?? '—' },
    { label: 'Navegador', value: install.browser ?? '—' }, // FB-21
    { label: 'Versão', value: install.appVersion ?? '—' },
    { label: 'Idioma', value: install.locale ?? '—' },
    { label: 'País', value: install.country ?? '—' },
    { label: 'Dias ativos', value: install.activeDays.toLocaleString('pt-BR') },
    // DEC-251 (Onda B) — server-authoritative AI spend (real Groq token count).
    {
      label: 'Tokens de IA',
      value: `${(install.aiTokens ?? 0).toLocaleString('pt-BR')} · ${(install.aiCalls ?? 0).toLocaleString('pt-BR')} chamadas`,
    },
    { label: 'Primeira vez', value: fullDate(install.firstSeen) },
    { label: 'Última vez', value: `${fullDate(install.lastSeen)} · ${relativeTime(install.lastSeen)}` },
    { label: 'ID do dispositivo', value: install.installId },
  ];
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-lg lg:max-w-3xl max-h-[88vh] overflow-y-auto bg-surface-container rounded-2xl p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <h2 className="text-lg font-bold text-on-surface truncate">{install.displayName ?? '—'}</h2>
            <span className="text-[10px] text-on-surface-faint">Detalhe do usuário</span>
          </div>
          <button
            onClick={onClose}
            className="btn-press text-xs px-3 py-2 rounded-lg bg-surface-high text-on-surface-dim font-medium shrink-0"
          >
            Fechar
          </button>
        </div>

        {/* FB-22: on desktop, distribute the info blocks into two columns so the
            wider modal is legible instead of one tall single column. */}
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:items-start">
        <div className="bg-surface rounded-xl px-3 py-1">
          {meta.map(({ label, value }) => (
            <div
              key={label}
              className="flex items-baseline justify-between gap-3 py-1.5 border-b border-surface-high/60 last:border-0"
            >
              <span className="text-xs text-on-surface-dim shrink-0">{label}</span>
              <span className="text-xs text-on-surface font-medium text-right break-all">{value}</span>
            </div>
          ))}
        </div>

        <div>
          <h3 className="text-xs font-semibold text-on-surface-dim mb-2">Uso por funcionalidade</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {Object.entries(install.counters)
              .sort((a, b) => b[1] - a[1])
              .map(([key, value]) => (
                <div key={key} className="flex items-baseline justify-between gap-2">
                  <span className="text-xs text-on-surface-dim truncate">{COUNTER_LABELS[key] ?? key}</span>
                  <span className="text-xs text-on-surface font-semibold tabular-nums">
                    {value.toLocaleString('pt-BR')}
                  </span>
                </div>
              ))}
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-on-surface-dim mb-2">Adoção</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(install.flags).map(([key, on]) => (
              <span
                key={key}
                className={`text-[11px] px-2 py-1 rounded-full font-medium ${
                  on ? 'bg-primary/15 text-primary' : 'bg-surface-high text-on-surface-faint line-through'
                }`}
              >
                {FLAG_LABELS[key] ?? key}
              </span>
            ))}
          </div>
        </div>
        </div>

        {/* FB-17 — per-function AI spend for THIS install (not just the total). */}
        <div>
          <h3 className="text-xs font-semibold text-on-surface-dim mb-2">IA por função</h3>
          {detail === null ? (
            <p className="text-xs text-on-surface-faint">Carregando…</p>
          ) : detail.byFn.length === 0 ? (
            <p className="text-xs text-on-surface-faint">Sem uso de IA registrado.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {detail.byFn.map((f) => (
                <div key={f.fn} className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="text-on-surface-dim">{AI_FN_LABELS[f.fn] ?? f.fn}</span>
                  <span className="text-on-surface font-semibold tabular-nums">
                    {f.tokens.toLocaleString('pt-BR')} tok · {f.runs.toLocaleString('pt-BR')}×
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FB-21 — the (deduped, scrubbed) errors this install hit. */}
        <div>
          <h3 className="text-xs font-semibold text-on-surface-dim mb-2">
            Erros deste usuário{installErrors ? ` (${installErrors.length})` : ''}
          </h3>
          {installErrors === null ? (
            <p className="text-xs text-on-surface-faint">Carregando…</p>
          ) : installErrors.length === 0 ? (
            <p className="text-xs text-on-surface-faint">Nenhum erro registrado. 🎉</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {installErrors.map((e) => (
                <li key={e.hash} className="bg-surface rounded-xl px-3 py-2 flex flex-col gap-1">
                  <p className="text-xs text-on-surface font-medium break-words">{e.message}</p>
                  <div className="flex flex-wrap items-center gap-x-3 text-[10px] text-on-surface-faint">
                    <span>{e.count.toLocaleString('pt-BR')}×</span>
                    <span title={fullDate(e.lastSeen)}>{relativeTime(e.lastSeen)}</span>
                    {e.appVersion ? <span>v{e.appVersion}</span> : null}
                    {e.platform ? <span>{e.platform}</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-[10px] text-on-surface-faint text-center">
          Dados anônimos de uso. Nunca capturamos valores nem o conteúdo dos gastos.
        </p>
      </div>
    </div>
  );
}

/**
 * FB-18 (DEC-273) — Groq free-tier governance. Server-authoritative usage today
 * + this month, "% of the REAL daily request cap" per function, and an honest
 * capacity projection ("with today's per-user usage, ~N active AI users fit
 * before the first ceiling"). All numbers are measured/verified — never invented.
 */
function GovernanceSection({ gov }: { gov: AdminGovernance }) {
  const projection = projectActiveUserCapacity(gov.byFnToday, gov.limits, gov.activeToday);
  const fnRows = Object.entries(gov.limits).map(([fn, limit]) => {
    const used = gov.byFnToday.find((f) => f.fn === fn)?.runs ?? 0;
    return { fn, limit, used, pct: usagePct(used, limit.rpd) };
  });
  return (
    <Section title="IA — governança Groq (free tier)">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi label="Tokens hoje" value={gov.todayTokens} hint={compactNumber(gov.todayTokens)} />
        <Kpi label="Chamadas hoje" value={gov.todayRuns} />
        <Kpi label="Tokens no mês" value={gov.monthTokens} hint={compactNumber(gov.monthTokens)} />
        <Kpi label="Ativos com IA hoje" value={gov.activeToday} />
      </div>

      <div className="flex flex-col gap-2.5">
        <h3 className="text-[11px] font-semibold text-on-surface-faint uppercase tracking-wide">
          % do limite diário (RPD) — hoje
        </h3>
        {fnRows.map(({ fn, limit, used, pct }) => (
          <div key={fn} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-on-surface-dim">{AI_FN_LABELS[fn] ?? fn}</span>
              <span className="text-on-surface font-semibold tabular-nums">
                {used.toLocaleString('pt-BR')} / {limit.rpd.toLocaleString('pt-BR')} · {Math.round(pct)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, background: pct >= 90 ? 'var(--error)' : pct >= 60 ? 'var(--warning)' : 'var(--primary)' }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-surface rounded-xl px-3 py-2.5 text-xs text-on-surface-dim">
        {projection ? (
          <>
            <span className="text-on-surface font-semibold">
              ~{projection.capacity.toLocaleString('pt-BR')} usuários ativos
            </span>{' '}
            cabem com a média de uso de hoje antes do 1º teto (
            {AI_FN_LABELS[projection.fn] ?? projection.fn}). Projeção a partir do uso real medido.
          </>
        ) : (
          'Sem uso medido hoje ainda — a projeção aparece quando houver atividade de IA.'
        )}
      </div>
    </Section>
  );
}

/**
 * DEC-251 (Onda B) — server-authoritative AI token panel: grand totals, a split
 * by function, and the heaviest installs. Tokens come from Groq's response so
 * the client can never under-report; this is the real cost signal.
 */
function AiUsageSection({ usage }: { usage: AdminAiUsageResult }) {
  const maxFnTokens = Math.max(1, ...usage.byFn.map((f) => f.tokens));
  return (
    <Section title="IA — tokens & chamadas (servidor, 30 dias)">
      <div className="grid grid-cols-2 gap-3">
        <Kpi label="Tokens (total)" value={usage.totals.tokens} hint={compactNumber(usage.totals.tokens)} />
        <Kpi label="Chamadas de IA" value={usage.totals.runs} />
      </div>

      {usage.byFn.length > 0 ? (
        <div className="flex flex-col gap-2.5">
          {usage.byFn.map((f) => (
            <Bar
              key={f.fn}
              label={`${AI_FN_LABELS[f.fn] ?? f.fn} · ${f.runs.toLocaleString('pt-BR')}×`}
              value={f.tokens}
              max={maxFnTokens}
              suffix=" tok"
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-on-surface-faint">Nenhum uso de IA registrado ainda.</p>
      )}

      {usage.topUsers.length > 0 ? (
        <div className="flex flex-col gap-1.5 pt-1">
          <h3 className="text-[11px] font-semibold text-on-surface-faint uppercase tracking-wide">
            Maiores consumidores
          </h3>
          {usage.topUsers.slice(0, 8).map((u) => (
            <div key={u.installId} className="flex items-baseline justify-between gap-3 text-xs">
              <span className={`truncate ${u.isSystem ? 'text-warning font-medium' : 'text-on-surface-dim'}`}>
                {/* FB-19: the all-zeros sentinel is named (probe/scanner), not user-ranked. */}
                {u.isSystem ? 'Sistema / sonda (00000000)' : u.displayName ?? u.installId.slice(0, 8)}
              </span>
              <span className="text-on-surface font-semibold tabular-nums shrink-0">
                {compactNumber(u.tokens)} tok · {u.runs.toLocaleString('pt-BR')}×
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </Section>
  );
}

/**
 * DEC-251 (Onda B) — anonymous error capture. Each row is a unique scrubbed
 * message (deduped server-side by hash): how many times it happened and how
 * many distinct installs it hit, newest first.
 */
function ErrorsSection({ result }: { result: AdminErrorsResult }) {
  return (
    <Section title={`Erros anônimos (${result.total})`}>
      {result.errors.length === 0 ? (
        <p className="text-xs text-on-surface-dim">Nenhum erro capturado. 🎉</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {result.errors.map((e) => (
            <ErrorRow key={e.hash} error={e} />
          ))}
        </ul>
      )}
    </Section>
  );
}

function ErrorRow({ error }: { error: AdminError }) {
  return (
    <li className="bg-surface rounded-xl px-3 py-2 flex flex-col gap-1">
      <p className="text-xs text-on-surface font-medium break-words">{error.message}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-on-surface-faint">
        <span className="text-danger font-semibold tabular-nums">{error.count.toLocaleString('pt-BR')}×</span>
        <span className="tabular-nums">{error.users.toLocaleString('pt-BR')} usuário(s)</span>
        {error.platform ? <span>{error.platform}</span> : null}
        {error.appVersion ? <span>v{error.appVersion}</span> : null}
        <span title={fullDate(error.lastSeen)}>{relativeTime(error.lastSeen)}</span>
      </div>
    </li>
  );
}

function GhostSignalsSection({ result }: { result: AdminGhostSignalsResult }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <Section title={`Sinais fantasma (${result.total})`}>
      <p className="text-[11px] text-on-surface-faint -mt-1">
        Dispositivos com vestígios em heartbeats, IA ou erros mas SEM registro na tabela de usuários.
        Dados com menor certeza — podem ser dispositivos deletados, testes, ou instalações que nunca
        completaram o primeiro heartbeat.
      </p>
      {result.signals.length === 0 ? (
        <p className="text-xs text-on-surface-dim">Nenhum sinal fantasma encontrado.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {result.signals.map((g) => (
            <GhostCard
              key={g.installId}
              ghost={g}
              expanded={expanded === g.installId}
              onToggle={() => setExpanded((prev) => (prev === g.installId ? null : g.installId))}
            />
          ))}
        </div>
      )}
    </Section>
  );
}

function GhostCard({
  ghost,
  expanded,
  onToggle,
}: {
  ghost: AdminGhostSignal;
  expanded: boolean;
  onToggle: () => void;
}) {
  const sourceLabels: Record<string, string> = {
    ai_usage: 'IA',
    error_seen: 'Erros',
    heartbeats: 'Heartbeats',
  };
  return (
    <div className="bg-surface rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full btn-press px-3 py-2.5 flex items-center justify-between gap-2 text-left"
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-xs font-mono text-warning font-semibold truncate">
            {ghost.installId.slice(0, 12)}…
          </span>
          <div className="flex flex-wrap gap-1.5">
            {ghost.sources.map((s) => (
              <span
                key={s}
                className="text-[10px] px-1.5 py-0.5 rounded-full bg-warning/15 text-warning font-medium"
              >
                {sourceLabels[s] ?? s}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          {ghost.aiTokens > 0 ? (
            <span className="text-[10px] text-on-surface-dim tabular-nums">
              {compactNumber(ghost.aiTokens)} tok · {ghost.aiCalls}×
            </span>
          ) : null}
          {ghost.lastSeen ? (
            <span className="text-[10px] text-on-surface-faint">{relativeTime(ghost.lastSeen)}</span>
          ) : null}
          <span className="text-[10px] text-on-surface-faint">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded ? (
        <div className="px-3 pb-3 flex flex-col gap-2 border-t border-surface-high/60">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-2">
            {ghost.platforms.length > 0 ? (
              <GhostMeta label="Plataformas" value={ghost.platforms.join(', ')} />
            ) : null}
            {ghost.versions.length > 0 ? (
              <GhostMeta label="Versões" value={ghost.versions.join(', ')} />
            ) : null}
            {ghost.firstSeen ? (
              <GhostMeta label="Primeiro sinal" value={fullDate(ghost.firstSeen)} />
            ) : null}
            {ghost.lastSeen ? (
              <GhostMeta label="Último sinal" value={fullDate(ghost.lastSeen)} />
            ) : null}
            {ghost.heartbeatDays.length > 0 ? (
              <GhostMeta label="Dias ativos" value={String(ghost.heartbeatDays.length)} />
            ) : null}
            {ghost.errorCount > 0 ? (
              <GhostMeta label="Erros totais" value={String(ghost.errorCount)} />
            ) : null}
          </div>

          {ghost.aiFns.length > 0 ? (
            <div>
              <h4 className="text-[10px] font-semibold text-on-surface-faint uppercase tracking-wide mb-1">
                IA por função
              </h4>
              {ghost.aiFns.map((f) => (
                <div key={f.fn} className="flex items-baseline justify-between gap-2 text-xs py-0.5">
                  <span className="text-on-surface-dim">{AI_FN_LABELS[f.fn] ?? f.fn}</span>
                  <span className="text-on-surface font-semibold tabular-nums">
                    {f.tokens.toLocaleString('pt-BR')} tok · {f.runs}×
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {ghost.errorMessages.length > 0 ? (
            <div>
              <h4 className="text-[10px] font-semibold text-on-surface-faint uppercase tracking-wide mb-1">
                Erros
              </h4>
              {ghost.errorMessages.slice(0, 5).map((msg, i) => (
                <p key={i} className="text-[11px] text-on-surface-dim break-words py-0.5">
                  • {msg}
                </p>
              ))}
              {ghost.errorMessages.length > 5 ? (
                <p className="text-[10px] text-on-surface-faint">
                  +{ghost.errorMessages.length - 5} erros adicionais
                </p>
              ) : null}
            </div>
          ) : null}

          {ghost.heartbeatDays.length > 0 ? (
            <div>
              <h4 className="text-[10px] font-semibold text-on-surface-faint uppercase tracking-wide mb-1">
                Heartbeat days
              </h4>
              <p className="text-[11px] text-on-surface-dim break-words">
                {ghost.heartbeatDays.slice(0, 10).join(', ')}
                {ghost.heartbeatDays.length > 10 ? ` (+${ghost.heartbeatDays.length - 10})` : ''}
              </p>
            </div>
          ) : null}

          <p className="text-[9px] text-on-surface-faint mt-1">
            ID completo: {ghost.installId}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function GhostMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-[11px] text-on-surface-faint">{label}</span>
      <span className="text-[11px] text-on-surface-dim font-medium text-right">{value}</span>
    </div>
  );
}

function Distribution({ title, items }: { title: string; items: { key: string; count: number }[] }) {
  const max = items.length > 0 ? Math.max(...items.map((i) => i.count)) : 0;
  return (
    <Section title={title}>
      {items.length === 0 ? (
        <p className="text-xs text-on-surface-faint">Sem dados.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.slice(0, 8).map((i) => (
            <Bar key={i.key} label={i.key} value={i.count} max={max} />
          ))}
        </div>
      )}
    </Section>
  );
}
