/**
 * Release notes shown in the About screen ("What's new").
 *
 * Keep the newest version FIRST (descending order). Each gate of the
 * feature-expansion package adds one entry here in the same commit as the
 * version bump (package.json + app-version.ts), with end-user copy in the
 * three supported languages.
 */

export type ReleaseNoteLang = 'pt-BR' | 'en' | 'es';

export interface ReleaseNote {
  version: string;
  date: string;
  items: Record<ReleaseNoteLang, string[]>;
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '0.85.0',
    date: '2026-06-18',
    items: {
      'pt-BR': [
        'Lista de gastos mais limpa: os filtros agora ficam atrás de um botão “Filtros”, organizados por tipo (Categorias, Lugares).',
        'O que está filtrando aparece sempre visível, com um contador — e nada foi removido, é tudo a um toque.',
        'A aba “Saídas” ganhou uma linha explicando o que é: os gastos de um rolê (uma noite, um passeio) numa linha só.',
      ],
      en: [
        'Cleaner expense list: filters now live behind a “Filters” button, grouped by type (Categories, Places).',
        'What’s filtering stays visible, with a count badge — and nothing was removed, it’s all one tap away.',
        'The “Outings” tab got a one-line explainer: the expenses of a night out (a bar crawl, a day trip) in a single line.',
      ],
      es: [
        'Lista de gastos más limpia: los filtros ahora están detrás de un botón “Filtros”, agrupados por tipo (Categorías, Lugares).',
        'Lo que está filtrando queda siempre visible, con un contador — y no se quitó nada, todo está a un toque.',
        'La pestaña “Salidas” tiene una línea que explica qué es: los gastos de una salida (una noche, un paseo) en una sola línea.',
      ],
    },
  },
  {
    version: '0.84.0',
    date: '2026-06-18',
    items: {
      'pt-BR': [
        'Vocabulário mais claro: o que antes se chamava “Perfis” agora é “Atividades” — os tipos de gasto que o app aprende (bar, restaurante, mercado…).',
        'É só o nome: o recurso é exatamente o mesmo (valores típicos, frequência por fase, planejamento) — agora com um rótulo que diz na hora o que é.',
      ],
      en: [
        'Clearer wording: what used to be called “Profiles” is now “Activities” — the spending types the app learns (bar, restaurant, groceries…).',
        'It’s just the name: the feature is exactly the same (typical values, per-phase frequency, planning) — now with a label that says what it is at a glance.',
      ],
      es: [
        'Vocabulario más claro: lo que antes se llamaba “Perfiles” ahora es “Actividades” — los tipos de gasto que la app aprende (bar, restaurante, mercado…).',
        'Es solo el nombre: la función es exactamente la misma (valores típicos, frecuencia por fase, planificación) — ahora con una etiqueta que dice de inmediato qué es.',
      ],
    },
  },
  {
    version: '0.83.0',
    date: '2026-06-18',
    items: {
      'pt-BR': [
        'Copiloto mais fácil de ler: as análises agora vêm organizadas em quatro temas que você abre e fecha — “Agora”, “Para onde vai”, “Padrões” e “Pessoas”.',
        'O primeiro tema com conteúdo abre sozinho; os outros ficam a um toque, cada um com um contador do que tem dentro — dá pra saber onde olhar primeiro.',
        'Nada foi removido: todas as leituras (veredito, projeção, mapa do mês, ritmo, social, dívidas…) continuam ali, só que agrupadas em vez de uma parede única.',
      ],
      en: [
        'Easier-to-read Copilot: the reads are now organized into four themes you can open and close — “Now”, “Where it’s heading”, “Patterns” and “People”.',
        'The first non-empty theme opens by itself; the others are one tap away, each with a counter of what’s inside — so you know where to look first.',
        'Nothing removed: every read (verdict, projection, month map, pace, social, settlements…) is still there, just grouped instead of one long wall.',
      ],
      es: [
        'Copiloto más fácil de leer: los análisis ahora se organizan en cuatro temas que abres y cierras — “Ahora”, “Hacia dónde va”, “Patrones” y “Personas”.',
        'El primer tema con contenido se abre solo; los demás quedan a un toque, cada uno con un contador de lo que hay dentro — así sabes dónde mirar primero.',
        'Nada eliminado: todas las lecturas (veredicto, proyección, mapa del mes, ritmo, social, deudas…) siguen ahí, solo que agrupadas en vez de un muro único.',
      ],
    },
  },
  {
    version: '0.82.0',
    date: '2026-06-18',
    items: {
      'pt-BR': [
        'Captura mais rápida no “+”: “Registrar gasto” e “Escanear nota” agora ficam na base do menu, na zona do polegar — sem precisar esticar o dedo até o topo.',
        'Menos bagunça, nada removido: os registros raros (transferência, saque, entrada) e o “Planejar / Simular” se escondem atrás de botões que expandem; tudo continua a um toque.',
        'Registrar gasto ficou enxuto: valor, categoria e descrição na frente; data, local, fundo, carteira e anexos recolhidos em “Detalhes”. Um gasto comum sai em ~3 toques.',
        'Quando você só tem um fundo na fase, ele nem aparece mais na tela — é escolhido sozinho.',
      ],
      en: [
        'Faster capture on “+”: “Register expense” and “Scan receipt” now sit at the base of the menu, in the thumb zone — no more reaching to the top.',
        'Less clutter, nothing removed: the rare entries (transfer, withdrawal, income) and “Plan / Simulate” tuck behind expanders; everything is still one tap away.',
        'Register expense is leaner: amount, category and description up front; date, place, fund, wallet and attachments collapse under “Details”. A typical expense is ~3 taps.',
        'When a phase has a single fund, it no longer shows on screen — it’s picked for you.',
      ],
      es: [
        'Captura más rápida en “+”: “Registrar gasto” y “Escanear recibo” ahora están en la base del menú, en la zona del pulgar — sin estirar el dedo hasta arriba.',
        'Menos desorden, nada eliminado: los registros raros (transferencia, retiro, ingreso) y “Planificar / Simular” se ocultan tras botones que expanden; todo sigue a un toque.',
        'Registrar gasto quedó más simple: monto, categoría y descripción al frente; fecha, lugar, fondo, billetera y adjuntos recogidos en “Detalles”. Un gasto típico sale en ~3 toques.',
        'Cuando una fase tiene un solo fondo, ya no aparece en pantalla — se elige solo.',
      ],
    },
  },
  {
    version: '0.81.0',
    date: '2026-06-18',
    items: {
      'pt-BR': [
        'Nova “Visão avançada da viagem” em Configurações → Dinheiro e metas: quem quiser ver os detalhes técnicos do dinheiro (fundos, vínculos, envelopes e carteiras) agora tem um lugar só pra isso — o dia a dia continua simples.',
        'É só visualização e atalho: de lá você abre direto as telas de Fundos e Carteiras para editar, sem bagunçar a tela inicial.',
        'Fecha a reforma do modelo de orçamento: trecho, pote, evento e compra planejada, tudo organizado — e nada do que existia antes foi removido.',
      ],
      en: [
        'New “Advanced trip view” in Settings → Money & goals: anyone who wants the technical details of their money (funds, links, envelopes and wallets) now has one place for it — the everyday flow stays simple.',
        'It’s view-and-shortcut only: from there you jump straight into the Funds and Wallets screens to edit, without cluttering the home screen.',
        'Wraps up the budget-model reform: segment, pot, event and planned purchase, all organized — and nothing that existed before was removed.',
      ],
      es: [
        'Nueva “Vista avanzada del viaje” en Ajustes → Dinero y metas: quien quiera ver los detalles técnicos del dinero (fondos, vínculos, sobres y billeteras) ya tiene un lugar para eso — el día a día sigue simple.',
        'Es solo visualización y atajo: desde ahí abres directo las pantallas de Fondos y Billeteras para editar, sin recargar la pantalla de inicio.',
        'Cierra la reforma del modelo de presupuesto: tramo, fondo, evento y compra planificada, todo organizado — y nada de lo que existía antes se quitó.',
      ],
    },
  },
  {
    version: '0.80.0',
    date: '2026-06-18',
    items: {
      'pt-BR': [
        'Carteira progressiva: se você usa uma só fonte de dinheiro, o app deixou de perguntar “de onde saiu?” em cada gasto — fica tudo mais simples e direto.',
        'Quando você tem 2 ou mais carteiras (ou importa do Wise), a pergunta da carteira acende sozinha, porque aí faz diferença saber de onde o dinheiro saiu.',
        'Novo controle em Configurações → Dispositivo e captura: escolha Automático, Sempre perguntar ou Nunca perguntar — você manda no comportamento.',
      ],
      en: [
        'Progressive wallet: if you use a single money source, the app no longer asks “where did it come from?” on every expense — it just stays simple.',
        'When you have 2 or more wallets (or import from Wise), the wallet question turns on by itself, because then it matters which source the money came from.',
        'New control in Settings → Device & capture: pick Automatic, Always ask or Never ask — you’re in charge of the behavior.',
      ],
      es: [
        'Billetera progresiva: si usas una sola fuente de dinero, la app dejó de preguntar “¿de dónde salió?” en cada gasto — todo más simple.',
        'Cuando tienes 2 o más billeteras (o importas desde Wise), la pregunta de la billetera se activa sola, porque ahí sí importa de dónde salió el dinero.',
        'Nuevo control en Ajustes → Dispositivo y captura: elige Automático, Preguntar siempre o No preguntar — tú decides el comportamiento.',
      ],
    },
  },
  {
    version: '0.79.0',
    date: '2026-06-18',
    items: {
      'pt-BR': [
        '“Planejar um gasto” agora é uma porta única: responda duas perguntas simples (acontece numa data? de onde vem o dinheiro?) e o app cria a coisa certa — um evento, um pote ou uma compra — sem termos técnicos.',
        'Eventos viraram de primeira classe: ficam na seção “Potes e planejados” da aba Viagem e sobem para a tela inicial quando ficam próximos (ao entrar no trecho dono ou faltando até 7 dias).',
        'Você escolhe de onde sai o dinheiro de cada plano: do dia a dia (sai do orçamento do trecho), um valor à parte só pra isso (cria um pote) ou um pote que já existe.',
      ],
      en: [
        '“Plan an expense” is now a single door: answer two simple questions (does it happen on a date? where does the money come from?) and the app creates the right thing — an event, a pot or a purchase — with no jargon.',
        'Events are now first-class: they live in the “Pots & planned” section on the Trip tab and rise to the home screen as they get close (when you enter the owning segment, or within 7 days).',
        'You choose where each plan’s money comes from: day-to-day (out of the segment’s budget), a separate amount just for it (creates a pot), or a pot you already have.',
      ],
      es: [
        '“Planear un gasto” ahora es una sola puerta: responde dos preguntas simples (¿ocurre en una fecha? ¿de dónde sale el dinero?) y la app crea lo correcto — un evento, un fondo o una compra — sin términos técnicos.',
        'Los eventos pasan a ser de primera clase: viven en la sección “Fondos y planificado” de la pestaña Viaje y suben a la pantalla de inicio cuando se acercan (al entrar en el tramo dueño o faltando hasta 7 días).',
        'Eliges de dónde sale el dinero de cada plan: del día a día (sale del presupuesto del tramo), un importe aparte solo para eso (crea un fondo) o un fondo que ya tienes.',
      ],
    },
  },
  {
    version: '0.78.0',
    date: '2026-06-18',
    items: {
      'pt-BR': [
        'Os potes (dinheiro à parte, com uma finalidade — um festival, compras, uma reserva) agora têm um lugar só: a seção “Potes e planejados” na aba Viagem. Crie um pote com nome e valor e, se quiser, uma data e uma meta.',
        'Pote com data só aparece na tela inicial quando fica relevante: ao entrar no trecho dono dele ou quando faltam até 7 dias para a data — assim ele não polui os outros dias. Potes sem data continuam sempre à mão.',
        'Você pode separar dinheiro num pote a qualquer momento, mesmo em outro trecho (ex.: adiantar um gasto do festival), sem mexer no orçamento do trecho atual.',
      ],
      en: [
        'Pots (money set apart for a purpose — a festival, shopping, a buffer) now have a single home: the “Pots & planned” section on the Trip tab. Create a pot with a name and amount, plus an optional date and goal.',
        'A dated pot only shows on the home screen when it becomes relevant: when you enter the segment that owns it, or within 7 days of its date — so it never clutters the other days. Dateless pots stay always at hand.',
        'You can set money aside in a pot anytime, even from another segment (e.g. pre-paying a festival expense), without touching the current segment’s budget.',
      ],
      es: [
        'Los fondos (dinero aparte, con un propósito — un festival, compras, una reserva) ahora tienen un único lugar: la sección “Fondos y planificado” en la pestaña Viaje. Crea un fondo con nombre e importe y, si quieres, una fecha y una meta.',
        'Un fondo con fecha solo aparece en la pantalla de inicio cuando se vuelve relevante: al entrar en el tramo dueño o cuando faltan hasta 7 días para la fecha — así no satura los demás días. Los fondos sin fecha siguen siempre a mano.',
        'Puedes apartar dinero en un fondo en cualquier momento, incluso desde otro tramo (p. ej. adelantar un gasto del festival), sin tocar el presupuesto del tramo actual.',
      ],
    },
  },
  {
    version: '0.77.0',
    date: '2026-06-18',
    items: {
      'pt-BR': [
        'Agora dá pra dividir a viagem em trechos com orçamento próprio direto na aba Viagem (nome, datas e valor). O total da viagem passa a ser a soma dos trechos, com os potes contados à parte.',
        'As datas dos trechos não se sobrepõem: se um trecho novo começa no último dia de outro, o app ajusta o anterior automaticamente — o dia de virada fica com o trecho que começa.',
        'Estourou um trecho? Toque em “Remanejar” para puxar orçamento de outro trecho; o total da viagem não muda.',
      ],
      en: [
        'You can now split your trip into segments with their own budget right from the Trip tab (name, dates, amount). The trip total becomes the sum of the segments, with pots counted separately.',
        'Segment dates never overlap: if a new segment starts on another’s last day, the app trims the previous one automatically — the boundary day goes to the segment that starts.',
        'Overspent a segment? Tap “Move budget” to pull from another segment; the trip total stays the same.',
      ],
      es: [
        'Ahora puedes dividir el viaje en tramos con su propio presupuesto desde la pestaña Viaje (nombre, fechas e importe). El total del viaje pasa a ser la suma de los tramos, con los fondos aparte.',
        'Las fechas de los tramos no se superponen: si un tramo nuevo empieza el último día de otro, la app ajusta el anterior automáticamente — el día de cambio queda con el tramo que empieza.',
        '¿Se excedió un tramo? Toca “Reasignar” para traer presupuesto de otro tramo; el total del viaje no cambia.',
      ],
    },
  },
  {
    version: '0.76.0',
    date: '2026-06-18',
    items: {
      'pt-BR': [
        'Quando sua viagem tem mais de um trecho com orçamentos separados, a tela inicial e a aba Viagem agora mostram o dinheiro do trecho em que você está hoje — antes podiam mostrar sempre o do primeiro trecho.',
      ],
      en: [
        'When your trip has more than one stretch with separate budgets, the home screen and the Trip tab now show the money for the stretch you are in today — before they could always show the first stretch.',
      ],
      es: [
        'Cuando tu viaje tiene más de un tramo con presupuestos separados, la pantalla de inicio y la pestaña Viaje ahora muestran el dinero del tramo en el que estás hoy — antes podían mostrar siempre el del primer tramo.',
      ],
    },
  },
  {
    version: '0.75.0',
    date: '2026-06-17',
    items: {
      'pt-BR': [
        'Ao escanear uma nota, se o app não conseguir ler o nome do estabelecimento ele passa a dar um nome pela categoria predominante (ex.: "Mercado", "Restaurante") em vez de só "Nota".',
      ],
      en: [
        'When you scan a receipt and the app can\'t read the store name, it now titles the note by its main category (e.g. "Market", "Restaurant") instead of a bare "Note".',
      ],
      es: [
        'Al escanear una cuenta, si la app no puede leer el nombre del establecimiento ahora le pone un nombre según la categoría predominante (p. ej. "Mercado", "Restaurante") en vez de solo "Nota".',
      ],
    },
  },
  {
    version: '0.74.0',
    date: '2026-06-17',
    items: {
      'pt-BR': [
        'Os gastos recentes na tela inicial agora agrupam as saídas igual à lista de gastos, e os calendários e o mapa de calor mostram o valor de cada dia direto na célula — sem precisar tocar.',
        'Desbloqueio por PIN: o app abre no instante em que você digita o último número, sem precisar tocar em "desbloquear".',
        'Dá pra vincular um gasto já lançado a uma compra planejada direto na tela do gasto; e os atalhos "ver prévia da fase" e "gerenciar fundo" agora aparecem na aba Viagem.',
        'Compartilhar uma divisão agora abre o compartilhamento do celular (WhatsApp e afins) em vez de só copiar o link; e "receber de outro aparelho / ler QR" passou a ficar também em Pessoas e dívidas.',
        'Toques finais: texto mais claro ao dividir um item da nota, dá pra arrastar a folha pra baixo por qualquer parte pra fechar, e a troca de abas anima no sentido certo.',
      ],
      en: [
        'Recent expenses on the home screen now group outings just like the expenses list, and the calendars and heatmap show each day\'s amount right in the cell — no tapping needed.',
        'PIN unlock: the app opens the moment you type the last digit, with no extra "unlock" tap.',
        'You can link an already-logged expense to a planned purchase right from the expense screen; and the "see phase preview" and "manage fund" shortcuts now live on the Trip tab.',
        'Sharing a split now opens your phone\'s native share sheet (WhatsApp and friends) instead of only copying the link; and "receive from another device / scan QR" is now also in People & debts.',
        'Finishing touches: clearer wording when splitting a receipt item, you can drag the sheet down from anywhere to close it, and tab switches animate in the right direction.',
      ],
      es: [
        'Los gastos recientes en la pantalla de inicio ahora agrupan las salidas igual que la lista de gastos, y los calendarios y el mapa de calor muestran el importe de cada día directamente en la celda, sin tocar.',
        'Desbloqueo por PIN: la app se abre en el instante en que escribes el último número, sin tener que tocar "desbloquear".',
        'Puedes vincular un gasto ya registrado a una compra planificada desde la propia pantalla del gasto; y los accesos "ver vista previa de la fase" y "gestionar fondo" ahora están en la pestaña Viaje.',
        'Compartir una división ahora abre el menú de compartir del teléfono (WhatsApp y similares) en vez de solo copiar el enlace; y "recibir de otro dispositivo / leer QR" ahora también está en Personas y deudas.',
        'Toques finales: texto más claro al dividir un ítem de la cuenta, puedes arrastrar la hoja hacia abajo desde cualquier parte para cerrarla, y el cambio de pestañas se anima en la dirección correcta.',
      ],
    },
  },
  {
    version: '0.73.0',
    date: '2026-06-17',
    items: {
      'pt-BR': [
        'Dinheiro que entra (um reembolso, um depósito, um troco) agora aparece na lista de gastos em verde com um "+", e dá pra importar créditos do extrato como entrada. Isso não infla o "total gasto" — ele continua contando só o que você gastou.',
        'Ao editar um gasto você ganhou o mesmo seletor de local da tela de adicionar: usar minha localização, escolher um lugar próximo, buscar o nome online e reaproveitar locais recentes — antes só dava pra digitar o nome.',
        'O "amigo sincero" ficou mais honesto: quando você está gastando um pouco acima do ritmo mas ainda dentro da folga da fase, ele mostra um aviso calmo (azul) em vez de um verde que dizia que estava tudo perfeito.',
      ],
      en: [
        'Money coming in (a refund, a deposit, change back) now shows in the expenses list in green with a "+", and you can import statement credits as income. It does not inflate your "total spent" — that still counts only what you spent.',
        'Editing an expense now has the same place picker as the add screen: use my location, pick a nearby place, look up the name online, and reuse recent places — before you could only type the name.',
        'The "honest friend" is more honest: when you are spending a bit over pace but still inside the phase\'s slack, it shows a calm (blue) heads-up instead of a green light that pretended everything was perfect.',
      ],
      es: [
        'El dinero que entra (un reembolso, un depósito, un vuelto) ahora aparece en la lista de gastos en verde con un "+", y puedes importar créditos del extracto como ingreso. Esto no infla tu "total gastado": sigue contando solo lo que gastaste.',
        'Al editar un gasto ahora tienes el mismo selector de lugar que la pantalla de agregar: usar mi ubicación, elegir un lugar cercano, buscar el nombre en línea y reutilizar lugares recientes — antes solo podías escribir el nombre.',
        'El "amigo sincero" es más honesto: cuando gastas un poco por encima del ritmo pero aún dentro del margen de la fase, muestra un aviso tranquilo (azul) en lugar de un verde que fingía que todo estaba perfecto.',
      ],
    },
  },
  {
    version: '0.72.0',
    date: '2026-06-17',
    items: {
      'pt-BR': [
        'A câmera do leitor de QR voltou ao normal: o botão alterna só entre a câmera de trás e a da frente (não fica mais passando por todas as lentes), e o zoom 1×/2×/3× da traseira reapareceu.',
        'Ao abrir uma foto anexada você agora pode dar zoom nela (toque duplo ou pinça) e o fundo combina com o tema do app. As fotos também aparecem quando você revê uma saída já encerrada, e na saída ativa o bloco de fotos ficou compacto pra não empurrar os botões pra baixo.',
      ],
      en: [
        'The QR scanner camera is back to normal: the switch button only flips between the back and front camera (no more cycling through every lens), and the rear 1×/2×/3× zoom is back.',
        'When you open an attached photo you can now zoom it (double-tap or pinch) and the background matches the app theme. Photos also show up when you review a finished outing, and on the active outing the photo block is now compact so it no longer pushes the buttons down.',
      ],
      es: [
        'La cámara del lector de QR volvió a la normalidad: el botón solo alterna entre la cámara trasera y la frontal (ya no recorre todas las lentes), y el zoom 1×/2×/3× de la trasera reapareció.',
        'Al abrir una foto adjunta ahora puedes ampliarla (doble toque o pellizco) y el fondo combina con el tema de la app. Las fotos también aparecen cuando revisas una salida ya finalizada, y en la salida activa el bloque de fotos quedó compacto para no empujar los botones hacia abajo.',
      ],
    },
  },
  {
    version: '0.71.0',
    date: '2026-06-17',
    items: {
      'pt-BR': [
        'Corrigimos os links de compartilhar (divisão de gastos e conexão entre aparelhos): no app instalado eles vinham como "localhost" e não abriam — agora geram o endereço certo e funcionam.',
        'Acabou o zoom que ficava preso ao tocar num campo no iPhone, a busca de gastos voltou a ter um só botão de limpar (×) e a barra de rolagem sumiu de novo dentro do app.',
      ],
      en: [
        'Fixed share links (expense split and device pairing): in the installed app they came out as "localhost" and opened nowhere — now they build the right address and work.',
        'No more stuck zoom when tapping a field on iPhone, the expenses search shows a single clear (×) button again, and the scrollbar is hidden again inside the app.',
      ],
      es: [
        'Arreglamos los enlaces para compartir (división de gastos y conexión entre dispositivos): en la app instalada salían como "localhost" y no abrían — ahora generan la dirección correcta y funcionan.',
        'Se acabó el zoom atascado al tocar un campo en iPhone, la búsqueda de gastos vuelve a tener un solo botón de limpiar (×) y la barra de desplazamiento se oculta de nuevo dentro de la app.',
      ],
    },
  },
  {
    version: '0.70.0',
    date: '2026-06-17',
    items: {
      'pt-BR': [
        'Melhorias de estabilidade: criar um fundo com fases agora é salvo de uma vez só, sem risco de ficar pela metade se algo falhar no meio.',
      ],
      en: [
        'Stability improvements: creating a fund with phases is now saved in one go, with no risk of being left half-written if something fails midway.',
      ],
      es: [
        'Mejoras de estabilidad: crear un fondo con fases ahora se guarda de una sola vez, sin riesgo de quedar a medias si algo falla en el proceso.',
      ],
    },
  },
  {
    version: '0.68.0',
    date: '2026-06-17',
    items: {
      'pt-BR': [
        'O Copiloto ganhou quatro leituras novas: o total da viagem na sua moeda de casa, a divisão entre dinheiro e cartão, a hora do dia em que você mais gasta e a sua sequência de dias dentro do ritmo. Cada uma só aparece quando já há dados suficientes — nada de cartão vazio.',
        'Quem protege o app com PIN agora pode desbloquear com a biometria do aparelho (digital ou rosto). É um atalho por cima do PIN — o PIN continua funcionando sempre, então você nunca fica trancado para fora.',
      ],
      en: [
        'The Copilot gained four new reads: your whole trip in your home currency, the cash-vs-card split, the hour of day you spend the most, and your streak of days on pace. Each one only appears once there is enough data — no empty cards.',
        'If you lock the app with a PIN, you can now unlock with your device biometrics (fingerprint or face). It is a shortcut on top of the PIN — the PIN always keeps working, so you are never locked out.',
      ],
      es: [
        'El Copiloto sumó cuatro lecturas nuevas: el total del viaje en tu moneda de casa, la división entre efectivo y tarjeta, la hora del día en que más gastas y tu racha de días dentro del ritmo. Cada una aparece solo cuando hay datos suficientes — sin tarjetas vacías.',
        'Si proteges la app con PIN, ahora puedes desbloquear con la biometría del dispositivo (huella o rostro). Es un atajo sobre el PIN — el PIN siempre sigue funcionando, así que nunca te quedas afuera.',
      ],
    },
  },
  {
    version: '0.67.0',
    date: '2026-06-17',
    items: {
      'pt-BR': [
        'Chegou o registro de entradas: aquele dinheiro que entra no meio da viagem (um reembolso, alguém te pagou de volta, um extra que caiu) agora tem lugar — toque no + e escolha "Registrar entrada".',
        'A entrada aumenta o fundo que você escolher e cai na carteira indicada — sem virar gasto. No "De onde vem esse número" ela aparece em verde, somando ao que você tem livre.',
      ],
      en: [
        'Income is here: money that comes in mid-trip (a refund, someone paying you back, an unexpected extra) finally has a home — tap + and pick "Record income".',
        'It grows the fund you choose and lands in the wallet you pick — never counted as a spend. In "Where this number comes from" it shows in green, adding to what you have free.',
      ],
      es: [
        'Llegaron los ingresos: ese dinero que entra a mitad del viaje (un reembolso, alguien que te paga, un extra inesperado) ya tiene lugar — toca + y elige "Registrar ingreso".',
        'Aumenta el fondo que elijas y cae en la billetera indicada — sin contar como gasto. En "De dónde viene este número" aparece en verde, sumando a lo que tienes libre.',
      ],
    },
  },
  {
    version: '0.66.0',
    date: '2026-06-17',
    items: {
      'pt-BR': [
        'Dividiu um gasto? Na hora aparece um atalho para mandar a cada pessoa o link da parte dela — ela abre no navegador, sem precisar do app, e vê o que vocês dividiram.',
        'É a forma simples de fazer a divisão "chegar no outro celular": um toque em "Compartilhar com {fulano}" já leva ao link pronto pra enviar.',
      ],
      en: [
        'Split an expense? A shortcut now pops up right away to send each person their slice as a link — they open it in the browser, no app needed, and see what you split.',
        'It\u2019s the simple way to make the split "reach the other phone": one tap on "Share with {name}" takes you straight to a ready-to-send link.',
      ],
      es: [
        '\u00bfDividiste un gasto? Aparece al instante un atajo para enviar a cada persona su parte como enlace — lo abre en el navegador, sin necesidad de la app, y ve lo que dividieron.',
        'Es la forma simple de que la división "llegue al otro celular": un toque en "Compartir con {nombre}" te lleva directo a un enlace listo para enviar.',
      ],
    },
  },
  {
    version: '0.65.0',
    date: '2026-06-17',
    items: {
      'pt-BR': [
        'Reservas por fase agora vêm com sugestão automática (Essencial / Recomendado / Confortável): o app divide o fundo entre as fases pelo ritmo de cada uma — você toca e escolhe, ou digita à mão como antes.',
        'Vincular um gasto que você já registrou a uma compra planejada: "comprei isso antes de criar o planejado" virou um toque — sem criar um gasto novo.',
        'Simulador mais honesto por categoria: se o dinheiro daquela categoria já estourou o plano, ele avisa — mesmo quando o gasto ainda "caberia" como mais uma ocasião.',
        'Planejador com uma tela de boas-vindas quando a viagem ainda não tem fases (antes podia ficar carregando).',
      ],
      en: [
        'Per-phase reserves now come with an automatic suggestion (Essential / Recommended / Comfortable): the app splits the fund across phases by each one\u2019s rhythm — tap to pick, or type it by hand as before.',
        'Link an expense you already recorded to a planned purchase: "I bought this before I planned it" is now one tap — without creating a new expense.',
        'A more honest simulator per category: if that category\u2019s money is already over plan, it warns you — even when the spend would still "fit" as one more occasion.',
        'The Planner now shows a friendly welcome when the trip has no phases yet (it could get stuck loading before).',
      ],
      es: [
        'Las reservas por fase ahora traen una sugerencia automática (Esencial / Recomendado / Cómodo): la app reparte el fondo entre las fases según el ritmo de cada una — toca para elegir, o escríbelo a mano como antes.',
        'Vincula un gasto que ya registraste a una compra planificada: "compré esto antes de planificarlo" ahora es un toque — sin crear un gasto nuevo.',
        'Un simulador más honesto por categoría: si el dinero de esa categoría ya se desbordó del plan, te avisa — incluso cuando el gasto aún "cabría" como una ocasión más.',
        'El Planificador ahora muestra una bienvenida cuando el viaje todavía no tiene fases (antes podía quedarse cargando).',
      ],
    },
  },
  {
    version: '0.64.0',
    date: '2026-06-17',
    items: {
      'pt-BR': [
        'Local da saída ativa agora tem a mesma inteligência do registro de gasto: além dos lugares próximos, aparecem os lugares que você já usou (funciona offline) e dá pra pesquisar digitando o nome.',
        'O campo de local virou busca: digite para filtrar os lugares conhecidos ou para nomear um lugar novo na hora.',
        'Botão "buscar nome (online)" para resolver o nome do ponto onde você está.',
      ],
      en: [
        'The active outing place now has the same intelligence as the expense flow: on top of nearby places, it shows places you have used before (works offline) and lets you search by typing the name.',
        'The place field became a search box: type to filter the known places or to name a brand-new one on the spot.',
        'A "find name (online)" button resolves the name of where you currently are.',
      ],
      es: [
        'El lugar de la salida activa ahora tiene la misma inteligencia que el registro de gasto: además de los lugares cercanos, muestra los lugares que ya usaste (funciona sin conexión) y permite buscar escribiendo el nombre.',
        'El campo de lugar se volvió un buscador: escribe para filtrar los lugares conocidos o para nombrar uno nuevo al instante.',
        'Botón "buscar nombre (en línea)" para resolver el nombre del punto donde estás.',
      ],
    },
  },
  {
    version: '0.63.0',
    date: '2026-06-17',
    items: {
      'pt-BR': [
        'Importação da Wise mais inteligente: quando uma entrada parece reembolso de uma compra (Bianca te manda 100 logo depois do Paylogic de 150), o app sugere vincular — registra a compra como dividida e já quita a dívida com a entrada, tudo de uma vez.',
        'Compras especiais reconhecidas: bilheterias e festivais (Paylogic, Eventim, Ticketmaster, Tomorrowland…) entram automaticamente como "lazer/ingresso", não mais como "outros".',
        'Caiu uma compra fora de qualquer fase? Crie a fase ali na hora da importação (ex.: um fim de semana de festival) — sem sair da tela.',
      ],
      en: [
        'Smarter Wise import: when an incoming amount looks like a refund for a purchase (Bianca sends you 100 right after a 150 Paylogic charge), the app suggests linking them — it records the purchase as split and settles the debt with the incoming money, all at once.',
        'Special purchases recognized: ticketing and festivals (Paylogic, Eventim, Ticketmaster, Tomorrowland…) now land automatically as "entertainment/tickets" instead of "other".',
        'A purchase outside every phase? Create the phase right there during import (e.g. a festival weekend) — without leaving the screen.',
      ],
      es: [
        'Importación de Wise más inteligente: cuando una entrada parece el reembolso de una compra (Bianca te envía 100 justo después de un cargo de 150 en Paylogic), la app sugiere vincularlas — registra la compra como dividida y salda la deuda con la entrada, todo de una vez.',
        'Compras especiales reconocidas: boleterías y festivales (Paylogic, Eventim, Ticketmaster, Tomorrowland…) entran automáticamente como "ocio/entradas" en vez de "otros".',
        '¿Una compra fuera de toda fase? Crea la fase ahí mismo durante la importación (p. ej. un fin de semana de festival) — sin salir de la pantalla.',
      ],
    },
  },
  {
    version: '0.62.0',
    date: '2026-06-17',
    items: {
      'pt-BR': [
        'Visão de futuro das fases: na Viagem, toque em "Ver prévia da fase" para planejar qualquer fase como se fosse o dia 1 — sem mexer no presente.',
        '"Disponível por dia" da fase num calendário (igual ao do dia a dia): cada dia mostra quanto dá pra gastar, já com as reservas marcadas. Toque num dia pra ver o detalhe (livre + reservado).',
        'Renda planejada por fase: informe aquele dinheiro que você SABE que vai entrar durante a fase (um reembolso, um salário). Ele entra só na visão de futuro da fase — nunca no seu "livre hoje".',
      ],
      en: [
        'Future vision for phases: in Trip, tap "See phase preview" to plan any phase as if it were day one — without touching the present.',
        'The phase\'s "available per day" as a calendar (like the day-to-day one): each day shows how much you can spend, with reserves already marked. Tap a day for the breakdown (free + reserved).',
        'Planned income per phase: enter the money you KNOW will arrive during the phase (a reimbursement, a paycheck). It feeds only the phase\'s future vision — never your "free today".',
      ],
      es: [
        'Visión de futuro de las fases: en Viaje, toca "Ver vista previa de la fase" para planificar cualquier fase como si fuera el día 1 — sin tocar el presente.',
        'El "disponible por día" de la fase en un calendario (como el del día a día): cada día muestra cuánto puedes gastar, con las reservas ya marcadas. Toca un día para ver el desglose (libre + reservado).',
        'Ingreso planificado por fase: indica ese dinero que SABES que llegará durante la fase (un reembolso, un sueldo). Alimenta solo la visión de futuro de la fase — nunca tu "libre de hoy".',
      ],
    },
  },
  {
    version: '0.61.0',
    date: '2026-06-17',
    items: {
      'pt-BR': [
        'Configurações repaginadas (estilo Samsung): em vez de uma lista enorme, agora são categorias. Toque numa categoria pra abrir só ela, numa subpágina focada — nada foi removido, tudo continua a um toque.',
        'A busca continua no topo das configurações e mostra na hora as opções que combinam com o que você digitou.',
        'Conectar com outra pessoa por link: além do QR, dá pra "Copiar link" (ou compartilhar) em Pessoas e dívidas. A outra pessoa abre o link, confirma "conectar com o aparelho de fulano?" e pronto.',
        'Atalho de Conexões dentro de Backup e segurança, pra achar tudo de "meus dados e meus aparelhos" no mesmo lugar.',
      ],
      en: [
        'Settings, redesigned (Samsung-style): instead of one huge list, it is now categories. Tap a category to open just it, in a focused subpage — nothing was removed, everything is still one tap away.',
        'Search stays at the top of Settings and instantly shows the options that match what you type.',
        'Connect with someone via a link: besides the QR, you can now "Copy link" (or share) in People & debts. The other person opens the link, confirms "connect with so-and-so\'s device?" and that is it.',
        'A Connections shortcut inside Backup & security, so everything about "my data and my devices" lives in one place.',
      ],
      es: [
        'Ajustes renovados (estilo Samsung): en vez de una lista enorme, ahora son categorías. Toca una categoría para abrir solo esa, en una subpágina enfocada — no se quitó nada, todo sigue a un toque.',
        'La búsqueda sigue arriba en Ajustes y muestra al instante las opciones que coinciden con lo que escribes.',
        'Conectar con alguien por enlace: además del QR, ahora puedes "Copiar enlace" (o compartir) en Personas y deudas. La otra persona abre el enlace, confirma "¿conectar con el dispositivo de fulano?" y listo.',
        'Un acceso a Conexiones dentro de Copia y seguridad, para tener todo de "mis datos y mis dispositivos" en un mismo lugar.',
      ],
    },
  },
  {
    version: '0.60.0',
    date: '2026-06-17',
    items: {
      'pt-BR': [
        'Mapa da fase repaginado: dentro de "de onde vem esse número" agora há um cartão com duas abas, sempre à vista (sem trocar sozinhas).',
        '"Disponível por dia" virou um calendário, como no copiloto: cada dia fica mais verde quanto mais você tem pra gastar naquele dia. Toque num dia pra ver o detalhe.',
        'Total do dia com o reservado somado: ao tocar num dia, você vê "livre no dia + o que está reservado pra ele = total do dia" (ex.: €63 livre + €60 do creme = €123) — sem mexer no seu orçamento, é só pra explicar o número.',
        '"Gastos por dia" é o mapa de gastos do mês ali do lado, na mesma carta — uma olhada mostra os dias que mais pesaram.',
      ],
      en: [
        'Phase map, redesigned: inside "where this number comes from" there is now a card with two tabs, always visible (they never auto-switch).',
        '"Available per day" is now a calendar, like in the copilot: each day gets greener the more you have to spend that day. Tap a day to see the detail.',
        'Day total includes what is reserved: tapping a day shows "free that day + what is reserved for it = day total" (e.g. €63 free + €60 for the cream = €123) — it never changes your budget, it just explains the number.',
        '"Spending per day" is the month spending map right next to it, in the same card — one glance shows the days that hit hardest.',
      ],
      es: [
        'Mapa de la fase renovado: dentro de "de dónde sale este número" ahora hay una tarjeta con dos pestañas, siempre a la vista (no cambian solas).',
        '"Disponible por día" ahora es un calendario, como en el copiloto: cada día se pone más verde cuanto más tienes para gastar ese día. Toca un día para ver el detalle.',
        'El total del día incluye lo reservado: al tocar un día ves "libre ese día + lo que está reservado para él = total del día" (ej.: €63 libre + €60 de la crema = €123) — no cambia tu presupuesto, solo explica el número.',
        '"Gastos por día" es el mapa de gastos del mes justo al lado, en la misma tarjeta — un vistazo muestra los días que más pesaron.',
      ],
    },
  },
  {
    version: '0.59.0',
    date: '2026-06-17',
    items: {
      'pt-BR': [
        'Tela inicial mais limpa: o check-in do dia agora é um controle discreto logo abaixo do "livre hoje" — toque pra abrir e trocar o clima do dia, sem ocupar um cartão inteiro. A barra de rolagem some pra não poluir.',
        'Cofrinho na hora certa: ele aparece nos momentos calmos ou "sem gastos" e no copiloto, em vez de ficar sempre na tela. Quem gosta de ver sempre pode fixar nas opções do cartão.',
        'Amigo sincero com cor por tom: fica verde quando está tudo dentro do plano (em vez de laranja de "alerta" o tempo todo) e some da home quando não há nada a ajustar.',
        'Trocar de aba arrastando: a tela acompanha o dedo enquanto você arrasta de uma aba pra outra, com volta suave se desistir no meio.',
        'Fechar cartão flutuante arrastando: puxe a alça do cartão pra baixo pra fechar.',
        'Correções: o swipe na tela de Gastos não pula mais pra Início sem querer; divisões aguardando confirmação viram um bloco compacto; gastos recentes mostram "hoje/ontem" + horário.',
      ],
      en: [
        'Cleaner home: the daily check-in is now a compact control right under "free today" — tap to open and switch the mood of the day, without taking a whole card. The scrollbar is hidden for a tidier look.',
        'Piggy bank at the right moment: it shows up in calm or "no-spend" moments and in the copilot, instead of always sitting on screen. Prefer it always visible? Pin it from the card options.',
        'Honest friend colored by tone: turns green when everything is on plan (instead of an "alert" orange all the time) and disappears from the home when there is nothing to adjust.',
        'Drag to switch tabs: the screen follows your finger as you drag from one tab to the next, springing back if you change your mind.',
        'Close a floating card by dragging: pull the card handle down to dismiss it.',
        'Fixes: the swipe on the Expenses screen no longer jumps to Home by accident; pending splits become a compact tile; recent expenses show "today/yesterday" + time.',
      ],
      es: [
        'Pantalla de inicio más limpia: el check-in del día ahora es un control discreto justo debajo de "libre hoy" — toca para abrir y cambiar el ánimo del día, sin ocupar una tarjeta entera. La barra de desplazamiento se oculta.',
        'Alcancía en el momento justo: aparece en los momentos tranquilos o "sin gastos" y en el copiloto, en vez de estar siempre en pantalla. ¿La prefieres siempre visible? Fíjala en las opciones de la tarjeta.',
        'Amigo sincero con color por tono: se pone verde cuando todo está dentro del plan (en lugar de un naranja de "alerta" todo el tiempo) y desaparece de la home cuando no hay nada que ajustar.',
        'Cambiar de pestaña arrastrando: la pantalla sigue tu dedo mientras arrastras de una pestaña a otra, y vuelve suavemente si te arrepientes.',
        'Cerrar una tarjeta flotante arrastrando: tira del asa de la tarjeta hacia abajo para cerrarla.',
        'Correcciones: el swipe en la pantalla de Gastos ya no salta a Inicio sin querer; las divisiones pendientes se vuelven un bloque compacto; los gastos recientes muestran "hoy/ayer" + hora.',
      ],
    },
  },
  {
    version: '0.58.0',
    date: '2026-06-16',
    items: {
      'pt-BR': [
        'Tempo real no link compartilhado: com a outra pessoa olhando o link aberto, quando você atualiza os gastos dela aparece na hora no aparelho dela — com um aviso "Fulano atualizou os gastos compartilhados com você".',
        'E volta também: quando ela confirma um gasto ou marca "já paguei", a resposta chega pra você na hora, sem precisar ficar puxando manualmente.',
        'É "melhor esforço": funciona enquanto os dois estão com o app aberto e online. Se cair a conexão ou fechar o app, nada se perde — continua tudo guardado e aparece quando abrir de novo.',
        'Continua tudo criptografado ponta a ponta: o tempo real só carrega um "tem novidade, atualize", nunca o conteúdo dos gastos.',
      ],
      en: [
        'Real-time on the shared link: while the other person has the link open, updating their expenses shows up on their device instantly — with a "So-and-so updated the expenses shared with you" heads-up.',
        'And back the other way: when they confirm an expense or mark "I paid", the response reaches you instantly, no manual pulling.',
        'It is "best-effort": it works while both have the app open and online. If the connection drops or the app closes, nothing is lost — everything stays saved and shows up next time.',
        'Still end-to-end encrypted: real-time only carries a "there is news, refresh" ping, never the expense content.',
      ],
      es: [
        'Tiempo real en el enlace compartido: mientras la otra persona tiene el enlace abierto, al actualizar sus gastos aparece al instante en su dispositivo — con un aviso "Fulano actualizó los gastos compartidos contigo".',
        'Y también de vuelta: cuando confirma un gasto o marca "ya pagué", la respuesta te llega al instante, sin traerla manualmente.',
        'Es "mejor esfuerzo": funciona mientras ambos tienen la app abierta y en línea. Si se cae la conexión o se cierra la app, nada se pierde — todo queda guardado y aparece la próxima vez.',
        'Sigue todo cifrado de extremo a extremo: el tiempo real solo lleva un "hay novedad, actualiza", nunca el contenido de los gastos.',
      ],
    },
  },
  {
    version: '0.57.0',
    date: '2026-06-16',
    items: {
      'pt-BR': [
        'Dividir por link: em uma pessoa, toque em "Compartilhar por link" e mande o link pra ela. Ela abre no navegador — sem instalar o app, sem criar conta — e vê só o que você dividiu com ela.',
        'A pessoa pode confirmar ou recusar cada gasto e marcar "já paguei". Você puxa as respostas e confirma a liquidação — ninguém quita dívida sozinho.',
        'Tudo criptografado ponta a ponta: a chave fica no próprio link e o servidor nunca lê o conteúdo. Você pode revogar o link quando quiser.',
        '"Compartilhadas comigo": quem só abriu um link ganha uma área própria com as contas que dividiram com ele, e pode começar a própria viagem quando quiser.',
      ],
      en: [
        'Share by link: on a person, tap "Share via link" and send them the link. They open it in a browser — no app install, no account — and see only what you split with them.',
        'They can confirm or reject each expense and mark "I paid". You pull the responses and confirm the settlement — nobody settles a debt unilaterally.',
        'End-to-end encrypted: the key lives in the link itself and the server never reads the content. You can revoke the link anytime.',
        '"Shared with me": someone who only opened a link gets their own area with the expenses shared with them, and can start their own trip whenever they want.',
      ],
      es: [
        'Compartir por enlace: en una persona, toca "Compartir por enlace" y envíaselo. Lo abre en el navegador — sin instalar la app, sin cuenta — y ve solo lo que dividiste con ella.',
        'Puede confirmar o rechazar cada gasto y marcar "ya pagué". Tú traes las respuestas y confirmas la liquidación — nadie salda una deuda por su cuenta.',
        'Cifrado de extremo a extremo: la clave vive en el propio enlace y el servidor nunca lee el contenido. Puedes revocar el enlace cuando quieras.',
        '"Compartidas conmigo": quien solo abrió un enlace tiene su propia área con las cuentas que dividieron con él, y puede empezar su propio viaje cuando quiera.',
      ],
    },
  },
  {
    version: '0.56.0',
    date: '2026-06-16',
    items: {
      'pt-BR': [
        'Escolha com quem dividir a nota: ao escanear, você seleciona exatamente quais pessoas entram no rateio (uma, duas, as que quiser) — não entra mais todo mundo automaticamente.',
        'Leitura da nota só por IA: a leitura na nuvem ficou perfeita e virou o único modo de escanear; a leitura local foi removida porque não lia direito. Cadastro manual continua disponível.',
        'O app se atualiza sozinho no Android: ao buscar atualização (ou ao abrir o app), ele baixa a nova versão e abre a instalação com um toque — sem precisar caçar o APK. O APK também vai sempre para a pasta Downloads.',
      ],
      en: [
        'Choose who splits the receipt: when scanning, you pick exactly which people are in the split (one, two, whoever you want) — it no longer adds everyone automatically.',
        'AI-only receipt reading: cloud reading turned out perfect and is now the only scan engine; on-device reading was removed because it did not read well. Manual entry stays available.',
        'The app updates itself on Android: when you check for updates (or open the app), it downloads the new version and opens the install with one tap — no more hunting for the APK. The APK also always lands in the Downloads folder.',
      ],
      es: [
        'Elige con quién dividir el recibo: al escanear, seleccionas exactamente qué personas entran en el reparto (una, dos, las que quieras) — ya no entra todo el mundo automáticamente.',
        'Lectura del recibo solo por IA: la lectura en la nube quedó perfecta y es ahora el único motor de escaneo; la lectura local se quitó porque no leía bien. La carga manual sigue disponible.',
        'La app se actualiza sola en Android: al buscar actualizaciones (o al abrir la app), descarga la nueva versión y abre la instalación con un toque — sin tener que buscar el APK. El APK también va siempre a la carpeta de Descargas.',
      ],
    },
  },
  {
    version: '0.55.1',
    date: '2026-06-16',
    items: {
      'pt-BR': [
        'Leitura da nota no aparelho (privada): dá para ler a nota sem enviar a foto para a nuvem — no Android e iPhone o reconhecimento roda no próprio aparelho e funciona offline. A IA na nuvem segue disponível como a opção mais precisa.',
        'Notas e saídas agrupadas: uma nota de mercado com 40 itens deixa de virar 40 gastos soltos — vira uma única linha ("loja · N itens · total") que você abre para ver os itens. Ao buscar ou filtrar, os itens aparecem um a um.',
        'Escanear nota em destaque: a leitura de notas agora aparece no botão de adicionar (+) e no topo da aba Gastos, fácil de achar.',
      ],
      en: [
        'On-device receipt reading (private): read a receipt without sending the photo to the cloud — on Android and iPhone the recognition runs on the device itself and works offline. Cloud AI stays available as the most accurate option.',
        'Receipts & outings are grouped: a 40-item grocery receipt no longer becomes 40 loose expenses — it shows as a single row ("store · N items · total") you open to see the items. Searching or filtering still lists them one by one.',
        'Scan receipt, front and center: receipt reading now lives in the add (+) menu and at the top of the Expenses tab, easy to find.',
      ],
      es: [
        'Lectura del recibo en el dispositivo (privada): puedes leer el recibo sin enviar la foto a la nube — en Android e iPhone el reconocimiento se ejecuta en el propio dispositivo y funciona sin conexión. La IA en la nube sigue disponible como la opción más precisa.',
        'Recibos y salidas agrupados: un recibo de supermercado con 40 artículos ya no se convierte en 40 gastos sueltos — se muestra como una sola fila ("tienda · N artículos · total") que abres para ver los artículos. Al buscar o filtrar, se listan uno por uno.',
        'Escanear recibo, bien visible: la lectura de recibos ahora está en el menú de agregar (+) y en la parte superior de la pestaña Gastos, fácil de encontrar.',
      ],
    },
  },
  {
    version: '0.54.0',
    date: '2026-06-16',
    items: {
      'pt-BR': [
        'Divisão da nota inteira: ao escanear, escolha "Pessoal" ou "Dividir igual" para a nota toda de uma vez (o caso do restaurante/rodada) e defina quem pagou — sem precisar editar item por item.',
        'Ajustar ao total: quando os itens não batem com o total impresso (taxa, serviço, gorjeta, desconto), um toque distribui a diferença proporcionalmente para fechar exatamente.',
      ],
      en: [
        'Split the whole receipt: when scanning, pick "Personal" or "Split equally" for the entire bill at once (the restaurant/round case) and set who paid — no need to edit item by item.',
        'Match to total: when the items don\u2019t add up to the printed total (tax, service, tip, discount), one tap spreads the difference proportionally so it balances exactly.',
      ],
      es: [
        'Dividir todo el recibo: al escanear, elige "Personal" o "Dividir en partes iguales" para toda la cuenta de una vez (el caso del restaurante/ronda) y define quién pagó — sin editar ítem por ítem.',
        'Ajustar al total: cuando los ítems no cuadran con el total impreso (impuesto, servicio, propina, descuento), un toque reparte la diferencia proporcionalmente para que cuadre exactamente.',
      ],
    },
  },
  {
    version: '0.53.0',
    date: '2026-06-16',
    items: {
      'pt-BR': [
        'Escanear nota: tire uma foto da nota (mercado, bar, restaurante), a IA lê os itens e você revisa, edita, divide entre pessoas e salva tudo como uma saída de uma vez.',
        'Leitura por IA é opt-in: a foto só sai do aparelho depois que você ativa (Ajustes). O serviço não treina com seus dados. Sem foto ou offline, dá para adicionar os itens na mão.',
      ],
      en: [
        'Scan a receipt: snap a photo (grocery, bar, restaurant), the AI reads the items, and you review, edit, split between people, and save it all as one outing.',
        'AI reading is opt-in: the photo only leaves your device after you turn it on (Settings). The service does not train on your data. With no photo or offline, you can add items by hand.',
      ],
      es: [
        'Escanear recibo: toma una foto (supermercado, bar, restaurante), la IA lee los artículos y tú revisas, editas, divides entre personas y lo guardas todo como una salida.',
        'La lectura con IA es opt-in: la foto solo sale de tu dispositivo cuando la activas (Ajustes). El servicio no entrena con tus datos. Sin foto o sin conexión, puedes agregar los artículos a mano.',
      ],
    },
  },
  {
    version: '0.52.0',
    date: '2026-06-16',
    items: {
      'pt-BR': [
        'Atualização do app corrigida no Android: o aplicativo agora detecta e instala novas versões automaticamente (a checagem estava travada e mostrava sempre a versão antiga).',
        'Fotos em mais lugares: além dos gastos já cadastrados, agora dá para anexar fotos ao criar um gasto novo e durante ou na finalização de uma saída.',
      ],
      en: [
        'App update fixed on Android: the app now detects and installs new versions automatically (the check was stuck and always showed the old version).',
        'Photos in more places: besides existing expenses, you can now attach photos while creating a new expense and during or when finishing an outing.',
      ],
      es: [
        'Actualización corregida en Android: la app ahora detecta e instala nuevas versiones automáticamente (la comprobación estaba bloqueada y mostraba siempre la versión antigua).',
        'Fotos en más lugares: además de los gastos existentes, ahora puedes adjuntar fotos al crear un gasto nuevo y durante o al finalizar una salida.',
      ],
    },
  },
  {
    version: '0.51.0',
    date: '2026-06-16',
    items: {
      'pt-BR': [
        'Fotos nos gastos: agora dá para anexar fotos (recibo, comprovante, etiqueta) a qualquer gasto — pela câmera ou pela galeria. Abra o gasto, toque em "Fotos" e adicione. As imagens ficam só no seu aparelho.',
      ],
      en: [
        'Photos on expenses: you can now attach photos (receipt, proof, label) to any expense — from the camera or the gallery. Open the expense, tap "Photos" and add. Images stay only on your device.',
      ],
      es: [
        'Fotos en los gastos: ahora puedes adjuntar fotos (recibo, comprobante, etiqueta) a cualquier gasto — desde la cámara o la galería. Abre el gasto, toca "Fotos" y añade. Las imágenes quedan solo en tu dispositivo.',
      ],
    },
  },
  {
    version: '0.50.0',
    date: '2026-06-16',
    items: {
      'pt-BR': [
        'Câmera do leitor de QR liberada: a permissão de câmera agora é pedida corretamente para ler o QR de pareamento.',
        'Backup salvo direto na pasta Downloads do aparelho.',
        'Fim do efeito de "esticar" a tela ao rolar além do fim (overscroll) no app Android.',
      ],
      en: [
        'QR scanner camera enabled: the camera permission is now requested correctly to read the pairing QR.',
        "Backup saved straight to the device's Downloads folder.",
        'No more screen "stretch" when scrolling past the end (overscroll) in the Android app.',
      ],
      es: [
        'Cámara del lector de QR habilitada: el permiso de cámara ahora se solicita correctamente para leer el QR de emparejamiento.',
        'Copia guardada directamente en la carpeta de Descargas del dispositivo.',
        'Fin del efecto de "estirar" la pantalla al desplazarse más allá del final (overscroll) en la app Android.',
      ],
    },
  },
  {
    version: '0.49.0',
    date: '2026-06-16',
    items: {
      'pt-BR': [
        'Enviar e salvar backup no Android: "Enviar backup" agora abre mesmo o menu de compartilhar do celular, e há um novo "Salvar no aparelho" que grava o arquivo direto na pasta Documentos.',
        'Saída ativa sem zoom: a tela não abre mais "ampliada" nem fica tremendo ao arrastar; e o valor adicionado pelo botão da notificação aparece na hora na saída ativa, sem precisar reabrir.',
        'Atualização pela internet: o app instalado passa a receber as melhorias só-da-web sem reinstalar — ao abrir, ele busca a versão nova e se atualiza sozinho. Quando uma mudança exige um novo APK, ele avisa com o link.',
      ],
      en: [
        'Send and save backup on Android: "Send backup" now actually opens the phone\'s share sheet, and a new "Save to device" writes the file straight to the Documents folder.',
        'Active outing without zoom: the screen no longer opens "zoomed in" or shakes while you drag; and the amount added from the notification button shows up on the active outing right away, no reopening needed.',
        'Over-the-internet updates: the installed app now receives web-only improvements without reinstalling — on open it fetches the new version and updates itself. When a change needs a new APK, it tells you with a link.',
      ],
      es: [
        'Enviar y guardar copia en Android: "Enviar copia" ahora sí abre el menú de compartir del teléfono, y un nuevo "Guardar en el dispositivo" escribe el archivo directo en la carpeta Documentos.',
        'Salida activa sin zoom: la pantalla ya no abre "ampliada" ni tiembla al arrastrar; y el importe añadido desde el botón de la notificación aparece al instante en la salida activa, sin reabrir.',
        'Actualización por internet: la app instalada ahora recibe las mejoras solo-web sin reinstalar — al abrir, busca la nueva versión y se actualiza sola. Cuando un cambio necesita un nuevo APK, te avisa con el enlace.',
      ],
    },
  },
  {
    version: '0.48.0',
    date: '2026-06-16',
    items: {
      'pt-BR': [
        'Zerar o app: em Configurações → Dados e segurança você pode recomeçar do zero. Antes de qualquer coisa baixamos um backup completo. Escolha entre apagar tudo (volta ao início) ou manter a viagem e só limpar os lançamentos.',
        'Consciência de versão: a tela "Sobre o app" agora mostra a versão interna e, no Android, também a versão do app instalado. "Buscar atualização" passa a dar uma resposta honesta — se há novidade pela internet ou se o app instalado precisa ser atualizado.',
      ],
      en: [
        'Reset the app: in Settings → Data & security you can start over. We download a full backup first. Choose between erasing everything (back to the start) or keeping the trip and only clearing the entries.',
        'Version awareness: the "About" screen now shows the internal version and, on Android, the installed app version too. "Check for update" now gives an honest answer — whether there is news over the internet or the installed app needs updating.',
      ],
      es: [
        'Reiniciar la app: en Ajustes → Datos y seguridad puedes empezar de cero. Antes descargamos una copia completa. Elige entre borrar todo (vuelve al inicio) o mantener el viaje y solo limpiar los registros.',
        'Conciencia de versión: la pantalla "Acerca de" ahora muestra la versión interna y, en Android, también la versión de la app instalada. "Buscar actualización" da una respuesta honesta — si hay novedades por internet o si la app instalada necesita actualizarse.',
      ],
    },
  },
  {
    version: '0.47.0',
    date: '2026-06-16',
    items: {
      'pt-BR': [
        'Caixa postal criptografada: agora dá pra mandar uma divisão para alguém pareado mesmo sem estarem juntos — a pessoa recebe quando abrir o app. Em Gastos compartilhados, toque em enviar e escolha "Enviar pela caixa postal".',
        'Backup entre aparelhos sem estar lado a lado: envie o backup para um aparelho pareado pela caixa postal; ele aparece na tela de Backup para você conferir e aplicar (merge ou substituir). Nada é aplicado sozinho.',
        'Tudo é cifrado ponta a ponta: o servidor só guarda um pacote embaralhado por até 7 dias e nunca lê o conteúdo. Dá pra desligar em Configurações → Caixa postal.',
      ],
      en: [
        'Encrypted mailbox: you can now send a split to a paired person even when you are not together — they get it the next time they open the app. In Shared expenses, tap send and pick "Send via mailbox".',
        'Backup between devices without being side by side: send the backup to a paired device through the mailbox; it shows up on the Backup screen for you to review and apply (merge or replace). Nothing is applied on its own.',
        'Everything is end-to-end encrypted: the server only keeps a scrambled blob for up to 7 days and never reads the contents. You can turn it off in Settings → Mailbox.',
      ],
      es: [
        'Buzón cifrado: ahora puedes enviar una división a alguien emparejado aunque no estén juntos — la recibe al abrir la app. En Gastos compartidos, toca enviar y elige "Enviar por el buzón".',
        'Copia entre dispositivos sin estar al lado: envía la copia a un dispositivo emparejado por el buzón; aparece en la pantalla de Copia para que la revises y apliques (combinar o reemplazar). Nada se aplica solo.',
        'Todo cifrado de extremo a extremo: el servidor solo guarda un paquete cifrado hasta 7 días y nunca lee el contenido. Puedes desactivarlo en Ajustes → Buzón.',
      ],
    },
  },
  {
    version: '0.46.0',
    date: '2026-06-16',
    items: {
      'pt-BR': [
        'Configurações repaginadas: agora é uma página só com busca no topo e seções que abrem e fecham. Nada sumiu — está tudo a um toque (ou uma busca) de distância.',
        'A meta de economia virou editável direto pelo card da tela inicial: toque no card para ajustar ou remover (o atalho nas Configurações continua lá).',
        'Tela inicial mais compacta: você pode juntar dois cards na mesma linha (Cofrinho, Meta, Planejadas, Compras). Segure o card ou use "Configurar tela inicial" e ative "Mostrar 2 por linha".',
      ],
      en: [
        'Redesigned Settings: now a single page with search at the top and sections that expand and collapse. Nothing was removed — it is all one tap (or one search) away.',
        'The savings goal is now editable straight from its home card: tap the card to adjust or remove it (the Settings shortcut is still there).',
        'More compact home: you can place two cards on the same row (Piggy bank, Goal, Planned, Shopping). Long-press the card or use "Configure home" and turn on "Show 2 per row".',
      ],
      es: [
        'Ajustes renovados: ahora es una sola página con búsqueda arriba y secciones que se abren y cierran. Nada desapareció — todo está a un toque (o una búsqueda) de distancia.',
        'La meta de ahorro ahora se edita directamente desde su card en la pantalla de inicio: toca el card para ajustarla o quitarla (el atajo en Ajustes sigue ahí).',
        'Inicio más compacto: puedes juntar dos cards en la misma fila (Alcancía, Meta, Planificadas, Compras). Mantén pulsado el card o usa "Configurar inicio" y activa "Mostrar 2 por fila".',
      ],
    },
  },
  {
    version: '0.45.0',
    date: '2026-06-16',
    items: {
      'pt-BR': [
        'Toque em "livre para usar nesta fase" e veja um mapa por dia: quanto sobra livre em cada dia até o fim da fase (dias de pico do fim de semana aparecem maiores) e o que você já planejou em cada data.',
        'A linha embaixo do número grande agora deixa a conta clara: "X na fase − Y no plano", para você ver de onde vem o livre de verdade.',
      ],
      en: [
        'Tap "free to spend this phase" to see a per-day map: how much is free each day until the phase ends (weekend peak days show taller) and what you already planned on each date.',
        'The line under the big number now spells out the math: "X this phase − Y in plan", so you see where the truly-free amount comes from.',
      ],
      es: [
        'Toca "libre para usar en esta fase" y verás un mapa por día: cuánto queda libre cada día hasta el fin de la fase (los días de pico del fin de semana se ven más altos) y lo que ya planeaste en cada fecha.',
        'La línea bajo el número grande ahora deja clara la cuenta: "X en la fase − Y en el plan", para que veas de dónde sale el libre de verdad.',
      ],
    },
  },
  {
    version: '0.44.0',
    date: '2026-06-16',
    items: {
      'pt-BR': [
        'Transferências para pessoas no extrato da Wise agora são inteligentes: o app reconhece o nome, sugere o participante e mostra a dívida que você tem com ele.',
        'Uma transferência pode ser dividida em várias partes: pagar dívida, gasto que a pessoa pagou por você, transferência entre carteiras ou gasto seu — a soma precisa fechar com o valor.',
        'Pagar uma dívida pelo extrato já registra a quitação; quando a pessoa te pagou de volta, dá para abater o que ela te devia. Transferências não viram mais um gasto solto sem querer.',
      ],
      en: [
        'Transfers to people in the Wise statement are now smart: the app recognizes the name, suggests the participant and shows the debt you have with them.',
        'One transfer can be split into several parts: pay a debt, an expense they paid for you, a wallet-to-wallet move, or your own expense — the split must add up to the amount.',
        'Paying a debt from the statement records the settlement; when they paid you back, you can clear what they owed you. Transfers are no longer accidentally booked as a stray expense.',
      ],
      es: [
        'Las transferencias a personas en el extracto de Wise ahora son inteligentes: la app reconoce el nombre, sugiere al participante y muestra la deuda que tienes con él.',
        'Una transferencia puede dividirse en varias partes: pagar una deuda, un gasto que la persona pagó por ti, un movimiento entre billeteras o un gasto tuyo — la suma debe cuadrar con el importe.',
        'Pagar una deuda desde el extracto registra la liquidación; cuando te pagó de vuelta, puedes descontar lo que te debía. Las transferencias ya no se registran por error como un gasto suelto.',
      ],
    },
  },
  {
    version: '0.43.0',
    date: '2026-06-16',
    items: {
      'pt-BR': [
        'Importar extrato agora fica à mão: um botão no topo da tela de Gastos abre a importação (continua também na Carteira).',
      ],
      en: [
        'Statement import is now within reach: a button at the top of the Expenses screen opens the importer (still available in Wallets too).',
      ],
      es: [
        'Importar extracto ahora está a mano: un botón en la parte superior de la pantalla de Gastos abre la importación (sigue también en Billetera).',
      ],
    },
  },
  {
    version: '0.42.0',
    date: '2026-06-16',
    items: {
      'pt-BR': [
        'O "livre para usar" da tela inicial agora é o livre de verdade: já desconta também o que está reservado no planejador. Abaixo do número grande você vê quanto é o total da fase e quanto está no plano.',
        'Check-in do dia com efeito real e compacto: o modo escolhido reenquadra o "livre hoje" no card principal (tranquilo reduz, noite reserva parte, dia sem gastos zera) — sempre como projeção, sem mexer no orçamento.',
        'Logo abaixo do check-in aparece o foco do dia (e não sempre o cofrinho): o card que o seu modo do dia destaca sobe para perto do check-in.',
      ],
      en: [
        'The home "free to spend" is now the truly-free amount: it also subtracts what is reserved in the planner. Below the big number you see the phase total and how much is in the plan.',
        'Daily check-in with a real, compact effect: the chosen mode reframes "free today" on the main card (calm trims it, night reserves part, no-spend zeroes it) — always a projection, never touching the budget.',
        'Right below the check-in the day\'s focus now appears (not always the piggy bank): the card your day mode spotlights moves up next to the check-in.',
      ],
      es: [
        'El "libre para usar" de inicio ahora es el libre de verdad: también descuenta lo reservado en el planificador. Debajo del número grande ves el total de la fase y cuánto está en el plan.',
        'Check-in del día con efecto real y compacto: el modo elegido reencuadra el "libre hoy" en la tarjeta principal (tranquilo lo reduce, noche reserva parte, sin gastos lo deja en cero) — siempre como proyección, sin tocar el presupuesto.',
        'Justo debajo del check-in aparece el foco del día (y no siempre la alcancía): la tarjeta que tu modo del día destaca sube cerca del check-in.',
      ],
    },
  },
  {
    version: '0.41.0',
    date: '2026-06-16',
    items: {
      'pt-BR': [
        'Deslize em qualquer lugar da tela — até no fundo — para trocar de aba: Início, Gastos, Viagem e Copiloto. Carrosséis e listas que rolam de lado continuam funcionando normalmente.',
        'As telas agora abrem sempre no topo: o título e o botão de voltar não ficam mais escondidos ao abrir Compras pessoais, planejadas e outras.',
        'Gastos recentes na tela inicial em formato compacto — uma prévia enxuta, com a lista completa a um toque.',
      ],
      en: [
        'Swipe anywhere on the screen — even the empty background — to switch tabs: Início, Gastos, Viagem and Copiloto. Side-scrolling carousels and lists keep working as before.',
        'Screens now always open at the top: the title and back button are no longer hidden when opening Personal/Planned purchases and other pages.',
        'Recent expenses on the home screen are now compact — a tidy preview, with the full list one tap away.',
      ],
      es: [
        'Desliza en cualquier parte de la pantalla — incluso el fondo vacío — para cambiar de pestaña: Início, Gastos, Viagem y Copiloto. Los carruseles y listas horizontales siguen funcionando igual.',
        'Las pantallas ahora se abren siempre arriba: el título y el botón de volver ya no quedan ocultos al abrir Compras personales, planificadas y otras.',
        'Gastos recientes en la pantalla de inicio en formato compacto — una vista previa ordenada, con la lista completa a un toque.',
      ],
    },
  },
  {
    version: '0.40.0',
    date: '2026-06-15',
    items: {
      'pt-BR': [
        'Importar extrato da Wise: selecione os arquivos .csv e o app transforma cada compra do cartão em um gasto, já com categoria, cidade e fase sugeridas.',
        'Nada de duplicado: o que já foi importado antes é reconhecido e ignorado, e gastos que parecem iguais a lançamentos manuais (mesmo dia e valor) vêm desmarcados para você decidir.',
        'Revisão antes de salvar: confira a lista, escolha a carteira de destino (ou crie a "Wise EUR" na hora) e importe — com desfazer logo após.',
      ],
      en: [
        'Wise statement import: pick the .csv files and the app turns each card purchase into an expense, with category, city and phase already suggested.',
        'No duplicates: anything imported before is recognized and skipped, and expenses that look like manual entries (same day and amount) come unchecked for you to decide.',
        'Review before saving: check the list, choose the target wallet (or create "Wise EUR" on the spot) and import — with undo right after.',
      ],
      es: [
        'Importar extracto de Wise: elige los archivos .csv y la app convierte cada compra con tarjeta en un gasto, con categoría, ciudad y fase ya sugeridas.',
        'Sin duplicados: lo ya importado antes se reconoce y se omite, y los gastos que parecen registros manuales (mismo día e importe) vienen desmarcados para que decidas.',
        'Revisión antes de guardar: revisa la lista, elige la billetera de destino (o crea "Wise EUR" al momento) e importa — con deshacer justo después.',
      ],
    },
  },
  {
    version: '0.39.0',
    date: '2026-06-15',
    items: {
      'pt-BR': [
        'Notificação da saída ativa repaginada: agora tem botões com os mesmos valores do quick-add da tela de saída — toque e o gasto é registrado na hora, sem nem abrir o app.',
        'Visual bem melhor: cor de destaque, total e quanto falta para a meta (e ≈ quantas bebidas) em texto expandido, mesmo nos Androids sem o recurso de "Live Update".',
        'O total na notificação atualiza a cada toque; ao abrir o app, os lançamentos são reconciliados automaticamente (funciona até se o app foi fechado).',
      ],
      en: [
        'Active-outing notification revamped: it now has buttons with the same quick-add values as the outing screen — tap one and the expense is logged instantly, without even opening the app.',
        'Much better looking: accent color, total and how much is left to the target (and ≈ how many drinks) in expanded text, even on Androids without the "Live Update" feature.',
        'The notification total updates on every tap; when you open the app, the entries are reconciled automatically (works even if the app was closed).',
      ],
      es: [
        'Notificación de salida activa renovada: ahora tiene botones con los mismos valores del quick-add de la pantalla de salida — toca uno y el gasto se registra al instante, sin siquiera abrir la app.',
        'Mucho mejor visualmente: color de acento, total y cuánto falta para la meta (y ≈ cuántas bebidas) en texto expandido, incluso en Android sin la función de "Live Update".',
        'El total de la notificación se actualiza con cada toque; al abrir la app, los registros se reconcilian automáticamente (funciona incluso si la app se cerró).',
      ],
    },
  },
  {
    version: '0.38.0',
    date: '2026-06-15',
    items: {
      'pt-BR': [
        'Tela de saída ativa: agora tudo cabe em uma tela só — os botões e os valores do quick-add não ficam mais escondidos exigindo rolagem.',
        'Menu do "+" repaginado: abre como uma folha com a ação principal ("Registrar gasto") em destaque e as demais em uma grade limpa, com ícones coloridos por tipo.',
      ],
      en: [
        'Active outing screen: everything now fits on a single screen — the buttons and quick-add values are no longer hidden below the fold.',
        'Revamped "+" menu: opens as a sheet with the primary action ("Add expense") highlighted and the rest in a clean grid with color-coded icons.',
      ],
      es: [
        'Pantalla de salida activa: ahora todo cabe en una sola pantalla — los botones y los valores del quick-add ya no quedan ocultos obligando a desplazar.',
        'Menú "+" renovado: se abre como una hoja con la acción principal ("Registrar gasto") destacada y el resto en una cuadrícula limpia, con iconos por tipo.',
      ],
    },
  },
  {
    version: '0.37.0',
    date: '2026-06-15',
    items: {
      'pt-BR': [
        'Corrigido: ao tocar em cards com detalhes, o painel volta a abrir na parte de baixo da tela visível (depois das animações ele estava abrindo fora da área visível).',
        'As transições de tela agora animam já na primeira vez que você entra — antes só animavam a partir da segunda visita.',
        'Deslizar para os lados funciona nos dois sentidos: em Gastos (Gastos ↔ Saídas) e em Viagem (entre as fases), com uma animação que acompanha o movimento.',
      ],
      en: [
        'Fixed: tapping cards with details opens the panel at the bottom of the visible screen again (after the animations it was opening off-screen).',
        'Screen transitions now animate on the very first time you open a screen — previously they only animated from the second visit.',
        'Side swipes work both ways now: in Expenses (Expenses ↔ Outings) and in Trip (between phases), with a slide animation that follows the gesture.',
      ],
      es: [
        'Corregido: al tocar tarjetas con detalles, el panel vuelve a abrirse en la parte inferior de la pantalla visible (tras las animaciones se abría fuera del área visible).',
        'Las transiciones de pantalla ahora se animan desde la primera vez que entras — antes solo se animaban a partir de la segunda visita.',
        'Deslizar a los lados funciona en ambos sentidos: en Gastos (Gastos ↔ Salidas) y en Viaje (entre las fases), con una animación que acompaña el gesto.',
      ],
    },
  },
  {
    version: '0.36.0',
    date: '2026-06-15',
    items: {
      'pt-BR': [
        'Animações em todo o app: ao trocar de tela o conteúdo desliza e aparece (e volta para o lado contrário quando você usa o "voltar") — dá a sensação de abrir uma página, com a barra de baixo e o topo parados.',
        'Menu do "+" repaginado: os atalhos surgem em sequência e somem ao fechar — e foi corrigido o posicionamento (os de baixo não ficam mais em cima da barra inferior; a lista rola quando há muitos).',
        'Detalhes que reagem: as folhas que sobem de baixo agora também fecham animadas, os avisos (toasts) entram suaves, a aba ativa ganha um indicador e valores como o cofrinho e o saldo das carteiras dão um "pulo" quando mudam.',
        'Tudo respeita "reduzir movimento" do sistema e foi feito para rodar a 60fps, sem exageros.',
      ],
      en: [
        'Animations across the app: switching screens slides the content in (and the other way when you go back) — it feels like opening a page, while the bottom bar and the top stay put.',
        'Revamped "+" menu: the shortcuts appear in sequence and fade out on close — and the positioning is fixed (the lower ones no longer sit on top of the bottom bar; the list scrolls when there are many).',
        'Details that react: bottom sheets now also animate closed, toasts ease in, the active tab gets an indicator, and figures like the piggy bank and wallet balances "pop" when they change.',
        'Everything honors the system "reduce motion" setting and is built to run at 60fps, without overdoing it.',
      ],
      es: [
        'Animaciones en toda la app: al cambiar de pantalla el contenido se desliza y aparece (y al revés cuando vuelves) — se siente como abrir una página, mientras la barra de abajo y la parte superior quedan fijas.',
        'Menú "+" renovado: los accesos aparecen en secuencia y se desvanecen al cerrar — y se corrigió la posición (los de abajo ya no quedan sobre la barra inferior; la lista se desplaza cuando hay muchos).',
        'Detalles que reaccionan: las hojas inferiores ahora también se cierran animadas, los avisos (toasts) entran suaves, la pestaña activa tiene un indicador y cifras como la alcancía y el saldo de las carteras dan un "salto" cuando cambian.',
        'Todo respeta el "reducir movimiento" del sistema y está hecho para ir a 60fps, sin excesos.',
      ],
    },
  },
  {
    version: '0.35.0',
    date: '2026-06-15',
    items: {
      'pt-BR': [
        'Notificações corrigidas: um erro fazia o app travar em loop ao verificar/ativar notificações no Android — agora a permissão e a notificação contínua da saída funcionam de verdade.',
        'Barra de status: o topo agora tem uma faixa sólida na cor do app, então o conteúdo não passa mais por trás da barra transparente. Vale para TODAS as telas — o botão de voltar no registro de gasto e na saída não fica mais embaixo da barra.',
        'Barra inferior com folga: os 4 botões não ficam mais colados na borda de baixo do celular.',
        'Vibração mais suave: o feedback ao tocar nos botões ficou bem mais discreto.',
      ],
      en: [
        'Notifications fixed: a bug crash-looped the app while checking/enabling notifications on Android — permission and the ongoing outing notification now actually work.',
        'Status bar: the top now has a solid band in the app color, so content no longer shows through the transparent bar. Applies to EVERY screen — the back button on expense entry and outings no longer hides under the bar.',
        'Bottom bar spacing: the 4 buttons no longer sit flush against the bottom edge of the phone.',
        'Softer vibration: tap feedback on buttons is now much more discreet.',
      ],
      es: [
        'Notificaciones corregidas: un error hacía que la app se colgara en bucle al comprobar/activar notificaciones en Android — ahora el permiso y la notificación continua de la salida funcionan de verdad.',
        'Barra de estado: la parte superior ahora tiene una franja sólida del color de la app, así el contenido ya no se ve por detrás de la barra transparente. Aplica a TODAS las pantallas — el botón de volver en el registro de gasto y en las salidas ya no queda debajo de la barra.',
        'Barra inferior con holgura: los 4 botones ya no quedan pegados al borde inferior del teléfono.',
        'Vibración más suave: la respuesta al tocar los botones es ahora mucho más discreta.',
      ],
    },
  },
  {
    version: '0.34.0',
    date: '2026-06-15',
    items: {
      'pt-BR': [
        'Notificação "viva" da saída (Android 16+): enquanto uma saída está ativa, ela aparece como notificação contínua com a cor do app, o total ao vivo e barra de progresso até a meta — e na barra de status (e Now Bar da Samsung, onde houver). Em versões anteriores, segue a notificação contínua de antes.',
      ],
      en: [
        'Live outing notification (Android 16+): while an outing is active it shows as an ongoing notification in the app color, with the live total and a progress bar toward the target — plus the status-bar chip (and Samsung Now Bar where available). Older versions keep the previous ongoing notification.',
      ],
      es: [
        'Notificación "viva" de la salida (Android 16+): mientras una salida está activa aparece como notificación continua con el color de la app, el total en vivo y barra de progreso hacia la meta — y en la barra de estado (y Now Bar de Samsung donde exista). En versiones anteriores se mantiene la notificación continua previa.',
      ],
    },
  },
  {
    version: '0.33.0',
    date: '2026-06-15',
    items: {
      'pt-BR': [
        'Navegação por gestos: deslize para os lados na lista de gastos para alternar entre "Gastos" e "Saídas", e na Viagem para passar pelas fases.',
        'Rolagem rápida nos gastos: quando a lista fica longa, aparece uma alça lateral — segure e arraste para voar pelos dias, com um balão mostrando a data atual (estilo Google Fotos).',
      ],
      en: [
        'Gesture navigation: swipe sideways on the expense list to switch between "Expenses" and "Outings", and on the Trip page to move through phases.',
        'Fast scroll on expenses: when the list gets long, a side handle appears — hold and drag to fly through days, with a bubble showing the current date (Google-Photos style).',
      ],
      es: [
        'Navegación por gestos: desliza de lado en la lista de gastos para cambiar entre "Gastos" y "Salidas", y en el Viaje para pasar por las fases.',
        'Desplazamiento rápido en gastos: cuando la lista se hace larga, aparece un tirador lateral — mantén y arrastra para volar por los días, con un globo que muestra la fecha actual (estilo Google Fotos).',
      ],
    },
  },
  {
    version: '0.32.0',
    date: '2026-06-15',
    items: {
      'pt-BR': [
        'Central de notificações reorganizada em seções: "Precisa de você", "Hoje" e "Lembretes" — em vez de uma lista única e gigante.',
        'No Copiloto, tocar em um dia do mapa do mês abre um cartão flutuante com os gastos daquele dia (sem sair da tela); o botão para ver tudo continua disponível.',
        'Busca de gastos: nova barra para procurar por descrição, lugar ou categoria direto na lista de gastos.',
      ],
      en: [
        'Notifications center reorganized into sections: "Needs you", "Today" and "Reminders" — instead of one giant flat list.',
        'In the Copiloto, tapping a day on the month map opens a floating card with that day’s expenses (without leaving the screen); the full view is still one tap away.',
        'Expense search: a new bar to find expenses by description, place or category right in the list.',
      ],
      es: [
        'Centro de notificaciones reorganizado en secciones: "Te necesita", "Hoy" y "Recordatorios" — en vez de una sola lista enorme.',
        'En el Copiloto, tocar un día del mapa del mes abre una tarjeta flotante con los gastos de ese día (sin salir de la pantalla); ver todo sigue a un toque.',
        'Búsqueda de gastos: una nueva barra para buscar por descripción, lugar o categoría en la lista de gastos.',
      ],
    },
  },
  {
    version: '0.31.0',
    date: '2026-06-15',
    items: {
      'pt-BR': [
        'Início mais enxuto: a análise (recap de ontem, ritmo da fase, mapa do mês) saiu da tela inicial e foi toda para o Copiloto, onde fica a inteligência do app.',
        'Contadores da tela inicial repensados: primeiro as suas metas (quantos faltam / quantos já feitos) e, em seguida, os gastos por categoria de tudo o que não tem meta — com rótulo dizendo que é contagem de gastos. Antes só apareciam 3 categorias fixas.',
        'Estrutura da Viagem agora é uma grade de atalhos (em vez de lista), mais fácil de tocar.',
        'Ferramentas do Copiloto reorganizadas em grade de 2 colunas com descrição em cada uma.',
      ],
      en: [
        'Leaner Home: the analytics (yesterday recap, phase pace, month map) left the home screen and moved entirely to the Copiloto, where the app’s intelligence lives.',
        'Rethought home counters: your goals first (how many left / already done), then per-category spend counts for everything without a goal — labeled so it’s clear it’s a spend count. Before, only 3 fixed categories showed.',
        'Trip structure is now a grid of shortcuts (instead of a list), easier to tap.',
        'Copiloto tools reorganized into a 2-column grid, each with a description.',
      ],
      es: [
        'Inicio más limpio: el análisis (resumen de ayer, ritmo de la fase, mapa del mes) salió de la pantalla de inicio y pasó por completo al Copiloto, donde está la inteligencia de la app.',
        'Contadores de inicio repensados: primero tus metas (cuántas faltan / ya hechas) y luego los gastos por categoría de todo lo que no tiene meta — con una etiqueta que aclara que es conteo de gastos. Antes solo aparecían 3 categorías fijas.',
        'La estructura del Viaje ahora es una cuadrícula de accesos (en vez de lista), más fácil de tocar.',
        'Herramientas del Copiloto reorganizadas en una cuadrícula de 2 columnas, cada una con descripción.',
      ],
    },
  },
  {
    version: '0.30.0',
    date: '2026-06-15',
    items: {
      'pt-BR': [
        'Vibração de toque (haptics) que funciona no app: confirmações ao salvar/editar um gasto, ao receber um alerta, ao abrir o menu “+”, ao trocar de aba e ao segurar para selecionar. Antes a vibração não funcionava no aplicativo instalado.',
        'Tudo respeita o botão “Vibração” nas configurações — desligou, silencia todas as vibrações.',
        'Tamanho da interface no Android: ajuste para o app não ficar “miudinho” como se estivesse com zoom menor — agora abre num tamanho mais confortável.',
      ],
      en: [
        'Haptic feedback that actually works in the app: confirmations when you save/edit an expense, on alerts, when opening the “+” menu, switching tabs, and on long-press to select. Before, vibration did nothing in the installed app.',
        'Everything honors the “Vibration” switch in settings — turn it off and all haptics go silent.',
        'Android UI size: a calibration so the app no longer looks “shrunk” as if zoomed out — it now opens at a more comfortable size.',
      ],
      es: [
        'Vibración táctil (haptics) que sí funciona en la app: confirmaciones al guardar/editar un gasto, en las alertas, al abrir el menú “+”, al cambiar de pestaña y al mantener pulsado para seleccionar. Antes la vibración no funcionaba en la app instalada.',
        'Todo respeta el interruptor “Vibración” de ajustes — al apagarlo, se silencian todas las vibraciones.',
        'Tamaño de la interfaz en Android: un ajuste para que la app no se vea “diminuta” como con menos zoom — ahora abre a un tamaño más cómodo.',
      ],
    },
  },
  {
    version: '0.29.0',
    date: '2026-06-15',
    items: {
      'pt-BR': [
        'Permissão de GPS de verdade: ao ligar “registrar o local dos gastos”, o app agora pede a permissão do Android e avisa com clareza se ela for negada (antes ficava em silêncio).',
        'Notificações nativas no Android: acabou o “navegador não suporta”. A saída ativa gera uma notificação real e contínua, com o total da rodada e botão para abrir o app.',
        'Armazenamento: no app instalado seus dados já ficam guardados de forma permanente — então o aviso de “dados podem ser perdidos” e o botão de ativar armazenamento não aparecem mais (eram coisas só do navegador).',
      ],
      en: [
        'Real GPS permission: when you turn on “record the location of expenses”, the app now asks for the Android permission and clearly warns you if it is denied (it used to fail silently).',
        'Native Android notifications: no more “browser does not support”. An active outing now shows a real, ongoing notification with the round total and a button to open the app.',
        'Storage: the installed app already keeps your data permanently — so the “data may be lost” warning and the enable-storage button no longer appear (they were browser-only).',
      ],
      es: [
        'Permiso de GPS real: al activar “registrar el lugar de los gastos”, la app ahora pide el permiso de Android y avisa con claridad si se deniega (antes fallaba en silencio).',
        'Notificaciones nativas en Android: se acabó el “el navegador no soporta”. La salida activa muestra una notificación real y continua, con el total de la ronda y un botón para abrir la app.',
        'Almacenamiento: la app instalada ya guarda tus datos de forma permanente — así que el aviso de “los datos pueden perderse” y el botón de activar almacenamiento ya no aparecen (eran solo del navegador).',
      ],
    },
  },
  {
    version: '0.28.0',
    date: '2026-06-15',
    items: {
      'pt-BR': [
        'App Android nativo: a barra de status agora acompanha o tema — fundo na cor do app e ícones legíveis no claro e no escuro — e o conteúdo (títulos e botões) não fica mais escondido atrás dela.',
        'O botão Voltar do Android agora funciona dentro do app: fecha o que estiver aberto, volta uma tela e só sai do app na tela inicial (com um segundo toque para confirmar).',
      ],
      en: [
        'Native Android app: the status bar now follows the theme — app-colored background and legible icons in light and dark — and content (titles and buttons) no longer hides behind it.',
        'The Android Back button now works inside the app: it closes what’s open, goes back one screen, and only leaves the app from the home screen (a second tap confirms).',
      ],
      es: [
        'App Android nativa: la barra de estado ahora acompaña el tema — fondo del color de la app e iconos legibles en claro y oscuro — y el contenido (títulos y botones) ya no queda escondido detrás.',
        'El botón Atrás de Android ahora funciona dentro de la app: cierra lo que esté abierto, vuelve una pantalla y solo sale de la app desde la pantalla de inicio (un segundo toque confirma).',
      ],
    },
  },
  {
    version: '0.27.0',
    date: '2026-06-15',
    items: {
      'pt-BR': [
        'Copiloto mais inteligente: novo “Como vinha × como está” mostra se você corrigiu a rota — “há 4 dias projetava fechar em €1.100; agora €980”.',
        'Novo “Quanto seu livre dura”: no ritmo de hoje, seu dinheiro livre dura ~X dias (e até que data) — ou avisa que cobre a fase toda com folga.',
        'Novo “Dia da semana”: descobre quanto seu fim de semana custa em relação a um dia útil.',
        'Nova “Eficiência das saídas”: em quantas saídas você ficou no alvo e quanto economizou em média.',
        'Tudo aparece só quando há dados suficientes — sem poluir a tela quando a viagem está começando.',
      ],
      en: [
        'Smarter Copilot: new “How it was heading vs now” shows whether you corrected course — “4 days ago you projected to close at €1,100; now €980”.',
        'New “How long your free budget lasts”: at today’s pace your free money lasts ~X days (and until what date) — or it tells you it covers the whole phase with room to spare.',
        'New “Day of the week”: discover how much your weekend costs compared to a weekday.',
        'New “Outing efficiency”: how many outings you kept within target and how much you saved on average.',
        'Everything shows only when there’s enough data — no clutter while the trip is just starting.',
      ],
      es: [
        'Copiloto más inteligente: el nuevo “Cómo venía × cómo está” muestra si corregiste el rumbo — “hace 4 días proyectabas cerrar en €1.100; ahora €980”.',
        'Nuevo “Cuánto dura tu libre”: al ritmo de hoy tu dinero libre dura ~X días (y hasta qué fecha) — o te avisa que cubre toda la fase con margen.',
        'Nuevo “Día de la semana”: descubre cuánto cuesta tu fin de semana frente a un día laboral.',
        'Nueva “Eficiencia de las salidas”: en cuántas salidas te mantuviste en el objetivo y cuánto ahorraste de media.',
        'Todo aparece solo cuando hay datos suficientes — sin saturar la pantalla al empezar el viaje.',
      ],
    },
  },
  {
    version: '0.26.0',
    date: '2026-06-15',
    items: {
      'pt-BR': [
        'Nova página “Tudo que dá pra fazer”: um guia com todas as funções do app, o que cada uma serve e um atalho pra abrir na hora — nada mais fica escondido dentro de menu.',
        'Atalho em destaque dentro de Ajustes (na engrenagem) e também no rodapé do Copiloto.',
        'Organizado por temas: dia a dia, planejamento, viagem e fases, dividir, análise (Copiloto) e ajustes.',
      ],
      en: [
        'New “Everything you can do” page: a guide to every feature, what each is for and a one-tap shortcut to open it — nothing stays hidden in a menu anymore.',
        'Highlighted shortcut inside Settings (the gear) and also in the Copilot footer.',
        'Organized by themes: day-to-day, planning, trip & phases, splitting, analysis (Copilot) and settings.',
      ],
      es: [
        'Nueva página “Todo lo que puedes hacer”: una guía con todas las funciones de la app, para qué sirve cada una y un atajo para abrirla al instante — ya nada queda escondido en un menú.',
        'Atajo destacado dentro de Ajustes (el engranaje) y también en el pie del Copiloto.',
        'Organizado por temas: día a día, planificación, viaje y fases, dividir, análisis (Copiloto) y ajustes.',
      ],
    },
  },
  {
    version: '0.25.0',
    date: '2026-06-15',
    items: {
      'pt-BR': [
        'Amigo sincero reconciliado: quando você passa do ritmo de uma categoria (ex.: bares) mas a fase ainda tem folga, ele agora explica os dois lados — “no plano de bares cabem só 3, mas a fase tem €X livres: o resto cabe sem culpa; pra seguir o plano, segura 1”.',
        'Acabou a sensação de contradição entre “você está sobrando” e “só cabem 3 dos 4”: o limite é do plano da categoria, não da viagem — e isso agora fica claro na própria mensagem.',
        'A mesma mensagem aparece igual no Início e no Copiloto (uma única fonte) e sem a barrinha colorida.',
      ],
      en: [
        'Honest friend reconciled: when you outpace a category (e.g. bars) but the phase still has slack, it now explains both sides — “your bar plan only fits 3, but the phase has €X free: the rest fits guilt-free; to stay on plan, hold 1”.',
        'No more apparent contradiction between “you have a surplus” and “only 3 of 4 fit”: the limit is the category plan, not the trip — and the message now says so.',
        'The same message reads identically on Home and Copilot (one source) and without the colored side-bar.',
      ],
      es: [
        'Amigo sincero reconciliado: cuando superas el ritmo de una categoría (p. ej. bares) pero la fase aún tiene margen, ahora explica ambos lados — “en el plan de bares solo caben 3, pero la fase tiene €X libres: el resto cabe sin culpa; para seguir el plan, aguanta 1”.',
        'Se acabó la sensación de contradicción entre “te sobra” y “solo caben 3 de 4”: el límite es del plan de la categoría, no del viaje — y ahora el mensaje lo dice.',
        'El mismo mensaje se ve igual en Inicio y en Copiloto (una sola fuente) y sin la barrita de color.',
      ],
    },
  },
  {
    version: '0.24.0',
    date: '2026-06-15',
    items: {
      'pt-BR': [
        'Check-in do dia agora tem efeito de verdade: escolha “Tranquilo” ou o novo “Sem gastos” e veja na hora quanto isso devolve pros próximos dias (ex.: “guardando €38 hoje, seus próximos dias ganham +€3,81/dia”).',
        'Novo modo “Sem gastos” pra quando você não vai gastar nada — todo o valor de hoje vira folga pra frente.',
        'A pergunta ficou mais clara: “Diz como vai ser o dia que eu mostro quanto dá pra gastar e ajusto o ritmo.” (continua só uma projeção — nada é gravado nem altera seu orçamento).',
      ],
      en: [
        'The day check-in now has a real effect: pick “Calm” or the new “No spending” and instantly see how much it hands back to the days ahead (e.g. “keeping €38 today, your next days gain +€3.81/day”).',
        'New “No spending” mode for days you won’t spend anything — the whole of today’s amount becomes slack for later.',
        'The question is clearer: “Tell me how the day looks and I’ll show how much you can spend and tune the pace.” (still just a projection — nothing is saved nor changes your budget).',
      ],
      es: [
        'El check-in del día ahora tiene efecto real: elige “Tranquilo” o el nuevo “Sin gastos” y mira al instante cuánto devuelve a los próximos días (ej.: “guardando €38 hoy, tus próximos días ganan +€3,81/día”).',
        'Nuevo modo “Sin gastos” para los días en que no vas a gastar nada — todo el importe de hoy se vuelve margen para después.',
        'La pregunta quedó más clara: “Dime cómo será el día y te muestro cuánto puedes gastar y ajusto el ritmo.” (sigue siendo solo una proyección — nada se guarda ni cambia tu presupuesto).',
      ],
    },
  },
  {
    version: '0.23.0',
    date: '2026-06-15',
    items: {
      'pt-BR': [
        'Tela inicial mais clara: o título do valor livre agora diz “Livre para usar nesta fase” em vez de repetir a data que já aparece logo acima no cabeçalho.',
        'O foco da inicial continua nos avisos rápidos (ritmo, divisões, compras planejadas) e nos insights que giram no topo; as análises mais profundas (mapa do mês, ritmo da fase, pra onde vai) vivem agora no Copiloto.',
      ],
      en: [
        'Cleaner home: the free-amount title now reads “Free to spend this phase” instead of repeating the date already shown in the header above it.',
        'The home stays focused on quick signals (pace, splits, planned purchases) and the rotating insights up top; the deeper analysis (month map, phase pace, where this is heading) now lives in the Copilot.',
      ],
      es: [
        'Inicio más claro: el título del importe libre ahora dice “Libre para usar en esta fase” en vez de repetir la fecha que ya aparece arriba en el encabezado.',
        'El inicio se mantiene enfocado en avisos rápidos (ritmo, divisiones, compras planificadas) y en los insights que rotan arriba; el análisis más profundo (mapa del mes, ritmo de la fase, hacia dónde va) ahora vive en el Copiloto.',
      ],
    },
  },
  {
    version: '0.22.0',
    date: '2026-06-15',
    items: {
      'pt-BR': [
        'Copiloto virou a inteligência da viagem: no topo, em uma frase, ele diz se você está no controle, pra onde a viagem vai (“neste ritmo, fecha em ~€X”) e o que faria agora — o amigo sincero com atalho pra simular.',
        'Mais abaixo: de onde veio o dinheiro (por categoria), o mapa do mês com o maior dia e a média/dia, o ritmo da fase, e — quando há dado — quanto você dividiu vs gastou sozinho, a comparação com a fase anterior e seus acertos.',
        'Cada bloco só aparece quando há dado suficiente pra ele fazer sentido; viagem nova mostra um convite curto em vez de tela vazia. As ferramentas (simular, resgate, impacto) ficam reunidas no rodapé.',
      ],
      en: [
        'Copilot is now the trip’s intelligence: up top, in one line, it tells you whether you’re in control, where the trip is heading (“at this pace it closes at ~€X”) and what it would do now — the honest friend with a shortcut to simulate.',
        'Below: where the money came from (by category), the month map with the biggest day and the daily average, the phase pace, and — when there’s data — how much you split vs spent alone, the comparison to the previous phase, and your settlements.',
        'Each block only shows when there’s enough data to be meaningful; a fresh trip shows a short invite instead of an empty screen. The tools (simulate, rescue, impact) are gathered at the bottom.',
      ],
      es: [
        'Copiloto ahora es la inteligencia del viaje: arriba, en una frase, te dice si tienes el control, hacia dónde va el viaje (“a este ritmo cierra en ~€X”) y qué haría ahora — el amigo sincero con atajo para simular.',
        'Más abajo: de dónde vino el dinero (por categoría), el mapa del mes con el mayor día y la media/día, el ritmo de la fase, y — cuando hay datos — cuánto dividiste vs gastaste solo, la comparación con la fase anterior y tus cuentas.',
        'Cada bloque solo aparece cuando hay datos suficientes para que tenga sentido; un viaje nuevo muestra una invitación corta en vez de una pantalla vacía. Las herramientas (simular, rescate, impacto) quedan reunidas abajo.',
      ],
    },
  },
  {
    version: '0.21.0',
    date: '2026-06-15',
    items: {
      'pt-BR': [
        'Aba Viagem agora é um hub completo: troque entre “Todas as fases” e cada fase ali no topo para ver e planejar qualquer fase — passada, atual ou futura — sem sair da página.',
        'Em “Todas as fases” você vê o resumo da viagem (orçamento × gasto) e um card por fase com o que já gastou e o que está livre. Ao escolher uma fase, aparece o plano dela (livre e por categoria) com atalho pra editar.',
        'Compras planejadas, fundos (com uma explicação do que é um fundo) e toda a estrutura da viagem (fases, perfis, pessoas, carteiras, histórico) ficam reunidos na mesma tela.',
      ],
      en: [
        'The Trip tab is now a full hub: switch between “All phases” and each phase at the top to view and plan any phase — past, current or future — without leaving the page.',
        'In “All phases” you get the trip summary (budget × spent) and a card per phase with what you’ve spent and what’s free. Pick a phase to see its plan (free and by category) with a shortcut to edit it.',
        'Planned purchases, funds (with a plain explanation of what a fund is) and the whole trip structure (phases, profiles, people, wallets, history) are gathered on the same screen.',
      ],
      es: [
        'La pestaña Viaje ahora es un hub completo: cambia entre “Todas las fases” y cada fase arriba para ver y planificar cualquier fase — pasada, actual o futura — sin salir de la página.',
        'En “Todas las fases” ves el resumen del viaje (presupuesto × gastado) y una tarjeta por fase con lo gastado y lo libre. Al elegir una fase aparece su plan (libre y por categoría) con un atajo para editarlo.',
        'Compras planificadas, fondos (con una explicación de qué es un fondo) y toda la estructura del viaje (fases, perfiles, personas, carteras, historial) quedan reunidos en la misma pantalla.',
      ],
    },
  },
  {
    version: '0.20.0',
    date: '2026-06-15',
    items: {
      'pt-BR': [
        'Navegação repensada: o menu “Mais” deu lugar a duas abas — Viagem (seu plano e a estrutura: planejar, fundos, fases, carteiras, perfis, pessoas) e Copiloto (a inteligência da viagem). Nada saiu do app, só ficou mais fácil de achar.',
        'Ajustes agora abre direto pela engrenagem no topo da tela inicial (ao lado do sino). Backup, exportar planilha e “Sobre” ficam lá dentro.',
      ],
      en: [
        'Rethought navigation: the “More” menu became two tabs — Trip (your plan and structure: planning, funds, phases, wallets, profiles, people) and Copilot (the trip’s intelligence). Nothing was removed, it’s just easier to find.',
        'Settings now opens straight from the gear at the top of the home screen (next to the bell). Backup, CSV export and “About” live there.',
      ],
      es: [
        'Navegación repensada: el menú “Más” pasó a ser dos pestañas — Viaje (tu plan y la estructura: planificar, fondos, fases, carteras, perfiles, personas) y Copiloto (la inteligencia del viaje). No se quitó nada, solo es más fácil de encontrar.',
        'Ajustes ahora se abre directo desde el engranaje arriba en la pantalla de inicio (al lado de la campana). Copia de seguridad, exportar a hoja de cálculo y “Acerca de” están ahí.',
      ],
    },
  },
  {
    version: '0.19.0',
    date: '2026-06-15',
    items: {
      'pt-BR': [
        'Estabilidade (Android): tratamos a volta do app do segundo plano, que podia deixar a conexão com o banco “velha” e travar o carregamento sem motivo. Agora o app reconecta sozinho nesse momento, antes de você tocar em qualquer coisa.',
        'Qualquer travamento do banco agora deixa rastro do motivo exato (mesmo quando o app se recupera sozinho) e a reconexão automática ficou mais rápida.',
        'A tela inicial não mostra mais o lembrete de backup — ele continua no sino de notificações.',
      ],
      en: [
        'Stability (Android): we now handle returning the app from the background, which could leave the database connection stale and stall loading for no reason. The app reconnects on its own at that moment, before you tap anything.',
        'Any database stall now leaves a trace of the exact cause (even when the app recovers on its own), and automatic reconnection is faster.',
        'The home screen no longer shows the backup reminder — it stays in the notifications bell.',
      ],
      es: [
        'Estabilidad (Android): ahora gestionamos el regreso de la app desde segundo plano, que podía dejar la conexión con la base de datos “vieja” y trabar la carga sin motivo. La app se reconecta sola en ese momento, antes de que toques nada.',
        'Cualquier bloqueo de la base de datos ahora deja rastro de la causa exacta (incluso cuando la app se recupera sola), y la reconexión automática es más rápida.',
        'La pantalla de inicio ya no muestra el recordatorio de copia de seguridad — sigue en la campana de notificaciones.',
      ],
    },
  },
  {
    version: '0.18.0',
    date: '2026-06-15',
    items: {
      'pt-BR': [
        'Nova ferramenta de diagnóstico: se o app travar ao carregar seus dados, a tela de recuperação agora tem um botão “Copiar diagnóstico” que mostra a causa exata do travamento — sem expor seus gastos. Isso nos deixa corrigir problemas de estabilidade de verdade, em vez de adivinhar.',
        'O mesmo diagnóstico também está em Mais → Sobre, para quando o app abre mas parece instável.',
      ],
      en: [
        'New diagnostics tool: if the app ever stalls loading your data, the recovery screen now has a “Copy diagnostics” button that reveals the exact cause of the stall — without exposing your expenses. This lets us fix stability issues for real instead of guessing.',
        'The same diagnostics are also under More → About, for when the app opens but feels unstable.',
      ],
      es: [
        'Nueva herramienta de diagnóstico: si la app se traba al cargar tus datos, la pantalla de recuperación ahora tiene un botón “Copiar diagnóstico” que muestra la causa exacta del bloqueo — sin exponer tus gastos. Así podemos corregir los problemas de estabilidad de verdad, en vez de adivinar.',
        'El mismo diagnóstico también está en Más → Acerca de, para cuando la app abre pero se siente inestable.',
      ],
    },
  },
  {
    version: '0.17.0',
    date: '2026-06-14',
    items: {
      'pt-BR': [
        'Novo: Compras planejadas. Aquela compra que você já sabe que vai fazer (cremes na farmácia, roupas, um presente) entra numa lista própria e, se você reservar, já sai do seu “livre para gastar” — então o número que sobra é o que dá pra gastar de verdade.',
        'Comprou? Toque em “Comprei” e o app lança o gasto, abate da reserva e atualiza tudo sozinho — com opção de desfazer. Dá pra comprar em vários lugares (farmácia, Primor, Druni) e ir baixando a mesma reserva até fechar.',
        'Dá também só para acompanhar sem reservar: útil quando você ainda não sabe o valor, mas quer registrar a intenção.',
        'A reserva aparece no “de onde vem esse número?” do livre para gastar, num card no início e como destino no simulador (“cabe na reserva dos cremes?”). Planeje pelo botão + → “Planejar compra”.',
      ],
      en: [
        'New: Planned purchases. That buy you already know is coming (creams at the pharmacy, clothes, a gift) gets its own list and, if you reserve it, it leaves your “free to spend” right away — so the number left is what you can really spend.',
        'Bought it? Tap “Bought” and the app logs the expense, draws it from the reserve and updates everything for you — with an undo. You can buy across several stores and shrink the same reserve until it closes.',
        'You can also just track without reserving: handy when you don’t know the amount yet but want to record the intention.',
        'The reserve shows up in the “where does this number come from?” of free to spend, in a home card, and as a target in the simulator (“does it fit the creams reserve?”). Plan one from the + button → “Plan a purchase”.',
      ],
      es: [
        'Nuevo: Compras planificadas. Esa compra que ya sabes que harás (cremas en la farmacia, ropa, un regalo) entra en su propia lista y, si la reservas, sale de tu “libre para gastar” de inmediato — así el número que queda es lo que puedes gastar de verdad.',
        '¿La compraste? Toca “Compré” y la app registra el gasto, lo descuenta de la reserva y actualiza todo solo — con opción de deshacer. Puedes comprar en varias tiendas e ir bajando la misma reserva hasta cerrarla.',
        'También puedes solo hacer seguimiento sin reservar: útil cuando aún no sabes el monto pero quieres registrar la intención.',
        'La reserva aparece en el “¿de dónde viene este número?” del libre para gastar, en una tarjeta del inicio y como destino en el simulador (“¿cabe en la reserva de las cremas?”). Planifica desde el botón + → “Planificar compra”.',
      ],
    },
  },
  {
    version: '0.16.0',
    date: '2026-06-14',
    items: {
      'pt-BR': [
        'Telas vazias agora acolhem em vez de só ficar em branco: gastos, saídas, carteiras e fundos explicam o que aparece ali e trazem um botão para começar na hora.',
        'Mais ações confirmam o que fizeram: criar um fundo, adicionar uma carteira ou definir a carteira padrão agora avisam com um toque na tela.',
        '“De onde vem esse número?” espalhado pelo app: ao abrir um fundo você vê a conta (total − gasto = disponível), e no planejador dá para tocar na margem e ver livre para usar − planejado = margem.',
        'Ao encerrar uma saída, um resumo rápido mostra quanto tempo durou, quantos itens rolaram e se você ficou abaixo ou acima do seu alvo.',
      ],
      en: [
        'Empty screens now welcome you instead of just sitting blank: expenses, outings, wallets and funds explain what will show up there and offer a button to start right away.',
        'More actions confirm what they did: creating a fund, adding a wallet or setting the default wallet now show a quick on-screen confirmation.',
        '“Where does this number come from?” is now spread across the app: open a fund to see the math (total − spent = available), and in the planner tap the margin to see free to spend − planned = margin.',
        'When you end an outing, a quick recap shows how long it lasted, how many items happened and whether you came in under or over your target.',
      ],
      es: [
        'Las pantallas vacías ahora te reciben en vez de quedar en blanco: gastos, salidas, billeteras y fondos explican qué aparecerá allí y traen un botón para empezar al instante.',
        'Más acciones confirman lo que hicieron: crear un fondo, agregar una billetera o definir la billetera predeterminada ahora avisan con un toque en pantalla.',
        '“¿De dónde viene este número?” repartido por la app: al abrir un fondo ves la cuenta (total − gastado = disponible), y en el planificador puedes tocar el margen para ver libre para gastar − planificado = margen.',
        'Al cerrar una salida, un resumen rápido muestra cuánto duró, cuántos ítems hubo y si quedaste por debajo o por encima de tu objetivo.',
      ],
    },
  },
  {
    version: '0.15.0',
    date: '2026-06-14',
    items: {
      'pt-BR': [
        'Estabilidade: corrigimos a falha em que o banco local travava (um problema conhecido do iOS/Safari) e o app ficava preso em “não foi possível carregar seus dados”. Agora ele se recupera sozinho — reconecta em segundo plano e, se precisar, reinicia internamente, sem nunca te deixar numa tela sem saída.',
        'Seus dados continuam sempre seguros no aparelho. Se mesmo assim algo travar, a tela de recuperação agora tenta reconectar sozinha, tem um botão de recarregar que funciona de verdade e deixa você exportar um backup na hora.',
        'Nenhuma tela fica mais “carregando para sempre”: se algo demorar demais, o app oferece recarregar em vez de travar.',
      ],
      en: [
        'Stability: we fixed the failure where the local database stalled (a known iOS/Safari bug) and the app got stuck on “couldn’t load your data”. It now recovers on its own — reconnecting in the background and, if needed, restarting internally, never leaving you on a dead-end screen.',
        'Your data is always safe on the device. If something still stalls, the recovery screen now retries on its own, has a reload button that actually works, and lets you export a backup right away.',
        'No screen stays “loading forever” anymore: if something takes too long, the app offers to reload instead of hanging.',
      ],
      es: [
        'Estabilidad: corregimos la falla en que la base local se trababa (un problema conocido de iOS/Safari) y la app se quedaba en “no se pudieron cargar tus datos”. Ahora se recupera sola — reconecta en segundo plano y, si hace falta, se reinicia internamente, sin dejarte nunca en una pantalla sin salida.',
        'Tus datos siempre están seguros en el dispositivo. Si aun así algo se traba, la pantalla de recuperación ahora reintenta sola, tiene un botón de recargar que funciona de verdad y te deja exportar una copia al instante.',
        'Ninguna pantalla queda “cargando para siempre”: si algo tarda demasiado, la app ofrece recargar en vez de trabarse.',
      ],
    },
  },
  {
    version: '0.14.21',
    date: '2026-06-14',
    items: {
      'pt-BR': [
        'Fluidez: a tela inicial não “treme” mais de lado — eliminamos um pequeno deslize horizontal que aparecia ao rolar.',
        'Acessibilidade: campos de data, nome do dispositivo e lembrete de backup ganharam rótulos para leitores de tela, e os pontinhos do carrossel de insights ficaram mais fáceis de tocar.',
      ],
      en: [
        'Fluidity: the home screen no longer “jiggles” sideways — we removed a small horizontal slip that showed up while scrolling.',
        'Accessibility: the date, device-name and backup-reminder fields now have screen-reader labels, and the insight carousel dots are easier to tap.',
      ],
      es: [
        'Fluidez: la pantalla inicial ya no “tiembla” de lado — quitamos un pequeño deslizamiento horizontal que aparecía al desplazar.',
        'Accesibilidad: los campos de fecha, nombre del dispositivo y recordatorio de copia ahora tienen etiquetas para lectores de pantalla, y los puntitos del carrusel de insights son más fáciles de tocar.',
      ],
    },
  },
  {
    version: '0.14.20',
    date: '2026-06-14',
    items: {
      'pt-BR': [
        'O número principal da tela inicial agora é tocável: toque no “livre para usar” e veja de onde ele vem — orçamento da fase menos o que já saiu, a reserva protegida, o que está guardado para as próximas fases e o reservado para ocasiões.',
        'Se os compromissos passam do orçamento, o app mostra exatamente quanto, em vez de só travar em zero.',
      ],
      en: [
        'The home screen’s main number is now tappable: tap “free to spend” to see where it comes from — phase budget minus what’s already gone, the protected reserve, what’s set aside for next phases and what’s reserved for occasions.',
        'If commitments exceed the budget, the app shows exactly by how much instead of just clamping at zero.',
      ],
      es: [
        'El número principal de la pantalla inicial ahora es tocable: toca “libre para gastar” y mira de dónde sale — presupuesto de la fase menos lo ya gastado, la reserva protegida, lo reservado para próximas fases y lo reservado para ocasiones.',
        'Si los compromisos superan el presupuesto, la app muestra exactamente cuánto, en vez de quedarse en cero.',
      ],
    },
  },
  {
    version: '0.14.19',
    date: '2026-06-14',
    items: {
      'pt-BR': [
        'Check-in vira a “lente do dia”: o modo que você escolhe agora destaca um sinal da tela inicial — tranquilo realça o cofrinho, passeio realça suas ocasiões e noite projeta quantas rodadas cabem na reserva da noite.',
        'O modo do dia deixou de ser só um rótulo: além dos valores que já mudavam, ele aponta para o card em foco logo abaixo.',
      ],
      en: [
        'Check-in becomes the “lens of the day”: the mode you pick now spotlights one home-screen signal — calm highlights the piggy bank, outing highlights your occasions, and night projects how many rounds fit the night reserve.',
        'The day’s mode is no longer just a label: on top of the numbers that already changed, it points to the card in focus right below.',
      ],
      es: [
        'El check-in se vuelve la “lente del día”: el modo que eliges ahora resalta una señal de la pantalla inicial — tranquilo resalta la alcancía, salida resalta tus ocasiones y noche proyecta cuántas rondas caben en la reserva de la noche.',
        'El modo del día ya no es solo una etiqueta: además de los valores que ya cambiaban, señala la tarjeta en foco justo abajo.',
      ],
    },
  },
  {
    version: '0.14.18',
    date: '2026-06-14',
    items: {
      'pt-BR': [
        'Local automático: ao registrar um gasto ou durante uma saída, o app agora lista os estabelecimentos perto de você na categoria escolhida (restaurantes, bares, mercados…) e já deixa o mais próximo selecionado — toque para trocar.',
        'Não achou na lista? É só digitar o nome, como antes. Tudo opcional e só com a localização ligada; offline, continua usando seus locais recentes.',
      ],
      en: [
        'Automatic place: when logging an expense or during an outing, the app now lists the establishments near you in the chosen category (restaurants, bars, markets…) and pre-selects the closest one — tap to switch.',
        "Not in the list? Just type the name, like before. All optional and only with location on; offline, it falls back to your recent places.",
      ],
      es: [
        'Lugar automático: al registrar un gasto o durante una salida, la app ahora lista los establecimientos cerca de ti en la categoría elegida (restaurantes, bares, mercados…) y deja preseleccionado el más cercano — toca para cambiar.',
        '¿No está en la lista? Solo escribe el nombre, como antes. Todo opcional y solo con la ubicación activada; sin conexión, usa tus lugares recientes.',
      ],
    },
  },
  {
    version: '0.14.17',
    date: '2026-06-14',
    items: {
      'pt-BR': [
        'Saída ativa agora te acompanha: enquanto um rolê está rolando, uma marca flutuante aparece nas outras telas mostrando o nome e o total gasto na hora — toque para voltar direto pra saída.',
        'Antes, ao sair da tela da saída, era fácil esquecer que ela estava aberta. Agora você sempre sabe.',
      ],
      en: [
        'Active outing now follows you: while a session is running, a floating chip appears on the other screens showing its name and live total — tap it to jump straight back to the outing.',
        'Before, leaving the outing screen made it easy to forget it was still open. Now you always know.',
      ],
      es: [
        'La salida activa ahora te acompaña: mientras una salida está en curso, aparece una marca flotante en las demás pantallas con su nombre y el total en vivo — tócala para volver directo a la salida.',
        'Antes, al salir de la pantalla de la salida era fácil olvidar que seguía abierta. Ahora siempre lo sabes.',
      ],
    },
  },
  {
    version: '0.14.16',
    date: '2026-06-14',
    items: {
      'pt-BR': [
        'Editar um gasto agora confirma na hora ("Gasto atualizado") com uma vibração suave — antes salvava em silêncio.',
        'Navegar pelo app ficou mais fluido: o app não pisca mais o ícone de carregando ao trocar de tela (ele só aparece se algo realmente demorar).',
      ],
      en: [
        'Editing an expense now confirms instantly ("Expense updated") with a soft tap — it used to save silently.',
        'Navigating the app feels smoother: it no longer flashes the loading spinner when switching screens (it only appears if something genuinely takes a while).',
      ],
      es: [
        'Editar un gasto ahora confirma al instante ("Gasto actualizado") con una vibración suave — antes guardaba en silencio.',
        'Navegar por la app es más fluido: ya no parpadea el ícono de carga al cambiar de pantalla (solo aparece si algo realmente tarda).',
      ],
    },
  },
  {
    version: '0.14.15',
    date: '2026-06-14',
    items: {
      'pt-BR': [
        'O mesmo "número que responde" do início agora vale no app todo: o cofrinho, o total das carteiras e o saldo de cada carteira animam até o novo valor quando mudam.',
        'Adiar um evento agora confirma na hora ("{evento} adiado para {data}") — antes a ação era silenciosa.',
        'A lista de gastos vazia agora tem um botão para registrar o primeiro gasto.',
      ],
      en: [
        'The same "number that reacts" from the home screen now applies across the app: the piggy bank, the wallets total and each wallet balance animate to their new value when they change.',
        'Postponing an event now confirms instantly ("{event} postponed to {date}") — the action used to be silent.',
        'The empty expense list now has a button to log your first expense.',
      ],
      es: [
        'El mismo "número que reacciona" de la pantalla de inicio ahora vale en toda la app: la hucha, el total de las carteras y el saldo de cada cartera se animan hasta su nuevo valor cuando cambian.',
        'Aplazar un evento ahora confirma al instante ("{evento} aplazado al {fecha}") — antes la acción era silenciosa.',
        'La lista de gastos vacía ahora tiene un botón para registrar el primer gasto.',
      ],
    },
  },
  {
    version: '0.14.14',
    date: '2026-06-14',
    items: {
      'pt-BR': [
        'O valor de "livre para gastar" agora reage: quando você registra ou desfaz um gasto, o número desce (ou sobe) animado até o novo total — você vê o resultado acontecer, não um número que troca do nada.',
        'Salvar um gasto e escolher o modo do check-in agora dão uma vibração suave de confirmação (quando a vibração está ativada nas configurações).',
      ],
      en: [
        'The "free to spend" amount now reacts: when you log or undo an expense, the number animates down (or up) to the new total — you see the result happen instead of a number swapping silently.',
        'Saving an expense and picking a check-in mode now give a soft confirmation tap (when vibration is enabled in settings).',
      ],
      es: [
        'El importe "libre para gastar" ahora reacciona: al registrar o deshacer un gasto, el número baja (o sube) animado hasta el nuevo total — ves el resultado suceder en lugar de un número que cambia sin más.',
        'Guardar un gasto y elegir el modo del check-in ahora dan una vibración suave de confirmación (cuando la vibración está activada en ajustes).',
      ],
    },
  },
  {
    version: '0.14.13',
    date: '2026-06-14',
    items: {
      'pt-BR': [
        'O check-in do dia agora mostra os números em destaque: ao escolher um modo, você vê na hora quanto gastar hoje e quanto fica de reserva — não some mais em texto pequeno.',
        'Antes de salvar um gasto, o app já mostra quanto vai sobrar no fundo ("depois deste gasto, sobram €X") — verde quando cabe, vermelho quando passa do plano.',
        'A lista de gastos agora é agrupada por dia (Hoje, Ontem, datas) com o total de cada dia ao lado.',
        'Na visão geral, cada fundo ganhou uma barra de progresso que muda de cor conforme o uso.',
        'Carteiras mostram o total somado, o modo resgate explica o que fazer quando está vazio, e os gastos divididos explicam o que "Pendente" e "Confirmado" significam.',
      ],
      en: [
        'The daily check-in now highlights the numbers: pick a mode and instantly see how much to spend today and how much is reserved — no longer buried in small text.',
        'Before saving an expense, the app shows how much will remain in the fund ("after this expense, €X left") — green when it fits, red when it goes over plan.',
        'The expense list is now grouped by day (Today, Yesterday, dates) with each day\'s total alongside.',
        'In the overview, each fund now has a progress bar that shifts color with usage.',
        'Wallets show a combined total, rescue mode explains what to do when empty, and shared expenses explain what "Pending" and "Confirmed" mean.',
      ],
      es: [
        'El check-in del día ahora resalta los números: al elegir un modo ves al instante cuánto gastar hoy y cuánto queda en reserva — ya no se pierde en texto pequeño.',
        'Antes de guardar un gasto, la app muestra cuánto quedará en el fondo ("después de este gasto, quedan €X") — verde cuando cabe, rojo cuando se pasa del plan.',
        'La lista de gastos ahora se agrupa por día (Hoy, Ayer, fechas) con el total de cada día al lado.',
        'En la vista general, cada fondo tiene una barra de progreso que cambia de color según el uso.',
        'Las carteras muestran el total combinado, el modo rescate explica qué hacer cuando está vacío, y los gastos compartidos explican qué significan "Pendiente" y "Confirmado".',
      ],
    },
  },
  {
    version: '0.14.12',
    date: '2026-06-14',
    items: {
      'pt-BR': [
        'Mais explicações onde fazia falta: o check-in do dia agora diz pra que serve antes de você escolher, o simulador mostra o que fazer quando está vazio, e a tela de reconciliar carteira explica o que ela faz.',
      ],
      en: [
        "More explanations where they were missing: the daily check-in now says what it's for before you pick, the simulator shows what to do when it's empty, and the wallet reconcile screen explains what it does.",
      ],
      es: [
        'Más explicaciones donde faltaban: el check-in del día ahora dice para qué sirve antes de elegir, el simulador muestra qué hacer cuando está vacío, y la pantalla de reconciliar billetera explica qué hace.',
      ],
    },
  },
  {
    version: '0.14.11',
    date: '2026-06-14',
    items: {
      'pt-BR': [
        'O check-in do dia agora muda de verdade: cada modo (Tranquilo, Passeio, Noite) vira um plano diferente do seu dinheiro de hoje — meta leve, ritmo livre ou reserva pra noite.',
        'Registrar gasto abre direto na última categoria que você usou, em vez de "Outros".',
        'Textos mais claros: o aviso do "amigo sincero" foi reescrito, "valor seguro" ganhou explicação e o painel não repete mais o mesmo número duas vezes.',
      ],
      en: [
        "The daily check-in now truly changes things: each mode (Calm, Outing, Night) becomes a different plan for today's money — a light target, free pace, or a night reserve.",
        'Add expense now opens on the last category you used, instead of "Other".',
        'Clearer wording: the "honest friend" note was rewritten, "safe value" got an explanation, and the dashboard no longer repeats the same number twice.',
      ],
      es: [
        'El check-in del día ahora cambia de verdad: cada modo (Tranquilo, Paseo, Noche) se vuelve un plan distinto de tu dinero de hoy — meta ligera, ritmo libre o reserva para la noche.',
        'Registrar gasto abre en la última categoría que usaste, en vez de "Otros".',
        'Textos más claros: la nota del "amigo sincero" se reescribió, "valor seguro" recibió una explicación y el panel ya no repite el mismo número dos veces.',
      ],
    },
  },
  {
    version: '0.14.10',
    date: '2026-06-14',
    items: {
      'pt-BR': [
        'Transferências e saques entre carteiras agora confirmam na tela ("Transferência de X registrada").',
        'O check-in do dia responde na hora: a leitura do dia aparece no instante do toque, sem espera.',
      ],
      en: [
        'Wallet transfers and withdrawals now confirm on screen ("X transfer recorded").',
        'The daily check-in now responds instantly: the day\'s read appears the moment you tap, no wait.',
      ],
      es: [
        'Las transferencias y retiros entre billeteras ahora confirman en pantalla ("Transferencia de X registrada").',
        'El check-in del día responde al instante: la lectura del día aparece al tocar, sin espera.',
      ],
    },
  },
  {
    version: '0.14.9',
    date: '2026-06-14',
    items: {
      'pt-BR': [
        'Registrar um gasto agora confirma na hora: aparece "Gasto de X registrado" com a opção Desfazer — e o painel já mostra o novo "livre para hoje".',
      ],
      en: [
        'Saving an expense now confirms instantly: a "X expense saved" message with an Undo option — and the dashboard already shows your new "free today".',
      ],
      es: [
        'Registrar un gasto ahora confirma al instante: aparece "Gasto de X registrado" con opción de Deshacer — y el panel ya muestra tu nuevo "libre para hoy".',
      ],
    },
  },
  {
    version: '0.14.8',
    date: '2026-06-14',
    items: {
      'pt-BR': [
        'Mais clareza: quando você aceita um valor sugerido ou decide o destino da sobra de uma fase, o app confirma na hora o que mudou e para onde o dinheiro foi.',
      ],
      en: [
        'More clarity: when you accept a suggested value or choose where a phase leftover goes, the app now confirms what changed and where the money went.',
      ],
      es: [
        'Más claridad: cuando aceptas un valor sugerido o eliges el destino del sobrante de una fase, la app confirma al instante qué cambió y a dónde fue el dinero.',
      ],
    },
  },
  {
    version: '0.14.7',
    date: '2026-06-14',
    items: {
      'pt-BR': [
        'O check-in do dia agora responde: ao escolher Tranquilo, Passeio ou Noite, ele mostra na hora quanto você tem livre hoje e o que aquilo significa pro seu dia.',
      ],
      en: [
        'The daily check-in now responds: pick Calm, Outing or Night and it instantly shows how much you have free today and what that means for your day.',
      ],
      es: [
        'El check-in del día ahora responde: elige Tranquilo, Paseo o Noche y muestra al instante cuánto tienes libre hoy y qué significa para tu día.',
      ],
    },
  },
  {
    version: '0.14.6',
    date: '2026-06-14',
    items: {
      'pt-BR': [
        'Mais fluido: tocar em coisas no app (abrir/fechar cards, check-in do dia e mais) agora responde na hora, sem recarregar a tela nem pular para o topo — você continua de onde estava.',
      ],
      en: [
        'Smoother: tapping things in the app (open/close cards, the daily check-in and more) now responds instantly, without reloading the screen or jumping to the top — you stay right where you were.',
      ],
      es: [
        'Más fluido: tocar cosas en la app (abrir/cerrar tarjetas, el check-in del día y más) ahora responde al instante, sin recargar la pantalla ni saltar arriba — te quedas donde estabas.',
      ],
    },
  },
  {
    version: '0.14.5',
    date: '2026-06-14',
    items: {
      'pt-BR': [
        'Navegação mais consistente: o botão de voltar e os títulos agora seguem o mesmo estilo em todas as telas (notificações e impacto incluídos).',
      ],
      en: [
        'More consistent navigation: the back button and titles now follow the same style across every screen (notifications and impact included).',
      ],
      es: [
        'Navegación más consistente: el botón de volver y los títulos ahora siguen el mismo estilo en todas las pantallas (notificaciones e impacto incluidos).',
      ],
    },
  },
  {
    version: '0.14.4',
    date: '2026-06-14',
    items: {
      'pt-BR': [
        'Ajustes mais fáceis de navegar: as opções agora ficam agrupadas por tema (Preferências, Notificações, Dinheiro, Tela inicial, Backup e segurança, Dispositivo e Sobre).',
      ],
      en: [
        'Settings are easier to scan: options are now grouped by theme (Preferences, Notifications, Money, Home screen, Backup & security, Device and About).',
      ],
      es: [
        'Ajustes más fáciles de recorrer: las opciones ahora están agrupadas por tema (Preferencias, Notificaciones, Dinero, Pantalla de inicio, Copia y seguridad, Dispositivo y Acerca de).',
      ],
    },
  },
  {
    version: '0.14.3',
    date: '2026-06-14',
    items: {
      'pt-BR': [
        'No registro de gasto, os botões Cancelar e Salvar agora ficam fixos na base da tela — dá pra salvar sem rolar até o fim.',
      ],
      en: [
        'On the expense form, the Cancel and Save buttons now stay pinned at the bottom — you can save without scrolling to the end.',
      ],
      es: [
        'En el registro de gasto, los botones Cancelar y Guardar ahora quedan fijos abajo — puedes guardar sin desplazarte hasta el final.',
      ],
    },
  },
  {
    version: '0.14.2',
    date: '2026-06-14',
    items: {
      'pt-BR': [
        'Painel mais limpo: as análises da viagem (resumo de ontem, ritmo da fase e mapa do mês) agora ficam juntas num cartão "Análise da viagem" que você abre quando quiser.',
        'Menos avisos repetidos no topo: aparece só o aviso de backup mais importante de cada vez.',
      ],
      en: [
        'Cleaner home: your trip analytics (yesterday recap, phase pace and month map) are now grouped into a single "Trip analytics" card you open when you want.',
        'Fewer repeated banners at the top: only the most important backup notice shows at a time.',
      ],
      es: [
        'Panel más limpio: los análisis del viaje (resumen de ayer, ritmo de la fase y mapa del mes) ahora están juntos en una tarjeta "Análisis del viaje" que abres cuando quieras.',
        'Menos avisos repetidos arriba: aparece solo el aviso de copia más importante a la vez.',
      ],
    },
  },
  {
    version: '0.14.1',
    date: '2026-06-13',
    items: {
      'pt-BR': [
        'Pacote de viagem e segurança dos dados completo: local e horário nos gastos, gastos em outra moeda com conversão pra sua moeda base, pontos de restauração diários no aparelho, envio de backup pelo compartilhamento, resumo da viagem em HTML, bloqueio por PIN e compartilhar texto pro TripPilot.',
        'Ajustes finais de estabilidade e desempenho em toda a viagem.',
      ],
      en: [
        'Travel & data-safety package complete: place and time on expenses, foreign-currency expenses converted to your base currency, daily on-device restore points, backup sharing, an HTML trip summary, a PIN lock and share-into-TripPilot.',
        'Final stability and performance touches across the whole trip.',
      ],
      es: [
        'Paquete de viaje y seguridad de datos completo: lugar y hora en los gastos, gastos en otra moneda convertidos a tu moneda base, puntos de restauración diarios en el dispositivo, envío de copia por compartir, resumen del viaje en HTML, bloqueo por PIN y compartir texto a TripPilot.',
        'Ajustes finales de estabilidad y rendimiento en todo el viaje.',
      ],
    },
  },
  {
    version: '0.14.0',
    date: '2026-06-13',
    items: {
      'pt-BR': [
        'Bloqueio do app por PIN (opcional): ative em Ajustes e o app pede o PIN ao abrir. Fica tudo neste aparelho — a recuperação por backup nunca trava.',
        'Compartilhar para o TripPilot: envie um texto de outro app e o registro de gasto já abre preenchido com valor e descrição (você confere antes de salvar).',
      ],
      en: [
        'App lock with a PIN (optional): turn it on in Settings and the app asks for the PIN on open. Everything stays on this device — backup recovery is never locked out.',
        'Share to TripPilot: send text from another app and the expense form opens pre-filled with the amount and description (you review before saving).',
      ],
      es: [
        'Bloqueo de la app con PIN (opcional): actívalo en Ajustes y la app pide el PIN al abrir. Todo queda en este dispositivo — la recuperación por copia nunca se bloquea.',
        'Compartir a TripPilot: envía un texto desde otra app y el registro de gasto se abre con el importe y la descripción ya rellenados (lo revisas antes de guardar).',
      ],
    },
  },
  {
    version: '0.13.2',
    date: '2026-06-13',
    items: {
      'pt-BR': [
        'Enviar backup pelo compartilhamento do sistema (Drive, Files, e-mail) — com aviso quando faz tempo que você não faz.',
        'Exportar um resumo da viagem em HTML que abre offline em qualquer navegador (totais, fases, categorias, lugares, saídas).',
      ],
      en: [
        'Send your backup through the system share sheet (Drive, Files, email) — with a nudge when it has been a while.',
        'Export a trip summary as HTML that opens offline in any browser (totals, phases, categories, places, outings).',
      ],
      es: [
        'Envía tu copia con el menú de compartir del sistema (Drive, Files, email) — con aviso cuando hace tiempo que no la haces.',
        'Exporta un resumen del viaje en HTML que abre sin conexión en cualquier navegador (totales, fases, categorías, lugares, salidas).',
      ],
    },
  },
  {
    version: '0.13.1',
    date: '2026-06-13',
    items: {
      'pt-BR': [
        'Pontos de restauração diários: o app guarda os últimos 7 dias só neste aparelho.',
        'Em Ajustes › Avançado, escolha um dia e volte o app àquele estado (com confirmação, sem perda silenciosa).',
      ],
      en: [
        'Daily restore points: the app keeps the last 7 days on this device only.',
        'In Settings › Advanced, pick a day to roll the app back to that state (with confirmation, no silent loss).',
      ],
      es: [
        'Puntos de restauración diarios: la app guarda los últimos 7 días solo en este dispositivo.',
        'En Ajustes › Avanzado, elige un día para volver la app a ese estado (con confirmación, sin pérdida silenciosa).',
      ],
    },
  },
  {
    version: '0.13.0',
    date: '2026-06-13',
    items: {
      'pt-BR': [
        'Gastos em moeda estrangeira: escolha a moeda, informe a taxa e o app converte pra moeda da viagem guardando o valor original.',
        'Baixe as taxas do dia uma vez (online) e use offline — ou informe a taxa manualmente a qualquer momento.',
        'A carteira debita certo: na moeda dela quando coincide, no valor convertido quando é a moeda da viagem.',
        'O detalhe do gasto mostra o valor original e o equivalente na moeda da viagem.',
      ],
      en: [
        'Foreign-currency expenses: pick the currency, set the rate and the app converts to your trip currency while keeping the original amount.',
        "Pull today's rates once (online) and use them offline — or enter the rate manually anytime.",
        'Wallets debit correctly: in their own currency when it matches, in the converted value when they hold the trip currency.',
        'The expense detail shows the original amount and its trip-currency equivalent.',
      ],
      es: [
        'Gastos en moneda extranjera: elige la moneda, indica la tasa y la app convierte a la moneda del viaje guardando el importe original.',
        'Descarga las tasas del día una vez (online) y úsalas sin conexión — o indica la tasa manualmente cuando quieras.',
        'La billetera descuenta correctamente: en su propia moneda cuando coincide, en el valor convertido cuando tiene la moneda del viaje.',
        'El detalle del gasto muestra el importe original y su equivalente en la moneda del viaje.',
      ],
    },
  },
  {
    version: '0.12.3',
    date: '2026-06-13',
    items: {
      'pt-BR': [
        'Hora e local aparecem em cada gasto, na lista e no detalhe — e dá pra editar o lugar.',
        'Lugares recentes pra reusar com um toque (offline) e busca do nome pela internet (opcional).',
        'Filtre seus gastos por lugar e veja o total gasto em cada um.',
        'Na saída ativa, o lugar atual aparece no topo e você troca ali mesmo.',
      ],
      en: [
        'Time and place now show on every expense, in the list and detail — and you can edit the place.',
        'Recent places to reuse with one tap (offline) plus an optional online name lookup.',
        'Filter your expenses by place and see the total spent at each one.',
        'During an active outing the current place shows at the top and you can change it there.',
      ],
      es: [
        'La hora y el lugar aparecen en cada gasto, en la lista y el detalle — y puedes editar el lugar.',
        'Lugares recientes para reutilizar con un toque (sin conexión) y búsqueda del nombre en línea (opcional).',
        'Filtra tus gastos por lugar y mira el total gastado en cada uno.',
        'En la salida activa, el lugar actual aparece arriba y lo cambias ahí mismo.',
      ],
    },
  },
  {
    version: '0.12.2',
    date: '2026-06-13',
    items: {
      'pt-BR': [
        'Local nos gastos (opcional): registre onde você gastou, com um toque pra nomear ou trocar o lugar.',
        'O app lembra o lugar atual e só repergunta quando você muda de área.',
        'Privacidade primeiro: o local usa o GPS só quando você ativa, fica 100% no aparelho e nunca é enviado.',
      ],
      en: [
        'Location on expenses (optional): record where you spent, with one tap to name or change the place.',
        'The app remembers your current place and only re-asks when you move to a new area.',
        'Privacy first: location uses GPS only when you turn it on, stays 100% on your device and is never sent.',
      ],
      es: [
        'Lugar en los gastos (opcional): registra dónde gastaste, con un toque para nombrarlo o cambiarlo.',
        'La app recuerda tu lugar actual y solo vuelve a preguntar cuando cambias de zona.',
        'Privacidad primero: la ubicación usa el GPS solo cuando la activas, queda 100% en el dispositivo y nunca se envía.',
      ],
    },
  },
  {
    version: '0.12.1',
    date: '2026-06-13',
    items: {
      'pt-BR': [
        'Fechamento do pacote: insights, ciclo de fase, metas e continuidade entre viagens revisados e estabilizados.',
      ],
      en: [
        'Package wrap-up: insights, phase cycle, goals and trip-to-trip continuity reviewed and stabilized.',
      ],
      es: [
        'Cierre del paquete: insights, ciclo de fase, metas y continuidad entre viajes revisados y estabilizados.',
      ],
    },
  },
  {
    version: '0.12.0',
    date: '2026-06-13',
    items: {
      'pt-BR': [
        'No fim da viagem, o app oferece guardar o que aprendeu como ponto de partida pra próxima.',
        'Salve a viagem como modelo: fases, perfis e valores típicos prontos pra reusar.',
        'Comece uma viagem nova a partir de um modelo salvo — a estrutura e os valores já vêm preenchidos.',
      ],
      en: [
        'At the end of a trip, the app offers to save what it learned as a starting point for the next one.',
        'Save a trip as a template: phases, profiles and typical values ready to reuse.',
        'Start a new trip from a saved template — the structure and values come pre-filled.',
      ],
      es: [
        'Al final del viaje, la app ofrece guardar lo aprendido como punto de partida para el próximo.',
        'Guarda el viaje como plantilla: fases, perfiles y valores típicos listos para reutilizar.',
        'Empieza un viaje nuevo desde una plantilla guardada — la estructura y los valores ya vienen cargados.',
      ],
    },
  },
  {
    version: '0.11.2',
    date: '2026-06-13',
    items: {
      'pt-BR': [
        'O app aprende na viagem: quando suas saídas custam diferente do perfil, ele sugere atualizar.',
        'A sugestão só muda o valor se você aceitar — ignorar não altera nada.',
        'A média usa a saída inteira como 1 ocasião e ignora gastos especiais.',
      ],
      en: [
        'The app learns during the trip: when your outings cost differently than the profile, it suggests an update.',
        'The suggestion only changes the value if you accept — ignoring it changes nothing.',
        'The average treats a whole outing as one occasion and skips special expenses.',
      ],
      es: [
        'La app aprende en el viaje: cuando tus salidas cuestan distinto al perfil, sugiere actualizar.',
        'La sugerencia solo cambia el valor si la aceptas — ignorarla no cambia nada.',
        'El promedio cuenta una salida entera como una ocasión e ignora gastos especiales.',
      ],
    },
  },
  {
    version: '0.11.1',
    date: '2026-06-13',
    items: {
      'pt-BR': [
        'Meta de economia: defina quanto quer voltar com sobrando e acompanhe a projeção até o fim da viagem.',
        'Cofrinho: veja quanto você já guardou gastando abaixo do ritmo.',
        'A meta e o cofrinho são só motivação — nunca mexem no seu "livre pra gastar".',
      ],
      en: [
        'Savings goal: set how much you want to come home with and track the projection to the trip’s end.',
        'Piggy bank: see how much you’ve put aside by spending under pace.',
        'The goal and piggy bank are motivation only — they never touch your "free to spend".',
      ],
      es: [
        'Meta de ahorro: define con cuánto quieres volver y sigue la proyección hasta el final del viaje.',
        'Alcancía: mira cuánto ya guardaste gastando por debajo del ritmo.',
        'La meta y la alcancía son solo motivación — nunca tocan tu "libre para gastar".',
      ],
    },
  },
  {
    version: '0.11.0',
    date: '2026-06-13',
    items: {
      'pt-BR': [
        'Ciclo de fase: quando uma fase fecha com saldo, o app mostra quanto você economizou.',
        'Decida o que fazer com a sobra: levar pra próxima fase, guardar como reserva ou liberar pras compras.',
        'Contagem regressiva entre fases: "faltam X dias pra próxima — você tem Y/dia até lá".',
      ],
      en: [
        'Phase cycle: when a phase closes with money left, the app shows how much you saved.',
        'Decide what to do with the leftover: carry it on, keep it as a reserve, or release it to shopping.',
        'Between-phases countdown: "X days until the next one — you have Y/day until then".',
      ],
      es: [
        'Ciclo de fase: cuando una fase cierra con saldo, la app muestra cuánto ahorraste.',
        'Decide qué hacer con lo que sobró: llevarlo a la próxima fase, guardarlo como reserva o liberarlo para compras.',
        'Cuenta regresiva entre fases: "faltan X días para la próxima — tienes Y/día hasta entonces".',
      ],
    },
  },
  {
    version: '0.10.3',
    date: '2026-06-13',
    items: {
      'pt-BR': [
        'Insights mais espertos: aviso de "categoria acelerada" (ex.: bar já no limite cedo).',
        '"Dia perigoso": quando um dia da semana costuma sair caro, o app avisa logo cedo.',
        '"Fim do dia": se você não registrou nada, um toque abre o registro rápido.',
        'Check-in do dia: diga em 1 toque se vai ser tranquilo, passeio ou noite.',
      ],
      en: [
        'Smarter insights: a "category on a tear" heads-up (e.g. bar near its limit early).',
        '"Pricey day": when a weekday tends to cost more, the app flags it early.',
        '"End of day": if you logged nothing, one tap opens quick capture.',
        'Daily check-in: say in one tap whether it’s a calm, outing or night kind of day.',
      ],
      es: [
        'Insights más listos: aviso de "categoría acelerada" (p. ej. bar cerca del límite pronto).',
        '"Día caro": cuando un día de la semana suele costar más, la app lo avisa temprano.',
        '"Fin del día": si no registraste nada, un toque abre la captura rápida.',
        'Check-in del día: di en un toque si será tranquilo, paseo o noche.',
      ],
    },
  },
  {
    version: '0.10.2',
    date: '2026-06-13',
    items: {
      'pt-BR': [
        'Insights sem limite: agora aparecem todos os relevantes, dos mais importantes aos menos.',
        'Os insights giram sozinhos — e pausam assim que você toca ou desliza.',
        'No Modo Simples, no máximo um aviso importante, sem virar mural.',
      ],
      en: [
        'Insights without a cap: all the relevant ones now show, most important first.',
        'Insights rotate on their own — and pause the moment you touch or swipe.',
        'In Simple mode, at most one important heads-up, never a wall.',
      ],
      es: [
        'Insights sin límite: ahora aparecen todos los relevantes, de los más importantes a los menos.',
        'Los insights giran solos — y se pausan en cuanto tocas o deslizas.',
        'En Modo Simple, como mucho un aviso importante, sin convertirse en un muro.',
      ],
    },
  },
  {
    version: '0.10.1',
    date: '2026-06-13',
    items: {
      'pt-BR': [
        'Pacote de captura rápida + saída v2 + modo simples finalizado e publicado.',
        'Tudo revisado: testes verdes, sem regressões dos ajustes de estabilidade.',
      ],
      en: [
        'Fast capture + outing v2 + simple mode package finalized and published.',
        'All reviewed: tests green, no regressions from the stability fixes.',
      ],
      es: [
        'Paquete de captura rápida + salida v2 + modo simple finalizado y publicado.',
        'Todo revisado: pruebas en verde, sin regresiones de los ajustes de estabilidad.',
      ],
    },
  },
  {
    version: '0.10.0',
    date: '2026-06-13',
    items: {
      'pt-BR': [
        'Início inteligente fechado: depois de alguns gastos, o app oferece desbloquear tudo (rolês, simulador, planejamento) — sem forçar.',
        'Textos mais humanos no modo simples, no tom de "amigo sincero".',
        'Fase 2 completa: modo simples ponta a ponta, do começo rápido ao desbloqueio.',
      ],
      en: [
        'Smart start wrapped up: after a few expenses, the app offers to unlock everything (outings, simulator, planning) — never forced.',
        'Warmer copy across simple mode, in the "honest friend" tone.',
        'Phase 2 complete: simple mode end to end, from quick start to unlock.',
      ],
      es: [
        'Inicio inteligente cerrado: tras algunos gastos, la app ofrece desbloquear todo (salidas, simulador, planificación) — sin forzar.',
        'Textos más humanos en el modo simple, con tono de "amigo sincero".',
        'Fase 2 completa: modo simple de punta a punta, del inicio rápido al desbloqueo.',
      ],
    },
  },
  {
    version: '0.9.2',
    date: '2026-06-13',
    items: {
      'pt-BR': [
        'Modo Simples chegou: tela inicial enxuta com "livre hoje" e um botão para registrar.',
        'Menos é mais: planejamento, rolês e simulador ficam escondidos (e voltam quando você quiser).',
        'Troque entre Simples e Completo a qualquer momento nos Ajustes.',
      ],
      en: [
        'Simple mode is here: a lean home with "free today" and one button to log.',
        'Less is more: planning, outings and simulator stay hidden (and come back when you want).',
        'Switch between Simple and Complete anytime in Settings.',
      ],
      es: [
        'Llegó el Modo Simple: pantalla de inicio mínima con "libre hoy" y un botón para registrar.',
        'Menos es más: planificación, salidas y simulador quedan ocultos (y vuelven cuando quieras).',
        'Cambia entre Simple y Completo cuando quieras en Ajustes.',
      ],
    },
  },
  {
    version: '0.9.1',
    date: '2026-06-13',
    items: {
      'pt-BR': [
        'Começo rápido: crie a viagem com 1 pergunta ("quanto você tem e até quando").',
        'Escolha como usar: Modo Simples (só o essencial) ou Completo — dá pra trocar depois.',
        'Tipo de viagem (Urbana/Família/Festival) já sugere ritmo e reserva.',
      ],
      en: [
        'Quick start: create the trip with 1 question ("how much and until when").',
        'Choose how to use it: Simple mode (essentials only) or Complete — switch anytime.',
        'Trip type (Urban/Family/Festival) suggests pace and reserve for you.',
      ],
      es: [
        'Inicio rápido: crea el viaje con 1 pregunta ("cuánto tienes y hasta cuándo").',
        'Elige cómo usarlo: Modo Simple (lo esencial) o Completo — cámbialo cuando quieras.',
        'Tipo de viaje (Urbana/Familia/Festival) ya sugiere ritmo y reserva.',
      ],
    },
  },
  {
    version: '0.9.0',
    date: '2026-06-13',
    items: {
      'pt-BR': [
        'Falar o gasto: toque no microfone e diga "25 no mercado" (onde houver suporte).',
        'Simulador "pegar de amanhã": aviso honesto quando o gasto cabe na fase, mas estoura o dia.',
        'Captura mais rápida e redonda, fechando a primeira fase de melhorias.',
      ],
      en: [
        'Speak the expense: tap the mic and say "25 at the market" (where supported).',
        '"Borrow from tomorrow" in the simulator: an honest heads-up when a spend fits the phase but blows today.',
        'Faster, rounder capture, wrapping up the first wave of improvements.',
      ],
      es: [
        'Decir el gasto: toca el micrófono y di "25 en el mercado" (donde haya soporte).',
        'Simulador "tomar de mañana": aviso honesto cuando el gasto cabe en la fase, pero se pasa del día.',
        'Captura más rápida y completa, cerrando la primera fase de mejoras.',
      ],
    },
  },
  {
    version: '0.8.5',
    date: '2026-06-13',
    items: {
      'pt-BR': [
        'Saída v2: os botões de valor aprendem o último valor usado.',
        'Repetir último item com um toque (respeita divisão com o grupo).',
        'Rodada: lance várias bebidas do mesmo preço de uma vez, dividindo se quiser.',
        'Sugestão de quem paga a próxima rodada (rotação justa).',
        'Projeção: "no seu ritmo, ~1h até o teto" durante a saída.',
      ],
      en: [
        'Outing v2: the amount buttons learn the last value you used.',
        'Repeat the last item in one tap (keeps the group split).',
        'Round: log several same-price drinks at once, split if you like.',
        'Suggestion for who pays the next round (fair rotation).',
        'Pace projection: "at this rate, ~1h to the ceiling" during the outing.',
      ],
      es: [
        'Salida v2: los botones de importe aprenden el último valor usado.',
        'Repetir el último ítem con un toque (respeta la división del grupo).',
        'Ronda: registra varias bebidas del mismo precio a la vez, dividiendo si quieres.',
        'Sugerencia de quién paga la próxima ronda (rotación justa).',
        'Proyección: "a este ritmo, ~1h hasta el techo" durante la salida.',
      ],
    },
  },
  {
    version: '0.8.4',
    date: '2026-06-13',
    items: {
      'pt-BR': [
        'O campo de valor virou calculadora: digite "12+3,50" ou "10*2".',
        'Repetir gastos: atalhos para os seus gastos mais frequentes.',
        'Sugestão pela descrição: ao digitar, ele lembra a categoria e o valor de antes.',
        'Transporte ida-e-volta: registre a volta com um toque.',
        'Aviso de valor fora do normal para evitar erros de digitação.',
      ],
      en: [
        'The amount field is now a calculator: type "12+3.50" or "10*2".',
        'Repeat expenses: shortcuts to your most frequent ones.',
        'Description memory: as you type, it recalls the category and amount from before.',
        'Round-trip transport: log the return leg with one tap.',
        'Heads-up when an amount is far above your usual, to catch typos.',
      ],
      es: [
        'El campo de importe ahora es una calculadora: escribe "12+3,50" o "10*2".',
        'Repetir gastos: accesos directos a los más frecuentes.',
        'Memoria por descripción: al escribir, recuerda la categoría y el importe de antes.',
        'Transporte ida y vuelta: registra la vuelta con un toque.',
        'Aviso cuando un importe está muy por encima de lo normal, para evitar errores.',
      ],
    },
  },
  {
    version: '0.8.3',
    date: '2026-06-13',
    items: {
      'pt-BR': [
        'Nova tela de novidades: abra o Sobre para ver o que muda a cada versão.',
      ],
      en: [
        'New "what\'s new" screen: open About to see what changes in each version.',
      ],
      es: [
        'Nueva pantalla de novedades: abre Acerca de para ver qué cambia en cada versión.',
      ],
    },
  },
];

/** Maps an i18n language code to one of the three supported note languages. */
export function resolveReleaseNoteLang(language: string): ReleaseNoteLang {
  if (language.startsWith('es')) return 'es';
  if (language.startsWith('en')) return 'en';
  return 'pt-BR';
}

/** The localized lines for a single release in the active language. */
export function getReleaseNoteItems(note: ReleaseNote, language: string): string[] {
  return note.items[resolveReleaseNoteLang(language)];
}

/** The release entry matching a version, or null when none is registered. */
export function findReleaseNote(version: string): ReleaseNote | null {
  return RELEASE_NOTES.find((note) => note.version === version) ?? null;
}

/** Every release older than the given version, preserving descending order. */
export function getPreviousReleaseNotes(version: string): ReleaseNote[] {
  return RELEASE_NOTES.filter((note) => note.version !== version);
}
