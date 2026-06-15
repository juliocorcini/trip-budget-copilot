# Pacote Executável — Fase 1: "App Nativo Correto"

> **Origem:** `post-apk-improvements-plan-2026-06-15.md` (Track N) + decisão Q4 do Julio (Fase 1 primeiro).
> **Objetivo da fase:** o APK passar a se comportar como app nativo correto — sem bugs de
> sistema (safe-area, status bar, voltar, permissões, notificação base, escala, haptics).
> **Saída:** um APK que "parece nativo" e destrava feedback honesto sobre o resto.
> **Padrão:** hardening de fases (gates, milestones, ACs, self-check, dev-log).

---

## NON-NEGOTIABLES (reler antes de CADA gate)

1. **Web/PWA intacto.** Todo comportamento nativo atrás de `isNativeApp()`. Rodar no browser e confirmar que nada mudou.
2. **`.ts` apenas.** Nunca editar `.js` compilado. (Exceto código nativo Kotlin/Java/Gradle/Manifest, que é fonte.)
3. **Domínio puro.** Nenhuma regra de negócio passa a depender de plugin nativo. Plugins só em `utils/native/**` (+ `utils/haptics.ts`, boundaries de `geolocation`/`notifications`).
4. **Verde por gate:** `npm run test` (≥898, 0 falhas) · `tsc --noEmit` · build web · `cap sync` + APK compila.
5. **`[device]`** = só fecha com APK reinstalado e testado no celular real.
6. **Zero regressão** (DEC-180 §0.4): nenhuma função/informação some.
7. **Bump de versão + entrada no dev-log** a cada gate.

---

## Pré-requisitos (uma vez, início do Gate 1A)

- **Node 22** para comandos Capacitor (`nvm use 22`).
- **Plugins** (alto impacto — confirmado com Julio antes de instalar):
  `@capacitor/status-bar @capacitor/app @capacitor/haptics @capacitor/geolocation @capacitor/local-notifications`
- **AndroidManifest** baseline já existente; permissões adicionadas por milestone (não tudo de uma vez).
- **Boundary nativo único:** `src/utils/native/index.ts` expondo `isNativeApp()` (wrapper de `Capacitor.isNativePlatform()`), reexportando os sub-boundaries.

---

## GATE 1A — Sistema & Layout (P0)

> Fecha quando: status bar correta nos 2 temas, nada atrás dela, e o botão voltar navega no app. APK validado.

### M1A.0 — Fundamentos nativos (N0)
- **Objetivo:** plugins instalados + detector de plataforma + inicialização única.
- **Arquivos:** `package.json` (deps), `src/utils/native/index.ts` (novo), `src/utils/platform.ts` (estender), `src/main.tsx` (bootstrap nativo), `capacitor.config.ts`.
- **Abordagem:** instalar plugins; criar `isNativeApp()`; ponto de init `initNativeShell()` chamado no boot só quando nativo (registra listeners de status bar/back/etc. nos milestones seguintes).
- **AC:** build web ok; `cap sync` ok; APK abre; `isNativeApp()` = `true` no APK e `false` no browser; nenhum import de plugin fora de `utils/native/**`.
- **Self-check:** [tests verdes] [tsc] [web inalterado] [sem import de plugin em domínio] [dev-log].

### M1A.1 — Safe-area no topo (N1) **[#1 do Julio · `[device]`]**
- **Objetivo:** nenhum header/título/botão voltar atrás da status bar; topo preenchido com a cor do tema.
- **Arquivos:** `src/utils/native/status-bar.ts` (overlay config), `index.css`/tokens (`--safe-top`, classe `.safe-top`), AppShell/header global, headers de páginas que rolam no body (ex.: `ExpenseListPage` `page-sticky-header`, `QuickAddPage`, telas fora do AppShell), `RootLayout.tsx`.
- **Abordagem:** decidir o modelo (recomendado: WebView **não** sobrepõe a status bar OU sobrepõe + `padding-top: env(safe-area-inset-top)` no contêiner de topo). Criar utilitário CSS reutilizável e aplicá-lo em **todas** as rotas (auditar rota a rota). Preencher a faixa superior com a cor do tema.
- **Risco:** MÉDIO — cobertura total de telas. Fazer checklist de rotas.
- **AC `[device]`:** em TODA rota, nada sob a status bar; faixa superior na cor do tema; sem "pulo" ao rolar; bottom inset preservado.
- **Self-check:** [checklist de rotas] [tests] [tsc] [web ok no browser] [dev-log].

