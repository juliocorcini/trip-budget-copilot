# IMPLEMENTAÇÃO R4 — REVIEW DE CAMPO DO JULIO — TripPilot

> **Modo**: Chat direto — sem agents, sem subagents, sem Task tool
> **Fonte da verdade**: ESTE prompt — os 12 requisitos abaixo são a transcrição fiel do novo review em áudio do Julio usando o app em viagem. Cada requisito traz o relato, o problema e a especificação
> **Objetivo**: 12/12 requisitos implementados · decisões registradas · brain atualizado · deploy (bump minor) no ar
> **Baseline protegida**: todos os testes unit + e2e atuais verdes, build/typecheck limpos — NUNCA pode regredir
> **Prioridades do review**: 1º a matemática do "quem pagou" (mexe com TODA a parte de dívidas) · 2º a contagem de ocasiões · 3º o simulador ("quero que você foque muito aqui")

---

## IDENTIDADE

Você é um desenvolvedor senior full-stack + UX engineer implementando a rodada R4 **sozinho, nesta conversa**. Os requisitos vieram de uso real. Onde o relato descreve o problema sem a solução exata, a especificação deste prompt decide — execute-a.

**Regras absolutas:**
- NÃO delegue para agents/subagents/Task tool
- NÃO peça confirmação entre gates — decisões pré-resolvidas abaixo
- NÃO resuma — implemente
- NÃO pare porque "conversa longa" — recovery protocol
- PRESERVE a baseline de testes — regressão bloqueia o gate
- Cada requisito tem "DONE quando" — critério de aceite inegociável

---

## ⚓ ÂNCORA — REGRAS INVIOLÁVEIS

Releia no início de CADA gate e reproduza no checkpoint:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. SEMÂNTICA DO PAGADOR (a regra desta rodada): registrar um gasto =
   registrar O MEU CUSTO. "Outra pessoa pagou" NUNCA significa presente —
   significa DÍVIDA minha com quem pagou. Custo pessoal não diminui
   porque outro pagou; só a carteira não é movimentada
2. Ocasião = SAÍDA/SESSÃO (1 saída com 9 itens = 1 ocasião, não 9)
3. INVESTIGUE ANTES DE MUDAR: leia o código atual de cada fluxo
4. Money = integer cents | Soft delete + revision | Domain pure TS
5. Registro NUNCA bloqueia: perguntas são pós-save e puláveis
6. Campos novos NÃO indexados em Dexie não exigem bump de versão
7. Zero cores hardcoded — tokens. Zero diálogos nativos
8. Catálogos/conteúdo (ajuda, ações por card) = data-driven no domínio
9. UI text = t() em pt-BR + en + es NO MESMO COMMIT (paridade)
10. Números mostrados ao usuário SEMPRE com rótulo e explicação —
    nunca "10 + 2 = 5x transporte" (lição do simulador)
11. npm run test + typecheck + build verdes em TODO checkpoint
12. Node 22: export PATH="$HOME/.nvm/versions/node/v22.22.3/bin:$PATH"
    Git: bash -c 'git commit ...' (sem --trailer)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## DECISÕES PRÉ-RESOLVIDAS

No Gate 0, registre como approved com a numeração sequencial seguinte do decision-log (confira o último DEC antes — se for DEC-102, estas viram DEC-103..112):

| # | Título | Resumo |
|---|---|---|
| D-R4-A | Semântica universal do pagador | Outra pessoa pagou ≠ presente: custo pessoal mantém, cria dívida com o pagador, carteira não movimenta. Vale em TODOS os fluxos (QuickAdd, saída, split) |
| D-R4-B | Ocasião = sessão | Contagem de ocasiões usa saídas/sessões (e gastos avulsos = 1 cada), nunca itens de sessão |
| D-R4-C | Simulador v3 contextual | Pergunta valor + ONDE vai gastar; busca no lugar certo (plano da categoria, reserva de evento, allowance); veredito sempre com o PORQUÊ |
| D-R4-D | Semântica honesta dos limites da saída | Acima da meta = "usando dinheiro de outras coisas" (cor e copy mudam NA meta, não perto do máximo) |
| D-R4-E | Long-press multi-select em listas | Segurar seleciona, tap adiciona, barra de ações em lote (excluir, etc.) |
| D-R4-F | Tela inicial configurável | Long-press em card → opções (esconder, ação rápida); card fino no fim → "Configurar tela inicial" (ordem + visibilidade) |
| D-R4-G | Notificação persistente de saída ativa (PWA, melhor esforço) | Notificação com botões de quick-add durante sessão; follow-up de subcategoria; limites do PWA documentados; o que não der → registrado p/ Capacitor (DEC-017) |
| D-R4-H | Modo ajuda contextual | Ícone "?" nas telas complexas → overlay com os elementos reais anotados + exemplos concretos |
| D-R4-I | Carrossel/insights: 1 item por gesto, alinhamento consistente | scroll-snap-stop always + scroll-padding alinhado às margens dos cards |
| D-R4-J | "Quem pagou?" como pergunta de primeiro nível no registrar gasto | Eu / Outra pessoa → (se outra) pagou tudo para você OU dividiu — sem precisar montar split manual para o caso simples |

