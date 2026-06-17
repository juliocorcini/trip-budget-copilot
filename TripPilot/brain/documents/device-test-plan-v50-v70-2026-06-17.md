# Roteiro de Teste em Celular — TripPilot v0.50 → v0.70

> **Como usar:** abra este arquivo no PC e vá marcando `[x]` enquanto testa no celular. O roteiro **não**
> segue a ordem das versões — segue o **melhor fluxo** (por tela, reaproveitando os mesmos dados, com as
> permissões e o que é nativo logo no começo). Cada item leva a etiqueta `[0.xx]` da versão que o introduziu.
> Itens marcados com ⚡ são **nativos** (só funcionam no APK instalado, nunca foram testados em aparelho — máxima prioridade).
>
> **Tempo estimado:** ~60–90 min para o roteiro completo; ~20 min se você fizer só os ⚡ (Bloco A + I + J).

---

## Resumo da estratégia (leia antes de começar)

1. **Um app só testa tudo.** Instale o **APK 0.69.0 debug**. Ele traz a casca nativa nova (CSV, App Links, GPS)
   e, ao abrir, **se atualiza sozinho para o web 0.70.0 via OTA**. Como o `latestNativeVersion` publicado (0.56) é
   *mais antigo* que o 0.69 instalado, o app **não** vai te encher pedindo "atualize o app". Ou seja: com esse APK
   você testa **as features web de 0.50→0.70 E as nativas de 0.69** no mesmo lugar.
2. **Dados em 2 cliques.** Em vez de cadastrar tudo na mão, use **"Carregar demonstração"** na tela inicial: cria
   uma viagem rica (2 fases, 2 carteiras dinheiro+digital, 2 pessoas, ~13 gastos, sessão de bar, divisão com dívida,
   liquidação). Isso já cobre Home, Copiloto, Planejador, Pessoas, Carteiras, Saídas etc.
3. **Ordem dos blocos** (cada um reaproveita o anterior):
   `A. Setup & nativo/permissões` → `B. Carregar demo` → `C. Início` → `D. Gastos/Entrada` →
   `E. Saídas/Sessão/Nota` → `F. Viagem/Planejador` → `G. Copiloto` → `H. Pessoas/Dívidas/Link` →
   `I. Importar Wise + ⚡CSV nativo` → `J. ⚡App Links` → `K. Ajustes/Segurança/Backup`.
4. **Por que essa ordem:** as permissões nativas (câmera, GPS) e o App install ficam no Bloco A (uma vez só); o
   **link de divisão** gerado no Bloco H é **reaproveitado** no Bloco J (App Links); o **CSV** do Bloco I serve para o
   import inteligente *e* para o teste de compartilhamento nativo (B1). Você quase nunca volta numa tela já testada.

---

## ⚠️ Antes de tudo — proteja seus dados

- [ ] **Exporte um backup** do app atual: Ajustes → Backup e segurança → enviar/salvar backup `[0.49/0.50]`.
  - Motivo: instalar o APK 0.69 *debug* por cima do app atual normalmente atualiza no lugar (dados preservados). **Se**
    o Android reclamar de assinatura ("app não instalado / conflito"), você terá que **desinstalar** o app atual
    (isso **apaga os dados locais**) e reinstalar — aí você restaura pelo backup.

---

## Bloco A — Setup, app nativo e permissões (faça uma vez) ⚡

APK: `TripPilot/android/app/build/outputs/apk/debug/app-debug.apk` (8,35 MB, versionName 0.69.0).

- [ ] ⚡ **Instalar o APK 0.69.0** (sideload). Copie para o celular e abra; permita "instalar de fonte desconhecida" se pedir.
- [ ] ⚡ **Abrir o app e deixar atualizar:** na primeira abertura com internet ele busca o `version.json` e aplica o
      bundle web 0.70.0. `[0.49 OTA]`
- [ ] **About / Sobre o app:** confirme **versão web = 0.70.0** e **versão nativa (APK) = 0.69.0**; "Buscar atualização"
      deve responder **"está em dia"** (não deve pedir novo APK). `[0.48/0.50/0.52/0.56]`
- [ ] ⚡ **Permissão de câmera:** vá em conectar com outro aparelho / ler QR (Pessoas e dívidas → conectar, ou
      Ajustes → Conexões) e dispare o **leitor de QR** → o Android deve **pedir a permissão de câmera** e a câmera abrir. `[0.50]`