### M1A.2 — Status bar segue o tema (N2) **[`[device]`]**
- **Objetivo:** cor + ícones da status bar conforme tema; troca ao vivo.
- **Arquivos:** `RootLayout.tsx` (`applyTheme`), `src/utils/native/status-bar.ts`.
- **Abordagem:** em `applyTheme(resolved)`, se `isNativeApp()`, `StatusBar.setBackgroundColor({ color })` + `StatusBar.setStyle({ style: resolved === 'light' ? Light : Dark })`. Manter a meta `theme-color` pro Web. `system` segue o SO (já há listener de `matchMedia`).
- **AC `[device]`:** tema claro → barra clara + ícones escuros; escuro → barra escura + ícones claros; troca instantânea; Web inalterado.
- **Self-check:** [tests] [tsc] [web ok] [troca de tema ok no device] [dev-log].

### M1A.3 — Botão voltar nativo (N3) **[`[device]`]**
- **Objetivo:** voltar fecha sheet aberto → senão volta uma tela → na raiz pede confirmação ("toque de novo pra sair"); nunca sai "do nada".
- **Arquivos:** `src/utils/native/back-button.ts` (novo), `RootLayout.tsx` (desativar `useBackButtonGuard` quando nativo), integração com router + estado de bottom sheets/modais.
- **Abordagem:** `App.addListener('backButton', ({ canGoBack }) => …)`. Prioridade: (1) sheet/modal aberto → fechar; (2) `canGoBack`/history → voltar; (3) raiz → toast + segundo toque em janela curta → `App.exitApp()`. Hack antigo de history fica só no Web.
- **Risco:** MÉDIO — coordenar com componentes de overlay (precisam expor "tem algo aberto?").
- **AC `[device]`:** sequência sheet→tela→confirma-saída correta em todas as telas; Web inalterado.
- **Self-check:** [tests] [tsc] [web ok] [matriz de telas no device] [dev-log].

### ✅ Checkpoint Gate 1A
Testes verdes + build web + APK compila/instala + 3 fluxos golden (abrir app, navegar e voltar, trocar tema) + re-verificar M1A.1..1A.3 + dev-log + **Context Refresh**.

---

## GATE 1B — Permissões & Serviços (P1)

> Fecha quando: persistência coerente no nativo, GPS pede permissão de verdade e a notificação nativa dispara. APK validado.

### M1B.1 — Persistência reflete a realidade nativa (N4)
- **Objetivo:** no APK, sumir banner "dados podem ser perdidos" + toggle "Armazenamento persistente"; backup manual permanece. Web idêntico.
- **Arquivos:** `SettingsPage.tsx`, componente do banner de backup, `utils/pwa.ts`/`platform.ts`.
- **Abordagem:** `isNativeApp()` ⇒ tratar como persistido (esconder banner de perda + item de Ajustes). Não remover backup manual.
- **AC:** APK sem banner/toggle de persistência; Web igual ao de hoje; backup manual nas 2 plataformas.
- **Self-check:** [tests] [tsc] [web ok] [APK sem banner] [dev-log].

### M1B.2 — GPS nativo com permissão (N5) **[`[device]`]**
- **Objetivo:** ao ligar "registrar local", o app pede permissão; concedida → coords; negada → feedback claro (não silêncio).
- **Arquivos:** `utils/geolocation.ts` (boundary: nativo×web), `AndroidManifest.xml` (`ACCESS_FINE/COARSE_LOCATION`), ponto de UI que ativa a captura.
- **Abordagem:** quando nativo, `Geolocation.checkPermissions/requestPermissions/getCurrentPosition`; senão `navigator.geolocation` (hoje). Tratar negação com toast (hoje engole erro).
- **AC `[device]`:** primeiro uso dispara diálogo do Android; concedido → coords no gasto; negado → toast; offline ok; coords não saem do device.
- **Self-check:** [tests do domínio location intactos] [tsc] [web ok] [fluxo permissão no device] [dev-log].