---

## STATE FILE (crie ANTES de qualquer código)

`TripPilot/src/gap-fix-log-r4.md` — formato dos anteriores: Current State (gate/item, X/12, testes, build), checkboxes por gate, extras encontrados (anotar, não corrigir).

---

## MAPA DE GATES

```
GATE 0  Baseline + decision-log
GATE 1  Polish visual rápido          R-01 R-02 R-03
GATE 2  Matemática do pagador (CRÍTICO) R-04 R-05
GATE 3  Ocasiões = saídas             R-06
GATE 4  Simulador v3                  R-07
GATE 5  Limites da saída honestos     R-08
GATE 6  Long-press: listas + tela inicial  R-09 R-10
GATE 7  Notificações PWA da saída     R-11
GATE 8  Modo ajuda                    R-12
GATE 9  Brain + verificação final + deploy
```

---

## GATE 1 — POLISH VISUAL RÁPIDO

**R-01 — Alinhamento do carrossel (D-R4-I)**
> Relato: "O primeiro card do carrossel está COLADO no lado esquerdo, sem a margem dos outros cards. Por isso aparece um 4º ícone na direita. Quando eu arrasto e ele volta, o primeiro card alinha com a margem certa e o 4º some — e é assim que tem que ser SEMPRE: primeiro card alinhado com os outros cards, só 3 visíveis."
- Corrigir o container do carrossel: `scroll-padding-left` / padding interno igual ao `--page-padding-x`, `scroll-snap-align` consistente — o estado inicial (sem interação) deve ser idêntico ao estado pós-snap
- Verificar o mesmo padrão em QUALQUER outro carrossel do app
- DONE quando: ao abrir o dashboard, o 1º card está alinhado às margens dos demais cards e apenas 3 aparecem

**R-02 — Insights: um por gesto (D-R4-I)**
> Relato: "Se eu rolo o dedo com força, ele pula do 1º insight direto para o 4º. Não importa a força: tem que passar UM insight por vez. As bolinhas clicáveis estão ótimas — mantém."
- `scroll-snap-stop: always` nos slides (+ ajuste de snap type se preciso) — um gesto = um slide
- DONE quando: swipe forte avança exatamente 1 insight

**R-03 — Chip "Entretenimento" estourando**
> Relato: "No registrar gasto, a palavra 'entretenimento' é maior que o chip e está saindo dos lados."
- Corrigir o fit do label nos chips de categoria (font-size menor para labels longos, `text-overflow` ou largura flexível do chip) — solução única para qualquer label longo nas 3 línguas
- DONE quando: nenhum label de categoria vaza do chip em pt/en/es

**Checkpoint** + commit `fix(gate-r4-1): carousel alignment, one-insight snap, chip label fit`

---

## GATE 2 — MATEMÁTICA DO PAGADOR (o item mais crítico do review)

**R-04 — "Outra pessoa pagou" mantém o custo e cria dívida (D-R4-A)**
> Relato: "Na saída eu tinha gasto €20. Registrei +€15 de comida, marquei que a ANA pagou, NÃO dividi — e o total VOLTOU para €20. Não pode! Se a Ana pagou e eu não dividi, a coisa é MINHA, eu vou ter que dar esse dinheiro para ela: estou DEVENDO €15 à Ana. O dinheiro não saiu do meu bolso AINDA, mas é gasto meu. Registrar que alguém pagou para mim não é presente — é para o aplicativo LEMBRAR que eu devo. Isso mexe com toda a parte de dívidas."
- Investigar todos os fluxos onde se marca o pagador (stepper da saída, split da saída, QuickAdd compartilhado) e mapear a matemática atual
- **Semântica correta (tabela da verdade — implementar em função de domínio única e reusada):**