- [ ] ⚡ **Sem overscroll:** role a Home além do topo/fim → **não** deve ter aquele efeito de "esticar/glow" do WebView. `[0.50]`
- [ ] ⚡ **Permissão de localização (GPS):** Ajustes → ative captura de localização (ou no fluxo de gasto, toque em
      "usar minha localização") → o Android deve **mostrar o prompt nativo de localização**; conceda. `[0.64 / B3 (0.69)]`
      *(o uso real do GPS num gasto você confere no Bloco E/D.)*

> Se a câmera **ou** o GPS não pedirem permissão / não funcionarem, anote (é exatamente o tipo de bug nativo que só
> aparece em aparelho). Tire print.

---

## Bloco B — Carregar dados de demonstração

- [ ] Se o app já tem viagem e você quer começar limpo: Ajustes → Dados e segurança → **Zerar** (baixa backup antes). `[0.48]`
- [ ] Na tela inicial (sem viagem), toque em **"Carregar demonstração"**. `[demo]`
- [ ] Confirme que aparece a viagem **"Eurotrip Espanha 2026"** e um **aviso de modo demonstração** no topo da Home. `[demo]`

*A partir daqui os blocos C–H usam esses dados.*

---

## Bloco C — Início (Home / Dashboard)

- [ ] **Trocar de aba arrastando** (Início ↔ Gastos ↔ Viagem ↔ Copiloto), inclusive arrastando no fundo vazio; a tela
      acompanha o dedo e volta suave se você desistir no meio. `[0.41/0.59]`
- [ ] Carrosséis/listas que rolam de lado **continuam** rolando de lado (não trocam de aba sem querer). `[0.41/0.59]`
- [ ] **"Livre para usar"** mostra o valor já **descontando o reservado do planejador**; abaixo aparece "total da fase −
      o que está no plano". `[0.42]`
- [ ] **Check-in do dia** (controle compacto sob o "livre hoje"): toque, troque o clima (tranquilo / noite / sem gastos)
      e veja o "livre hoje" **reenquadrar** (sempre como projeção, sem mexer no orçamento). `[0.42/0.59]`
- [ ] **Foco do dia** sobe perto do check-in (nem sempre o cofrinho). `[0.42]`
- [ ] **Cofrinho** aparece em momentos calmos/"sem gastos" e no Copiloto; dá pra **fixar** nas opções do card. `[0.59]`
- [ ] **"Amigo sincero"** fica **verde** quando está tudo no plano e **some** quando não há nada a ajustar. `[0.59]`
- [ ] **Meta de economia**: toque no card para ajustar/remover direto na Home. `[0.46]`
- [ ] **2 cards por linha**: segure um card (ou "Configurar tela inicial") e ative "Mostrar 2 por linha" (Cofrinho/Meta/Planejadas/Compras). `[0.46]`
- [ ] **Fechar card flutuante arrastando** a alça pra baixo. `[0.59]`
- [ ] **Gastos recentes** na Home em formato compacto, com "hoje/ontem" + horário; lista completa a um toque. `[0.41/0.59]`
- [ ] **Animações de transição** já animam na **primeira** vez que você abre uma tela (e voltam ao contrário no "voltar"). `[0.36/0.37]`
- [ ] Telas abrem **no topo** (título e "voltar" visíveis) ao entrar em Compras pessoais/planejadas etc. `[0.41]`

---

## Bloco D — Gastos e Entrada (aba Gastos + menu "+")

- [ ] **Menu "+"** abre como folha com "Registrar gasto" em destaque e os demais numa grade com ícones coloridos. `[0.36/0.38]`
- [ ] **Registrar um gasto** novo (valor, categoria, carteira). `[base]`
- [ ] ⚡ **Foto no gasto novo**: anexe foto pela **câmera** e pela **galeria** (pede permissão na 1ª vez). `[0.51/0.52]`
- [ ] Abra um gasto existente → **"Fotos"** → adicione/lembre que as imagens ficam só no aparelho. `[0.51]`
- [ ] ⚡ **Local no gasto (GPS)**: ao registrar, use "usar minha localização" → deve preencher coordenadas/lugar; teste
      também **digitar** para filtrar lugares conhecidos (offline) e o botão **"buscar nome (online)"**. `[0.64 / B3]`
