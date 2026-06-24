# KICKOFF — Aplicar a leva "Coerência & Tricount" do TripPilot (sessão única)

> **Cole TUDO abaixo da linha `=== COLE A PARTIR DAQUI ===` como a primeira mensagem de um chat NOVO**, com o
> repositório `trip-budget-copilot` aberto. É o gatilho de execução: o agente lê o orquestrador (a fonte de verdade) e
> implementa a leva inteira de ponta a ponta, sem parar, nesta sessão.
>
> **Modelo recomendado:** o mais forte disponível para implementação (a leva tem coerência fina + uma feature nova grande).
> **Por que um prompt curto se o orquestrador já tem tudo?** Porque o orquestrador é o *contrato* (o quê/onde/como); este
> prompt é o *start* — fixa autonomia, decisões lockadas e a primeira ação ANTES de o agente abrir o doc, para ele não
> hesitar, não perguntar e não delegar.

---

=== COLE A PARTIR DAQUI ===

 Você é um **engenheiro full-stack sênior** e vai **aplicar a leva "Coerência & Tricount" do TripPilot de ponta a ponta,
sozinho, nesta sessão**. O app já existe, está testado e no ar (0.99.51) — você **não reconstrói nada**: alinha a lógica para
todas as telas contarem a mesma história, tira a confusão/susto, e entrega a função nova de divisão de grupo (tipo Tricount).

## FONTE DE VERDADE (leia primeiro, é o seu contrato)

`TripPilot/brain/documents/2026-06-24-coherence-implementation-orchestrator.md`

Esse documento é a **única fonte de verdade de execução** desta leva. Ele já traz: missão (§0), regras (§1), ordem de
leitura (§2), não-negociáveis (§3), baseline do que já existe (§4), change-set C01–C24 (§5), **root-cause map código↔mudança
com arquivo e símbolo exatos (§6)**, decisões/councils DEC-295→304 (§7), estratégia de testes (§8), protocolo por milestone
(§9), **os gates G0→G8 (§10)**, segurança de terminal (§11), Definition of Done (§12), anti-padrões (§13), brain sync (§14),
matriz de smoke (§15), decisões lockadas (§16) e o dicionário de estados (apêndice). **Leia §0–§9 uma vez, depois execute
G0→G8 na ordem.** Antes de editar qualquer arquivo, releia o arquivo citado no §6 (símbolos podem ter mudado).

## CONTRATO DE AUTONOMIA (inviolável)

1. **SEM subagents / SEM Task tool / SEM delegação.** Tudo inline, nesta sessão (custo é por request; um subagent = +1).
   Múltiplas perspectivas = seções de UMA resposta, nunca múltiplos agentes.
2. **NÃO peça permissão para avançar.** Terminar uma milestone/gate é a deixa para **commitar → deploy → atualizar dev-log →
   próxima**, não para parar. Não pare por "é muito" ou "a conversa está longa".
3. **NÃO resuma o que vai fazer — FAÇA.** Minimize narração; cada token conta numa sessão longa.
4. **Continue até a §12 (Definition of Done) ser TODA TRUE** — ou até o contexto realmente acabar (então feche o gate atual
   limpo, commit + deploy, escreva o handoff no `dev-log.md` e **pare limpo**), ou um bloqueador de credencial/custo
   intransponível. **Só nesse hand-off final** a mensagem termina com um `AskQuestion`.
5. **Reuse o que já existe — não reinvente.** A maior parte da leva é *ligar e dar coerência* a peças que já existem
   (`buildSessionFeed`, `piggy-ledger`, `connections`, `share-link`/`/t/`, `share-card`). Veja §4/§6.

## DECISÕES JÁ LOCKADAS PELO JULIO (§16 — NÃO re-pergunte)

- **Saída × item:** resumos/filtros/carrossel/recentes/mapa/padrões mostram a **saída** (1 entidade); só a **busca textual**
  itemiza; item sempre referencia a saída-mãe. Sob filtro de categoria, a linha colapsada mostra **subtotal filtrado**
  ("Mercado · N itens nesta categoria · €X") e o tap abre a saída completa. (DEC-296)
- **Modo simples (bottom nav):** layout **2+2** — Início, Gastos · (+) · Viagem, **Ajustes**. (DEC-298)
- **Tricount:** escopo **COMPLETO agora** — despesas manuais + **IA/leitura de nota** + divisão **igual E personalizada**;
  **entidade-agregado nova** reusando link público + claim + acerto existentes. (DEC-297) → gate grande, dividido em
  milestones (§10 G8).
- **Cores das barras:** progresso normal = neutro/positivo; **vermelho só em risco real** (acabou/estourou/reserva/crítico).
  (DEC-299)
- **Amigo Sincero:** CTA **contextual por slide** (sem ação útil → oculta o botão); na home, **aparece só quando
  acionável/novo** (não duplica insight). (DEC-301)
