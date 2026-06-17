# Relatório Final — Execução das Ondas 1→5 (2026-06-17)

> **Para o Julio (ler primeiro).** Este é o arquivo que você pediu para abrir ao voltar: tudo o que
> foi entregue, os **problemas**, os **itens pulados e por quê**, os **desvios do padrão e por quê**, e
> principalmente **o que ainda precisa ser verificado/feito por você**. Detalhe gate-a-gate fica em
> `waves-execution-log-2026-06-17.md`; decisões em `decision-log.md` (DEC-212..216); plano em
> `master-fix-and-skipped-features-plan-2026-06-17.md`.

---

## 1. Resumo executivo

O plano foi **executado de ponta a ponta** até o limite do que é possível **sem um aparelho Android físico**.
Cada onda passou pelo gate completo (suíte de testes + tsc + build + E2E + deploy + verificação) antes de avançar.

| Onda | Itens | Versão | Estado |
|------|-------|:------:|--------|
| 1 | B17 (empty state Planner), B9 (vincular gasto a planejado), B12 (sim. por categoria), B7 (piso automático) | 0.65.0 | ✅ deployado |
| 2-A | B5 (nudge de compartilhar link da divisão) | 0.66.0 | ✅ deployado |
| 2-B | B8 (tipo de transação `income`, invariância provada) | 0.67.0 | ✅ deployado |
| 3 | B10 (4 módulos data-gated do Copiloto), B6 (biometria sobre o PIN) | 0.68.0 | ✅ deployado |
| 4 | B1 (receber `.csv`), B2 (App Links), B3 (GPS nativo) | 0.69.0 (APK) | 🟠 **código-completo, APK construído, NÃO promovido — aguarda device** |
| 5 | B15 (E2E no CI), B13 (orquestrador atômico de fundo) | 0.70.0 | ✅ deployado |

**Estado final de qualidade:** 1224 testes unitários / 136 arquivos verdes · tsc 0 · E2E 33/33 · web/OTA no apex
`trippilot.pages.dev` em **0.70.0**.

**Fora de escopo por decisão/design (não são pendências):** B4 (shared link v1.1 — congelado, você vai
redesenhar), B5-push/FCM (sideload-first), B11 (P2P V2), B14 (SW por plugin — condicional, alto risco), B16
(close-on-background).

---

## 2. ⚠️ O QUE PRECISA DE VOCÊ (verificação/ação)

### 2.1. Sessão de device Android — desbloqueia a Onda 4 inteira (PRIORIDADE)
A Onda 4 (lote nativo) está **100% codificada, compila e passa em todos os gates de CI**, mas os critérios de
aceite são `[device]` e **não há aparelho físico nesta sessão**. O APK foi construído (`assembleDebug`, 8,35 MB,
versionCode 22 / versionName 0.69.0) e está em:

```
TripPilot/android/app/build/outputs/apk/debug/app-debug.apk
```

**Por que NÃO promovi automaticamente:** shippar App Links sem testar em device é exatamente o bug "abre e não
navega" que o plano manda evitar; e publicar um APK não verificado em `/trippilot.apk` empurraria casca não testada
para qualquer usuário. Então mantive `latestNativeVersion` 0.56.0 / `requiredNativeVersion` 0.50.0 e o
`/trippilot.apk` vivo continua sendo o **0.56.0 verificado** (republicado byte-idêntico).

**Checklist da sessão de device (valida B1+B2+B3 e o backlog B18):**
1. Instalar o APK 0.69.0 no aparelho (sideload).
2. **B1** — no Wise/Files, "Compartilhar" um `.csv` → escolher TripPilot → deve abrir o preview de import já com as linhas.
   - Também testar "Abrir com" a partir de um gerenciador de arquivos (ACTION_VIEW).
3. **B2** — abrir no navegador do celular um link `…/pair#...` e um `…/s/<id>#k=<chave>` → deve abrir **no app** e cair
   na tela certa. **CRÍTICO:** confirmar se o `#fragment` (a chave `#k=`) **sobrevive**. Veja 2.2 abaixo.
4. **B3** — em Settings, ativar captura de localização → o Android deve mostrar o **prompt de permissão** nativo; conceder e
   confirmar que um gasto registra coordenadas.
5. **B18** — rodar o checklist consolidado de features nativas nunca testadas em device (ver dev-log) + screenshots.
6. Se tudo OK: promover o APK (copiar para `dist/trippilot.apk`, bump `latestNativeVersion` → 0.69.0 no `version.json`,
   redeploy) — ou me peça para preparar esse deploy de promoção.

### 2.2. App Links: risco do `#fragment` ser descartado (decisão pode ser necessária)
App Links no Android **podem descartar o `#fragment`** da URL. A chave de ponta-a-ponta do `/s/:id` vive justamente no
fragment (`#k=`). O código já preserva o fragment ao navegar; **falta confirmar em device** se o Android o entrega.
- **Se sobreviver:** ótimo, nada a fazer.
- **Se NÃO sobreviver:** aplicar o fallback honesto já documentado (DEC-215) → App Links só para `/pair` (cuja identidade
  não é segredo) e manter QR/scan para `/s/:id` (a chave **nunca** pode ir para a query string, onde vazaria em logs).
  Isso exige uma pequena mudança no manifest (remover o filtro `/s/*`) + um novo APK. Me avise o resultado.

### 2.3. `assetlinks.json` com SHA-256 só do keystore DEBUG
O `/.well-known/assetlinks.json` já está **no ar como JSON real** (`application/json`) no apex, com a SHA-256 do
**keystore debug** (`C9:D3:09:C5:...:71:AC`). Este ambiente **não tem `keystore.properties`** (keystore de release).
- **Ação quando houver build assinado de release:** anexar a SHA-256 do keystore de release ao array
  `sha256_cert_fingerprints` (ele aceita múltiplas) e redeployar. Sem isso, App Links só verificam para o APK assinado
  em debug.

