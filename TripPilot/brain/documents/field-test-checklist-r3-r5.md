# Checklist de Teste de Campo — R3 + R4 + R5

**App:** [https://master.trippilot.pages.dev](https://master.trippilot.pages.dev) · **Versão atual:** v0.6.0
**Cobertura:** Gap-Fix R3 (26 itens, v0.4.0) · R4 P2P Sync (14 itens, v0.5.0) · R5 Confiabilidade (9 itens, v0.5.1)

> **Atualização R6 (v0.6.0):** todos os 8 achados desta rodada foram corrigidos —
> itens marcados com **[CORRIGIDO NA R6 — retestar]** abaixo. Detalhes em `src/gap-fix-log-r6.md`.

> Como usar: teste na ordem das seções (montei por tela/fluxo, não por rodada).
> Marque `[x]` quando passar. Anote problemas no final, na seção "Achados".

---

## 1. Visual e "feel" geral (R3: R-01..05)

- [x] **Headers fixos** — Dashboard, Gastos e Planejar: ao rolar, o topo da página (título/tabs/filtros) fica fixo e ganha uma sombra sutil. Nada "some" ao rolar. *(R-01)*
- [ ] **Margens alinhadas** — Em todas as páginas, cards e listas compartilham a mesma margem lateral (nada desalinhado em relação ao resto). *(R-02) Não: o card que tem scroll herizontal que mostra os usos de perfis na tela inicial não esta alinhado doas lados, deveria estar com 3 cards alinhados na tela e os outros cards aparecerem quando rolar.. e esses icones antes eram de varias cores mediterraneas como o app, agora ficou tudo vermelho..* **[CORRIGIDO NA R6 — retestar: 3 cards exatos por página + cores por categoria]**  

- [x] **Counters com mesma altura** — No Dashboard, os cards do carrossel de contadores têm todos a mesma altura, mesmo com nomes de 1 ou 2 linhas. *(R-03)*
- [x] **Sem barras de scroll visíveis** — Filtros de Gastos, carrossel do Dashboard, seletor de fases do Planner: nenhuma scrollbar horizontal aparece. *(R-04)*
- [x] **PWA sem pull-to-refresh** — Com o app instalado (standalone), puxar a tela para baixo no topo NÃO recarrega a página. *(R-05)*

## 2. Dashboard (R3: R-06..10)

- [x] **Livre hoje é subtrativo** — Anote o "livre hoje" (ex.: €6,00), registre um gasto de €2,00 → o valor vira €4,00 (não uma média recalculada). Pode ficar negativo (em vermelho). *(R-06)*
- [x] **Sem linha "Reservado para…"** — O hero não mostra mais a linha de reservado para mês futuro. *(R-07)*
- [x] **Sino → central de notificações** — O sino abre /notifications com badge numérico; cada notificação navega para o destino certo (shares pendentes → confirmação; evento de hoje → iniciar sessão; backup vencido → backup; saída longa → saída ativa; fase estourada → planner). *(R-08)*
- [x] **Carrossel de insights interativo** — Swipe troca o insight, dots navegam; tap em projeção/ritmo/streak abre sheet "Como cheguei nisso" com o cálculo; tap em dívida → /shared; custo por saída → Gastos (tab saídas); próximo evento → edição do evento. *(R-09)*
- [x] **Economia com referência real** — Insight de economia cita a saída específica, o gasto e a referência ("€Z normal") — nunca uma % sem base. *(R-10)*

## 3. Amigo Sincero + Simulador (R3: R-11..12)

- [x] **Amigo Sincero baseado em plano** — O card compara o gasto com o PLANO da categoria (dentro do plano / acima do ritmo / sem plano) e projeta quando a reserva começa a ser usada. Nunca mostra absurdos tipo "197 saídas". *(R-11)*
- [x] **"Ver impacto completo" → /impact** — Abre página com gasto-gatilho, planejado vs gasto por categoria, projeção de fim de fase e risco de reserva (não abre mais o simulador). *(R-11)*
- [x] **Simulador com 3 métricas** — Simular um gasto mostra 3 perspectivas (impacto no total, em dias de allowance, no plano) e o veredito é o PIOR dos 3 (ok/atenção/risco). *(R-12) Ainda não esta 100% bom pode melhorar.* **[CORRIGIDO NA R6 — retestar: cada métrica mostra a conta, chips €5/€10/€20, CTAs "registrar esse gasto" e "ver no planner"]**

## 4. Taxonomia de gastos em saídas (R3: R-13..18)

- [x] **Subcategorias por proximidade de valor** — Numa saída de bar: gasto de €3 sugere "jogos/fichas" primeiro; €10 sugere couvert/drinks — a ordem muda com o valor. *(R-13)*
- [x] **Stepper espera 10s e reseta** — O stepper de detalhamento fica 10s aberto e qualquer toque/scroll reinicia o timer (não fecha no meio da escolha). *(R-14)*
- [x] **Detalhar item depois** — No histórico da sessão ativa, item sem subcategoria mostra "Toque para detalhar" e reabre o stepper só para aquele item. *(R-15)*
- [x] **Split também enriquece** — Ao adicionar gasto dividido, o stepper pergunta O QUE foi (sem repetir pagador/rateio). *(R-16)*
- [x] **Eventos: contexto → subcategoria** — Em sessão de evento (sem perfil), o stepper pergunta primeiro o contexto (bar/restaurante/mercado/...) e depois a subcategoria. *(R-17)*
- [x] **Review nunca mostra nome da sessão** — No fim da sessão e no review, cada item mostra subcategoria > descrição > categoria (nunca "Bar do Zé" repetido em tudo). *(R-18)*

## 5. Planner (R3: R-19..24 + R5-06..07)

- [x] **Margem ao vivo** — Cada tap em +/− atualiza a margem do resumo sticky na hora. *(R-19)*
- [x] **Estouro visível** — Alocar acima do disponível: margem fica NEGATIVA em vermelho (não clampada em 0) e o banner de estouro aparece DENTRO do header fixo (visível sem rolar). *(R-20)*
- [x] **Menu da categoria** — Tap no nome/ícone da categoria abre sheet: editar valor típico (ex.: transporte €8→€1), mudar classificação da fase, remover da fase. *(R-21)*
- [x] **Classificação por fase + cadeado real** — A prioridade de uma categoria pode diferir entre fases; com cadeado ativo, +/− bloqueia com toast e o preset pula a categoria. *(R-22)*
- [x] **Eventos individuais clicáveis** — Cada evento do Planner (e o card do dia no Dashboard) é um botão → abre a edição daquele evento direto. *(R-23)*
- [x] **Editar/remover perfis** — Em Perfis: tap abre edição (nome, ícone, típico, seguro); remover perfil COM gastos → desabilita nas fases com aviso; SEM uso → remove. *(R-24)*
- [x] **Mensagem de adições itemizada** — Após adicionar várias ocasiões numa sessão do Planner, a mensagem lista item a item (ex.: "2 bar, 16 transporte, 5 café"), não um total genérico. *(R5-06)*
- [x] **Recomendação de déficit persiste** — Com déficit, o card de recomendação aparece e CONTINUA aparecendo se você sair e voltar ao Planner (déficit = margem negativa atual). *(R5-07)*

## 6. Dívidas e navegação (R3: R-25..26 + R5-08)

- [x] **Extrato por participante** — Em /shared, tap num participante abre extrato item a item (cada share que move o saldo, com status e quem pagou + liquidações); o total bate com o saldo mostrado (ex.: €1,12 = 0,75 + 0,37). *(R-25)*
- [x] **Zero botões mortos** — Navegue pelas telas tocando em tudo que parece clicável: tudo navega ou age (fases/fundos do overview, gasto compartilhado em /shared, pool global do Dashboard etc.). *(R-26)*
- [x] **Botões de voltar** — /shared, Backup e Configurações têm header com botão de voltar funcionando. *(R5-08)*

## 7. Gauge da saída (R5-09)

- [ ] **Dot proporcional ao orçamento** — Na saída ativa com orçamento (ex.: €40): gastou €35 → dot ANTES do marcador de limite; €45 → logo depois; €55 → perto do fim, com pill de valor legível. O dot nunca "cola" errado no início/fim. *(R5-09) eu entendi o problema que eu estava vendo aqui, por exemplo, uma meta de 15 aparece no começo da barra verde, meta de 15, mas a meta real de 15 é no fim direito da barra, isso nao confunde tanto mas quando chega no teto seguro, que é 25 euros, o valor que fala que o teto é 15 euros, fica contralizado na tela, enquanto a barra ambar fica um pouco fora de centro para a direita, ai as coisas não se conversam, teto seguro deveria estar acomapnhando sua cor, ou ver uma forma visual de dar para entender que o valor dele é no fim quando ja esta trocando para o amarelo..* **[CORRIGIDO NA R6 — retestar: rótulos ancorados nas fronteiras reais (43%/71%/86%) + ticks coloridos na barra]**

## 8. Sync P2P entre celulares (R4) — precisa de 2 dispositivos

> Preparo: iPhone + Android, ambos com o app aberto (idealmente instalado como PWA).
> Teste com internet primeiro; depois os modos offline.

- [ ] **Migração de dispositivo (online)** — Backup → "Enviar para outro dispositivo" no celular antigo → QR; novo celular: Welcome → "Receber de outro dispositivo" (ou Backup → Receber) → escaneia → preview de import → confirmar. Dados completos chegam. *(P2P-09) de primeira deu erro nos dois celulares, de segunda o celular que estava mandando deu erro, mas no celular que estava recebendo os dados chegaram sim, então um com erro e outro sem.. sempre assim, na segunda conexão ele envia mas ainda da erro no que esta enviando..* **[CORRIGIDO NA R6 — retestar: hello simétrico (erro do remetente) + buffer do canal (falha da 1ª tentativa)]**  

- [x] **Pareamento de pessoa por QR** — /shared → "Meu QR" num celular; no outro, "Adicionar por QR" → a pessoa entra cadastrada e com badge de vínculo. *(P2P-11)*
- [x] **Vincular pessoa existente** — Participante já criado por nome → extrato → "Conectar por QR" → vincula sem duplicar. *(P2P-11)*
- [ ] **Enviar extrato** — "Enviar extrato para [nome]" → outro celular recebe em "Recebidos de outros dispositivos" → sheet com confirmar/rejeitar por item, timestamp visível. *(P2P-12/13) mesma coisa só funciona da segunda vez e o que manda ainda da erro..* **[CORRIGIDO NA R6 — retestar: mesma causa raiz do P2P-09]**
- [ ] **Respostas voltam na mesma sessão** — Confirmações/rejeições do outro lado são aplicadas no remetente ainda na sessão (ou na próxima conexão, via fila). *(P2P-12/13)* **[CORRIGIDO NA R6 — retestar: o remetente não quebra mais antes das respostas chegarem]**
- [x] **Fallback de relay** — Em redes que bloqueiam P2P direto (ex.: 4G + Wi-Fi distintos), a transferência ainda completa (relay cifrado via Worker após ~8s). Verifique apenas que funciona — a troca é transparente. *(P2P-05/06)*
- [ ] **Modo offline 2-QR** — Sem internet, mesmos Wi-Fi/hotspot: fluxo manual de 2 QRs (A mostra, B lê, B mostra, A lê) conecta e transfere. *(P2P-06) não consegui testar pois não da para escolher qual camera quer usar para ler o QR e de acordo com o tamanho do qr precisava de outra camera..* **[CORRIGIDO NA R6 — retestar: botão de trocar câmera (lembra a última) + chips de zoom 1×/2×/3×]**
- [ ] **Câmera: permissão negada** — Negar permissão da câmera mostra mensagem clara (não tela travada). *(P2P-07)* **[Testável agora na R6 — negar a permissão ao testar a troca de câmera]**

## 9. Confiabilidade de dados (R5-01..03) — os críticos do iOS

- [x] **Erro de carga tem tela de recuperação** — Se a base falhar ao abrir (difícil de forçar; no iOS às vezes ao reabrir o PWA após dias), aparece tela de erro com "Tentar novamente" — nunca redirect para welcome (que parecia "dados apagados") nem loading infinito (watchdog de 10s). *(R5-01)*
- [x] **Export no iPhone não trava o app** — Backup → Exportar no iOS abre o share sheet nativo (salvar em Arquivos etc.); o app segue utilizável depois; botão mostra estado ocupado durante o processo. *(R5-02)*
- [ ] **Aviso de armazenamento não persistente** — Se o navegador não conceder armazenamento persistente, o Dashboard mostra banner discreto sugerindo backup. *(R5-03) Está mostrando mas no iphone quando tenta ativar essa opção no iphone parece que nunca ativa, estou usando o safari.* **[CORRIGIDO NA R6 — retestar: no iOS Safari o banner agora orienta "instale na tela inicial" (o botão ativar era impossível no Safari); instalado como PWA não alarma]**
- [x] **Datas reais intactas** — Viagem real (não-demo) NUNCA tem as datas reescritas ao abrir o app (a auto-reparação só roda na viagem demo). *(R5-03)*
- [x] **Sair e voltar não perde dados** — Use o app, feche completamente, reabra (inclusive dias depois no iOS): dados continuam. *(R5-01/03)*

## 10. Onboarding (R5-04..05)

- [ ] **Teclado não cobre o conteúdo** — No iPhone, com teclado aberto no onboarding, o campo focado e o botão de avançar permanecem visíveis (a tela se ajusta). *(R5-04) funcionou pela metade parece que quando abre o teclado ele sobre o viewport mesmo, ams quando fecha o teclado ele não volta o viewport..* **[CORRIGIDO NA R6 — retestar: viewport forçado de volta ao fechar o teclado]**
- [x] **Etapa de detalhes da fase** — O onboarding tem etapa dedicada da fase: datas (validadas dentro do range da viagem), preset de ritmo e dias de pico — e tudo isso chega correto na viagem criada. *(R5-05)*

---

## Achados


| #   | Tela/Fluxo | O que aconteceu | Esperado | Gravidade |
| --- | ---------- | --------------- | -------- | --------- |
| 1   |            |                 |          |           |