| Quem pagou | Dividiu? | Custo pessoal | Dívida criada | Carteira |
|---|---|---|---|---|
| Eu | não | valor total | — | debita minha |
| Eu | sim | minha parte | outros me devem as partes deles | debita minha (total) |
| Outro | sim | minha parte | eu devo MINHA PARTE ao pagador | NÃO movimenta |
| Outro | não | **valor total** | **eu devo o TOTAL ao pagador** | NÃO movimenta |

- A linha 4 é o bug do relato: hoje zera o custo pessoal. Corrigir: gauge/total da sessão, "livre para usar", contadores — tudo usa o custo pessoal correto
- Conferir que TODAS as variações criam os shares/dívidas corretos e aparecem em /shared
- Testes de domínio com os cenários exatos do relato: (a) €15 pago pela Ana sem dividir → custo +15, dívida 15; (b) €10 pago pela Ana dividido meio a meio → custo +5, dívida 5; (c) eu pago €10 dividido → Ana me deve 5
- DONE quando: os 3 cenários batem no app E em /shared

**R-05 — Interação com "registrar total atual" + verificação ponta a ponta**
> Relato: "Eu tinha feito divisões com a Ana na saída, depois registrei o total final e ele criou um ajuste de €15. Precisa verificar se esse ajuste levou em conta os compartilhamentos — não pode fazer um bolo só e tirar tudo do meu saldo; tem que manter todas as dívidas."
- O ajuste de reconciliação da sessão (DEC-046) deve ser calculado sobre o CUSTO PESSOAL da sessão (soma dos meus custos), nunca sobre o fluxo financeiro total — e não pode apagar/duplicar shares existentes
- Teste: sessão com itens próprios + item dividido + item pago por outro → registrar total → ajuste = diferença sobre o custo pessoal; dívidas intactas
- DONE quando: o cenário composto fecha a conta certa e preserva as dívidas

**Checkpoint** + commit `fix(gate-r4-2): payer semantics — personal cost + debt, reconciliation respects shares`

---

## GATE 3 — OCASIÕES = SAÍDAS (D-R4-B)

**R-06 — Contagem de ocasiões usa sessões, não itens**
> Relato: "O Amigo Sincero falou 'bar: 20 de 5 ocasiões usadas — dentro do plano'(!). Fui ver: eu tenho 3 SAÍDAS de bar (uma com 9 itens, uma com 8, uma com 3). Ele está contando os ITENS como ocasiões. Errado: ocasião é a SAÍDA. Eu planejo 'vou ao bar 5 vezes', não '5 itens de bar'. E ainda deu veredito 'dentro do plano' com 20 de 5!"
- Investigar `calculateOccasionForecasts` e toda contagem de "feitas" (dashboard, Amigo Sincero, impacto, planner)
- **Regra**: transações com `sessionId` → agrupam na sessão (1 sessão = 1 ocasião do perfil dela); gastos avulsos com perfil/categoria → 1 ocasião cada
- Corrigir o veredito do Amigo Sincero (3/5, não 20/5) e a tela de impacto
- Testes: 3 sessões (9+8+3 itens) + 2 avulsos = 5 ocasiões
- DONE quando: dashboard, Amigo Sincero, impacto e planner contam 3 saídas como 3 ocasiões

**Checkpoint** + commit `fix(gate-r4-3): occasions count sessions, not items`

---

## GATE 4 — SIMULADOR V3 (foco máximo do Julio)

**R-07 — Simulador contextual com explicação (D-R4-C)**
> Relato: "Ele mostra '10 euros equivale a 0 dias do seu livre diário €524,10 por dia' e '10 + 2 = 5x transporte' — não entendi NADA. Números que não sei de onde vêm nem o que significam. Ele fala 'arriscado' mas não fala QUAL é o risco. E ele não sabe ONDE eu vou gastar — como vai saber se é arriscado? Às vezes o dinheiro está RESERVADO para aquilo, aí não é arriscado. O que deveria acontecer: eu falo 'vou gastar €20', ele pergunta ONDE (comendo, passeio...), ele procura no planejamento o lugar certo e faz as contas certas, e me MOSTRA explicando. Foque muito aqui."
- **Fluxo novo**: valor → "Onde você vai gastar?" (chips: perfis habilitados da fase + eventos próximos + "outro")
- **Motor contextual** (domínio, testável):
  - Categoria com plano: ocasiões restantes da categoria × valor típico vs o valor simulado → "isso consome ≈ N das M ocasiões de [categoria] que restam no seu plano"
  - Evento selecionado: comparar com `reservedCents` → "você reservou €X para isso — cabe/teria que completar €Y"
  - Sem plano para o destino: impacto no livre da fase + allowance diária
