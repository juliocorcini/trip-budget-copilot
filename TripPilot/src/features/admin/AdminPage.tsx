import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AdminAuthError,
  deleteInstall,
  fetchInstalls,
  fetchOverview,
  type AdminInstall,
  type AdminOverview,
} from '@/utils/admin-api';
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
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async (activeToken: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const [ov, list] = await Promise.all([
        fetchOverview(activeToken),
        fetchInstalls(activeToken, 500),
      ]);
      setOverview(ov);
      setInstalls(list.installs);
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

            <Section title={`Usuários (${installs.length})`}>
              {installs.length === 0 ? (
                <p className="text-xs text-on-surface-dim">Nenhum usuário registrado ainda.</p>
              ) : (
                <div className="overflow-x-auto -mx-1">
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
                        <th className="py-2 px-1 font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {installs.map((it) => (
                        <tr key={it.installId} className="border-b border-surface-high">
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
                          <td className="py-2 px-1 text-right">
                            <button
                              onClick={() => void handleDelete(it)}
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

            <p className="text-[10px] text-on-surface-faint text-center pb-6">
              Dados anônimos de uso. Nunca capturamos valores nem o conteúdo dos gastos.
            </p>
          </>
        ) : null}
      </div>
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
