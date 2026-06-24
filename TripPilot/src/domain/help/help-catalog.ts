/**
 * FB-28 V1 (DEC-278) — the in-app help center / concierge, 100% LOCAL (0 token).
 *
 * A comprehensive, data-driven knowledge base: every first-class feature gets at
 * least one article (question + short answer + concrete steps + a deep-link to
 * the screen that does it), plus the common cross-cutting doubts (privacy &
 * location, reimbursement, AI-vs-manual entry…). The catalog lives in the domain
 * (Core Rule 8); the page only renders it and a unit test guards that every route
 * exists and every article resolves to copy in the three languages.
 *
 * Search is keyword/synonym matching over `keywords` (authored multilingual) and
 * the article id — purely local, no AI, so it never touches the Groq token budget
 * (the V2 AI fallback is explicitly out of this gate). All copy lives in i18n
 * under `help_center.a.<id>.{q,a,steps}` and `help_center.section_<sectionId>`.
 */

export type HelpSectionId =
  | 'getting_started'
  | 'day_to_day'
  | 'planning'
  | 'money'
  | 'trips'
  | 'people'
  | 'copilot'
  | 'data_privacy';

/** Theme order in the browse view (search results are ranked, ungrouped). */
export const HELP_SECTION_IDS: HelpSectionId[] = [
  'getting_started',
  'day_to_day',
  'planning',
  'money',
  'trips',
  'people',
  'copilot',
  'data_privacy',
];

export interface HelpArticle {
  /** Unique id; also the i18n key fragment (`help_center.a.<id>.…`). */
  id: string;
  /** Material symbol shown in the row. */
  icon: string;
  /** Theme grouping for the browse view. */
  section: HelpSectionId;
  /**
   * Deep-link to the screen that performs this. MUST exist in the router (a unit
   * test guards it). Mode-gated routes are still listed — ModeGuard handles the
   * simple→complete prompt, exactly like the feature guide.
   */
  route: string;
  /**
   * Accent-insensitive, multilingual keywords/synonyms for the local search.
   * Authored so a doubt typed in pt/en/es lands on the right article without AI.
   */
  keywords: string[];
}

const a = (
  id: string,
  icon: string,
  section: HelpSectionId,
  route: string,
  keywords: string[],
): HelpArticle => ({ id, icon, section, route, keywords });

/**
 * The knowledge base. Every entry maps to a first-class capability or a common
 * doubt; collectively the routes cover the whole feature guide (coverage test).
 */