- **Saída SEMPRE explicada, com rótulos** (banir equações cruas): cada linha = frase completa com os números nomeados ("Seu livre diário é €5,24; €20 equivalem a ≈4 dias dele")
- **Veredito com porquê**: "Arriscado porque [motivo concreto]" — se há reserva que cobre, "tranquilo: você reservou para isso"
- Corrigir os bugs atuais de exibição ("0 dias", contas sem sentido) — provavelmente formatação de cents e templates de i18n com variáveis erradas: investigar e testar as 3 línguas
- Testes de domínio do motor (cenários: com plano, sem plano, com evento reservado, valor gigante)
- DONE quando: simular €20 "comendo" explica o impacto no plano de comida com frases legíveis e veredito justificado

**Checkpoint** + commit `feat(gate-r4-4): simulator v3 — contextual, explained, reason-based verdict`

---

## GATE 5 — LIMITES DA SAÍDA HONESTOS (D-R4-D)

**R-08 — Meta é o alvo; acima dela a conversa muda**
> Relato: "Meta €15, teto seguro €25. Se chama 'seguro', dá vontade de ir até €25 — 'já que é seguro, posso'. E depois do teto a cor AINDA é amarela, nem parece ruim; só complica perto do máximo. Tem que deixar claro: a meta é 15, passou de 15 você JÁ está usando dinheiro de outra coisa. E os textos: passei da meta e ele diz 'ainda pode gastar com tranquilidade: €0' e '≈0 bebidas cabem' — e embaixo 'a próxima bebida de €3,50 ainda cabe sem afetar suas próximas saídas'. Isso me dá VONTADE de continuar gastando. Por que eu pararia em 15?"
- **Zonas e cores** (mudam NA meta, não perto do máximo): abaixo da meta = verde/neutro; meta→teto = laranja/atenção com copy "Você passou da meta em €X — isso sai de [outras categorias do plano / margem livre]"; teto→máximo = vermelho "comprometendo o orçamento da fase"; máximo = vermelho forte + confirmação (já existe)
- **Renomear/reposicionar os rótulos na UI** (i18n): "Meta" = o alvo da noite; "Teto" (sem "seguro") = até aqui dói pouco; "Máximo" = limite duro — revisar onde "seguro" aparece e o efeito convidativo
- **Textos coerentes com a zona**: acima da meta, NUNCA "pode gastar com tranquilidade €0" — trocar por "€X acima da meta"; a frase "próxima bebida cabe sem afetar próximas saídas" SÓ aparece abaixo da meta; acima, vira "a próxima bebida aumenta o que você está tirando de outras coisas"
- Alertas progressivos (DEC-048) re-ancorados nas zonas novas
- DONE quando: cruzar a meta muda cor E discurso imediatamente; nenhum texto convida a gastar acima da meta

**Checkpoint** + commit `feat(gate-r4-5): honest outing limit zones and copy`

---

## GATE 6 — LONG-PRESS: LISTAS + TELA INICIAL

**R-09 — Multi-select em listas (D-R4-E)**
> Relato: "Sinto falta de excluir vários de uma vez. Aperto e seguro num gasto, ele seleciona, aí eu vou tocando e selecionando outros, e aparecem opções para os selecionados — excluir todos, e pensar que outras opções fazem sentido. Isso para tudo que é lista."
- Infra reutilizável de selection-mode (long-press entra, tap adiciona/remove, barra de ações no rodapé, X cancela)
- Aplicar em: **lista de gastos** (ações: excluir selecionados; mover de fundo; trocar categoria) e **histórico de saídas** (excluir). Outras listas: avaliar e aplicar onde houver ação útil — registrar no state file as escolhidas
- Exclusões em lote via soft delete + confirmação única
- DONE quando: segurar + selecionar 3 gastos + excluir todos funciona com confirmação

