# TripPilot — Estratégia para virar App Android real (Play Store + features nativas)

> Estudo completo e verificado · **Data: 2026-06-15** · Versão do app hoje: **0.27.0**
> Autor: análise técnica (engenharia + produto + risco + custo) com pesquisa de fontes primárias.
> Status: **PROPOSTA** para aprovação do Julio. Nada aqui altera código ainda.

---

## 0. TL;DR (a resposta curta)

**A melhor forma NÃO é reescrever o app. É embrulhar o React que já existe com Capacitor (que já está instalado) e escrever uma camada nativa fina em Kotlin só para as superfícies que o navegador não alcança (widgets e notificações ao vivo).**

Três fatos que decidem tudo:

1. **Tudo que você quer — widget, notificação estilo Spotify, Now Bar da Samsung, cor/conteúdo customizado — é nativo de Android. Não existe em PWA, e não existe "de graça" em NENHUM framework.** Quem te dá isso é código Kotlin, não a escolha do framework.
2. **Você tem um app React maduro: 898 testes, v0.27, local-first, deployado.** Reescrever em React Native ou Flutter joga fora meses de trabalho **sem ganhar nenhuma capacidade nativa a mais** — porque o widget/Live Update vai ser Kotlin de qualquer jeito.
3. **Capacitor te entrega o projeto Android nativo completo.** Dentro dele você escreve o Kotlin do widget e da notificação ao vivo (Android 16 *Live Updates* → entra na *Now Bar* da Samsung automaticamente no One UI 8). O React roda sem mudar uma linha.

**Recomendação: Capacitor + módulos Kotlin nativos. Confiança: ALTA.**

Caminho de pagamentos (futuro): bens digitais (premium/assinatura) → **Google Play Billing** é obrigatório (com a nova opção de billing alternativo nos EUA/EEE/UK, ainda em definição judicial); serviços/produtos físicos → **Stripe** liberado. Fora de escopo agora, mas a arquitetura já fica preparada.

---

## 1. Onde estamos hoje (ponto de partida)

| Item | Estado atual | Fonte |
|---|---|---|
| App | React 19 + TypeScript + Vite + Tailwind, PWA local-first | `technical-direction.md` (DEC-003) |
| Dados | IndexedDB via Dexie, offline, sem backend | DEC-004 |
| Hospedagem | Cloudflare Pages (`trippilot.pages.dev`) + Worker de sync P2P | DEC-005 / DEC-107 |
| Maturidade | v0.27.0, 898 testes unitários + e2e, deploy contínuo | `project-status.md` |
| Capacitor | `@capacitor/core` **8.4.0** já instalado, `capacitor.config.ts` existe (`appId: com.trippilot.app`), **mas ainda NÃO existe a pasta `android/`** | `package.json` |
| Decisão prévia | DEC-002 "PWA First", DEC-017 "Capacitor depois, p/ APK + notificações locais" | `decision-log.md` |
| Teto do PWA já comprovado | A notificação de saída ativa (DEC-120) bateu no limite do navegador: **não dá notificação ao vivo/ongoing, sem layout custom, sem cor que você quer**. Já está documentado e VERIFICADO em `pwa-notification-research.md` | DEC-120 / DEC-124 |

**Tradução:** metade do caminho já foi andado (Capacitor instalado, decisão tomada) e o próprio app já bateu na parede do PWA exatamente no ponto que você reclama (a notificação "feia, sem cor, sem a informação certa"). Este documento é o plano para atravessar essa parede.

---

## 2. A pergunta certa (reenquadrando o problema)

Você pediu "qual a melhor forma de virar um app real". A pergunta parece ser **"qual framework?"**, mas na verdade são **três perguntas independentes**:

1. **Como botar o app dentro de um pacote nativo (.aab/.apk) na Play Store?**
2. **Como ter widget, notificação ao vivo (Now Bar/Spotify), cor e controle total?**
3. **Como cobrar (futuro)?**

O erro clássico aqui é achar que "React Native/Flutter dão poderes nativos e PWA/Capacitor não". **Falso.** Widgets e Live Updates são **APIs nativas do Android escritas em Kotlin/Java** — você escreve o mesmo Kotlin independentemente de o resto do app ser React, React Native ou Flutter. A diferença entre os frameworks é só **quanto do seu app atual você joga fora** e **como a parte JS conversa com esse Kotlin**.

