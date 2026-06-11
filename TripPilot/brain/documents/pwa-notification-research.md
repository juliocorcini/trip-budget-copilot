# Pesquisa — Notificações PWA para saída ativa (R-11 / DEC-120)

**Verificado em**: 2026-06-11
**Fontes**: MDN (`ServiceWorkerRegistration.showNotification`, `Notification()`), WHATWG Notifications API Standard (review draft jan/2026), web.dev (push-notifications-display-a-notification, push-notifications-notification-behaviour)
**Contexto**: Julio pediu uma notificação persistente tipo Spotify ("notificações ao vivo" da Samsung) durante a saída ativa, com botões +€3 / +€5 / "outro" e follow-up perguntando o que foi o gasto, sem precisar abrir o app.

## O que o PWA Android PERMITE hoje (VERIFIED)

| Capacidade | API | Status |
|---|---|---|
| Notificação persistente no notification center | `registration.showNotification()` via Service Worker | ✅ Suportado (Chrome/Samsung Internet Android) |
| Botões de ação (até `Notification.maxActions`, tipicamente 2-3 visíveis) | opção `actions` (só em notificações persistentes de SW) | ✅ Suportado |
| Atualizar a MESMA notificação (novo total) | `tag` fixa — nova notificação substitui a anterior | ✅ Suportado |
| Atualização silenciosa (sem vibrar de novo) | `renotify: false` (default) ao substituir por tag | ✅ Suportado |
| Persistência parcial (não some sozinha) | `requireInteraction: true` | ✅ Suportado em Chrome/Samsung Internet Android |
| Reagir ao clique sem abrir o app | evento `notificationclick` no SW + `event.action` | ✅ Suportado (SW acorda para tratar o clique) |
| Escrever no IndexedDB a partir do SW | IndexedDB disponível no contexto do SW | ✅ Suportado |
| Badge no ícone do app | Badging API (`navigator.setAppBadge`) | ✅ Suportado em PWA instalado (não usado nesta rodada) |

## O que NÃO dá em PWA (VERIFIED)

- **Notificação "ongoing"/live real (estilo Spotify/foreground service)**: não existe API web. A notificação web pode ser dispensada pelo usuário com swipe e entra em "Limpar tudo" — o Android não permite que a web impeça isso. As "live notifications"/"Live Updates" (Android 16) são exclusivas de apps nativos.
- **Media-style / layout custom**: o layout é o padrão do sistema; sem progress bar nativa, sem botões estilizados.
- **Garantia de vida do SW**: battery management agressivo (Samsung/Xiaomi etc.) pode matar o SW; o `notificationclick` acorda o SW de forma confiável, mas updates espontâneos em background (sem push) não são garantidos.
- **`new Notification()` direto**: lança `TypeError` em browsers móveis — só `showNotification()` via SW (MDN, Chrome issue #481856).

## Decisão de implementação (DEC-120, melhor esforço entregue)

1. **App constrói o payload completo** (títulos i18n, valores rápidos, subcategorias prováveis por proximidade DEC-095, device id) e o embute no `data` da notificação — o SW não tem i18n nem imports de domínio.
2. **Notificação principal**: tag fixa `trippilot-active-outing`, `requireInteraction: true`, atualização silenciosa a cada gasto; ações `+€X`, `+€Y` (2 primeiros valores rápidos da sessão) e "Abrir app".
3. **Clique em ação**: o SW delega para uma janela aberta via `postMessage` (fluxo de domínio completo no app — `quickAddSessionExpense`); sem janela aberta, o SW grava direto no IndexedDB replicando o shape do registro (transaction + sessionItem) e re-renderiza a notificação com o novo total.
4. **Follow-up**: segunda notificação (tag `trippilot-outing-followup`) "O que foi esse gasto?" com 2 subcategorias mais prováveis + "Abrir app"; o clique grava `subcategoryId` (via app aberto ou direto no IDB).
5. **Permissão**: pedida no PRIMEIRO início de sessão com sheet explicativo — nunca no boot. Recusa é lembrada (localStorage) e não insiste.
6. **Encerrar sessão** limpa as duas notificações.

## Limitações aceitas (registradas para o usuário)

- A notificação pode ser dispensada com swipe — ela volta no próximo gasto registrado pelo app, mas não há como impedi-la de sumir.
- Sem som/vibração nos updates (intencional, `silent`); o alerta sonoro continua sendo responsabilidade dos alertas progressivos in-app (DEC-048).
- Gastos adicionados pela notificação entram como "paguei eu, não dividi" (semântica DEC-114 linha 1) — divisões continuam exigindo o app.

## Item para o pacote Capacitor (DEC-017) — NOT POSSIBLE em PWA

Quando o TripPilot for empacotado com Capacitor, migrar esta feature para:
- **Foreground service notification** (ongoing de verdade, não dispensável) com media-style/custom layout;
- **Live Updates (Android 16+)** para progresso da saída (total vs meta);
- Botões de ação ilimitados/estilizados e atualização garantida em background.
Anexar esta pesquisa como referência do que o PWA já cobre.