- [ ] **Registrar entrada (income)** `[0.67]`:
  - [ ] "+" → **"Registrar entrada"**; informe um valor (ex.: reembolso), escolha **fundo** e **carteira**.
  - [ ] A entrada **aumenta o fundo** escolhido e **credita a carteira** — **não** vira gasto.
  - [ ] No **"De onde vem esse número"** (toque no "livre") ela aparece **em verde**, somando ao livre.
  - [ ] Abra a entrada em Gastos → dá para **ver/editar/excluir** como um lançamento.
- [ ] **Dividir um gasto** com a Ana e, logo após salvar, aparece o **atalho "Compartilhar com Ana"** (nudge). `[0.66]`
      *(Não precisa enviar agora — o link você gera de verdade no Bloco H.)*

---

## Bloco E — Saídas, Sessão e Escanear nota (aba Gastos → Saídas)

- [ ] **Saída ativa** cabe numa tela só (botões e valores do quick-add visíveis sem rolar). `[0.38]`
- [ ] ⚡ **Notificação da saída ativa**: inicie uma saída → confira a **notificação com botões de valor**; toque num
      botão **com o app fechado/em segundo plano** → o gasto entra na hora; ao abrir o app, o total reconcilia. `[0.39]`
- [ ] **Quick-add** registra rodadas; total e "quanto falta pra meta (≈ N bebidas)" atualizam. `[0.39]`
- [ ] A demo já tem uma **sessão de bar concluída** ("Noite no bar — Plaza Mayor") agrupando 3 itens — abra e veja os itens. `[0.55.1/demo]`
- [ ] **Local da saída** com busca (mesma inteligência do gasto: próximos + conhecidos + digitar). `[0.64]`
- [ ] ⚡ **Escanear nota** (precisa da **leitura por IA ligada** em Ajustes + internet): "+" ou topo de Gastos →
      **Escanear nota** → foto → a IA lê os itens. `[0.53/0.55.1/0.56]`
  - [ ] **Revisar/editar** itens; **escolher exatamente quais pessoas** entram no rateio (não entra todo mundo). `[0.56]`
  - [ ] **Dividir a nota inteira** ("Pessoal" / "Dividir igual") e definir **quem pagou**. `[0.54]`
  - [ ] **Ajustar ao total** quando itens não batem (taxa/serviço/gorjeta) → distribui a diferença. `[0.54]`
  - [ ] Salva como **uma saída** (linha única "loja · N itens · total"); buscar/filtrar lista item a item. `[0.55.1]`
  - [ ] Sem foto/offline: **adicionar itens na mão**. `[0.53]`

---

## Bloco F — Viagem, Planejador e Fases (aba Viagem)

- [ ] **"Livre para usar nesta fase"**: toque → **mapa por dia** (quanto sobra livre em cada dia até o fim da fase, picos
      de fim de semana maiores) + o que já foi planejado em cada data; a conta "X na fase − Y no plano" aparece. `[0.45]`
- [ ] **"De onde vem esse número"**: card com **duas abas sempre à vista** — "Disponível por dia" (calendário, mais verde
      = mais livre) e **"Gastos por dia"** (mapa do mês). Toque num dia → detalhe "livre + reservado = total do dia". `[0.60]`
- [ ] **"Ver prévia da fase"** (visão de futuro): planeje uma fase como se fosse o dia 1, sem mexer no presente;
      calendário "disponível por dia" da fase. `[0.62]`
- [ ] **Renda planejada por fase**: informe um dinheiro que vai entrar na fase → entra **só** na visão de futuro,
      nunca no "livre hoje". `[0.62]`
- [ ] **Reservas por fase com sugestão automática** (Essencial / Recomendado / Confortável): o app divide o fundo entre
      fases pelo ritmo; dá pra tocar e escolher **ou** digitar à mão. `[0.65 / B7]`
- [ ] **Vincular gasto já registrado a uma compra planejada** ("comprei antes de planejar"): um toque, **sem** criar
      gasto novo. `[0.65 / B9]`
- [ ] **Simulador por categoria mais honesto**: se a categoria já estourou o plano, ele **avisa** mesmo que "caberia"
      como mais uma ocasião. `[0.65 / B12]`
