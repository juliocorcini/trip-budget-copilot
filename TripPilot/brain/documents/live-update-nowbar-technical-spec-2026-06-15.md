# Spec Técnica — Live Update (Android 16) & Now Bar (Samsung) para a Saída Ativa

> **Origem:** Q5 do `post-apk-improvements-plan-2026-06-15.md` (Julio: detalhar agora).
> **Escopo:** notificação "viva", ongoing, com a cor do app e botões, refletindo a
> **saída ativa** em tempo real — e aparecendo na **Now Bar** da Samsung onde houver suporte.
> **Pertence à Track B / Fase 4** (executar só depois de N6, a base de notificação nativa).
> **Verificação de fatos:** pesquisa em 2026-06-15 (fontes citadas + nível de confiança).

---

## 1. Por que a saída encaixa perfeitamente

O Android exige que um Live Update represente **uma atividade ativa, com começo e fim**
(não passado, não futuro distante). A **saída ("outing")** do TripPilot é exatamente isso:
inicia → rodadas/gastos acontecem → encerra. É o caso de uso ideal (par com rideshare/delivery).

---

## 2. Achados VERIFICADOS — Android 16 "Live Updates"

> **Fonte:** developer.android.com — "Create live update notifications", "Progress-centric
> notifications", "Notification.ProgressStyle". **Verificado: 2026-06-15. Confiança: ALTA.**

Um **Live Update** é uma **notificação ongoing "promovida"** (promoted ongoing): o sistema a
destaca no topo da gaveta, na lock screen e como **chip na status bar**. Requisitos para
qualificar:

- **Estilo** deve ser um de: Standard, `BigTextStyle`, `CallStyle`, **`ProgressStyle`**, `MetricStyle`.
- **Permissão (não-runtime) no manifest:** `android.permission.POST_PROMOTED_NOTIFICATIONS`.
- **Solicitar promoção:** `NotificationCompat.Builder#setRequestPromotedOngoing(true)` (ou extra `EXTRA_REQUEST_PROMOTED_ONGOING`).
- **Ongoing:** `FLAG_ONGOING_EVENT`.
- **`contentTitle` definido.**
- **NÃO** usar `customContentView`/`RemoteViews` (custom layout é proibido p/ Live Update — consistência cross-OEM).
- **NÃO** ser group summary (`setGroupSummary`).
- **NÃO** `setColorized(true)` (para ser promovível). ⚠️ ver §2.1 (cor).
- **Canal** não pode ser `IMPORTANCE_MIN`.

**APIs de verificação de promoção:**
- `NotificationManager.canPostPromotedNotifications()` — usuário habilitou p/ o app?
- `Notification.hasPromotableCharacteristics()` — a notif atende aos critérios?
- `Notification.FLAG_PROMOTED_ONGOING` — foi promovida?
- `Settings.ACTION_MANAGE_APP_PROMOTED_NOTIFICATIONS` — manda o usuário às configurações.

**`ProgressStyle`** (o template progress-centric): segmentos coloridos, pontos (marcos) e
ícone "tracker". Classes: `Notification.ProgressStyle`, `.Segment`, `.Point`. Métodos-chave:
`setProgress`, `addProgressSegment`/`setProgressSegments`, `addProgressPoint`/`setProgressPoints`,
`setProgressTrackerIcon`, `setStyledByProgress`, `setProgressIndeterminate`.

> **Nota OEM (verificada):** "OEMs podem impor critérios adicionais de elegibilidade." → testar por fabricante.

### 2.1 Cor (atenção a uma sutileza verificada)
A doc de **Live Update** diz "NÃO `setColorized(true)`" (senão não promove). Já o exemplo da
referência de `ProgressStyle` usa `setColorized(true)` em contexto geral. **Resolução:** para
manter a promoção (Live Update/Now Bar), **não** colorir o fundo; a "cor do app" vem de
`setColor(accent)` + cores dos **segmentos/pontos** do `ProgressStyle`. Assim atendemos o
desejo do Julio ("cor certa") sem perder a promoção. **Confiança: MÉDIA-ALTA** (confirmar no device).

---

## 3. Achados VERIFICADOS — Samsung Now Bar (One UI 8)