Logo, a decisão real é: **qual a forma de obter um shell nativo com acesso 100% nativo, preservando o app React maduro que já existe?**

---

## 3. As 5 abordagens, comparadas (com fatos verificados)

| Abordagem | Reaproveita o React de hoje? | Esforço de migração | Widget nativo? | Notificação Live/Now Bar? | Performance | Veredito p/ TripPilot |
|---|---|---|---|---|---|---|
| **PWA puro (hoje)** | 100% | zero | ❌ Impossível | ❌ Impossível (comprovado DEC-120) | Boa | Já no teto. Não atende. |
| **TWA / PWABuilder / Bubblewrap** | 100% | baixíssimo | ❌ Não (é só uma aba Chrome em tela cheia) | ❌ Não | Boa | Põe na Play Store, mas **não destrava nada nativo**. Beco sem saída p/ seus objetivos. |
| **✅ Capacitor (recomendado)** | **100%** | **baixo** | ✅ **Sim** (Kotlin/Glance + ponte de dados) | ✅ **Sim** (plugin Kotlin custom) | Boa (WebView) | **Mantém o app inteiro E dá acesso nativo total.** |
| **React Native** | Parcial (só lógica/TS; **UI toda reescrita**) | **alto** | ✅ Sim (native module) | ✅ Sim (native module) | Excelente | Reescrever UI de um app de 898 testes **sem ganho nativo extra**. Não compensa. |
| **Flutter** | **0%** (Dart, outra linguagem) | **altíssimo** | ✅ Sim (platform channel) | ✅ Sim (platform channel) | Excelente | Reescrita total. Fora de cogitação aqui. |
| **Kotlin nativo puro** | 0% | altíssimo | ✅ Sim | ✅ Sim | Máxima | Reescrita total. Só faria sentido se o app fosse trivial — não é. |

**Fontes (verificadas 2026-06-15):**
- Capacitor reaproveita 100% do web e custa **1/3 a 1/5** do esforço de RN/Flutter para portar um web app existente (Capacitor 8.3.x, abr/2026). *Confiança: ALTA.*
- Capacitor permite **escrever Kotlin arbitrário** no projeto Android (custom plugins via `@CapacitorPlugin`, registrados no `MainActivity`) — doc oficial `capacitorjs.com/docs/android/custom-code`. *Confiança: ALTA.*
- Widgets exigem código nativo (RemoteViews/Jetpack Glance) em **qualquer** abordagem; o web não roda dentro de widget. *Confiança: ALTA.*
- TWA é, por definição, uma Trusted Web Activity (Chrome em tela cheia) — sem superfícies nativas próprias. *Confiança: ALTA.*

### Por que Capacitor vence aqui (e não é "porque é mais fácil")

A objeção comum a Capacitor é "performance de WebView" e "parece web". Mas:

- O TripPilot **não é** um app de animação 60fps/scroll infinito/jogo — é um app de finanças/formulários/listas, exatamente o caso onde WebView moderno (Chrome WebView no Android) performa muito bem. *Confiança: ALTA.*
- "Parece web" é resolvido pelo seu próprio design system (já existe, "Mediterranean Cockpit", DEC-022), não pelo framework.
- E o ponto decisivo: **Capacitor não impõe teto nativo.** Você tem o projeto Android Studio inteiro. O widget e a Live Update são Kotlin de primeira classe, iguais aos de um app nativo. O WebView só hospeda a tela principal.

> **Conclusão da seção 3:** Capacitor é a única opção que **soma** (mantém o app + abre o nativo) em vez de **trocar** (jogar fora o app para reabrir o nativo do zero).

---

## 4. As features que você quer — viabilidade e COMO fazer

Aqui está o coração do pedido. Para cada coisa que você citou: **dá? como? qual o limite honesto?**

### 4.1 Notificação ao vivo estilo Spotify / Now Bar da Samsung ✅ (a estrela)