**R-10 — Tela inicial configurável (D-R4-F)**
> Relato: "Apertar e segurar num card da tela inicial podia dar opções: ESCONDER o card (excluir que não exclui), e ações rápidas do card — compras pessoais → já criar uma compra pessoal. E se eu escondo, aparece no fim da tela um card fininho de ponta a ponta: 'cards escondidos / configurar tela inicial'. Clicando, eu vejo todos os cards, onde estão, os escondidos, e posso arrastar para mudar a ORDEM. Deixar o usuário definir."
- Long-press em cards do dashboard → sheet: **Esconder card** + ação rápida contextual (data-driven por tipo de card: compras pessoais → registrar compra; eventos → criar evento; gastos recentes → registrar gasto; insights → ver todos...)
- Persistência em settings: `hiddenDashboardCards: string[]` + `dashboardCardOrder: string[]` (campos não indexados — sem migração)
- Hero e card de saída ativa NÃO escondíveis/móveis (âncora do app)
- Card fino no fim do dashboard: "Configurar tela inicial" (sempre que houver escondidos; senão entrada equivalente em Configurações) → tela de configuração: lista dos cards na ordem atual, reordenar (botões ↑↓ servem no V1), toggle de visibilidade
- Dashboard renderiza respeitando ordem + visibilidade
- DONE quando: esconder, reordenar e restaurar cards funciona e persiste

**Checkpoint** + commit `feat(gate-r4-6): long-press multi-select + configurable dashboard`

---

## GATE 7 — NOTIFICAÇÕES PWA DA SAÍDA ATIVA (D-R4-G)

**R-11 — Notificação persistente com quick-add (pesquisar + melhor esforço)**
> Relato: "Quero que pesquise se dá para fazer pelo PWA: quando estou numa saída ativa, uma notificação persistente tipo a do Spotify (na Samsung, 'notificações ao vivo'). E o principal: com ATALHOS — os botões de +€3, +€5, 'outro'. Salvou pela notificação? Ele manda outra notificação perguntando o que foi (drink, comida...). Assim eu nem preciso abrir o aplicativo."
- **Pesquisa primeiro** (documente as conclusões no brain): o que o PWA Android permite hoje — Notification API via Service Worker com `actions` (botões), `tag`+`renotify` (atualizar a mesma notificação), `requireInteraction` (persistência parcial), Badging API; o que NÃO dá (ongoing/live real, media-style)
- **Implementar o viável**:
  1. Ao iniciar sessão (com permissão concedida): notificação com tag fixa mostrando nome + total atual, botões de ação (+€3, +€5, "Outro" → abre o app na sessão)
  2. Clique nos botões → SW registra o gasto direto no IndexedDB (reusar a lógica de domínio; cuidado com contexto SW: importar funções puras) e atualiza a notificação com o novo total
  3. Follow-up: segunda notificação com até 2-3 ações de subcategoria mais prováveis (+ "abrir app" para o resto)
  4. Encerrar sessão → limpa notificações
- Pedir permissão de notificação no momento certo (primeiro início de sessão, com explicação), nunca no boot
- **O que não for possível em PWA**: registrar no brain como item do pacote Capacitor (DEC-017) com a pesquisa anexada
- DONE quando: iniciar saída gera a notificação com botões funcionais OU o brain documenta exatamente o que bloqueou e o fallback entregue

**Checkpoint** + commit `feat(gate-r4-7): active outing notification with quick-add actions (PWA best effort)`

---

## GATE 8 — MODO AJUDA (D-R4-H)

**R-12 — "?" contextual com a tela anotada**
> Relato: "Entro em Fundos e não sei o que é cada coisa, o que vocês querem que eu faça. As telas deviam ter um ícone de ajuda no canto superior direito. Clicando, mostra a MESMA tela só que com explicações em cima dos elementos reais — o elemento real e a explicação embaixo, com exemplos de verdade: 'aqui você coloca o valor que está na sua carteira', 'esse é o valor que você quer reservar e não gastar'. No app normal não dá para poluir, mas no modo ajuda dá para fazer bem feito."
- **Registry data-driven** (`help-content.ts` no domínio): por tela, lista de tópicos `{ anchorId/elemento, títuloKey, explicaçãoKey (com exemplo concreto) }` — todo conteúdo via i18n ×3
- **UI**: ícone "?" no header das telas complexas → ativa o modo ajuda: overlay escurecido sobre a tela REAL com callouts ancorados às seções (ou painel sequencial destacando elemento por elemento — escolha o que ficar robusto com o layout atual); navegação próximo/anterior; fechar fácil
- **Telas V1 obrigatórias**: Fundos, Planejar, Carteiras, Editar Fase/Eventos, Saída ativa, Backup. Estrutura pronta para adicionar as demais
- Exemplos REAIS nos textos (números concretos, cenário de viagem), não definições abstratas
- DONE quando: "?" em Fundos explica cada bloco da tela com exemplo concreto, nas 3 línguas

