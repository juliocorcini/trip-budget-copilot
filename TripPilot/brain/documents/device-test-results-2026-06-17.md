# Resultado da Sessão de Teste em Celular — v0.50→v0.70 (2026-06-17)

> **O que é este arquivo:** o registro **factual** (evidência) da sessão de verificação em
> device que o Julio rodou seguindo o `device-test-plan-v50-v70-2026-06-17.md`. É a execução
> do item **B18** ("backlog de validação em device") que o `master-fix-and-skipped-features-plan-2026-06-17.md`
> tinha agendado. Aqui só **registramos o que foi observado** (PASS / FAIL / melhoria pedida) —
> a causa-raiz e o plano de correção ficam no companheiro
> **`device-test-fixes-masterplan-2026-06-17.md`** (separação observar × corrigir).
>
> **Aparelho/Build:** Samsung (3 câmeras) com o **APK 0.69.0 debug** + **OTA web 0.70.0**; um
> **iPhone** abrindo pelo **navegador** (web). Fonte das mudanças testadas: `src/utils/release-notes.ts`.
>
> **Legenda:** ✅ funcionou · ❌ bug/regresão · 🟡 funciona mas confunde / melhoria pedida ·
> 🔵 decisão a tomar · ⏭️ bloqueado (não deu pra testar) · 🔁 verificar (inconclusivo).
> Cada linha leva o **ID** rastreável usado no masterplan.

---

## Placar geral

| Resultado | Qtde | IDs |
|---|---|---|
| ✅ Funcionou bem | 26 | (ver blocos) |
| ❌ Bug / regressão | 20 | D-BUG-01 … D-BUG-20 |
| 🟡 Melhoria pedida | 7 | D-IMP-01 … D-IMP-07 |
| 🔵 Decisão | 5 | D-DEC-A … D-DEC-E |
| ⏭️ Bloqueado | 4 | link/real-time/App Links/compartilhadas (todos por D-BUG-01) |
| 🔁 Verificar | 3 | D-VER-01 … D-VER-03 |

> **Leitura honesta:** o app está **rico e majoritariamente funcional** — os fluxos nativos mais
> arriscados (notificação da saída com app fechado, compartilhamento nativo de CSV cold/warm,
> import inteligente, escanear nota) **passaram**. O que sobrou são **1 bug crítico que cascateia**
> (link `localhost`), **1 bug crítico de iOS** (zoom em input), regressões de UI e uma lista de
> clareza/descoberta. Quase tudo é corrigível **por OTA (web)** — só biometria nativa pede APK novo.

---

## Bloco A — Setup, nativo e permissões

- ✅ Instalar APK 0.69 + OTA para web 0.70 — atualizou sozinho, sem encher pedindo update.
- ✅ Permissão de **câmera** (QR): Android pediu, câmera abriu.
- ❌ **D-BUG-03 — Câmera do QR regrediu:** sumiram os presets **1×/2×/3×**; o botão de "câmera
  frontal" agora **cicla por TODAS as câmeras** (traseira → frontal → outra frontal → traseira)
  em vez de só alternar frente/trás. *"Quero que volte ao que era: os tipos de câmera (1×2×3×) ali
  e o botão de câmera frontal só ir pra frontal."*
- ✅ **Sem overscroll/glow:** o efeito de esticar do WebView sumiu. *"Tá bem legal."*
- ✅ Permissão de **GPS**: ativou a captura (já tinha permissão concedida no app).

## Bloco B — Carregar demonstração

- ✅ Carregou a viagem demo; nomes de fase (Burgos/Eurotrip) aparecem ao entrar na viagem.
- 🔁 **D-VER-01 — Aviso de modo demonstração no topo da Home:** o Julio inicialmente não viu o
  banner "você está usando dados de demonstração". Depois se distraiu com a nomenclatura de fase e
  não confirmou. **Verificar** se o banner aparece de fato.

## Bloco C — Início (Home)