**O que é tecnicamente:** o que a Samsung chama de *Live Notification* na *Now Bar* é, no One UI 8 (baseado em Android 16), a feature **"Live Updates" do próprio Android 16** — notificações *promoted ongoing* que ganham destaque no topo da gaveta, na tela de bloqueio e como **chip na barra de status**.

**Verificado (developer.android.com + Android Authority/Police, 2026-06-15):**
- One UI 7: Now Bar só funcionava com apps da Samsung/Google.
- One UI 8: **abre para qualquer app** que implemente a API de Live Updates do Android 16. *Confiança: ALTA.*
- Ou seja: **implementou Live Updates → entra na Now Bar da Samsung de graça.**

**Como se faz (Kotlin, nativo, dentro do Capacitor):**

```kotlin
val builder = NotificationCompat.Builder(context, CHANNEL_ID)
    .setSmallIcon(R.drawable.ic_stat_flight)
    .setContentTitle("Saída ativa · Bar do Zé")
    .setOngoing(true)                        // obrigatório p/ promover
    .setRequestPromotedOngoing(true)         // pede o "modo Now Bar"
    .setShortCriticalText("€48/€60")         // o texto do chip na status bar
    .setStyle(
        NotificationCompat.ProgressStyle()
            .setProgress(48)                  // gasto atual
            // segmentos coloridos = sua identidade (terracota etc.)
            .addProgressSegment(Segment(35).setColor(GREEN))   // até a meta
            .addProgressSegment(Segment(15).setColor(AMBER))   // meta→teto
            .addProgressSegment(Segment(10).setColor(RED))     // teto→máx
    )
```

**Requisitos obrigatórios (todos verificados na doc oficial):**
- Permissão no manifest: `android.permission.POST_PROMOTED_NOTIFICATIONS`.
- `setOngoing(true)` + `setRequestPromotedOngoing(true)`.
- Ter `contentTitle`. Canal com importância ≥ default.
- Estilo permitido: **Standard, BigTextStyle, CallStyle, ProgressStyle ou MetricStyle**.
- **NÃO** usar `customContentView`/RemoteViews. **NÃO** usar `setColorized(true)`.
- Compilar contra o **SDK do Android 16 (API 36)**.

**Sobre a cor (sua reclamação direta "não tem a cor que eu quero"):**
- Você **PODE** colorir: os **segmentos do ProgressStyle têm cor própria** (`Segment.setColor`) — perfeito para o seu sistema de 3 limites (Meta/Teto/Máx em verde/âmbar/vermelho), e dá pra usar o terracota da marca. O ícone pequeno também é tintado (já temos `iconColor: #C75B39` no `capacitor.config.ts`).
- **Limite honesto:** se você quiser um **layout 100% custom** (fundo terracota, fontes próprias, qualquer pixel), isso exige RemoteViews — **e RemoteViews te desqualifica da promoção/Now Bar** (são mutuamente exclusivos). Então existem **duas trilhas** e você escolhe por superfície:

| Trilha | Controle visual | Entra na Now Bar / chip na status bar? | Uso recomendado |
|---|---|---|---|
| **A — Live Update (ProgressStyle)** | Cor por segmento + ícone tintado + chip; layout é do sistema | ✅ **Sim** | **A saída ativa** (o "uau" do Now Bar) |
| **B — Notificação custom (RemoteViews)** | 100% (qualquer cor/layout) | ❌ Não | Casos onde layout total importa mais que o Now Bar |

**Recomendação:** Trilha A para a saída ativa (é o efeito que você quer ver na Now Bar) + **widget** (seção 4.3) para o visual 100% da marca. Assim você tem o melhor dos dois.

**Mapeando ao seu caso de uso real (saída/outing):** o chip mostra `€48/€60`; a barra mostra os 3 limites coloridos; o título dá a ocasião; ações `+€5 / +€7 / abrir`. Tudo que o DEC-120 quis e o PWA não deixou — agora entrega de verdade.

**Degradação graciosa:** em Android < 16 (ou One UI < 8), a mesma notificação aparece como **ongoing normal** (sem o chip/Now Bar). Ninguém fica sem nada; quem tem Samsung novo ganha o efeito premium.

### 4.2 Notificação "ongoing" de verdade + media-style (controles fixos) ✅

