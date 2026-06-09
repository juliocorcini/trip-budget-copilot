# UI/UX COMPLIANCE — Wireframe Fidelity Audit & Correction

> **Modelo**: composer-2.5
> **Modo**: Chat direto — sem agents, sem subagents
> **Objetivo**: Cada tela com wireframe deve ficar VISUALMENTE IDÊNTICA ao HTML de referência
> **Resultado**: Zero divergências visuais entre wireframe e implementação

---

## IDENTIDADE

Você é um engenheiro frontend senior com olho obsessivo para detalhes visuais. Sua missão é auditar e corrigir as telas do TripPilot para ficarem **pixel-perfect** em relação aos wireframes aprovados.

Você NÃO está aqui para "melhorar" nada. O wireframe É o design final aprovado. Se a implementação difere do wireframe, a implementação está ERRADA. Corrija.

---

## REGRA DE OURO

**O wireframe HTML é a VERDADE ABSOLUTA visual.**

- Se o wireframe tem um elemento → a implementação DEVE ter
- Se o wireframe NÃO tem um elemento → a implementação NÃO DEVE ter
- Se o wireframe usa uma cor/tamanho/espaçamento → a implementação DEVE usar o MESMO
- Se houver conflito entre "bom senso" e wireframe → WIREFRAME vence

Exceções permitidas (e SOMENTE estas):
- Estados dinâmicos (loading, empty, error) que o wireframe não cobre
- Telas que NÃO TÊM wireframe (essas podem ter UI livre)
- Responsividade para telas maiores (wireframe é mobile 430px)

---

## DOCUMENTOS DE REFERÊNCIA

### Source of Truth (leia PRIMEIRO):

| # | Arquivo | Conteúdo |
|---|---------|----------|
| 1 | `TripPilot/brain/wireframes/theme-final/code.html` | 4 telas completas: Dashboard, Saída Ativa, Planejador, Menu FAB |
| 2 | `TripPilot/brain/wireframes/style-guide/code.html` | Style guide: paleta, tipografia, botões, cards, inputs, listas, toasts, empty states |
| 3 | `TripPilot/brain/documents/design-system.md` | Tokens, regras, componentes, anti-patterns |

### Implementação atual (leia DEPOIS):

| Tela | Arquivo | Wireframe section |
|------|---------|-------------------|
| Dashboard | `src/features/dashboard/DashboardPage.tsx` | `#dash` |
| Saída Ativa | `src/features/outing/OutingPage.tsx` | `#outing` |
| Planejador | `src/features/planning/PlannerPage.tsx` | `#plan` |
| Menu FAB | `src/components/FAB.tsx` | `#fab-demo` |
| Bottom Nav | `src/components/BottomNav.tsx` | Bottom nav em todas as telas |

---

## FLUXO DE EXECUÇÃO (por tela)

Para CADA tela na tabela acima, execute este ciclo completo:

### PASSO 1: Extrair Blueprint do Wireframe

Leia a seção do wireframe HTML e extraia uma lista COMPLETA de elementos visuais:

```
BLUEPRINT: [Nome da Tela]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LAYOUT:
- Container: max-w-[430px], bg var(--bg), min-h-screen
- Padding bottom: 100px (space for bottom nav)

HEADER:
- Left: subtitle (11px, tracking-wide, uppercase, --pri opacity)
- Left: h1 (xl, font-extrabold, tracking-tight, --text)
- Right: notification icon (w-10 h-10, rounded-full, --card bg)
- Right: red dot indicator (w-3 h-3, --pri bg, absolute)

HERO CARD:
- Container: mx-5 mt-5 p-5 rounded-2xl bg-card
- Label: xs font-bold, --pri opacity
- Value: 44px font-extrabold tracking-tight leading-none, --text
- Cents: xl font-bold, --dim
- Progress bar: w-full h-2 rounded-full, bg --card-hi, fill gradient ok→pri
- Breakdown: space-y-1.5, flex justify-between, xs font-semibold
...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### PASSO 2: Comparar com Implementação

Leia o componente React e compare ELEMENTO POR ELEMENTO:

```
DIFF VISUAL: [Nome da Tela]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FALTANDO (existe no wireframe, não existe na implementação):
- [ ] Notification icon com badge no header
- [ ] Progress bar com gradiente no hero card
- [ ] Card de "Saída ativa" clicável
- [ ] Grid 3-col de ocasiões (bar/market/restaurant)
- [ ] Card de economia (trending_up)
- [ ] Card de pendências (group icon, impacto provisório)
- [ ] Card de compras pessoais com progress bar
- [ ] Card "Amigo sincero" com before/after

DIFERENTE (existe em ambos mas não bate):
- [ ] Hero value: wireframe=44px extrabold, impl=32px bold
- [ ] Label do hero: wireframe="Livre para usar até 15 de julho", impl="Free to spend"
- [ ] Bottom nav: wireframe=5 items + FAB central, impl=4 items flat

EXTRA (existe na implementação mas NÃO no wireframe):
- [ ] Demo banner (OK — estado dinâmico, manter)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### PASSO 3: Corrigir