export const HELP_ARTICLES: HelpArticle[] = [
  // ── Getting started: how money goes in ────────────────────────────────────
  a('log_ai', 'auto_awesome', 'getting_started', '/quick-add', [
    'lancar gasto ia voz texto registrar anotar despesa', 'log expense ai voice text add', 'registrar gasto inteligencia', 'falar gasto microfone', 'add spending assistant', 'registrar con ia voz',
  ]),
  a('log_manual', 'edit', 'getting_started', '/quick-add', [
    'manual lancar gasto formulario campos sem ia', 'manual expense form fields', 'digitar gasto na mao', 'registro manual completo', 'cargar gasto manual',
  ]),
  a('log_photo', 'photo_camera', 'getting_started', '/quick-add', [
    'foto nota recibo cupom fiscal escanear camera galeria', 'photo receipt scan camera gallery', 'fotografar conta', 'ler nota com ia', 'foto factura ticket',
  ]),
  a('expenses', 'receipt_long', 'getting_started', '/expenses', [
    'gastos lista ver editar apagar historico despesas', 'expenses list view edit delete history', 'meus gastos', 'lista de despesas', 'ver editar gasto', 'lista de gastos',
  ]),

  // ── Day to day: feedback while you spend ───────────────────────────────────
  a('checkin', 'wb_sunny', 'day_to_day', '/dashboard', [
    'check-in diario amigo sincero como estou hoje saldo do dia', 'daily check in honest friend how am i doing today', 'feedback diario', 'amigo sincero voz', 'check in diario hoy',
  ]),
  a('outing', 'local_bar', 'day_to_day', '/outings/new', [
    'saida rolê balada bar noite mesa ao vivo limite gauge', 'outing night out bar live session limit gauge', 'noitada controle', 'sessao ao vivo gastos', 'salida noche bar en vivo',
  ]),

  // ── Planning ahead ─────────────────────────────────────────────────────────
  a('planner', 'tune', 'planning', '/planner', [
    'planejador cenarios quanto gastar por categoria fase plano', 'planner scenarios how much to spend per category phase', 'montar plano de gastos', 'cenario economico equilibrado', 'planificador escenarios',
  ]),
  a('planned', 'shopping_bag', 'planning', '/planned', [
    'compras planejadas reserva comprar depois lista presentes', 'planned purchases reserve buy later shopping list gifts', 'reservar dinheiro compra', 'planejar compra', 'compras planeadas reservar',
  ]),
  a('simulator', 'calculate', 'planning', '/simulator', [
    'simulador e se gastar testar cenario futuro impacto', 'simulator what if test scenario future impact', 'simular gasto', 'e se eu gastar', 'simulador que pasa si',
  ]),
  a('converter', 'currency_exchange', 'planning', '/converter', [
    'conversor cambio moeda quanto e em euro dolar real taxa', 'converter exchange currency how much in euro dollar rate', 'converter moeda', 'cotacao cambio', 'conversor moneda cambio',
  ]),
  a('comparator', 'balance', 'planning', '/comparator', [
    'comparador custo beneficio preco por kg litro unidade qual vale mais barato peso quantidade mercado', 'cost benefit comparator price per kg litre unit which is cheaper weight quantity grocery', 'qual vale mais', 'preco por quilo', 'melhor custo beneficio', 'comparador precio por kg unidad cual conviene',
  ]),

  // ── Money: where it sits ───────────────────────────────────────────────────
  a('funds', 'savings', 'money', '/funds', [
    'fundos potes orcamento reserva protegida envelope dinheiro', 'funds pools budget protected reserve envelope money', 'orcamento da viagem', 'reserva de emergencia', 'fondos presupuesto reserva',
  ]),
  a('piggy', 'savings', 'money', '/dashboard', [
    'cofrinho economia sobrou guardou dia poupanca buffer', 'piggy bank savings leftover saved per day', 'cofrinho extrato', 'quanto economizei', 'alcancia ahorro',
  ]),
  a('wallets', 'account_balance_wallet', 'money', '/wallets', [
    'carteiras cartao dinheiro debito credito saldo conciliar', 'wallets card cash debit credit balance reconcile', 'meios de pagamento saldo', 'cartao de credito', 'billeteras tarjeta efectivo',
  ]),
  a('income', 'payments', 'money', '/income', [
    'receita entrada dinheiro recebido salario adicionar renda', 'income money received salary add revenue', 'registrar receita', 'entrou dinheiro', 'ingreso recibir dinero',
  ]),

  // ── Trips & spaces ─────────────────────────────────────────────────────────
  a('spaces', 'workspaces', 'trips', '/spaces', [
    'espacos varias viagens dia a dia trocar viagem multi', 'spaces multiple trips day to day switch trip', 'mais de uma viagem', 'modo dia a dia', 'espacios varios viajes',
  ]),
  a('viagem', 'luggage', 'trips', '/viagem', [
    'viagem datas fases configurar editar destino periodo resumo compartilhar mapa onde gastei', 'trip dates phases configure edit destination period summary share map where i spent', 'editar viagem', 'configurar fases', 'resumo da viagem', 'compartilhar resumo', 'viaje fechas fases resumen compartir mapa',
  ]),
  a('profiles', 'badge', 'trips', '/profiles', [
    'perfis atividade categorias bar mercado valor tipico', 'activity profiles categories bar market typical value', 'categorias de gasto', 'editar perfis', 'perfiles categorias',
  ]),

  // ── People: splitting & settling ───────────────────────────────────────────
  a('split', 'splitscreen', 'people', '/split/scan', [
    'dividir conta racha mesa ao vivo passar o telefone nota', 'split bill share live table pass the phone receipt', 'dividir despesa entre amigos', 'rachar a conta', 'dividir cuenta entre amigos',
  ]),
  a('settle', 'group', 'people', '/shared', [
    'acerto de contas quem me deve cobrar lembrar conexao pix wise', 'settle up who owes me remind connection pix wise', 'acertar contas', 'cobrar amigo', 'ajuste de cuentas quien me debe',
  ]),
  a('reimbursement', 'request_quote', 'people', '/shared', [
    'reembolso recebi pagamento de volta pix wise dinheiro registrar', 'reimbursement got paid back received payment pix wise cash record', 'me pagaram de volta', 'registrar reembolso recebido', 'reembolso me pagaron',
  ]),

  // ── Copilot: the smart reads ───────────────────────────────────────────────
  a('copilot', 'insights', 'copilot', '/copiloto', [
    'copiloto insights analise inteligente dicas economizar', 'copilot insights smart analysis tips save money', 'ver copiloto', 'dicas de economia', 'copiloto analisis',
  ]),
  a('impact', 'monitoring', 'copilot', '/impact', [
    'impacto projecao ate o fim quanto sobra ritmo gasto', 'impact projection end of trip how much left pace', 'projecao de gasto', 'vou conseguir', 'impacto proyeccion',
  ]),
  a('rescue', 'health_and_safety', 'copilot', '/rescue', [
    'plano de resgate estourei orcamento recuperar cortar gasto', 'rescue plan over budget recover cut spending', 'gastei demais', 'como me recuperar', 'plan de rescate exceder',
  ]),

  // ── Data, privacy & the rest ───────────────────────────────────────────────
  a('backup', 'cloud_upload', 'data_privacy', '/settings/backup', [
    'backup salvar restaurar exportar importar dados copia seguranca', 'backup save restore export import data', 'fazer backup', 'restaurar dados', 'respaldo exportar importar',
  ]),
  a('import_wise', 'sync_alt', 'data_privacy', '/import/wise', [
    'importar wise extrato csv transferencia cartao', 'import wise statement csv transfer card', 'trazer gastos do wise', 'importar extrato', 'importar wise estado de cuenta',
  ]),
  a('privacy_location', 'location_on', 'data_privacy', '/settings', [
    'privacidade localizacao gps onde gastei desligar permissao mapa', 'privacy location gps where i spent turn off permission', 'desligar localizacao', 'meus dados privacidade', 'privacidad ubicacion gps',
  ]),
  a('customize_home', 'dashboard_customize', 'data_privacy', '/settings/dashboard', [
    'personalizar tela inicial cards home esconder organizar', 'customize home screen cards hide arrange', 'mudar a home', 'organizar cards', 'personalizar inicio',
  ]),
  a('notifications', 'notifications', 'data_privacy', '/notifications', [
    'notificacoes avisos alertas lembrete silenciar', 'notifications alerts reminders mute', 'ativar notificacoes', 'avisos do app', 'notificaciones avisos',
  ]),
  a('about', 'info', 'data_privacy', '/about', [
    'sobre versao atualizar novidades app update release notes', 'about version update what is new app', 'atualizar o app', 'qual versao', 'acerca version actualizar',
  ]),
  a('settings', 'settings', 'data_privacy', '/settings', [
    'configuracoes ajustes preferencias idioma tema moeda', 'settings preferences language theme currency', 'mudar configuracoes', 'ajustes do app', 'configuracion ajustes idioma',
  ]),
];