Para a saída ficar **fixa, não-dispensável** enquanto rola (foreground service), e/ou ter cara de player:

- **Foreground service** com notificação ongoing + botões: plugin `@capawesome-team/capacitor-android-foreground-service` (v8.1.0, mar/2026) — suporta `buttons`, `serviceType`, `silent` (atualiza sem vibrar de novo). *Verificado. Confiança: ALTA.*
- **Media-style real** (controles na lockscreen como Spotify): plugin `@capawesome-team/capacitor-media-session` (v8, ativo) usa `MediaSession` nativo. Útil se você quiser literalmente a estética de player. *Verificado.*
- Em Android 14+, foreground service **exige** declarar `foregroundServiceType` no manifest + permissão `POST_NOTIFICATIONS` (Android 13+). *Verificado.*

**Recomendação:** para orçamento, a **Live Update (ProgressStyle)** comunica melhor que media-style (barra de progresso = quanto já gastei). Use foreground service para garantir persistência durante a saída.

### 4.3 Widget na home ✅ (controle visual 100%)

**Verificado:** widget **não** sai do Capacitor "de graça" — a UI do widget é **nativa** (Kotlin), via **Jetpack Glance** (moderno, sintaxe tipo Compose) ou RemoteViews clássico. O web **não** roda no widget. *Confiança: ALTA.*

**Como funciona a ponte de dados (padrão consagrado):**
1. O app React grava o que o widget mostra (ex.: "livre hoje", total da saída) em **SharedPreferences** via `@capacitor/preferences`.
2. Dispara um **broadcast intent** para acordar o widget.
3. O `GlanceAppWidget`/provider nativo **lê** o SharedPreferences e redesenha.

```text
React (Dexie) ──grava──> SharedPreferences ──broadcast──> Widget (Glance/Kotlin) redesenha
```

**O que dá pra fazer (com cor/marca 100%, sem as limitações da notificação):**
- "Livre hoje: €42" grande, com o terracota da marca.
- Card da saída ativa (gasto vs meta) na home.
- Atalhos: registrar gasto / abrir saída (deep link pra dentro do app).

Existem plugins que ajudam o bridge (`@capgo/capacitor-widget-kit`), mas **a UI do widget continua sendo Kotlin** — é o esperado.

### 4.4 Cor e "trazer a informação certa" ✅

Resolvido em dois lugares:
- **Notificação ao vivo:** cores por segmento + ícone tintado + chip com o número que importa (`setShortCriticalText`). Conteúdo é montado pelo app (você decide o quê: gasto/meta/≈N drinks).
- **Widget:** controle total de cor/layout/tipografia (é UI nativa sua).

A frustração de hoje ("notificação feia, sem cor, sem a info certa") era **limite do PWA**, não falta de capricho. No nativo isso sai.

### 4.5 Bônus que o nativo destrava (já que vamos lá)

- **Notificações locais agendadas confiáveis** (`@capacitor/local-notifications`) — lembretes ("fim do dia, registrou os gastos?").
- **App badge** no ícone, **biometria** (destrava o DEC-161 que ficou só com PIN), **back button** nativo, **splash/ícone** nativos.
- **iOS quase de graça no futuro:** mesma base Capacitor gera iOS também. O equivalente da Now Bar no iOS são as **Live Activities** (API diferente, e Apple custa **US$ 99/ano**). Fica **fora de escopo** (você já disse que iPhone não é foco), mas a **porta permanece aberta** sem retrabalho — um ganho estratégico de graça.

---

## 5. Caminho da Play Store (passo a passo, verificado)