### M1B.3 — Notificação nativa base (N6) **[`[device]`]**
- **Objetivo:** acabar com "navegador não suporta"; pedir permissão nativa e disparar notificação real (com ≥1 botão). Base pra Track B.
- **Arquivos:** `utils/notifications.ts` (boundary), `domain/outing/outing-notification.ts` (mantém puro; troca adapter), `SettingsPage` (estado/texto), `AndroidManifest.xml` (`POST_NOTIFICATIONS`).
- **Abordagem:** `LocalNotifications` (permissão, canal, `schedule`, action types). Migrar notificação de saída ativa pro caminho nativo quando `isNativeApp()`; Web/PWA mantém o atual.
- **Risco:** MÉDIO — não regredir Web/PWA.
- **AC `[device]`:** APK pede permissão; saída ativa gera notificação com ≥1 botão funcional; Web/PWA inalterado.
- **Self-check:** [tests] [tsc] [web/PWA ok] [notif no device] [dev-log].

### ✅ Checkpoint Gate 1B
Testes verdes + build + APK + golden (ligar local→permissão→gasto com local; iniciar saída→notificação) + re-verificar 1A + dev-log + **Context Refresh**.

---

## GATE 1C — Sensação (P1/P2)

> Fecha quando: escala calibrada no aparelho + haptics nos gatilhos curados.

### M1C.1 — Calibração de escala/DPI (N7) **[`[device]`]**
- **Objetivo:** tamanho/proporção como o esperado (hoje "pequeno demais").
- **Arquivos:** doc de medição; `MainActivity` (Kotlin) e/ou injeção de viewport no nativo.
- **Abordagem:** **medir** (`innerWidth`, `devicePixelRatio`, `visualViewport`) no APK vs PWA; aplicar a alavanca de menor risco (viewport base / `webView.settings.textZoom` / `setInitialScale`); **evitar** `transform: scale()` global. Re-testar no device.
- **Risco:** MÉDIO — empírico, pode exigir 2 iterações.
- **AC `[device]`:** alvos de toque/tipografia no tamanho esperado; sem scroll horizontal; sem corte.
- **Self-check:** [medição registrada] [web inalterado] [tests] [device] [dev-log].

### M1C.2 — Haptics (N8) **[`[device]`]**
- **Objetivo:** vibrações sutis nos gatilhos do mapa (§3.2 do plano mestre); toggle em Ajustes.
- **Arquivos:** `utils/haptics.ts` (boundary), pontos de interação (FAB, long-press `useMultiSelect`, toggles, toasts sucesso/erro, troca de aba), `SettingsPage` (toggle "Vibração").
- **Abordagem:** `Haptics.impact/notification/selectionChanged` no-op no Web; respeitar toggle + acessibilidade. Só os gatilhos curados (evitar fadiga).
- **AC `[device]`:** gatilhos vibram sutilmente; toggle desliga tudo; Web sem efeito/erro.
- **Self-check:** [tests] [tsc] [web ok] [device] [dev-log].

### ✅ Checkpoint Gate 1C (fim da Fase 1)
Suite completa verde + build + APK final + golden (registrar gasto, iniciar/encerrar saída, navegar+voltar, trocar tema) + re-verificar 1A+1B cumulativo + dev-log + bump de versão.

---

## Context Refresh (entre gates)

1. Reler NON-NEGOTIABLES (acima).
2. Reler a seção do próximo gate.
3. Reler `dev-log` (estado atual).
4. Imprimir CURRENT STATE (5 linhas: gate, último milestone, testes, riscos, escopo).

## dev-log (template por milestone)

```
### [M1A.1] Safe-area topo — <data>
- O que: <resumo>
- Arquivos: <lista>
- Testes: <n passa / n falha>  Build: <ok>  APK: <ok/na>
- Riscos de regressão checados: <3 ACs anteriores>
- [device]: <validado? em qual aparelho>
- Escopo: <sem desvio / desvio + motivo>
```

## Riscos & rollback

- **Edge-to-edge cobre todas as telas?** Maior risco do 1A → checklist de rotas obrigatório.
- **Plugins = 5 deps novas** → instalar no início do 1A, com confirmação do Julio (alto impacto).
- **Rollback:** cada milestone é commit isolado; reverter um milestone não derruba os outros. Gate só fecha verde.
- **`[device]`:** sem aparelho, esses ACs ficam "pendentes de validação" — não marcar como done.

---

> **Início recomendado:** M1A.0 (fundamentos) → M1A.1 (safe-area), o "primeiro problema a arrumar".