> **Fontes:** SamMobile, Android Police, Android Authority (relato de beta), akexorcist.dev
> (dev). **Verificado: 2026-06-15. Confiança: MÉDIA** (imprensa/beta, não doc oficial Samsung dev).

- **One UI 7:** Now Bar / Live Notifications eram **exclusivas de apps Samsung whitelisted** — apps gerais **NÃO** conseguiam usar. (akexorcist.dev — VERIFICADO)
- **One UI 8 + Android 16:** a Now Bar **consome o Live Updates do Android 16**. Qualquer app
  de terceiros que use a API de Live Updates aparece na Now Bar (chip na status bar, lock
  screen, gaveta). Há um toggle de desenvolvedor "Live notifications for all apps".
- **Implicação prática:** **não precisamos de SDK Samsung** nem de whitelist no One UI 8 —
  basta implementar o **Live Update padrão do Android 16**. A Now Bar vem "de graça" onde o
  One UI 8 estiver presente. Em **One UI 7 não funciona** pra nós (whitelist).

> **NOT VERIFIED:** disponibilidade/estabilidade exatas por modelo Samsung e se o toggle "all
> apps" vem ligado por padrão no estável. → validar em hardware Samsung One UI 8 real.

---

## 4. Arquitetura proposta (isolando o nativo do domínio)

```
domain/outing (PURO)  ──emite estado──▶  utils/native/live-outing.ts (adapter)
                                                │  (só quando isNativeApp)
                                                ▼
                                   LiveOutingPlugin (Capacitor, Kotlin)
                                                │
                                                ▼
                                   OutingLiveService (Foreground Service)
                                                │  posta/atualiza
                                                ▼
                         Notification (ProgressStyle, promoted ongoing)
                                                │  botões (Action)
                                                ▼
                       BroadcastReceiver ──▶ plugin ──▶ evento JS ──▶ orchestrator de saída
```

**Princípios:**
- O **domínio continua puro** (testável): orchestrators de saída emitem o estado; o adapter
  traduz pro plugin. Nenhum import nativo no domínio.
- **Plugin custom Kotlin** (`LiveOutingPlugin`) com API mínima:
  `start(outing)`, `update(state)`, `addRound(round)`, `end()`, `isSupported()`.
- **Foreground Service** (`OutingLiveService`) segura a notificação enquanto a saída está
  ativa e a atualiza a cada evento (rodada/gasto/tempo).
- **Botões → BroadcastReceiver → plugin → evento JS → orchestrator** (ex.: "registrar rodada",
  "encerrar saída"). Fecha o loop sem abrir o app.

### 4.1 Mapeamento ProgressStyle → saída (proposta de design)
- **Tracker/título:** nome da saída + total gasto ao vivo (ex.: "Bar do Centro · €42").
- **Segmentos:** podem representar o **orçamento da saída** (parte usada vs livre) com cores do app.
- **Pontos (marcos):** cada **rodada/gasto** vira um ponto na linha.
- **Ações:** `+ Rodada` · `Encerrar`. (ambas via broadcast)
- **Cor:** `setColor(accent do tema)` + cores de segmentos/pontos (sem `setColorized(true)`).

> Design exato (o que vira segmento × ponto) a refinar com o Julio na execução da Track B.

---

## 5. Manifest & permissões (Track B)

- `android.permission.POST_PROMOTED_NOTIFICATIONS` (Live Update)
- `android.permission.POST_NOTIFICATIONS` (já vem de N6)
- `android.permission.FOREGROUND_SERVICE` + tipo apropriado (ex.: `FOREGROUND_SERVICE_SPECIAL_USE` ou `DATA_SYNC` — **definir e justificar**; políticas do Play exigem justificativa de tipo).
- `<service>` declarado para `OutingLiveService` com `foregroundServiceType`.
- Canal de notificação dedicado, `IMPORTANCE` ≥ default (não MIN).

> **NOT VERIFIED / decisão de execução:** qual `foregroundServiceType` o Play aceita melhor para
> este caso (não é mídia, não é localização contínua). Pesquisar política vigente na execução.

---

## 6. Matriz de fallback por versão/OEM