| Etapa | O que é | Detalhe verificado (2026-06-15) |
|---|---|---|
| **Conta** | Google Play Console | **US$ 25, taxa única** (Apple é US$ 99/ano). Não reembolsável. *ALTA.* |
| **Tipo de conta** | Pessoal vs Organização | **Conta pessoal criada após 13/nov/2023:** exige **teste fechado com ≥12 testadores opt-in por 14 dias consecutivos** antes de liberar produção. **Conta de organização é isenta**, mas exige número **D-U-N-S**. *ALTA.* |
| **Target API** | `targetSdkVersion` | Desde **31/ago/2025**, apps novos/atualizações exigem **API 35 (Android 15)** no mínimo. Para Live Updates compilamos contra **API 36 (Android 16)**. *ALTA.* |
| **Build** | Pacote de publicação | **AAB** assinado (Android App Bundle), com **Play App Signing** (Google guarda a chave de assinatura — você guarda a *upload key*). |
| **Listing** | Ficha da loja | Ícone, screenshots, descrição, política de privacidade (URL), categoria. |
| **Data safety** | Formulário de dados | **Aqui o local-first é vantagem de marketing:** "dados ficam no seu aparelho, sem servidor". Declarar o mínimo (sync P2P é E2E). |
| **Testes** | Closed testing | Recrutar **14–16 testadores** (folga p/ desistências) e rodar 14 dias. |
| **Produção** | Liberação | Após teste + questionário de "production access". Revisão costuma levar **dias a ~2 semanas**. |

**Implicação prática no cronograma:** o gargalo **não é técnico**, é a **regra dos 12 testadores/14 dias** (se for conta pessoal). **Comece o teste fechado cedo** — enquanto você lapida widget/notificação, os 14 dias já correm em paralelo.

**Decisão a tomar (sua):** conta **pessoal** (US$ 25, mas 12 testadores/14 dias) vs **organização** (isenta do teste, mas precisa D-U-N-S e CNPJ/empresa). Para um indie, pessoal costuma ser o caminho; se houver CNPJ, a organização poupa a dança dos testadores.

---

## 6. Pagamentos (futuro — fora de escopo agora, arquitetado desde já)

Você disse "talvez no futuro". Então: **não construir agora**, mas **não pintar a arquitetura num canto**. O que a regra do Google diz (verificado):

| Você vende... | Precisa Google Play Billing? | Pode Stripe? |
|---|---|---|
| **Bens/serviços físicos** (produto, transporte, ingresso, entrega) | ❌ Não | ✅ **Sim, sempre** |
| **Bens digitais** (premium, assinatura, "ad-free", **"software de gestão financeira"**, features extras) | ✅ **Sim** (regra padrão) | Só via **billing alternativo** habilitado |

**Onde o TripPilot cai:** funcionalidade premium / assinatura = **bem digital** → **Play Billing** é a rota padrão. *Confiança: ALTA.*

**A reviravolta de 2025/2026 (marcar como EM EVOLUÇÃO):** após o caso Epic vs. Google, desde ~29/out/2025 desenvolvedores nos **EUA (e já antes EEE/UK)** podem oferecer **billing alternativo / checkout externo** para bens digitais, com **service fee** decoupled (~**20%** novas instalações / ~**9%** em programas, vs. até 30% antigos; Play Billing próprio = 5% de billing fee + service fee). **Há audiência de acordo em jan/2026 e a injunção vale até nov/2027** — ou seja, **as taxas e regras ainda podem mudar.** *Confiança: MÉDIA (em litígio).*

**Recomendação de arquitetura (custa quase nada agora):**
- Isolar a noção de **"entitlement" (direito premium)** atrás de uma interface limpa em TS (`src/domain/billing/` futuro), sem espalhar `if (isPro)` pelo código.
- Quando for monetizar: usar **Play Billing** (eventualmente via **RevenueCat** para abstrair Play+App Store) para o premium digital; **Stripe** só se um dia houver venda de serviço/físico.
- **Não** acoplar pagamento ao core de orçamento. O app deve funcionar 100% sem pagar (mantém o espírito local-first).

---

## 7. Impacto no código (spoiler: pequeno e limpo)

A beleza do caminho Capacitor é que o **app React não muda**. O que entra é uma **camada nativa fina e bem isolada**:

```text
TripPilot/
  src/
    native/                 # NOVO: interfaces TS dos plugins custom (ponte tipada)
      live-update.ts        #   registerPlugin<LiveUpdatePlugin>('LiveUpdate')
      widget-bridge.ts      #   grava SharedPreferences + dispara refresh
    domain/                 # inalterado (lógica pura, 898 testes seguem válidos)
    features/ ...           # inalterado
  android/                  # NOVO (npx cap add android): projeto Android Studio
    app/src/main/java/com/trippilot/app/
      LiveUpdatePlugin.kt   #   Live Updates (ProgressStyle/Now Bar)
      OutingWidget.kt       #   widget Glance
      MainActivity.kt       #   registerPlugin(...)
    AndroidManifest.xml     #   POST_PROMOTED_NOTIFICATIONS, FOREGROUND_SERVICE...
  capacitor.config.ts       # já existe
```