- ✅ Trocar de aba arrastando — *"muito legal esse efeito."* Carrosséis rolam de lado sem trocar aba.
- ❌ **D-BUG-10 — Direção da animação de transição:** a página de **Início sempre entra do mesmo
  lado**, indo ou voltando. A animação de entrada deveria **seguir a direção** do gesto/navegação
  (entrar da direita quando avança, da esquerda quando volta) pra dar continuidade.
- ✅ "Livre para usar" já desconta o reservado do planejador.
- ✅ Check-in do dia reenquadra o "livre hoje" (46 → passeio 76).
- ✅ Cofrinho aparece no "sem gastos".
- ❌ **D-BUG-11 — "Amigo sincero" verde dizendo coisa ruim:** ficou **verde** com a mensagem
  *"você planejou 7 bares… no ritmo atual cabem só 5 dos 6 que faltam…"*. *"Ele está me falando que
  não vai funcionar, que já perdi um bar — então não pode ser verde. Amarelo parece aviso; talvez
  uma terceira cor: não tá tudo bem, mas também não tá tudo mal."* → ver **D-DEC-E**.
- 🟡 **(clareza) "Meta de economia":** *"não sei o que é esse meta de economia."* (microcopy)
- ✅ **2 cards por linha** funciona (Divisões, Compras pessoais). 🔵 **D-DEC-B:** *"poderia já vir
  préativo quando a página tem muita coisa; e não sei se as pessoas vão saber que existe."*
- ❌ **D-BUG-12 — Fechar card arrastando só pela alça:** *"se eu puxo o card pra baixo de qualquer
  lugar (e ele não tem mais o que rolar), já deveria ir fechando — não só segurando na alça."*
- ❌ **D-BUG-13 — Gastos recentes:** mostra "rodada 3 / rodada 2" (itens soltos da sessão de bar) e
  o "hoje/ontem" parece errado. *"Registrei um gasto hoje, apareceu 'bar Hoje' e logo abaixo 'rodada
  3 dia 14/6 1h da manhã' — não está funcionando direito."*
- ❌ **D-BUG-07 — Barra de rolagem voltou:** *"a gente já tinha tirado a barra de rolagem; o app rola
  sem barra como app, não como navegador. Pode tirar de novo."*
- ✅ Animações já animam na primeira vez (ressalva = direção, D-BUG-10).
- ✅ Telas abrem no topo; **o menu sobe junto com o teclado** — *"ficou muito bom, gostei bastante."*

## Bloco D — Gastos e Entrada

- ✅ Menu "+", registrar gasto, foto via câmera e galeria.
- 🟡 **D-IMP-… / D-BUG-17 — Foto:** *"queria dar zoom na foto, mas só nesse componente, sem mexer
  no app todo. E esse visualizador tem fundo preto enquanto o resto do app não tem — fica ruim."*
- ✅ Abrir gasto existente → adicionar foto → salvou local.
- ❌ **D-BUG-08 — Localização (GPS) só na criação, não na edição:** ao **criar** um gasto, "usar
  minha localização" / lugares próximos / buscar nome online funcionam; ao **editar** um gasto já
  feito, essa parte **não aparece** (só dá pra digitar o nome). *"Tinha que estar também na edição."*
- ✅ **Registrar entrada (income):** +20 BRL → aumentou o fundo Burgos e creditou a carteira (vi a
  principal subir de 844 → 864). Funciona.
- ❌ **D-BUG-04 — Entrada não aparece na aba Gastos:** *"fiz 2 registros de entrada e eles não
  aparecem na aba de gastos pra ver/editar/excluir. Tem que rever isso."* → ver **D-DEC-D**.
- ❌ **D-BUG-01 — Link de divisão = `https://localhost`:** dividiu 50 € (restaurante) → "Compartilhar
  com Ana" → **copiou um link `https://localhost/...`** que *"nunca vai funcionar."* 🟡 **D-IMP-04:**
  *"já podia abrir o compartilhamento nativo (WhatsApp) direto, não só copiar."* (mesmo localhost em
  Pessoas/dívidas ao tocar na Ana).

## Bloco E — Saídas, Sessão e Escanear nota

- ❌ **D-BUG-15 — Saída ativa sem margem dos lados:** *"é a única tela que não está com margem dos
  lados; tinha que ter igual as outras."*