/* ── i18n key helpers (the domain stays i18n-free) ─────────────────────────── */

export function helpQuestionKey(id: string): string {
  return `help_center.a.${id}.q`;
}

export function helpAnswerKey(id: string): string {
  return `help_center.a.${id}.a`;
}

export function helpStepsKey(id: string): string {
  return `help_center.a.${id}.steps`;
}

export function helpSectionTitleKey(sectionId: HelpSectionId): string {
  return `help_center.section_${sectionId}`;
}

/* ── browse view: articles grouped by theme ────────────────────────────────── */

export interface HelpSectionGroup {
  id: HelpSectionId;
  articles: HelpArticle[];
}

export function groupHelpArticlesBySection(
  articles: HelpArticle[] = HELP_ARTICLES,
): HelpSectionGroup[] {
  return HELP_SECTION_IDS.map((id) => ({
    id,
    articles: articles.filter((article) => article.section === id),
  })).filter((group) => group.articles.length > 0);
}

/* ── local search (0 token) ────────────────────────────────────────────────── */

/** Lowercase, strip diacritics, collapse whitespace — so "câmbio" == "cambio". */
export function normalizeHelpText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tokens of length ≥ 2 — single letters are too noisy to match on. */
function queryTokens(query: string): string[] {
  return normalizeHelpText(query)
    .split(' ')
    .filter((token) => token.length >= 2);
}

function articleScore(article: HelpArticle, tokens: string[]): number {
  const haystacks = [normalizeHelpText(article.id.replace(/_/g, ' ')), ...article.keywords.map(normalizeHelpText)];
  let score = 0;
  for (const token of tokens) {
    const hit = haystacks.some((h) => h.includes(token) || token.includes(h));
    if (hit) score += 1;
  }
  return score;
}

/**
 * Ranks the KB against a free-text doubt — purely local. Returns the articles
 * that match at least one query token, best match first (ties keep catalog
 * order, which is theme order). An empty/too-short query returns nothing so the
 * page can fall back to the grouped browse view.
 */
export function searchHelp(query: string, articles: HelpArticle[] = HELP_ARTICLES): HelpArticle[] {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return [];
  return articles
    .map((article, index) => ({ article, index, score: articleScore(article, tokens) }))
    .filter((entry) => entry.score > 0)
    .sort((x, y) => y.score - x.score || x.index - y.index)
    .map((entry) => entry.article);
}

/** Same-theme siblings (the "related questions" rail), excluding the article. */
export function relatedHelpArticles(
  id: string,
  limit = 3,
  articles: HelpArticle[] = HELP_ARTICLES,
): HelpArticle[] {
  const current = articles.find((article) => article.id === id);
  if (!current) return [];
  return articles
    .filter((article) => article.section === current.section && article.id !== id)
    .slice(0, limit);
}