**Princípios (alinhados ao `software-engineering-guidelines.mdc`):**
- A ponte é **fina**: o Kotlin não tem regra de negócio — ele só **renderiza** o que o domínio TS calcula (igual ao padrão do SW no DEC-120, onde o app monta o payload e o nativo só exibe).
- Cada plugin custom = uma responsabilidade (Live Update, Widget). Sem abstrações novas no domínio.
- **Lembrete da regra do projeto:** editar sempre os arquivos **`.ts`**, nunca os `.js` compilados.
- `Dexie`/local-first **permanece** — o widget lê um espelho leve em SharedPreferences, não o IndexedDB direto (IndexedDB não é acessível fora do WebView).

---

## 8. Conselho multi-perspectiva (síntese)

> Conforme a prática de council do projeto, avaliei por 4 ângulos. (Feito inline, sem subagentes, respeitando a regra de execução direta.)

**Estrategista (negócio/longo prazo):** virar app nativo destrava retenção (widget/notificação = app "vive" na tela do usuário), credibilidade (estar na Play Store) e o futuro de monetização. Capacitor mantém **uma única base** que serve web + Android + (futuro) iOS — máximo alcance, mínimo custo. *Bottom line: Capacitor é o movimento de maior alavancagem.*

**Arquiteto (técnico):** o app é local-first com domínio puro testado; a fronteira nativa é pequena e encaixa no padrão "app calcula, camada externa exibe" que já existe. RN/Flutter custam reescrita da UI **sem** ganho nativo, porque widget/Live Update é Kotlin em todos. *Bottom line: Capacitor + Kotlin custom é o de menor dívida técnica.*

**Crítico (advogado do diabo):** riscos reais — (1) Now Bar só brilha em Android 16/One UI 8 (mitigado por degradação graciosa); (2) battery managers de Samsung/Xiaomi podem matar serviços (mitigado por foreground service + a Live Update ser do sistema); (3) manter um pé em Kotlin é nova competência (mas superfície minúscula); (4) regra dos 12 testadores atrasa o lançamento (mitigado: começar cedo, em paralelo); (5) **perder a keystore = perder o app** — fazer backup da chave. *Bottom line: riscos conhecidos e mitigáveis; nenhum é bloqueador.*

**Advogado do usuário (UX):** é exatamente o que falta — a notificação "viva" e o widget transformam o uso na hora da saída (não precisa abrir o app no bar). O usuário Samsung vai sentir o app "premium". *Bottom line: ganho de UX alto e direto na dor relatada.*

**Consenso:** Capacitor + Kotlin. **Divergência:** nenhuma relevante sobre o framework; a única escolha aberta é **conta pessoal vs organização** na Play Store (decisão sua, seção 5). **Confiança geral: ALTA.**

---

## 9. Roadmap recomendado (fases, ordenadas por valor)

> Estimativas em padrão **Tier 3** (`velocity-standard.mdc`: brain + fases + IA ≈ ÷3,3). "≈" = horas efetivas estimadas, não dias corridos.

| Fase | Entrega | Por que primeiro | Esforço (Tier 3) |
|---|---|---|---|
| **A — Shell nativo** | `npx cap add android`, ícone/splash, AAB assinado, rodando no seu aparelho + **internal testing** na Play Console | Tira do "site" e vira app de verdade; **dispara o relógio dos 14 dias** | ≈ 6–10h |
| **B — Saída ativa ao vivo** | Plugin Kotlin `LiveUpdate` (ProgressStyle + foreground service), cores dos 3 limites, chip na status bar, botões +€X | É **a sua dor #1** e o efeito "Now Bar" | ≈ 12–18h |
| **C — Widget na home** | `OutingWidget` (Glance) "livre hoje" + saída ativa, ponte SharedPreferences, deep links | Presença diária na tela; visual 100% da marca | ≈ 10–16h |
| **D — Play Store produção** | Closed testing (12+ testadores/14 dias), data safety, política de privacidade, questionário, release | Distribuição pública | ≈ 6–10h + **14 dias de espera** |
| **E — Pagamentos (futuro)** | Camada de entitlement + Play Billing (RevenueCat) quando decidir monetizar | Só quando houver premium definido | a definir |