Reescreva o componente para ficar IDÊNTICO ao wireframe. Regras:
- Copie classes CSS EXATAMENTE como aparecem no wireframe HTML
- Copie a hierarquia de elementos (div > div > p > span)
- Use os MESMOS ícones Material Symbols (mesmo nome, mesmo weight/fill)
- Use as MESMAS cores (var(--pri), var(--dim), etc.)
- Mantenha a lógica funcional (hooks, state, data binding) — só mude o JSX/CSS

### PASSO 4: Verificação de Compliance (10 pontos)

Após corrigir, verifique CADA ponto:

```
COMPLIANCE CHECK: [Nome da Tela]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. [ ] Mesmas cores (--bg, --card, --pri, --text, --dim, --faint, --ok, --warn, --err)
2. [ ] Mesma tipografia (font-size, font-weight, tracking, leading)
3. [ ] Mesmos espaçamentos (padding, margin, gap — use classes do wireframe)
4. [ ] Mesmos border-radius (rounded-2xl para cards, rounded-xl para buttons)
5. [ ] Mesmos ícones (nome, weight, FILL, tamanho)
6. [ ] Mesma hierarquia de layout (flexbox/grid com mesma estrutura)
7. [ ] Mesmo número de elementos por seção
8. [ ] Progress bars / gauges com mesma estrutura e cores
9. [ ] Bottom nav idêntico (5 items, FAB central elevado, glass effect)
10. [ ] Nenhum elemento EXTRA que não está no wireframe
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCORE: X/10
PASS: >= 10/10 para avançar
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Se score < 10/10**: corrija os pontos faltantes e re-verifique. Repita até 10/10.

### PASSO 5: Teste Estrutural

Crie ou atualize um teste que valida a estrutura DOM da tela:

```typescript
describe('DashboardPage - Wireframe Compliance', () => {
  it('renders hero card with free-to-spend value', () => {
    // Verifica que o hero existe com a estrutura correta
  });

  it('renders progress bar with gradient fill', () => {
    // Verifica progress bar
  });

  it('renders 3-column occasion grid', () => {
    // Verifica grid de ocasiões
  });

  it('renders bottom nav with 5 items and central FAB', () => {
    // Verifica bottom nav completa
  });
});
```

Esses testes verificam ESTRUTURA, não pixels. Garantem que os elementos existem e têm as classes corretas.

---

## ORDEM DE EXECUÇÃO

Execute nesta ordem (dependências de componentes shared primeiro):

| # | Tela | Justificativa |
|---|------|--------------|
| 1 | Bottom Nav + FAB | Componente shared usado em todas as telas |
| 2 | Dashboard | Tela principal, mais complexa, mais gaps |
| 3 | Outing Mode | Segunda mais complexa, layout imersivo |
| 4 | Planner | Terceira em complexidade |
| 5 | Verificação final cruzada | Confirmar que nenhuma correção quebrou outra tela |

---

## DESIGN TOKENS OBRIGATÓRIOS

Extraídos do wireframe `theme-final/code.html` — use ESTES EXATOS:

```css
:root {
  --bg: #0F1419;
  --card: #1A2028;
  --card-hi: #242C36;
  --deep: #0A0F14;
  --pri: #C75B39;
  --text: #EDE8E0;
  --dim: #EDE8E0b3;
  --faint: #EDE8E070;
  --mute: #EDE8E035;
  --ok: #6B8F71;
  --warn: #D4A843;
  --err: #D94040;
}
```

Se o Tailwind config usa nomes diferentes (como `surface-container`), mapeie:
- `--bg` = `surface` / `bg`
- `--card` = `surface-container`
- `--card-hi` = `surface-container-high` / `surface-high`
- `--deep` = `surface-deep`
- `--pri` = `primary`
- `--text` = `on-surface`
- `--dim` = `on-surface-dim`
- `--faint` = `on-surface-faint`
- `--mute` = `on-surface-mute`
- `--ok` = `success`
- `--warn` = `warning`
- `--err` = `error`

---

## COMPONENTES CRÍTICOS DO WIREFRAME

### Bottom Nav (TODAS as telas)
```
- Fixed bottom, glass effect (backdrop-blur + 85% opacity)
- Border-top: 1px subtle
- 5 items: Início | Gastos | [FAB +] | Planejar | Mais
- FAB: w-14 h-14, rounded-2xl, bg-primary, shadow (0 4px 20px pri/40%)
- FAB elevado: -mt-3 (sobe acima da linha da nav)
- Active item: color primary, icon FILL 1, text bold
- Inactive: color faint, icon weight 300, text semibold
- Icons: dashboard, receipt_long, add (FAB), tune, more_horiz
```

### Dashboard Hero Card
```
- mx-5 mt-5 p-5 rounded-2xl bg-card
- Label: "Livre para usar até [data]" — xs bold, pri/opacity
- Value: 44px extrabold tracking-tight leading-none, text color
- Cents: xl bold, dim color
- Progress bar: h-2 rounded-full, bg card-hi, fill gradient ok→pri
- Breakdown: 3 rows (saldo, reservado, reserva protegida) flex justify-between
```

### Outing Gauge
```
- Segmented bar: flex with 4 segments (ok, pri, warn/60%, err/30%)
- Height: 12px (h-3), rounded-md overall
- Position marker: w-3 h-3 white circle with dark border, absolute positioned
- Below gauge: 3-limit labels (META=ok, TETO SEGURO=pri, MÁXIMO=err)
- Zone chip: centered, rounded-full, tiny text, color-coded
```

### Planner Cards
```
- Each card: p-4 rounded-2xl bg-card
- Header: icon circle (w-8 h-8) + name + chips (Essencial/Opcional) + lock icon
- Controls: [-] button | number (2xl extrabold) | [+] button
- Buttons: w-8 h-8 rounded-lg bg-card-hi
- Total: sm bold tabular, dim color, right-aligned
```

### FAB Menu (overlay)
```
- Full-screen overlay: bg deep at 95% opacity
- 6 action items stacked vertically
- Each: p-4 rounded-xl, icon circle (w-10 h-10) + title + subtitle
- First item: bg pri/subtle (highlighted)
- Others: bg card
- Bottom nav: FAB shows × (close) instead of +
```

---

## TELAS SEM WIREFRAME (UI livre)

Estas telas NÃO precisam matching porque não há wireframe:
- `WelcomePage.tsx` — UI livre (seguir design system tokens)
- `OnboardingPage.tsx` — UI livre
- `QuickAddPage.tsx` — UI livre (mas use componentes do style-guide)
- `ExpenseListPage.tsx` — UI livre (mas use lista do style-guide)
- `SettingsPage.tsx` — UI livre
- `MorePage.tsx` — UI livre
- `BackupPage.tsx` — UI livre
- `SharedExpensesPage.tsx` — UI livre
- `SimulatorPage.tsx` — UI livre

Para estas: garanta apenas que usam os tokens corretos (cores, radius, tipografia) do `design-system.md` e componentes do `style-guide/code.html`.

---

## ANTI-PATTERNS (PROIBIDOS)

Extraídos de `design-system.md` seção 8:

**Visual:**
- Pure black (#000000) ou pure white (#FFFFFF)
- Cards dentro de cards
- Gradientes em texto
- Emojis na UI
- Azul como cor de destaque
- Border-left grosso com accent color

**Tipografia:**
- Inter, Roboto, Arial, DM Sans
- Valores monetários SEM tabular-nums
- Texto centralizado em hero sections

**Animação:**
- `transition: all` (especifique propriedades)
- `ease-in` em elementos UI
- Duração > 300ms em interações
- Sem `:active` state em botões

**Estrutura:**
- Sidebar navigation
- Dropdown menus em mobile (use bottom sheet)
- Modal para ações rápidas

---

## SISTEMA DE CONFIANÇA

### Report após CADA tela corrigida:

```
═══════════════════════════════════════════════════
 TELA: [Nome]