- **Cofrinho:** **seção fixa** no Copiloto; rótulos **simulado / será guardado no fechamento / já guardado**. (DEC-300)
- **Ajuda/tutoriais:** **re-auditoria COMPLETA** agora (G7), em milestones por área.
- **Versão:** 0.99.6x por gate; **1.0.0-rc** quando o Tricount (G8) entrar.
- **Foco de input (adendo 2026-06-24):** sem **borda laranja** ao focar — foco neutro e **bem sutil/discreto** nos campos
  (`input/textarea/select/[contenteditable]`), sem glow, **mantendo o mínimo de foco por teclado** para a11y (C25 / DEC-305,
  entra no G1).

Ambiguidade **nova** que o brain não resolver → rode o **council inline na hora** (1 request, sem subagents), escreva como
`DEC-NNN (PROPOSED)` no `decision-log.md` e **continue**.

## REGRAS CRÍTICAS (resumo — o detalhe está em §3 do orquestrador)

- **Idioma:** todo código/identificador/comentário/commit/nome de arquivo em **inglês**; texto de UI em **pt-BR via `t()`**
  (zero hardcode; en/es quando o item tiver cópia nova). Este prompt, o orquestrador e o brain são em português.
- **Dinheiro = inteiro em centavos.** **Domínio = TS puro, zero React.** Lógica de negócio nunca dentro de componente.
- **ÂNCORA 9 — esconder, nunca deletar:** nenhuma ação/feature some; no máximo muda de lugar/hierarquia.
- **ÂNCORA 11 — invariância de dados:** Σ(itens) == total da saída, sempre; recálculos puros (cofrinho/free-budget)
  recomputam para frente; nada novo persistido sem migração Dexie justificada.
- **Nunca bloquear o registro de gasto.** Preserve a honestidade da matemática.
- **Sem scrollbar visível** em nenhuma tela/modal/lista/card (desktop/mobile/PWA/cap-native); a rolagem funciona, a barra não.
- **Sem dead affordance** e **sem susto evitável** (vermelho só em problema real; todo alerta explica o quê/por quê/o que
  fazer/se é real ou só ajuste de plano).
- **Preserve o que já é bom e bonito** (fases/carteiras/atividades; conversor/comparador) — só toque se houver inconsistência.
- **Domínio antes de UI; uma mudança por vez; teste JUNTO com a mudança** (Vitest no domínio >90%, Playwright na UI crítica
  >70%). Rode a suíte **completa** entre gates (0 falhas).

## SEGURANÇA DE TERMINAL (WSL — o terminal trava num pager)

- **git sempre com `--no-pager`** (`git --no-pager log/diff/show/status`); commit **sempre** `-m` (HEREDOC p/ multilinha).
- **Nunca** `less`/`more`/`man`/`vim`/`nano`/flags `-i`/`rebase -i`. CLI incerta → `| cat`.
- Comando travou >30s sem saída: não re-rode; leia o terminal file, ache o pid e mate o processo preso.

## PROTOCOLO POR MILESTONE (§9) + REFRESH

Antes de **cada commit de milestone**: (1) liste os AC satisfeitos; (2) nomeie 3 AC anteriores em risco e verifique-os;
(3) rode os testes (sem novas falhas); (4) sinalize qualquer arquivo tocado fora do escopo; (5) atualize `src/dev-log.md`.
**Em cada fronteira de gate:** releia §3 + escopo do próximo gate + `dev-log` Current State; imprima o bloco NÃO-NEGOCIÁVEIS
e o CURRENT STATE (gate, último commit, testes, riscos, escopo). **A cada 3 milestones:** refresh leve.

## COMECE AGORA — G0 (sem responder nada, sem confirmar)

```bash
cd TripPilot
npm install
npm run test            # baseline — anote a contagem
npm run build && npx tsc --noEmit
npx playwright test      # se o ambiente E2E estiver disponível
```

Depois: crie/atualize `src/dev-log.md` (Current State + tabela de milestones), registre `DEC-295→304` como **PROPOSED** no
`brain/decision-log.md`, confirme o pipeline de deploy (Cloudflare Pages/worker — confirme no `package.json`/`wrangler` e
anote no dev-log). Em seguida **execute G1 → G8 na ordem do §10**, uma milestone por vez, testando junto, com o self-check de
5 pontos e deploy ao fim de cada gate. **Não pare até a §12 ser toda TRUE.**

## BLOCO ÂNCORA (cole a cada 3 milestones e em cada fronteira de gate)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ÂNCORA — leva Coerência & Tricount
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INVIOLÁVEIS:
1. Sem subagents/Task. Inline, 1 sessão. Não parar até §12 TRUE.
2. Money = integer cents. Domínio = TS puro (zero React).
3. UI text = t() sempre (pt-BR; en/es se houver cópia nova). Código em inglês.
4. ÂNCORA 9: esconder, nunca deletar. ÂNCORA 11: Σ itens == total da saída.
5. Saída = 1 entidade em resumos; só busca textual itemiza (DEC-296).
6. Vermelho só em risco real (DEC-299). Sem scrollbar visível. Sem dead affordance.
7. git sempre --no-pager; commit -m. Nunca less/vim/-i.
8. Teste junto com a mudança; suíte completa verde entre gates.
CURRENT STATE: gate=__ | último commit=__ | testes=__ pass/0 fail | riscos=__ | escopo=__
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

Confirme em UMA linha que leu o orquestrador e começou o G0 — e siga direto, sem esperar resposta.

=== FIM ===