- [ ] **Empty state do Planejador** `[0.65 / B17]`: para ver, **crie uma viagem nova** (ou uma fase-zero) e abra o
      Planejador **antes** de ter fases → deve mostrar uma **tela de boas-vindas** (antes ficava carregando).
      *(A demo já tem fases, então esse é o único item que pede uma viagem sem fases.)*

---

## Bloco G — Copiloto (aba Copiloto) — módulos novos data-gated `[0.68 / B10]`

> São "data-gated": só aparecem quando há dados suficientes. Com a **demo** carregada, os 4 devem aparecer (ela tem
> gasto em **dinheiro e cartão**, **horários variados** e **moeda base EUR**). Se algum **não** aparecer, registre —
> mas lembre que sumir por falta de dado é **comportamento esperado**, não bug.

- [ ] **Total da viagem na sua moeda de casa** (âncora em moeda base). `[0.68]`
- [ ] **Divisão dinheiro × cartão** (payment mix) com o que está sem rastrear, se houver. `[0.68]`
- [ ] **Hora do dia em que você mais gasta** (peak hour). `[0.68]`
- [ ] **Sequência de dias dentro do ritmo** (discipline streak). `[0.68]`
- [ ] Cofrinho também aparece aqui em momentos certos. `[0.59]`

---

## Bloco H — Pessoas, dívidas, divisão por link, tempo real e pareamento

- [ ] **Pessoas e dívidas**: a demo mostra a **Ana** com saldo pendente (ela já liquidou parte). `[demo/0.47]`
- [ ] **Compartilhar por link** `[0.57]`: numa pessoa (Ana) → **"Compartilhar por link"** → **copie/guarde o link** (vai
      ser tipo `https://trippilot.pages.dev/s/<id>#k=<chave>`). **GUARDE ESSE LINK para o Bloco J.**
  - [ ] Abra o link **no navegador do próprio celular** (ou em outro aparelho) → deve mostrar **só** o que você dividiu,
        **sem instalar app / sem conta**. `[0.57]`
  - [ ] Na visão do link: **confirmar/recusar** cada gasto e marcar **"já paguei"**. `[0.57]`
  - [ ] No seu app: **puxar respostas** e **confirmar a liquidação** (ninguém quita sozinho). `[0.57]`
  - [ ] **Revogar o link** e confirmar que ele para de abrir. `[0.57]`
- [ ] ⚡ **Tempo real** `[0.58]` (precisa de 2 telas online: seu app + o link aberto noutro lugar): edite um gasto no app
      → aparece **na hora** no link, com aviso "Fulano atualizou…"; e a resposta dela volta na hora pra você.
- [ ] **Conectar por link/QR** `[0.61]`: Pessoas/Conexões → **"Copiar link"** ou **QR**; a outra pessoa abre, confirma
      "conectar com o aparelho de fulano?". **Guarde também um link `…/pair#...` para o Bloco J.**
- [ ] ⚡ **Caixa postal** `[0.47]`: enviar uma divisão/backup para um aparelho pareado pela caixa postal; confere que
      aparece pro outro **só quando ele abre** e nada é aplicado sozinho. *(precisa de 2º aparelho pareado)*
- [ ] **"Compartilhadas comigo"**: quem só abriu link tem área própria e pode começar a própria viagem. `[0.57]`

---

## Bloco I — Importar extrato Wise + ⚡ compartilhamento nativo de CSV (B1)

> Use um **CSV real exportado da Wise** (Statements → CSV) para exercitar o import inteligente. Para um teste rápido só
> do **fluxo nativo**, salve o mini-CSV abaixo como `teste-wise.csv` no celular:

```csv
TransferWise ID,Date,Amount,Currency,Description,Payment Reference,Payee Name,Merchant,Card Last Four Digits,Note,Transaction Type,Transaction Details Type
CARD-1001,15-06-2026,-12.50,EUR,Mercadona Burgos,,,Mercadona,1234,,DEBIT,CARD
CARD-1002,16-06-2026,-7.39,EUR,Cervezas Plaza Mayor,,,Bar Plaza,1234,,DEBIT,CARD
CARD-1003,16-06-2026,-89.00,EUR,Paylogic Tomorrowland,,,Paylogic,1234,,DEBIT,CARD
TRANSFER-2001,17-06-2026,100.00,EUR,From Ana,,Ana,,,,CREDIT,TRANSFER
```