**Checkpoint** + commit `feat(gate-r4-8): contextual help mode with annotated screens`

---

## GATE 9 — BRAIN + VERIFICAÇÃO FINAL + DEPLOY

```
1. Brain:
   - decision-log.md → decisões D-R4-A..J registradas (numeração sequencial conferida)
   - product-spec.md → semântica do pagador, ocasiões=sessões, simulador v3,
     zonas de limite, dashboard configurável, modo ajuda, notificações
   - project-status.md → R4 implementada + pesquisa de notificações documentada
2. package.json → bump minor
3. npm run test (100%) + typecheck + build + npx playwright test
4. RE-VERIFICAÇÃO: tabela R-01..R-12 com cada "DONE quando" confirmado NO CÓDIGO
5. Smokes dos cenários do review (trace):
   a) saída com €20 + €15 pago pela Ana sem dividir → total €35 + dívida de €15
   b) 3 saídas de bar (9+8+3 itens) → Amigo Sincero mostra 3/5 ocasiões
   c) simular €20 "comendo" → resposta explicada com veredito justificado
   d) cruzar a meta da saída → cor e copy mudam na hora
   e) carrossel abre alinhado com 3 cards; swipe de insight avança 1
   f) esconder card + reordenar → persiste após reload
6. Paridade i18n ×3 | 0 hardcoded | 0 diálogos nativos
7. Deploy: npx wrangler pages deploy dist --project-name=trippilot
8. Entregar: 🚀 URL + tabela 12/12 + resumo por gate + conclusões da pesquisa
   de notificações
```

---

## PROTOCOLO DE CHECKPOINT (fim de CADA gate)

```
GATE [N] CONCLUÍDO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Requisitos: [R-XX ✅ ...] | Arquivos: [lista]
Testes: X unit + Y e2e | Build ✅ | Typecheck ✅
i18n: [N] chaves novas ×3 (paridade ✅)
Regressão: [2-3 fluxos anteriores re-checados — inclua sempre 1 fluxo de
dinheiro: split, dívida ou reconciliação]
Fora de escopo tocado? [não / o quê e por quê]
State file ✅ | Commit: [hash]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[reproduza o bloco ÂNCORA]
PRÓXIMO: Gate [N+1]
```

**Mid-gate refresh**: a cada 3 requisitos, releia a ÂNCORA + Current State (3 linhas).

---

## RECOVERY PROTOCOL

1. `TripPilot/src/gap-fix-log-r4.md` → gate/requisito ativo
2. Releia ÂNCORA + seção do gate ativo NESTE prompt (o relato está aqui dentro)
3. `npm run test` para confirmar estado real
4. Continue do último checkbox aberto — NUNCA refaça gate concluído

---

## CRITÉRIO DE PARADA

```
DONE quando TUDO = TRUE:
- [ ] 12/12 requisitos com "DONE quando" confirmado (tabela do Gate 9)
- [ ] Decisões D-R4-A..J approved no decision-log
- [ ] Tabela da verdade do pagador implementada e testada (4 linhas × testes)
- [ ] Ocasiões contam sessões em TODOS os lugares (dashboard, amigo, impacto, planner)
- [ ] Simulador v3: zero números sem rótulo/explicação
- [ ] 6 smokes do review passando
- [ ] Pesquisa de notificações PWA documentada no brain (mesmo que parcialmente inviável)
- [ ] Testes ≥ baseline e 100% verdes | Build/Typecheck clean | i18n ×3
- [ ] Brain atualizado | Deploy no ar com URL
```

---

## COMECE AGORA

1. GATE 0: baseline + state file + decisões no decision-log
2. GATE 1: polish rápido (3 fixes pequenos para abrir o caminho)
3. GATE 2 é o coração: a matemática do pagador mexe com TODAS as dívidas — teste cada linha da tabela da verdade
4. Termine com deploy + tabela 12/12 + URL

**O Julio está usando o app numa viagem real AGORA. A matemática do "quem pagou" decide se ele pode confiar nos números. GO.**