---

## 3. Problemas encontrados (e como foram resolvidos)

Todos os problemas foram **resolvidos durante a execução** — nenhum ficou em aberto.

1. **Node 18 vs Node 22.** A suíte exige Web Crypto (`crypto.subtle`); o ambiente default é Node 18. Resolvido rodando
   tudo com Node 22 (nvm). O CI novo (B15) também fixa Node 22.
2. **Onda 3 — TS2532 em `copilot-insights.ts`** (índice de array possivelmente undefined com `noUncheckedIndexedAccess`).
   Resolvido com `?? 0` nas acumulações por hora.
3. **Onda 3 — TS2322 `BufferSource` em `biometric-unlock.ts`.** Resolvido com cast explícito (padrão já usado no projeto).
4. **Onda 4 — API depreciada `Intent.getParcelableExtra(String)`** (depreciada na API 33). Resolvido com
   `IntentCompat.getParcelableExtra(intent, name, Uri.class)` (androidx.core 1.17). APK recompilou sem aviso.
5. **Onda 5 — `make-ota-bundle` copiaria o APK errado.** O script republica o último APK do build output, que após a
   Onda 4 é o 0.69.0 **não verificado**. Resolvido movendo o 0.69.0 de lado, gerando o bundle, rebaixando o
   `/trippilot.apk` para o 0.56.0 vivo (re-baixado do apex, byte-idêntico) e devolvendo o 0.69.0 ao lugar.
6. **Onda 5 — `/.well-known/assetlinks.json` devolvia HTML.** Antes do deploy 0.70.0 o caminho caía no fallback SPA
   (`/* /index.html 200`) e retornava a página, não JSON — App Links jamais verificariam. Resolvido publicando o arquivo
   estático real (Pages dá precedência a arquivo estático sobre o `_redirects`); agora serve `application/json`.

---

## 4. Itens pulados / fora de escopo (e por quê)

- **B4 (shared link v1.1 / S9):** congelado por decisão sua (2026-06-17) — você vai redesenhar o link. Removido da Onda 5.
- **B5-push (app fechado) / FCM / real-time iOS-web:** fora por decisão (sideload-first, sem Play Store obrigatória). A
  Onda 2-A entregou só o **nudge de compartilhar** (barato, reusa o `/s`).
- **B11 (P2P V2):** deferido por design (subsumido pelo épico shared link; guardrail explícito de não virar CRDT/grupo).
- **B14 (SW por build plugin / Workbox):** **alto risco de regressão** (SW é zona crítica — DEC-082/137). Recomendação do
  conselho: só mexer com bateria de testes de update + device. Mantido deferido (condicional).
- **B16 (fechar conexão no `visibilitychange`):** deferido de propósito (risco de abortar escrita em voo; a escada de
  recovery já neutraliza o wedge).
- **B18 (validação em device):** não é código — é QA em aparelho físico. Faz parte da sessão de device (seção 2.1).

### Desvios de escopo conscientes (menores)
- **B5** foi ligado só ao fluxo primário (Quick Add). Outing/Receipt **não** ganharam o gatilho (o componente já é
  reutilizável; adoção lá é follow-up barato).
- **B8 `income`** é coletado em **moeda base** na V1 (o domínio/factory já aceitam `baseCurrencyAmountCents` para entrada
  em moeda estrangeira; a página coleta só base). `ExpenseDetailPage` vê/edita/exclui income de forma genérica.
- **B13** fez **uma fatia segura** (criação de fundo atômica), não um refactor varrendo todas as páginas. O resto da dívida
  DEC-067 (escritas de tabela única / updates de settings — baixo risco de atomicidade) fica como follow-up oportunístico
  documentado. Um refactor amplo foi evitado de propósito (fora de escopo + risco de regressão).

---

## 5. Desvios do padrão (e por quê)

1. **Node 22 via nvm** para todo test/build/deploy (o default é 18; a suíte precisa de Web Crypto).
2. **Onda 4 NÃO fez deploy web nem promoveu o APK** (desvio consciente do "deploy a cada gate"): os ACs são `[device]` e
   não há aparelho. Promover App Links/APK não verificados arriscaria o bug "abre e não navega". O `assetlinks.json`
   (web-safe) subiu na Onda 5. **Aderente ao gate da Onda 4 no plano** (`cap sync` + `assembleDebug` verde + ACs `[device]`).
3. **Versão 0.69.0 reservada ao APK nativo** (device-pendente); o web/OTA pulou de 0.68.0 para **0.70.0** para não haver
   dois artefatos diferentes com o mesmo número.
4. **`/trippilot.apk` republicado byte-idêntico** (0.56.0) re-baixando do apex, em vez de deixar o script publicar o build
   output — para não promover o 0.69.0 não verificado.

---

## 6. Como retomar / próximos passos sugeridos

1. **Agendar a sessão de device** (seção 2.1) — é o maior desbloqueio: fecha B1+B2+B3+B18 de uma vez.
2. Durante a sessão, **decidir o fragment dos App Links** (seção 2.2) e aplicar o fallback se necessário.
3. **Promover o APK 0.69.0** após validado (ou me pedir para preparar o deploy de promoção).
4. Quando houver **keystore de release**, anexar a SHA-256 ao `assetlinks.json` (seção 2.3).
5. Opcional/oportunístico: continuar a dívida **B13** (migrar mais páginas a orquestradores, uma a uma, com testes).

---

*Fim do relatório. Tudo o que dependia só de código/web foi entregue, testado e deployado; o que resta depende de um
aparelho Android físico (Onda 4 + B18) ou de decisões suas (App Links fragment, keystore de release).*