- [ ] **Importar pelo botão no topo de Gastos** (e confirme que também existe na Carteira). `[0.43]`
- [ ] **Importar .csv**: selecione o(s) arquivo(s) → cada compra vira gasto com **categoria, cidade e fase sugeridas**;
      revise, escolha a carteira (ou crie "Wise EUR" na hora), importe, e teste **desfazer**. `[0.40]`
- [ ] **Sem duplicado**: reimporte o mesmo arquivo → o já importado é **reconhecido e ignorado**; lançamentos parecidos
      com manuais (mesmo dia/valor) vêm **desmarcados**. `[0.40]`
- [ ] **Import inteligente** `[0.63]`:
  - [ ] **Compra especial** reconhecida: a linha **Paylogic/Tomorrowland** entra como **lazer/ingresso** (não "outros").
  - [ ] **Reembolso vinculado**: a entrada **"From Ana" (+100)** logo após uma compra deve **sugerir vincular** (registra
        a compra como dividida e **quita a dívida** com a entrada).
  - [ ] **Criar a fase na hora** quando uma compra cai fora de toda fase (ex.: fim de semana de festival).
- [ ] **Transferência inteligente** `[0.44]`: uma transferência para uma pessoa reconhece o nome, sugere participante e
      mostra a dívida; pode ser **dividida em partes** (pagar dívida / gasto que ela pagou / entre carteiras / gasto seu) —
      a soma tem que **fechar** com o valor; não vira mais gasto solto.
- [ ] ⚡ **B1 — compartilhamento nativo de CSV** (o grande teste nativo) `[0.69 / B1]`:
  - [ ] No **Wise** (ou app de **Arquivos**), selecione o `.csv` → **Compartilhar** → escolha **TripPilot** na lista →
        o app deve **abrir já na tela de import com as linhas carregadas**.
  - [ ] Teste também **"Abrir com" → TripPilot** a partir de um gerenciador de arquivos (intent ACTION_VIEW).
  - [ ] Faça os dois cenários: **app fechado** (cold start) e **app aberto** (warm start).

---

## Bloco J — ⚡ App Links (deep links nativos) `[0.69 / B2]`

> Reaproveita os links que você guardou no Bloco H. **Não** cole no app — cole na **barra do navegador** do celular.

- [ ] ⚡ Abra um link **`…/pair#...`** no navegador do celular → deve **abrir o app TripPilot** (não o site) e cair na
      tela de pareamento. *(Na 1ª vez o Android pode perguntar "abrir com TripPilot?": escolha **sempre**.)*
- [ ] ⚡ Abra um link **`…/s/<id>#k=<chave>`** no navegador → deve abrir **no app** a divisão correta.
- [ ] ⚡ **CRÍTICO — a chave sobrevive?** Confirme que o `/s/...` aberto pelo app mostra os gastos **decifrados**
      (prova que o **`#k=` (fragment)** chegou). Se abrir mas vier **vazio/erro de chave**, o Android descartou o
      fragment → **anote** (decisão pendente: cair pro fallback "App Links só no `/pair`, QR no `/s/:id`").
- [ ] ⚡ (Opcional) Sanidade da verificação: o `https://trippilot.pages.dev/.well-known/assetlinks.json` já está no ar
      como JSON. Lembrete: ele só tem a impressão do **keystore debug**; o App Link verifica para **este APK debug**.

---

## Bloco K — Ajustes, Segurança, Backup, Biometria e Reset

- [ ] **Ajustes por categorias** (estilo Samsung): toca numa categoria → subpágina focada; **busca no topo** filtra na hora. `[0.61]` *(em versões antigas era página única com seções `[0.46]`)*
- [ ] **Atalho de Conexões** dentro de Backup e segurança. `[0.61]`
- [ ] ⚡ **Backup**: "Enviar backup" abre o **menu de compartilhar** do Android; "Salvar no aparelho" grava o arquivo na
      pasta **Downloads/Documentos**. `[0.49/0.50]`