| Ambiente | Comportamento |
|---|---|
| **Android 16+ (Pixel/AOSP)** | Live Update completo (ProgressStyle + promoted ongoing + chip na status bar). |
| **Android 16 + One UI 8 (Samsung)** | Idem + **Now Bar** (de graça via Live Updates). Validar no device. |
| **Android 13–15** | Sem "promoted ongoing": cair pra notificação **ongoing normal** com progresso + ações + `setColor`. Sem chip/Now Bar. |
| **Android < 13** | Notificação ongoing simples; sem permissão runtime de notificação. |
| **One UI 7** | **Sem Now Bar pra nós** (whitelist). Comporta como Android normal da versão. |

Detecção: `Build.VERSION.SDK_INT` + `NotificationManager.canPostPromotedNotifications()` / `hasPromotableCharacteristics()`.

---

## 7. Milestones da Track B (Fase 4 — após N6)

- **B1.0** — Scaffold do plugin Capacitor custom (Kotlin) + `isSupported()` + adapter `utils/native/live-outing.ts` (no-op no Web). AC: chamada do JS chega no Kotlin; build APK.
- **B1.1** — Foreground Service + notificação **ongoing base** (sem promoção) refletindo a saída ativa (título + total + 1 ação). AC `[device]`: aparece e atualiza ao registrar gasto.
- **B1.2** — `ProgressStyle` (segmentos/pontos = orçamento/rodadas) + cor do app. AC `[device]`: visual de progresso correto; cor certa.
- **B1.3** — Promoted ongoing (`POST_PROMOTED_NOTIFICATIONS` + `setRequestPromotedOngoing`) + checagem de elegibilidade. AC `[device]`: chip na status bar (Pixel/AOSP 16).
- **B1.4** — Ações via broadcast → orchestrator ("+ rodada", "encerrar") sem abrir o app. AC `[device]`.
- **B1.5** — Validação **Now Bar** em Samsung One UI 8. AC `[device-Samsung]` (best-effort; documentar resultado).
- **B1.6** — Fallbacks por versão (§6) + telemetria de elegibilidade. AC: matriz testada (emulador 13–16 + device real).

---

## 8. Plano de verificação (test matrix)

- **Emulador Pixel API 36** (Android 16): caminho completo Live Update.
- **Emulador API 33/34/35:** fallback ongoing.
- **Device real Samsung One UI 8:** Now Bar (best-effort).
- **Device real não-Samsung (se houver):** Live Update padrão.
- Checar: promoção (chip), atualização ao vivo, ações sem abrir app, cor, comportamento ao encerrar (remove a notif), bateria/throttling.

---

## 9. Riscos & questões abertas

- **OEM/Play policy** do `foregroundServiceType` (NOT VERIFIED) — definir na execução.
- **Now Bar real** em Samsung (MÉDIA confiança via imprensa) — só confirma no hardware.
- **Custom layout proibido** em Live Update → não dá pra fazer layout 100% arbitrário; trabalhamos dentro do `ProgressStyle` (que já é bem flexível: segmentos/pontos/cores/ícone/ações).
- **Bateria/limites de background** — Foreground Service mitiga, mas testar throttling por OEM.
- **Pré-One UI 8 / pré-Android 16:** experiência reduzida (fallback) — alinhar expectativa.

---

## 10. Resumo de confiança

| Afirmação | Confiança | Base |
|---|---|---|
| Live Update = promoted ongoing + ProgressStyle + `POST_PROMOTED_NOTIFICATIONS` | **ALTA** | developer.android.com (2026-06-15) |
| Cor via `setColor`/segmentos, sem `setColorized(true)` p/ promover | MÉDIA-ALTA | docs (sutileza) — confirmar no device |
| One UI 8 Now Bar consome Live Updates (sem SDK Samsung) | **MÉDIA** | SamMobile/Android Police/Authority (beta) |
| One UI 7 = whitelist (não serve pra nós) | ALTA | akexorcist.dev (dev) |
| `foregroundServiceType` aceito pelo Play p/ este caso | **NOT VERIFIED** | pesquisar na execução |
| Estabilidade Now Bar por modelo Samsung | NOT VERIFIED | validar em hardware |

> **Conclusão:** o caminho é **implementar o Live Update padrão do Android 16** (não há atalho
> Samsung proprietário necessário no One UI 8). Isso entrega chip na status bar, lock screen e
> Now Bar de uma vez, com fallback gracioso nas versões antigas. Executar na Fase 4, após N6.
