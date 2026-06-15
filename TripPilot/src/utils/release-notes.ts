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
