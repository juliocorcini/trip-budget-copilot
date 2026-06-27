# KICKOFF — Leva "Acerto Confiável (P2P) + Instalação + Microfone" (2026-06-27)

Cole isto numa sessão nova para executar a leva sem reler tudo antes.

---

Você é um(a) **engenheiro(a) full-stack sênior** aplicando esta leva **sozinho(a), nesta sessão, do começo
ao fim** (design → código → testes → commit → deploy por gate). **Sem subagents, sem Task tool, sem
delegação** — tudo inline (custo é por request).

## Fonte da verdade
- **Doc de execução:** `TripPilot/brain/documents/2026-06-27-settle-flows-reliability-orchestrator.md`. Leia
  **§0–§9 uma vez**, depois execute **G0→G9** em ordem.
- **Estado da leva:** `AWAITING LOCK` em **G5 (L-DELIVERY)**, **G8 (L-MAP)**, **G3 (L-MIC)**. **G1, G2 e G4
  não têm lock — comece já.** Se chegar numa gate com lock aberto, **PARE e faça hand-off** (não code um
  fork sem lock).
- **Base:** `1.4.12-rc`. Project root = `TripPilot/`.

## Contrato de autonomia (9 regras, condensadas)
1. Sem subagents/Task/delegação — tudo inline. 2. Não peça permissão pra avançar entre milestones (após o
lock). 3. Faça, não narre. 4. Reuse, não reinvente (o caminho `debt`/peer-ping/notif center/`getCurrentCoords`/
`ImageRef` já existem). 5. Código em inglês; UI via `t()` pt/en/es; dinheiro = centavos. 6. Domínio antes da
UI; teste junto. 7. Segurança WSL (`git --no-pager`; `G=/usr/bin/git; "$G" commit -m "…"`; sem pager/editor).
8. Brain em sincronia todo milestone. 9. Hand-off termina com `AskQuestion` (só num stop genuíno).

## Decisões já adotadas (não re-perguntar)
- **DEC-364** instalação: tabelas por plataforma (iOS sem APK, sem linha "updates"; Android com App), Android
  sempre-oferece-atalho, nudge abre o sheet, sem a palavra "PWA".
- **DEC-365** microfone: ciclo controlável + estados; iOS → caminho PCM/getUserMedia (release garantido)
  *pendente L-MIC*.
- **DEC-366** entrega P2P (headline): pessoa **conectada** ⇒ dívida `debt` accept-first real-time
  (notif+home+acerto+perfil); link só p/ não-conectado; statement-espelhado demovido *pendente L-DELIVERY*.
- **DEC-367** localização: capturar coords no **save** sem reverse-geocode (mesmo sem abrir detalhes).
- **DEC-368** mapa no detalhe: estático × Leaflet lazy *pendente L-MAP*.
- **DEC-369** ações: "aguardando aceite" abre detalhe; tela por cobrança; separar aceitar/pagar/confirmar/
  manual.
- **DEC-370** remover pessoa conectada (tombstone + histórico). **DEC-371** modelo de 15 estados.
- **DEC-372** varredura de linguagem (sem "caixa postal"/"Recebidos…"/strings técnicas).
- **DEC-373** todo QR = URL + scanner universal.

## ÂNCORA (cole a cada 3 milestones / cada fronteira de gate)
> Dinheiro=centavos · domínio=TS puro · `t()` sempre (pt/en/es) · código em inglês · **sem login** (nome do
> onboarding, nunca "Android Chrome") · **invariância da matemática do acerto** · **pessoa conectada ⇒
> entrega `debt` real-time** (notif+home+acerto+perfil) · **link só p/ não-conectado** · **nada de "caixa
> postal"/"Recebidos de outros aparelhos" como caminho principal** · **todo QR = URL + scanner universal** ·
> **microfone liberado após o uso** · **local salvo no save, sem reverse-geocode** · **iOS sem APK** ·
> DEC-207 ciphertext · hide-never-delete · nunca bloquear gasto/entrega.
> **CURRENT STATE:** gate=__ · último commit=__ · testes=__/__ (baseline __) · locks=__ · riscos=__ · escopo=__.

## Ordem das gates (1 linha cada + versão alvo)
- **G0** baseline (sem versão) — install, test, build, tsc; semeie dev-log; DEC-364…373 PROPOSED.
- **G1** `1.4.13-rc` — **doc de fluxos** `2026-06-27-settle-flows-map.md` (7 fluxos + 15 estados) + tipos
  puros de estado. *(destrava as gates de acerto)*
- **G2** `1.4.14-rc` — instalação (A1–A6, DEC-364).
- **G3** `1.4.15-rc` — microfone (B1, DEC-365) *(L-MIC)*.
- **G4** `1.4.16-rc` — linguagem humana + demover "Recebidos…" + remover card "como funciona" (D1–D3/I3,
  DEC-372).
- **G5** `1.5.0-rc` *(headline)* — entrega automática P2P p/ conectado (E1–E3, DEC-366) *(L-DELIVERY)*.
- **G6** `1.5.1-rc` — ações acionáveis + telas de detalhe + verbos + aplicar estados (F1–F4/J1, DEC-369/371).
- **G7** `1.5.2-rc` — todo QR = URL + scanner universal (DEC-373).
- **G8** `1.5.3-rc` — local no save (sem lock) + mapa no detalhe (DEC-367/368) *(L-MAP p/ o mapa)*.
- **G9** `1.5.4-rc` — remover pessoa conectada + nome real (I1/I2, DEC-370).

## Protocolo por milestone (5 pontos)
(1) liste ACs satisfeitos; (2) 3 ACs em risco + verifique (sempre: invariância da matemática · nunca
bloquear gasto/entrega · DEC-207 ciphertext); (3) testes sem novas falhas; (4) sinalize arquivo fora do
escopo; (5) atualize `src/dev-log.md`. Fronteira de gate: releia §3 + escopo + Current State; ANCHOR +
CURRENT STATE; lock aberto → PARE.

## Comandos G0 (exatos)
```
git --no-pager log --oneline -5
cat TripPilot/package.json | grep version   # espere 1.4.12-rc
```
Depois: `cd TripPilot && npm install && npm run test && npm run build && npx tsc --noEmit` (registre o
baseline, incl. os 2 `split-live-loop` que só passam no Node 22/CI), semeie o dev-log, marque DEC-364…373
`PROPOSED`, imprima o estado dos locks §16, e **comece G1**. Não pare até a DoD §12 toda TRUE — ou uma gate
fechar limpa no fim do contexto — ou um lock aberto — ou um blocker duro.

Confirme em **UMA linha** que leu o orchestrator e iniciou G0 — e siga sem esperar resposta (respeitando os
locks de G3/G5/G8).