- [ ] **Importar backup** (restaurar) a partir de um arquivo. `[0.48]`
- [ ] **PIN / bloqueio do app** `[0.68 / B6]`: Ajustes → ative o **PIN**.
  - [ ] ⚡ **Biometria sobre o PIN**: ative **"Desbloquear com biometria"** (registra a digital/rosto do aparelho).
  - [ ] Feche e reabra o app → ele deve **oferecer a biometria**; autentique e desbloqueie.
  - [ ] **Fallback (ÂNCORA 12)**: o campo de **PIN continua sempre visível** — cancele a biometria e entre pelo PIN;
        force uma falha de biometria e confirme que o **PIN ainda funciona** (você nunca fica trancado pra fora).
  - [ ] Desligar o bloqueio também **limpa** a credencial de biometria.
- [ ] **Caixa postal** liga/desliga em Ajustes. `[0.47]`
- [ ] **Zerar o app** `[0.48]`: baixa backup automático antes; testar as duas opções — **apagar tudo** (volta ao
      início) e **manter a viagem, limpar lançamentos**.
- [ ] **Atualização self-update Android** `[0.56]`: em "Buscar atualização", quando houver APK novo publicado, ele baixa
      e abre a instalação com um toque (o APK também vai pra Downloads). *(hoje não há APK mais novo que 0.69, então deve dizer "em dia".)*

---

## Mapa de cobertura (versão → onde testar)

| Versão | O que entrou | Bloco |
|---|---|---|
| 0.50 | câmera QR, backup→Downloads, fim do overscroll | A, K |
| 0.51 | fotos nos gastos | D |
| 0.52 | auto-update Android, fotos em mais lugares | A/K, D |
| 0.53 | escanear nota (IA opt-in) | E |
| 0.54 | dividir nota inteira, ajustar ao total | E |
| 0.55.1 | leitura no aparelho*, notas/saídas agrupadas, escanear em destaque | E |
| 0.56 | escolher quem divide, IA-only, self-update APK | E, A/K |
| 0.57 | dividir por link, "compartilhadas comigo" | H |
| 0.58 | tempo real no link | H |
| 0.59 | Home mais limpa, check-in compacto, swipe entre abas, drag-to-close | C |
| 0.60 | mapa da fase (2 abas), calendário por dia, gastos por dia | F |
| 0.61 | Ajustes por categorias, conectar por link | K, H |
| 0.62 | visão de futuro da fase, calendário da fase, renda planejada por fase | F |
| 0.63 | import Wise inteligente (reembolso, compras especiais, criar fase) | I |
| 0.64 | busca de lugar na saída/gasto + "buscar nome online" | D, E |
| 0.65 | empty state Planner (B17), vincular gasto (B9), simulador por categoria (B12), piso automático (B7) | F |
| 0.66 | nudge "Compartilhar com {pessoa}" após dividir (B5) | D |
| 0.67 | tipo de transação **entrada/income** (B8) | D |
| 0.68 | Copiloto v3: 4 módulos (B10) + biometria sobre PIN (B6) | G, K |
| 0.69 | ⚡ **nativo**: receber CSV (B1), App Links (B2), GPS nativo (B3) | I, J, A/D |
| 0.70 | criação de fundo atômica (B13) — estabilidade interna | F* |

\* *0.55.1 leitura on-device foi **removida** na 0.56 (IA-only) — não precisa testar.*
\* *0.70 (B13) é mudança interna sem UI nova: o teste é funcional — criar um **fundo com fases** no Planejador e
confirmar que salva inteiro (pool + reservas das fases de uma vez). Cobre no Bloco F ao criar/editar um fundo.*

---

## O que **não** está aqui (e por quê)

- **B4** (link compartilhado v1.1) — congelado, você vai redesenhar. **B11/B14/B16** — deferidos por decisão.
  Detalhes no `waves-final-report-2026-06-17.md`.
- **Anotações para a sessão:** qualquer falha, anote a **versão `[0.xx]`**, o **bloco**, e um **print**. Os itens ⚡ são
  os mais importantes — nunca rodaram em aparelho. Se o App Link **`/s/`** perder a chave (Bloco J), me avise: já tenho
  o fallback pronto pra aplicar.

---

*Roteiro gerado em 2026-06-17. Fonte da verdade das mudanças: `src/utils/release-notes.ts` (0.50→0.70) +
`waves-final-report-2026-06-17.md`. APK de teste: `android/app/build/outputs/apk/debug/app-debug.apk` (0.69.0).*