- 🟡 **D-IMP-07 — Configurar saída sem imagem** (Veneza ok). (cosmético)
- ✅ Saída ativa cabe na tela; quick-add com botões/valores; total e "quanto falta (≈ N bebidas)".
- ❌ **D-BUG-16 — Bloco de fotos da saída grande demais:** *"quando coloco o primeiro gasto já tenho
  que rolar; se continuo adicionando, rola mais. O bloco de fotos não precisa ser todo aquele —
  podia colapsar / virar um botão no topo quando vai precisar rolar."*
- ❌ **D-BUG-05 — Foto da saída some:** anexei foto na saída, apareceu na revisão, confirmei/encerrei;
  depois **não vejo a foto** nem em Gastos→bar nem em Saídas→bar. *"Basicamente perdi a foto."*
- ✅ **Notificação da saída (NATIVO crítico):** total/faltam/≈ bebidas atualizam; toquei no valor
  **com o app fechado/2º plano** e o gasto entrou; ao abrir, reconciliou. *"Perfeito."*
- ✅ Sessão de bar concluída agrupando itens; local da saída com busca.
- ✅ **Escanear nota (NATIVO/IA):** leu a nota e os itens. 🟡 **D-IMP-05:** *"o nome ficou só 'nota';
  seria muito bom puxar o nome do estabelecimento, a categoria (mercado/restaurante) e o subgrupo."*
- 🟡 **D-BUG-18 — UI de dividir item da nota confusa:** *"abre 'divisão' com um botão 'pessoal' e não
  está claro que é divisão. Deveria perguntar 'dividir esse item com quem?' / 'quem vai pagar?'."*
  Depois de entender, funciona (dividir entre 2, quem pagou, ajustar ao total — tudo ok).
- ❌ **D-BUG-14 — Dois "X" na busca de Gastos:** *"tem 2 X pra limpar o texto, os dois funcionam.
  Tira um, deixa só um."*
- ✅ Salvar nota como uma saída (linha única) + buscar item a item.
- 🔵 **D-DEC-A — Categoria por item da nota:** *"a nota tem categoria (mercado/bar…), mas o item é
  uma coisa, não um lugar. Cada item ter sua categoria seria melhor, mas se for difícil, nem precisa."*
- ✅ Adicionar itens à mão (offline).

## Bloco F — Viagem, Planejador e Fases

- ✅ "Livre para usar nesta fase" (na Home) → mapa por dia + orçamento da fase. *"Fez exatamente o
  que pedi."*
- 🟡 **D-IMP-01 — Calendário sem valor por dia:** *"não quero clicar no dia pra ver quanto sobra;
  quero o valor em € embaixo do número do dia, já visível. Vale pra 'disponível por dia' E 'gastos
  por dia' e qualquer calendário desse tipo. Clicar pode mostrar MAIS info."*
- ✅ "De onde vem esse número" com 2 abas; renda planejada por fase entra só na visão de futuro.
- 🟡 **D-IMP-02 — "Ver prévia da fase" / "Gerenciar fundo" muito escondidos:** *"só cheguei clicando
  no cabeçalho da Home → visão geral → ver prévia. Nem sabia que estava ali. E é uma função muito
  importante."*
- ✅ Reservas por fase com sugestão automática (não entendeu 100% pra que serve).
- ❌ **D-IMP-03 — "Vincular gasto existente a compra planejada" não se acha:** *"um gasto já existe,
  quero vincular a um planejado e não sei como; não está na cara."* (a função existe na tela de
  Compras planejadas; falta porta de entrada **pelo lado do gasto**.)
- ✅ Empty state do Planejador (*"está certo"*).

## Bloco G — Copiloto

- ✅ Total na moeda de casa · dinheiro × cartão · hora de pico · sequência de dias. *"Perfeito."*
- 🔁 **D-VER-02 — Cofrinho no Copiloto:** *"não apareceu aqui; mas deve aparecer em algum momento."*

## Bloco H — Pessoas, dívidas, link, tempo real, pareamento