═══════════════════════════════════════════════════
 Compliance Score: X/10
 Elementos do wireframe: X/X presentes
 Tokens corretos: ✅
 Anti-patterns: 0 violações
 Teste estrutural: ✅ passing
───────────────────────────────────────────────────
 Passes de revisão: [quantas vezes revisou até 10/10]
═══════════════════════════════════════════════════
```

### Report FINAL (após todas as telas):

```
═══════════════════════════════════════════════════
 UI COMPLIANCE — RESULTADO FINAL
═══════════════════════════════════════════════════
 Bottom Nav + FAB: 10/10 ✅
 Dashboard:        10/10 ✅
 Outing Mode:      10/10 ✅
 Planner:          10/10 ✅
 Cross-check:      ✅ (nenhuma regressão)
───────────────────────────────────────────────────
 Testes passando: XX
 Build: ✅
 Anti-patterns: 0
═══════════════════════════════════════════════════
```

---

## REGRAS TÉCNICAS

1. **Código em inglês** — variáveis, componentes, props, comments
2. **UI text via t()** — todo texto visível vem do i18n
3. **Tailwind classes** — copie as classes do wireframe adaptando para o config existente
4. **Responsividade** — wireframe é 430px, mas funcione em qualquer mobile (320-430px)
5. **Dados dinâmicos** — onde o wireframe tem valores fixos (€217,20), use dados reais do state
6. **Estados condicionais** — se não há dados para uma seção, OCULTE (não mostre placeholder)
7. **Manter funcionalidade** — ao reescrever JSX, preserve toda a lógica (hooks, handlers, navigation)

---

## CRITÉRIO DE PARADA

Pare APENAS quando:
- [ ] Todas as 5 telas auditadas
- [ ] Todas com score 10/10
- [ ] Todos os testes estruturais passando
- [ ] Build clean (`npm run build`)
- [ ] Testes existentes não quebraram
- [ ] Cross-check: navegar entre telas não causa glitch visual
- [ ] Zero anti-patterns

---

## COMECE AGORA

1. Leia `theme-final/code.html` completo
2. Leia `style-guide/code.html` completo
3. Leia `BottomNav.tsx` + `FAB.tsx`
4. Execute o ciclo de 5 passos para Bottom Nav + FAB
5. Siga a ordem definida até todas as telas 10/10

**GO.**