**Ordem inteligente:** começar **A** já dispara o teste fechado; enquanto os 14 dias correm, você faz **B** e **C**; aí **D** sai sem espera adicional. Caminho crítico ≈ **2–3 semanas corridas** (dominadas pela espera de testes), não pelo código.

---

## 10. Decisões propostas para registrar no brain (DEC-185+)

*(Última decisão hoje: DEC-184. Sujeito à sua aprovação.)*

- **DEC-185 — Estratégia de empacotamento: Capacitor (não reescrever).** Manter a base React 19; adicionar a plataforma Android via Capacitor; recusar TWA (sem nativo) e RN/Flutter/Kotlin-puro (reescrita sem ganho nativo). *Supersede parcialmente o tom de DEC-002/DEC-017, confirmando-os.*
- **DEC-186 — Camada nativa fina em Kotlin.** Plugins custom (`LiveUpdate`, `WidgetBridge`) sem regra de negócio; domínio TS permanece a fonte da verdade ("app calcula, nativo exibe").
- **DEC-187 — Notificação da saída via Android 16 Live Updates (ProgressStyle).** Trilha A (promovível/Now Bar) para a saída ativa; cores por segmento (Meta/Teto/Máx); degradação graciosa < Android 16. Trilha B (RemoteViews) reservada a casos sem necessidade de Now Bar.
- **DEC-188 — Widget de home nativo (Jetpack Glance)** alimentado por SharedPreferences espelhando "livre hoje" e a saída ativa.
- **DEC-189 — Publicação na Play Store** com `targetSdk 35+` (compile 36), AAB + Play App Signing; **decisão pendente: conta pessoal vs organização**.
- **DEC-190 — Pagamentos fora de escopo agora**, mas isolar "entitlement"; quando ativar, premium digital via **Play Billing** (regra padrão), Stripe só p/ físico/serviço; acompanhar a evolução do billing alternativo (litígio, audiência jan/2026).

---

## 11. Fontes (verificadas em 2026-06-15)

| Tema | Fonte | Confiança |
|---|---|---|
| Live Updates / ProgressStyle (requisitos, permissão, sem RemoteViews/colorized) | developer.android.com — *Create live update notifications* (Views/Compose) e *Progress-centric notifications* (Android 16) | **VERIFIED** |
| Now Bar abrindo p/ terceiros no One UI 8 via Live Updates | Android Authority, Android Police, developer-tech (jun/2025) | **ALTA** (imprensa especializada confirmando feature de beta/SDK) |
| Capacitor escreve Kotlin custom (plugins locais) | capacitorjs.com/docs/android/custom-code; /plugins/android | **VERIFIED** |
| Widgets exigem nativo + ponte SharedPreferences | developer.android.com (Glance); fórum Ionic; Capgo widget-kit | **VERIFIED** |
| Foreground service / media-session plugins | npm `@capawesome-team/capacitor-android-foreground-service` (8.1.0) e `capacitor-media-session` | **VERIFIED** |
| Capacitor vs RN vs Flutter (reuso/esforço) | Oflight (Capacitor 8.3.x, abr/2026); youngju.dev deep dive; adapty | **ALTA** |
| Target API 35 (ago/2025) | support.google.com/.../11926878; developer.android.com/.../target-sdk | **VERIFIED** |
| 12 testadores / 14 dias (conta pessoal pós nov/2023) | support.google.com/.../14151465 | **VERIFIED** |
| Taxa US$ 25 única | Google Play Console signup; guias 2026 | **VERIFIED** |
| Play Billing p/ digital vs Stripe p/ físico | support.google.com/.../9858738 e /10281818 | **VERIFIED** |
| Billing alternativo / fees pós-Epic (em litígio) | Android Police (nova estrutura de fees), Adapty, Solidgate | **MÉDIA** (em evolução até nov/2027) |

