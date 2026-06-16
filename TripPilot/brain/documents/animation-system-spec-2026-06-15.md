# TripPilot — Sistema de Animações e Transições (Motion System)

- **Data**: 2026-06-15
- **Decisão**: DEC-194 (Motion System)
- **Versão de entrega**: 0.36.0
- **Autor**: implementação direta (sem subagentes — `tech-lead-delegation`)
- **Escopo**: animações de página, micro-interações de componentes, feedback de ação, acessibilidade e performance.

> Princípio do pedido do Julio: *"fluido, profissional, eu me sinto abrindo uma página; componentes animados, não só páginas; transições entre elementos/componentes; **sem exagero**, sem animação demais."*

---

## 1. Conselho (multi-perspectiva, inline)

O conselho foi rodado **inline** (não via subagentes — a regra `tech-lead-delegation` proíbe o uso da Task tool). Quatro perspectivas + síntese.

### Architect (técnico)
- O webview do Capacitor aqui é Chrome 148 → **View Transitions API disponível**, mas a integração *global* com o **back de hardware/gesto** do Android é frágil (React Router só aplica `viewTransition` por navegação; popstate de back nativo não é envolvido de forma confiável). Resultado seria inconsistente: back animado às vezes, instantâneo outras.
- O codebase já é **CSS-first** (keyframes `checkin-reveal`, `lens-in`, `seg-pulse`, `AnimatedMoney` + `usePrefersReducedMotion`). Manter o mesmo paradigma = consistência (princípio #1) e zero dependência nova.
- **Framer Motion** custa ~50KB e roda na main thread (WAAPI ajuda, mas ainda há custo) — penaliza Android mid-range. Desnecessário para o que queremos.
- **Bottom Line:** CSS-first com tokens de motion; transição de página por **re-mount keyed + direção via `history.idx`** (robusto para TODA navegação, inclusive back de gesto); 0 KB JS.

### User Advocate (experiência)
- O "sentir abrindo a página" vem de **3 coisas**: (1) o conteúdo entra com movimento direcional, (2) a *chrome* (barra inferior + topo) fica **parada** (sensação de "a página trocou dentro da moldura"), (3) consistência de timing.
- Micro-interações de **componentes reusados** (FAB, sheet, toast, nav, dinheiro) dão a sensação de "componentes animados" em TODAS as telas com pouquíssima superfície de código — melhor ROI que animar cada lista.
- O bug do FAB (atalhos sobre a barra) quebra a percepção de qualidade — **corrigir é pré-requisito**.
- **Bottom Line:** Investir no que é onipresente (página + FAB + sheet + toast + nav + dinheiro). Evitar animar listas inteiras (fadiga).

### Critic (advogado do diabo)
- **Risco (MÉDIO):** `transform` no ancestral quebra `position: sticky/fixed` dos filhos *durante* a animação. Mitigação: keyframe final = `transform: none` (não cria containing block); sheets/FAB abrem **depois** da entrada (320ms), então em regime estacionário tudo é fixed-correto.
- **Risco (MÉDIO):** re-mount keyed por `pathname` re-monta a página a cada navegação (refetch). Mas a rota já re-monta naturalmente ao trocar de elemento — o `key` só garante o replay da animação; sem regressão nova.
- **Risco (ALTO se ignorado):** acessibilidade. `prefers-reduced-motion` é **obrigatório** (35% dos usuários têm alguma sensibilidade; é baseline de shipping).
- **Risco (BAIXO):** "animação demais". Mitigar com durações curtas (≤320ms), pulse só em mudança real, sem bounce/elastic.
- **Bottom Line:** Aprovar, com reset global de reduced-motion e disciplina de timing/curvas.

### Strategist (produto)
- Movimento é hoje a camada que carrega a "voz" do produto (Linear/Raycast/Arc). Um pass de motion coeso eleva a percepção de qualidade sem novas features — alto valor para a meta de Play Store.
- Token-driven (durações/curvas) = escala sem virar dívida técnica; reutilizável nas próximas fases.
- **Bottom Line:** Fazer agora, documentar como tokens, manter restrição (a marca é "amigo sincero", não "circo").

### Síntese & Recomendação
**Consenso:** CSS-first, tokens, foco no onipresente, reduced-motion obrigatório, sem bounce, durações curtas. **Divergência:** View Transitions API (Architect tentado pelo cross-fade nativo; Critic/Advocate preferem robustez e consistência no back de gesto) → **resolvido a favor do re-mount keyed CSS** (consistente em 100% das navegações). **Confiança: ALTA.**

---

## 2. Pesquisa (fundamentação)

| Fonte | Conclusão usada |
|---|---|
| React Router v7 — View Transitions (docs) | `viewTransition` é por-navegação; direção via `data-*` + `::view-transition-*`. Confirmou a fragilidade do back global → motivou o re-mount keyed. |
| Material Design 3 — Easing & Duration tokens | Escala de duração (short 50–200 / medium 250–400 / long 450–600) e curvas: standard `cubic-bezier(0.2,0,0,1)`, accelerate (saída) `cubic-bezier(0.3,0,1,1)`, emphasized-decelerate `cubic-bezier(0.05,0.7,0.1,1)`. Enter=decelera, exit=acelera e é mais curto. |
| Micro-interactions 2026 (Ripplix, Creative Alive, Rune) | 100–300ms para micro-interações; só animar com propósito (feedback/estado/atenção); rate-limit em celebrações; `prefers-reduced-motion` é baseline; **sem bounce/elastic** (lê como "datado"). |
| CSS vs JS (Josh Comeau) / "Drop your animation library" / Capgo (Capacitor) | CSS/`transform`+`opacity` rodam no compositor (GPU), fora da main thread → 60fps no webview; View Transitions = 0KB; Framer Motion ~50KB + custo de TBT em Android mid-range. **CSS-first.** |

---

## 3. Tokens de Motion (`src/styles/tokens.css`)

```
--motion-fast: 120ms;   /* feedback imediato: press, toggle, indicador de aba */
--motion-base: 220ms;   /* mudança de estado: menu, sheet, reveal, item do stagger */
--motion-slow: 320ms;   /* transição de página / layout */

--ease-out:        cubic-bezier(0.23, 1, 0.32, 1);   /* decelera — entradas (existente) */
--ease-standard:   cubic-bezier(0.2, 0, 0, 1);        /* M3 standard */
--ease-accelerate: cubic-bezier(0.3, 0, 1, 1);        /* acelera — SAÍDAS */
--ease-in-out:     cubic-bezier(0.77, 0, 0.175, 1);   /* existente */
--ease-spring:     cubic-bezier(0.34, 1.56, 0.64, 1); /* só "delight", uso raro */
```

**Regras:** entradas usam `--ease-out`; saídas usam `--ease-accelerate` e duram ~75% da entrada; nunca animar `width/height/top/left` (só `transform`/`opacity`); `will-change` com parcimônia.

---

## 4. Catálogo de animações (entregue em 0.36.0)

### 4.1 Transição de página — "abrir uma página"
- **Mecanismo:** `AppShell` envolve o `<Outlet/>` em `<div key={pathname} className="route-view">`. Só o conteúdo re-monta; a barra inferior, a `ActiveOutingBar` e a faixa do topo ficam **paradas**.
- **Direção:** `RootLayout.useNavDirection()` lê `history.state.idx` e marca `<html data-nav="forward|back">`. Forward → entra deslizando da direita; back (inclui **back de gesto/hardware**) → entra da esquerda. Tudo sem tocar nas dezenas de `navigate()`.
- **Keyframes:** `page-in-fwd` / `page-in-back` = `translate3d(±16px)` + fade, `--motion-slow` `--ease-out`.
- **Páginas standalone** (fora do AppShell): `QuickAdd` e `Simulator` recebem `.route-view` na raiz (montam do zero → animam no mount). `Outing` ficou de fora de propósito (múltiplos branches + Bar Mode fullscreen).

### 4.2 FAB / menu do "+" (bug + animação)
- **Bug corrigido:** os atalhos de baixo ficavam **sobre a barra inferior**. Agora o `paddingBottom` é `calc(112px + var(--safe-bottom))` (limpa a nav mais alta + o botão central saliente) e a lista rola internamente (`max-height: 100dvh`, `overflow-y-auto`) — o item mais baixo nunca encosta na barra, e todos os 7 atalhos ficam alcançáveis.
- **Entrada:** scrim `fab-scrim-in` + itens em `.stagger` (cascata).
- **Saída:** scrim `fab-scrim-out` + painel `.fab-panel-out` (cai e some) — mantido montado pelo hook `useAnimatedPresence`. O `+` gira para `×` (`rotate(90deg)`).

### 4.3 BottomSheet
- Agora também **fecha animado** (antes sumia seco). `useAnimatedPresence(open, 200)` mantém montado durante a saída; `sheet-up` (entrada) / `sheet-down` (saída) + scrim `sheet-fade`/`sheet-fade-out`.

### 4.4 Toast
- Entra com `toast-in` (desce do topo + leve scale), reaproveitando o keyframe do sistema (removido o inline duplicado).

### 4.5 BottomNav
- **Indicador de aba ativa** (`.nav-ind`): barrinha no topo da aba que cresce (`scaleX 0→1`) na ativa e encolhe na anterior → lê como o indicador "se movendo".
- `+`/`×` com giro suave.

### 4.6 "O dinheiro reage" (`AnimatedMoney`)
- Nova prop `pulseOnChange`: dá um **pulo** (`money-pulse`, scale 1→1.07→1) quando o valor muda **em tela** (nunca no mount nem ao trocar de rota) — junto com o count-up já existente. Ligado no **cofrinho** e nos **saldos das carteiras** (o momento "fiz algo e o número respondeu", ex.: a bebida que entra no total).

### 4.7 Base reutilizável
- `.btn-press` (já global) retunado ao token (scale 0.96, `--motion-fast`).
- `.stagger` — qualquer container ganha cascata nos filhos diretos (cap em 10).
- `hooks/useAnimatedPresence.ts` — `{mounted, state}` para enter/exit de overlays.

---

## 5. Acessibilidade

Reset **global** em `globals.css`:
```
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.001ms !important;
    animation-delay: 0ms !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
```
Mantém o estado final (sem translação/scale perceptível) — o conteúdo continua 100% acessível. Cobre todas as animações novas e antigas. `AnimatedMoney`/`pulseOnChange` também checam `usePrefersReducedMotion` no JS.

---

## 6. Performance

- Só `transform`/`opacity` (compositor/GPU, fora da main thread) → 60fps no webview.
- `translate3d(...)` para garantir camada de composição.
- Sem dependências novas (0 KB). Sem mudanças de domínio/lógica.
- Limite implícito de animações simultâneas (stagger até 10; pulse só em mudança real) para evitar custo de composição e "fadiga".

---

## 7. Fora de escopo agora (ideias V2)

- **Shared-element transition** (ex.: card → detalhe morfando) via `view-transition-name` — depende de adotar View Transitions API de forma controlada.
- **Stagger de listas** (Gastos por dia, cards do Dashboard) — hoje deixado de fora para não conflitar com animações próprias dos cards e evitar excesso; o `.stagger` já existe pronto para aplicar pontualmente.
- **Animação de saída de página** real (página antiga deslizando enquanto a nova entra) — exigiria View Transitions API ou double-buffering; o re-mount keyed entrega entrada direcional, que já dá o sentido de "abrir/voltar".
- **Pulse no total da saída** (`OutingPage`) — o total usa `formatCurrency` em layout complexo (gauge/Bar Mode); migrar para `AnimatedMoney`+pulse fica para um pass dedicado.

---

## 8. Verificação

- `tsc -b` limpo • 944 testes (108 arquivos) verdes • `vite build` + `cap sync` + `assembleDebug` OK • APK `0.36.0` (versionCode 10) • deploy Cloudflare Pages (`--branch=main`).