- ✅ Pessoas e dívidas (Ana com saldo, liquidação parcial).
- ❌ **D-BUG-01 (de novo) — link `localhost`:** *"o link vem em localhost, não abre."*
- ⏭️ **Abrir link / tempo real / "compartilhadas comigo"** — **bloqueados** por D-BUG-01.
- ❌ **D-BUG-02 — iPhone (web): zoom preso em input + ícones 1×2×3×:** *"clico em qualquer campo no
  iPhone, dá zoom na página e não volta — tá horrível."* (e ainda aparecem os ícones 1×2×3× no iPhone.)
- ❌ **D-BUG-19 — Pareamento por QR conecta e para:** *"li o QR, falou 'conectado à Ana', mas depois
  não faz mais nada."*
- ❌ **D-BUG-09 — Caixa postal não entrega:** *"enviei extrato pela caixa postal, falou 'entregue',
  mas no outro aparelho não apareceu nada."* (precisa de 2 aparelhos pareados — ver D-BUG-19.)
- ❌ **D-BUG-20 — Receber dívida/conexão só pelo Backup:** *"pra receber tive que ir em Backup →
  importação → receber de outro aparelho → QR. Isso devia estar em qualquer lugar mais acessível,
  não enterrado no backup."* (depois de achar, funcionou: "Júlio te deve 6 BRL".)

## Bloco I — Importar Wise + CSV nativo

- ✅ Importar pelo topo de Gastos; CSV vira gasto com categoria/cidade/fase sugeridas; sem duplicado.
- ❌ **D-BUG-06 — Linha de crédito não importa:** *"recebeu dinheiro de Bianca, +100, tag crédito —
  não consigo selecionar, fica desativado. Esse dinheiro não vai pra lugar nenhum; era pra atualizar
  minha carteira."*
- ✅ Compra especial (Paylogic/Tomorrowland → lazer/ingresso); criar fase na hora; transferência
  inteligente (Bruno) *"funcionou perfeitamente."*
- ✅ **B1 — Compartilhar CSV nativo (cold + warm start):** *"compartilhei do app de Arquivos →
  TripPilot → abriu no import. Fechei o app e tentei de novo → importou. Perfeito."*

## Bloco J — App Links

- ⏭️ **Bloqueado por D-BUG-01:** sem um link válido (vem localhost), não dá pra testar se o App Link
  abre o app nem se a chave `#fragment` sobrevive (o teste CRÍTICO).

## Bloco K — Ajustes, Segurança, Backup, Biometria

- ✅ Ajustes por categorias; **busca no topo** acha e mostra. *"Está ótimo, não precisa mudar."*
  (a busca não funciona DENTRO das subpáginas, mas o Julio aceitou.)
- ✅ Atalho de Conexões dentro de Backup; **Backup** abre o compartilhamento nativo / grava em
  Downloads; **importar backup** funciona.
- ❌ **D-BUG-… (biometria) / D-DEC-C — Biometria não existe no app nativo:** *"ativei o PIN, mas não
  acho biometria em lugar nenhum; busquei nas configurações, nada. Pede o PIN mas não deixa usar
  biometria."* (a biometria foi entregue **só via WebAuthn web**; no WebView Android ela não aparece
  — precisa de plugin nativo.) 🟡 **D-IMP-06:** *"o PIN podia entrar sozinho quando eu digito o
  certo, sem clicar."*
- 🔁 **D-VER-03 — Self-update do APK:** *"às vezes não atualiza sozinho; o APK estava bem
  desatualizado. Atualizei na mão agora."*

---

## Itens bloqueados (todos destravam ao corrigir D-BUG-01)

1. Abrir o link de divisão no navegador do celular.
2. Tempo real no link (S7).
3. "Compartilhadas comigo".
4. App Links nativos (Bloco J) — inclusive o teste crítico do `#fragment`.

> **Conclusão:** **D-BUG-01 (link `localhost`) é o desbloqueio de maior alavancagem** — uma correção
> de origem destrava 4 áreas inteiras de teste. **D-BUG-02 (zoom iOS)** é o segundo crítico.
> Plano de correção completo (causa-raiz, conselho, anti-regressão, ondas): ver
> `device-test-fixes-masterplan-2026-06-17.md`.