---

## 12. Próximos passos (o que eu preciso de você)

1. **Aprovar a direção** (Capacitor + Kotlin) — ou pedir ajustes.
2. **Decidir conta Play: pessoal (US$ 25, 12 testadores) ou organização (D-U-N-S, isenta de teste).**
3. Se aprovar, eu começo pela **Fase A** (adicionar Android, gerar o AAB, subir internal testing) e já te passo o roteiro para recrutar os testadores em paralelo.

---

## Apêndice A — Fase A executada (2026-06-15)

Direção aprovada pelo Julio. A **base local da Fase A** foi montada (sem tocar no app web — `src/` intacto, 898 testes seguem válidos):

| Feito | Detalhe |
|---|---|
| `@capacitor/android@^8.4.0` instalado | adicionado ao `package.json` |
| Projeto `android/` criado | `npx cap add android` (Node 22 via nvm) + `cap sync`; web assets de `dist/` copiados |
| SDK confirmado | Capacitor 8 já gera **compileSdk/targetSdk 36 (Android 16)**, minSdk 24, AGP 8.13, Gradle 8.14.3 → satisfaz Play (API 35+) e habilita Live Updates (Fase B) sem ajuste |
| Assinatura de release | `android/app/build.gradle` lê de `keystore.properties` (condicional, não quebra sem o arquivo); `versionName "0.27.0"`, `versionCode 1` |
| Segredos protegidos | `android/.gitignore`: `*.jks`, `*.keystore`, `keystore.properties` |
| Template | `android/keystore.properties.example` (com o comando `keytool`) |
| Toolchain WSL | `scripts/setup-android-toolchain.sh` (JDK **21** — exigido pelo Capacitor 8 — + SDK 36 + build-tools + `local.properties`) |

### A.1 — Recomendação de conta (Play Console)

**Recomendo conta PESSOAL** (US$ 25 única) se você é indie/sem CNPJ que queira usar agora — o "custo" é a regra dos **12 testadores por 14 dias**, que se resolve recrutando 14–16 conhecidos e **começando o teste cedo** (corre em paralelo às Fases B/C). Só vá de **organização** se já tem CNPJ + D-U-N-S e quer pular o teste obrigatório; o processo de verificação da empresa costuma demorar mais que os 14 dias dos testadores, então para começar logo, **pessoal vence**. *Confiança: ALTA.*

### A.2 — Como gerar o AAB (dois caminhos)

**Caminho 1 — Android Studio (Windows, mais à prova de falhas, você já tem):**
1. Abrir a pasta `TripPilot/android` no Android Studio (via `\\wsl$\...`).
2. Deixar ele baixar SDK 36/build-tools/aceitar licenças.
3. `Build > Generate Signed App Bundle` → criar/usar o upload keystore → AAB.

**Caminho 2 — Tudo no WSL (linha de comando):**
```bash
bash scripts/setup-android-toolchain.sh          # uma vez (JDK + SDK)
# criar o keystore + keystore.properties (ver android/keystore.properties.example)
nvm use 22 && npm run build && npx cap sync android
cd android && ./gradlew bundleRelease
# saída: android/app/build/outputs/bundle/release/app-release.aab
```

### A.3 — O que falta para fechar a Fase A (precisa de você)
- [ ] **Decidir e criar a conta** Play Console (recomendado: pessoal, US$ 25).
- [ ] **Criar o upload keystore** e o `keystore.properties` (guardar a chave em local seguro — perdê-la = não conseguir mais atualizar o app).
- [ ] **Gerar o AAB** (caminho 1 ou 2) e subir em **Internal testing** (já dispara o relógio do teste).
- [ ] (Polimento) Trocar os **ícones/splash** padrão do Capacitor pela marca (há `public/icons/icon.svg`; usar `@capacitor/assets` numa etapa rápida).

> Observação: o app web de hoje **não foi alterado** — só ganhou um corpo nativo (`android/`). Tudo é reversível via git. Fases B (notificação ao vivo / Now Bar) e C (widget) entram quando você quiser, em cima desta base.
