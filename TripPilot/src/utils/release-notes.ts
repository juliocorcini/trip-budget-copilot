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
    version: '2.0.7-rc',
    date: '2026-07-01',
    items: {
      'pt-BR': [
        'O conversor de moedas ficou mais fácil de usar: as moedas mais comuns (Real, Dólar, Euro, Dólar canadense, Franco suíço, Libra e Iene) aparecem no topo da lista, e cada uma mostra a bandeira e o nome — não só o código.',
        'A cotação agora se atualiza sozinha, em segundo plano, quando está com mais de 12 horas e você está online. Continua funcionando offline (com a última cotação salva) e você ainda pode atualizar na mão ou digitar uma taxa manual quando quiser.',
      ],
      en: [
        'The currency converter is easier to use: the most common currencies (Real, US Dollar, Euro, Canadian Dollar, Swiss Franc, Pound and Yen) now lead the list, each showing its flag and name — not just the code.',
        'Rates now refresh on their own, in the background, when they are over 12 hours old and you are online. It still works offline (with the last saved rate), and you can still refresh manually or type a manual rate whenever you want.',
      ],
      es: [
        'El conversor de monedas es más fácil de usar: las monedas más comunes (Real, Dólar, Euro, Dólar canadiense, Franco suizo, Libra y Yen) aparecen al principio de la lista, cada una con su bandera y su nombre — no solo el código.',
        'Las cotizaciones ahora se actualizan solas, en segundo plano, cuando tienen más de 12 horas y estás en línea. Sigue funcionando sin conexión (con la última cotización guardada) y aún puedes actualizar a mano o escribir una tasa manual cuando quieras.',
      ],
    },
  },
  {
    version: '2.0.6-rc',
    date: '2026-07-01',
    items: {
      'pt-BR': [
        'Agora dá para remover uma pessoa de vez, não só desconectar. Antes, remover só desvinculava o aparelho e a pessoa continuava na lista — e quem você só digitou o nome (sem app) nem tinha o botão. Agora o botão "Remover pessoa" aparece para qualquer um, e ela some das suas listas.',
        'O histórico é preservado: os gastos e acertos passados continuam com o nome dela. E há uma trava de segurança — se ainda houver saldo em aberto, o app pede para acertar as contas antes, para nenhuma dívida ficar perdida.',
      ],
      en: [
        'You can now remove a person for good, not just disconnect. Removing used to only unlink their device and leave them on the list — and someone you only typed by name (no app) had no button at all. Now the "Remove person" button shows for anyone, and they leave your lists.',
        'History is preserved: past expenses and settlements keep their name. And there\'s a safety guard — if there\'s still an open balance, the app asks you to settle up first, so no debt gets lost.',
      ],
      es: [
        'Ahora puedes eliminar a una persona de una vez, no solo desconectarla. Antes, eliminar solo desvinculaba su dispositivo y la persona seguía en la lista — y a quien solo escribiste por nombre (sin app) ni siquiera tenía el botón. Ahora el botón "Eliminar persona" aparece para cualquiera, y desaparece de tus listas.',
        'El historial se preserva: los gastos y ajustes pasados siguen con su nombre. Y hay un seguro — si todavía hay saldo abierto, la app te pide saldar las cuentas primero, para que ninguna deuda se pierda.',
      ],
    },
  },
  {
    version: '2.0.5-rc',
    date: '2026-07-01',
    items: {
      'pt-BR': [
        'Agora dá para mover uma dívida de uma pessoa para outra. Quando quem gastou não é quem vai pagar, abra o extrato da pessoa, toque em "Mover dívida para outra pessoa", escolha para quem e quais itens passar. O valor total não muda — só troca de titular.',
        'A dívida movida mostra "veio da {nome}" no extrato de quem recebeu, e você pode desfazer com um toque. O acerto entre você e cada pessoa continua batendo certinho (o total nunca muda, só de mãos).',
      ],
      en: [
        'You can now move a debt from one person to another. When whoever spent isn\'t the one who\'ll pay, open the person\'s statement, tap "Move debt to another person", and pick who takes it and which items. The total amount never changes — only the holder does.',
        'The moved debt shows "moved from {name}" on the new holder\'s statement, and you can undo it with one tap. Your balance with each person stays exact (the total never changes, only whose it is).',
      ],
      es: [
        'Ahora puedes mover una deuda de una persona a otra. Cuando quien gastó no es quien va a pagar, abre el resumen de la persona, toca "Mover deuda a otra persona" y elige a quién pasarla y qué ítems. El total no cambia — solo cambia de titular.',
        'La deuda movida muestra "viene de {nombre}" en el resumen de quien la recibió, y puedes deshacerla con un toque. Tu saldo con cada persona sigue exacto (el total nunca cambia, solo de manos).',
      ],
    },
  },
  {
    version: '2.0.4-rc',
    date: '2026-07-01',
    items: {
      'pt-BR': [
        'O Amigo Sincero parou de ficar preso no mesmo gasto. Antes ele comentava sempre o mais recente (às vezes um cafezinho, às vezes um gasto caro de semanas atrás); agora ele escolhe o gasto que mais se destaca do seu padrão e varia de um dia para o outro, sem repetir o do dia anterior.',
        'Quando não há um plano para aquele gasto, ele prefere abrir pelo seu ritmo do dia (quanto sobra por dia) em vez de repetir "esse gasto levou X%". A escolha é estável no dia — não fica piscando.',
      ],
      en: [
        'The Honest Friend stopped fixating on the same expense. It used to always comment on the most recent one (sometimes a coffee, sometimes a big spend from weeks ago); now it picks the expense that stands out most from your pattern and varies day to day, never repeating the day before.',
        'When there is no plan for that spend, it prefers to open with your daily rhythm (how much is left per day) instead of repeating "this expense took X%". The pick is stable within a day — no flicker.',
      ],
      es: [
        'El Amigo Sincero dejó de fijarse siempre en el mismo gasto. Antes comentaba siempre el más reciente (a veces un café, a veces un gasto caro de semanas atrás); ahora elige el gasto que más se destaca de tu patrón y varía de un día a otro, sin repetir el del día anterior.',
        'Cuando no hay un plan para ese gasto, prefiere abrir con tu ritmo del día (cuánto queda por día) en lugar de repetir "este gasto se llevó X%". La elección es estable en el día — no parpadea.',
      ],
    },
  },
  {
    version: '2.0.3-rc',
    date: '2026-07-01',
    items: {
      'pt-BR': [
        'O "livre de hoje" parou de inflar quando você gasta menos que o ideal do dia: antes a sobra subia a mesada do dia seguinte; agora ela vai para o cofrinho e o número do dia fica no ideal, estável.',
        'O total livre da fase e do trecho continua exatamente o mesmo — só a leitura do dia mudou. O cofrinho segue guardando a diferença certinho.',
      ],
      en: [
        'The "free today" number stopped inflating when you spend under the day\'s ideal: it used to raise the next day\'s allowance; now the leftover goes to the cofrinho and the daily number stays at the ideal, stable.',
        'Your total free budget for the phase and trip is exactly the same — only the daily reading changed. The cofrinho keeps holding the difference precisely.',
      ],
      es: [
        'El "libre de hoy" dejó de inflarse cuando gastas menos que el ideal del día: antes subía la asignación del día siguiente; ahora el sobrante va a la alcancía y el número del día se queda en el ideal, estable.',
        'Tu presupuesto libre total de la fase y del viaje es exactamente el mismo — solo cambió la lectura diaria. La alcancía sigue guardando la diferencia con precisión.',
      ],
    },
  },
  {
    version: '2.0.2-rc',
    date: '2026-07-01',
    items: {
      'pt-BR': [
        'O import do Wise passou a acertar mais a categoria: muito mais lojas, mercados, restaurantes, transporte e marcas são reconhecidos, e saque em caixa (ATM) vira "Ajuste de caixa" e chip/telefone viram "Comunicação" — bem menos coisa cai em "Outros".',
        'Ao importar vários gastos, o app agora respeita o limite do serviço de mapas e coloca cada gasto no lugar certo do mapa sem ser bloqueado (roda em segundo plano, sem travar o import).',
      ],
      en: [
        'Wise import now guesses the category far better: many more shops, markets, restaurants, transport and brands are recognized, ATM cash-outs become "Cash adjustment" and SIM/phone charges become "Communication" — much less lands in "Other".',
        'When importing several expenses, the app now respects the map service rate limit and pins each expense to the right spot without being blocked (runs in the background, never stalls the import).',
      ],
      es: [
        'La importación de Wise ahora acierta mucho mejor la categoría: se reconocen muchas más tiendas, mercados, restaurantes, transporte y marcas, los retiros de cajero (ATM) pasan a "Ajuste de caja" y el chip/teléfono a "Comunicación" — mucho menos cae en "Otros".',
        'Al importar varios gastos, la app ahora respeta el límite del servicio de mapas y coloca cada gasto en el sitio correcto sin ser bloqueada (se ejecuta en segundo plano, nunca detiene la importación).',
      ],
    },
  },
  {
    version: '2.0.1-rc',
    date: '2026-07-01',
    items: {
      'pt-BR': [
        'Importar o mesmo extrato do Wise de novo não recria mais a transferência que você já tinha importado (a que virou uma dívida paga): ela aparece marcada como "já importada" e não é duplicada.',
        'Cada transferência agora pode ser desmarcada antes de importar — toque no círculo à esquerda para incluir ou deixar de fora, do mesmo jeito que os gastos.',
      ],
      en: [
        'Re-importing the same Wise statement no longer recreates a transfer you already imported (the one that became a paid debt): it now shows up marked as "already imported" and is never duplicated.',
        'Each transfer can now be unchecked before importing — tap the circle on the left to include it or leave it out, just like expenses.',
      ],
      es: [
        'Volver a importar el mismo extracto de Wise ya no recrea la transferencia que ya habías importado (la que se convirtió en una deuda pagada): ahora aparece marcada como "ya importada" y no se duplica.',
        'Cada transferencia se puede desmarcar antes de importar — toca el círculo de la izquierda para incluirla o dejarla fuera, igual que los gastos.',
      ],
    },
  },
  {
    version: '2.0.0-rc',
    date: '2026-07-01',
    items: {
      'pt-BR': [
        'A barra de rolagem que tinha voltado a aparecer na tela do mapa sumiu de novo — a superfície do mapa (Leaflet) agora esconde a barra como o resto do app.',
      ],
      en: [
        'The scrollbar that had reappeared on the map screen is gone again — the map surface (Leaflet) now hides the bar like the rest of the app.',
      ],
      es: [
        'La barra de desplazamiento que había vuelto a aparecer en la pantalla del mapa desapareció de nuevo — la superficie del mapa (Leaflet) ahora oculta la barra como el resto de la app.',
      ],
    },
  },
  {
    version: '1.9.9-rc',
    date: '2026-06-30',
    items: {
      'pt-BR': [
        'No celular (Android), colar imagem no campo da IA era bloqueado pelo teclado — agora é só tocar no botão de câmera/galeria ao lado: a foto da nota vira miniatura e a IA lê no enviar, igual ao colar.',
        'Dá para escolher várias fotos da galeria de uma vez; elas se acumulam como miniaturas (com X para remover) e a IA lança todos os gastos num envio só. Colar continua funcionando no computador.',
      ],
      en: [
        'On mobile (Android), pasting an image into the AI box was blocked by the keyboard — now just tap the camera/gallery button next to it: the receipt photo becomes a thumbnail and the AI reads it on send, just like paste.',
        'You can pick several photos from the gallery at once; they stack as thumbnails (with an X to remove) and the AI logs all the expenses in a single send. Pasting still works on desktop.',
      ],
      es: [
        'En el móvil (Android), pegar una imagen en el campo de la IA estaba bloqueado por el teclado — ahora basta con tocar el botón de cámara/galería al lado: la foto de la cuenta se vuelve miniatura y la IA la lee al enviar, igual que pegar.',
        'Puedes elegir varias fotos de la galería a la vez; se acumulan como miniaturas (con una X para quitarlas) y la IA registra todos los gastos en un solo envío. Pegar sigue funcionando en el ordenador.',
      ],
    },
  },
  {
    version: '1.9.8-rc',
    date: '2026-06-29',
    items: {
      'pt-BR': [
        'Corrigido o "livre do dia": um gasto pago pela reserva de um evento (por exemplo, um gasto importado do Wise e atribuído ao evento) não derruba mais o valor livre do dia — esse dinheiro já tinha saído do livre quando você reservou o evento.',
        'Só mexe no livre do dia o que passa da reserva do evento (o excedente) e os gastos do dia a dia. Quando não há evento envolvido, o número continua exatamente igual ao de antes.',
      ],
      en: [
        'Fixed the "free today" number: a spend paid by an event reserve (for example, an expense imported from Wise and attributed to the event) no longer knocks down your daily free — that money already left the free pool when you reserved the event.',
        'Only the part that overflows the event reserve, plus everyday spending, moves the daily free now. With no event involved, the number stays exactly as before.',
      ],
      es: [
        'Corregido el "libre del día": un gasto pagado por la reserva de un evento (por ejemplo, un gasto importado de Wise y atribuido al evento) ya no baja el libre diario — ese dinero ya había salido del libre cuando reservaste el evento.',
        'Solo mueve el libre del día lo que supera la reserva del evento (el excedente) y los gastos del día a día. Cuando no hay un evento involucrado, el número queda exactamente igual que antes.',
      ],
    },
  },
  {
    version: '1.9.7-rc',
    date: '2026-06-29',
    items: {
      'pt-BR': [
        'A IA agora cria eventos: diga algo como "sábado tem o show do Coldplay, separo 100 euros" e ela monta o evento já com a reserva — ou "cria um evento jantar de aniversário" para só acompanhar, sem reservar.',
        'Antes de confirmar, dá para ajustar nome, data, reserva e se o evento começa agora — tudo no mesmo cartão, num toque.',
      ],
      en: [
        'The AI now creates events: say something like "Saturday there\'s the Coldplay show, set aside 100 euros" and it builds the event with the reserve — or "create a birthday dinner event" to just track it, no reserve.',
        'Before confirming, you can adjust the name, date, reserve and whether it starts now — all in the same card, in one tap.',
      ],
      es: [
        'La IA ahora crea eventos: di algo como "el sábado está el show de Coldplay, aparto 100 euros" y arma el evento con la reserva — o "crea un evento cena de cumpleaños" para solo seguirlo, sin reservar.',
        'Antes de confirmar, puedes ajustar el nombre, la fecha, la reserva y si empieza ahora — todo en la misma tarjeta, en un toque.',
      ],
    },
  },
  {
    version: '1.9.6-rc',
    date: '2026-06-29',
    items: {
      'pt-BR': [
        'Agora você pode colar a foto da nota direto no campo da IA (Ctrl/Cmd+V ou colar no celular) — sem precisar abrir a câmera.',
        'Dá para colar várias imagens: elas ficam acumuladas como miniaturas (com X para remover) e, ao enviar, a IA lê todas e lança os gastos de uma vez.',
      ],
      en: [
        'You can now paste a receipt photo straight into the AI box (Ctrl/Cmd+V, or paste on mobile) — no need to open the camera.',
        'Paste several images at once: they stack as thumbnails (with an X to remove), and on send the AI reads them all and logs the expenses in one go.',
      ],
      es: [
        'Ahora puedes pegar la foto de la cuenta directamente en el campo de la IA (Ctrl/Cmd+V o pegar en el móvil) — sin abrir la cámara.',
        'Puedes pegar varias imágenes: se acumulan como miniaturas (con una X para quitarlas) y, al enviar, la IA las lee todas y registra los gastos de una vez.',
      ],
    },
  },
  {
    version: '1.9.5-rc',
    date: '2026-06-29',
    items: {
      'pt-BR': [
        'O mapa do gasto, ao expandir, agora fica fixo de verdade: não rola junto com a página nem aparece um retângulo por cima escondendo o botão de fechar.',
        'O cartão flutuante não fecha mais sem querer quando você rola dentro de um campo de texto ou de uma lista interna.',
      ],
      en: [
        'The expense map, when expanded, now stays truly fixed: it no longer scrolls with the page or shows a rectangle on top hiding the close button.',
        'The floating card no longer closes by accident when you scroll inside a text field or an inner list.',
      ],
      es: [
        'El mapa del gasto, al expandirse, ahora queda realmente fijo: ya no se desplaza con la página ni aparece un rectángulo encima tapando el botón de cerrar.',
        'La tarjeta flotante ya no se cierra sin querer cuando desplazas dentro de un campo de texto o de una lista interna.',
      ],
    },
  },
  {
    version: '1.9.4-rc',
    date: '2026-06-29',
    items: {
      'pt-BR': [
        'O seletor de local ganhou busca por nome: digite "Bar do Zé" e toque no lugar real — ele salva as coordenadas certas, não mais um texto solto.',
        'A busca aparece em todos os lugares onde você escolhe um local (gasto rápido, edição de gasto e a IA) e dá pra refinar pelo que está perto de você.',
      ],
      en: [
        'The place selector now has search-by-name: type "Joe\u2019s Bar" and tap the real venue — it saves the right coordinates, no more a loose string.',
        'Search shows up everywhere you pick a place (quick add, expense edit and the AI) and is biased to what is near you.',
      ],
      es: [
        'El selector de lugar ahora tiene búsqueda por nombre: escribe "Bar de Pepe" y toca el lugar real — guarda las coordenadas correctas, ya no un texto suelto.',
        'La búsqueda aparece en todos los lugares donde eliges un sitio (gasto rápido, edición de gasto y la IA) y se orienta a lo que está cerca de ti.',
      ],
    },
  },
  {
    version: '1.9.3-rc',
    date: '2026-06-29',
    items: {
      'pt-BR': [
        'A IA agora escreve uma descrição de verdade do gasto (ex.: "almoço no Bar do Zé"), tirada do que você disse — nunca mais joga a categoria ("Outros") no lugar do nome.',
        'Quando não há uma descrição clara, ela usa o nome do lugar; só cai num rótulo neutro quando não há nada — a categoria nunca vira o título.',
      ],
      en: [
        'The AI now writes a real description of the spend (e.g. "lunch at Joe\u2019s Bar"), taken from what you said — it no longer drops the category ("Other") in place of the name.',
        'When there is no clear description, it uses the place name; it only falls back to a neutral label when there is nothing — the category never becomes the title.',
      ],
      es: [
        'La IA ahora escribe una descripción real del gasto (ej.: "almuerzo en el Bar de Pepe"), tomada de lo que dijiste — ya no pone la categoría ("Otros") en lugar del nombre.',
        'Cuando no hay una descripción clara, usa el nombre del lugar; solo recurre a una etiqueta neutra cuando no hay nada — la categoría nunca se vuelve el título.',
      ],
    },
  },
  {
    version: '1.9.2-rc',
    date: '2026-06-29',
    items: {
      'pt-BR': [
        'O acerto que você compartilha agora reconcilia: os pagamentos já feitos aparecem como linhas e somam com as despesas até o saldo final — aquele pagamento que ficava "invisível" agora aparece.',
        'Cada item compartilhado mostra o local onde aconteceu, com um mini-mapa sob demanda, para quem recebe conferir.',
        'Continua privado: quem recebe vê só o que é entre vocês (despesas + pagamentos + local), nunca seus fundos, carteiras ou pote.',
      ],
      en: [
        'The settle-up you share now reconciles: payments already made show up as lines and add up with the expenses to the final balance — the payment that used to be "invisible" now appears.',
        'Each shared item shows where it happened, with an on-demand mini-map for the recipient to check.',
        'Still private: the recipient sees only what is between you (expenses + payments + place), never your funds, wallets or pool.',
      ],
      es: [
        'El ajuste que compartes ahora reconcilia: los pagos ya hechos aparecen como líneas y suman con los gastos hasta el saldo final — el pago que quedaba "invisible" ahora aparece.',
        'Cada ítem compartido muestra el lugar donde ocurrió, con un mini-mapa bajo demanda para que quien recibe lo verifique.',
        'Sigue siendo privado: quien recibe ve solo lo que hay entre ustedes (gastos + pagos + lugar), nunca tus fondos, billeteras o bolsa.',
      ],
    },
  },
  {
    version: '1.9.1-rc',
    date: '2026-06-29',
    items: {
      'pt-BR': [
        'Cada evento agora tem um guia próprio: toque no evento para abrir a tela dedicada e acompanhar tudo num só lugar.',
        'O guia mostra o ritmo factual: quanto já foi consumido, quanto sobra, quanto dá por dia e um aviso leve quando o gasto do dia pede para segurar.',
        'Todas as despesas do evento aparecem agrupadas por dia, com o lugar de cada uma e um mini-mapa sob demanda.',
        'As saídas do evento ficam listadas no guia, com a saída ao vivo embutida; editar o evento abre a folha de edição de sempre e dá para encerrar o evento ali mesmo.',
      ],
      en: [
        'Every event now has its own guide: tap an event to open the dedicated screen and follow everything in one place.',
        'The guide shows a factual rhythm: how much is consumed, how much is left, how much per day, and a light nudge when today\u2019s spending says to ease up.',
        'All event spends are grouped by day, each with its place and an on-demand mini-map.',
        'The event\u2019s outings are listed in the guide, with the live outing embedded; editing the event opens the usual edit sheet, and you can end the event right there.',
      ],
      es: [
        'Cada evento ahora tiene su propia guía: toca un evento para abrir la pantalla dedicada y seguir todo en un solo lugar.',
        'La guía muestra un ritmo factual: cuánto se consumió, cuánto queda, cuánto por día y un aviso leve cuando el gasto del día pide frenar.',
        'Todos los gastos del evento se agrupan por día, cada uno con su lugar y un mini-mapa bajo demanda.',
        'Las salidas del evento se listan en la guía, con la salida en vivo embebida; editar el evento abre la hoja de edición de siempre y puedes finalizar el evento ahí mismo.',
      ],
    },
  },
  {
    version: '1.9.0-rc',
    date: '2026-06-29',
    items: {
      'pt-BR': [
        'Eventos agora têm vida própria: toque em "Iniciar evento" e ele fica ao vivo até você "Encerrar evento" — não some mais sozinho ao fechar uma saída.',
        'Um evento pode ter várias saídas ao longo do tempo. Encerrar ou descartar uma saída não apaga nem encerra o evento.',
        'No card do evento ao vivo: o botão principal registra um gasto direto do evento; "Iniciar saída" abre o modo foco; e a saída em andamento aparece embutida ali mesmo (sem um segundo card).',
        'O número grande do evento mostra o que já foi consumido — somando todas as saídas e os gastos diretos uma única vez, sem contar em dobro.',
      ],
      en: [
        'Events now have their own life: tap "Start event" and it stays live until you "End event" — it no longer disappears when you close an outing.',
        'An event can hold several outings over time. Ending or discarding an outing never deletes or ends the event.',
        "On the live-event card: the primary button logs a direct event expense; \"Start outing\" opens focus mode; and a running outing shows embedded right there (no second card).",
        'The event\u2019s big number shows what\u2019s been consumed — summing every outing and direct expense exactly once, never double counted.',
      ],
      es: [
        'Los eventos ahora tienen vida propia: toca "Iniciar evento" y queda en vivo hasta que "Finalizas el evento" — ya no desaparece al cerrar una salida.',
        'Un evento puede tener varias salidas a lo largo del tiempo. Finalizar o descartar una salida nunca borra ni finaliza el evento.',
        'En la tarjeta del evento en vivo: el botón principal registra un gasto directo del evento; "Iniciar salida" abre el modo enfoque; y la salida en curso aparece embebida ahí mismo (sin una segunda tarjeta).',
        'El número grande del evento muestra lo consumido — sumando cada salida y gasto directo una sola vez, sin contar doble.',
      ],
    },
  },
  {
    version: '1.8.7-rc',
    date: '2026-06-28',
    items: {
      'pt-BR': [
        'Compartilhar a dívida de uma pessoa por link agora mostra só o que é entre vocês dois — antes podia somar o que outras pessoas deviam.',
        'O que outras pessoas registradas devem ou recebem aparece num menu separado, deixado claro que não entra no acerto de vocês.',
      ],
      en: [
        "Sharing a person's debt by link now shows only what's between the two of you — it used to add in what other people owed.",
        'What other recorded people owe or are owed shows in a separate menu, clearly outside your settle-up.',
      ],
      es: [
        'Compartir la deuda de una persona por enlace ahora muestra solo lo que hay entre ustedes dos — antes podía sumar lo que otras personas debían.',
        'Lo que otras personas registradas deben o reciben aparece en un menú aparte, dejando claro que no entra en su ajuste.',
      ],
    },
  },
  {
    version: '1.8.6-rc',
    date: '2026-06-28',
    items: {
      'pt-BR': [
        'O mapa do gasto agora fica fixo: rolar a página passando por cima dele não trava mais a rolagem.',
        'Toque no mapa pra abrir em tela cheia — aí sim dá pra mover e dar zoom à vontade; fechar volta ao normal.',
      ],
      en: [
        "The expense map is now static: scrolling the page over it no longer traps the scroll.",
        'Tap the map to open it full-screen — there you can pan and zoom freely; closing returns to the preview.',
      ],
      es: [
        'El mapa del gasto ahora queda fijo: desplazar la página por encima ya no atrapa el scroll.',
        'Toca el mapa para abrirlo en pantalla completa — ahí sí puedes mover y hacer zoom libremente; al cerrar vuelve al preview.',
      ],
    },
  },
  {
    version: '1.8.5-rc',
    date: '2026-06-28',
    items: {
      'pt-BR': [
        'Quando você registra gastos pela IA (texto, voz ou foto), agora dá pra definir o fundo, o evento e a carteira de cada um — antes vinham "crus", sem essas informações.',
        'Num lote de vários gastos da IA, cada item pode ser ajustado ali mesmo ou aberto na tela de gasto completa, já preenchido (inclusive com o evento que ele entra).',
        'O confirmar de um toque continua igual — pra quando você só quer registrar tudo sem mexer em nada.',
      ],
      en: [
        "When you log expenses via the AI (text, voice or photo), you can now set each one's fund, event and wallet — before they came in \"raw\", without those.",
        'In a batch of several AI expenses, each item can be tweaked right there or opened in the full expense screen pre-filled (including the event it belongs to).',
        "The one-tap confirm still works exactly as before — for when you just want to log everything without touching anything.",
      ],
      es: [
        'Cuando registras gastos con la IA (texto, voz o foto), ahora puedes definir el fondo, el evento y la billetera de cada uno — antes venían "crudos", sin eso.',
        'En un lote de varios gastos de la IA, cada ítem se puede ajustar ahí mismo o abrir en la pantalla de gasto completa, ya rellenado (incluido el evento al que entra).',
        'El confirmar de un toque sigue igual — para cuando solo quieres registrar todo sin tocar nada.',
      ],
    },
  },
  {
    version: '1.8.4-rc',
    date: '2026-06-28',
    items: {
      'pt-BR': [
        'Ao importar do Wise, cada gasto agora tenta achar o lugar sozinho pelo nome do estabelecimento — assim ele aparece no mapa sem você marcar um por um.',
        'É opcional (só com a localização ligada), roda em segundo plano e nunca trava a importação; se não achar, a linha fica sem local — nunca crava um gasto antigo no lugar onde você está agora.',
        'O copiloto ficou mais honesto: "hora de pico" e "dia da semana" não tiram conclusão de uma única compra grande nem de pouquíssimos dias — com dado fino demais, o insight some em vez de inventar um padrão.',
      ],
      en: [
        'When importing from Wise, each expense now tries to find its place on its own from the merchant name — so it shows on the map without you tagging one by one.',
        "It's optional (only with location on), runs in the background and never blocks the import; if it can't find it, the row just stays unlocated — it never pins an old expense at wherever you are now.",
        'The copilot got more honest: "peak hour" and "day of week" no longer conclude from a single big purchase or from too few days — when the data is too thin, the insight hides instead of inventing a pattern.',
      ],
      es: [
        'Al importar de Wise, cada gasto ahora intenta encontrar su lugar solo por el nombre del comercio — así aparece en el mapa sin marcarlos uno por uno.',
        'Es opcional (solo con la ubicación activada), corre en segundo plano y nunca bloquea la importación; si no lo encuentra, la fila queda sin ubicación — nunca clava un gasto viejo donde estás ahora.',
        'El copiloto se volvió más honesto: "hora pico" y "día de la semana" ya no concluyen de una sola compra grande ni de muy pocos días — con datos demasiado escasos, el insight desaparece en vez de inventar un patrón.',
      ],
    },
  },
  {
    version: '1.8.3-rc',
    date: '2026-06-28',
    items: {
      'pt-BR': [
        'Em "Pessoas", o saldo de cada um agora é fiel ao que há entre você e ela — acabou o número roteado por terceiros ("fulano recebe X" sem ter nada a ver com você).',
        'Abrir uma pessoa mostra só os gastos e acertos entre vocês dois; uma cobrança que ela tem com um terceiro (e que você só registrou) não aparece mais no perfil dela.',
        'As "cobranças entre outros" desceram para um registro à parte, recolhido — continuam guardadas, sem sumir. Seu total a receber/pagar não muda.',
      ],
      en: [
        'In "People", each balance is now faithful to what is between you and them — no more a number routed through a third party ("so-and-so receives X" with nothing to do with you).',
        "Opening a person shows only the expenses and settlements between the two of you; a debt they have with a third party (that you merely recorded) no longer shows in their profile.",
        '"Charges between others" moved to a separate, collapsed registry — still kept, never gone. Your total to receive/pay is unchanged.',
      ],
      es: [
        'En "Personas", el saldo de cada uno ahora es fiel a lo que hay entre tú y esa persona — se acabó el número ruteado por terceros ("fulano recibe X" sin tener nada que ver contigo).',
        'Abrir una persona muestra solo los gastos y arreglos entre ustedes dos; una deuda que tiene con un tercero (y que solo registraste) ya no aparece en su perfil.',
        'Los "cobros entre otros" bajaron a un registro aparte, plegado — siguen guardados, sin desaparecer. Tu total a recibir/pagar no cambia.',
      ],
    },
  },
  {
    version: '1.8.2-rc',
    date: '2026-06-28',
    items: {
      'pt-BR': [
        'O cofrinho agora segue o ritmo da viagem: ele guarda contra o ideal real de cada dia — maior nos dias de pico, menor nos dias calmos — em vez de um valor fixo igual pra todos os dias.',
        'O saldo do fim continua o mesmo; muda só o ritmo de quanto entra a cada dia, então o que você economiza (ou cobre) reflete o dia de verdade.',
      ],
      en: [
        "The piggy bank now follows your trip's rhythm: it saves against each day's real ideal — bigger on peak days, smaller on calm days — instead of one flat amount for every day.",
        'The final balance stays the same; only the pace of what goes in each day changes, so what you save (or cover) reflects the real day.',
      ],
      es: [
        'La alcancía ahora sigue el ritmo del viaje: guarda contra el ideal real de cada día — mayor en los días pico, menor en los días tranquilos — en vez de un valor fijo igual para todos los días.',
        'El saldo final sigue siendo el mismo; solo cambia el ritmo de cuánto entra cada día, así lo que ahorras (o cubres) refleja el día de verdad.',
      ],
    },
  },
  {
    version: '1.8.1-rc',
    date: '2026-06-28',
    items: {
      'pt-BR': [
        'O "livre do dia" conta a verdade: a "média até o fim da fase" agora é uma média de verdade (livre ÷ dias), e o ritmo de pico aparece à parte, como "ritmo de hoje" — sem mais um número de pico rotulado como "média".',
        'O evento de hoje aparece junto do livre na tela inicial ("+ X do evento hoje"), e o detalhe do dia mostra a base de um dia comum + o extra do dia de pico + o que está reservado.',
        'No detalhe do dia, a reserva de um evento mostra só o que ainda sobra dela, dividido pelos dias que faltam — e recalcula sozinho conforme você gasta.',
      ],
      en: [
        'The "free for today" tells the truth: the "average until the phase ends" is now a real average (free ÷ days), and the peak pace shows separately as "today\'s rhythm" — no more a peak number mislabeled as an "average".',
        'Today\'s event shows up next to your free amount on the home screen ("+ X from today\'s event"), and the day detail breaks it down as a regular day\'s base + the peak-day extra + what\'s reserved.',
        "In the day detail, an event's reserve now shows only what is still left of it, split over the remaining days — and recomputes on its own as you spend.",
      ],
      es: [
        'El "libre del día" cuenta la verdad: el "promedio hasta el fin de la fase" ahora es un promedio de verdad (libre ÷ días), y el ritmo pico aparece aparte, como "ritmo de hoy" — ya no un número pico rotulado como "promedio".',
        'El evento de hoy aparece junto a tu libre en la pantalla de inicio ("+ X del evento de hoy"), y el detalle del día lo desglosa como base de un día normal + el extra del día pico + lo reservado.',
        'En el detalle del día, la reserva de un evento ahora muestra solo lo que aún queda de ella, repartido entre los días restantes — y se recalcula sola a medida que gastas.',
      ],
    },
  },
  {
    version: '1.8.0-rc',
    date: '2026-06-28',
    items: {
      'pt-BR': [
        'O evento que está acontecendo agora continua à vista na tela inicial — antes ele sumia quando você abria a saída. Você vê quanto já gastou (com o quê e quando), quanto ainda sobra, quanto dá por dia e quantos dias faltam.',
        'O bloco do evento e o card da saída convivem sem contar o gasto duas vezes: gastos manuais e da saída entram no mesmo progresso.',
      ],
      en: [
        "The event that's happening now stays in view on the home screen — it used to disappear once you opened the outing. You see how much you've spent (on what and when), how much is left, how much per day, and how many days remain.",
        'The event block and the outing card live together without double-counting: both manual and outing spends feed the same progress.',
      ],
      es: [
        'El evento que está en curso ahora sigue a la vista en la pantalla de inicio — antes desaparecía al abrir la salida. Ves cuánto gastaste (en qué y cuándo), cuánto queda, cuánto por día y cuántos días faltan.',
        'El bloque del evento y la tarjeta de la salida conviven sin contar el gasto dos veces: tanto los gastos manuales como los de la salida alimentan el mismo progreso.',
      ],
    },
  },
  {
    version: '1.7.5-rc',
    date: '2026-06-27',
    items: {
      'pt-BR': [
        'No acerto de contas, agora aparece só o que é seu: quem te deve e quem você deve. Dívidas entre outras pessoas (que você só registrou) saíram da sua lista principal.',
        "Essas cobranças entre outros não somem — ficam guardadas num menu separado “Cobranças entre outros (que registrei)”, sem entrar no seu saldo.",
      ],
      en: [
        "Settle-up now shows only what's yours: who owes you and who you owe. Debts between other people (that you just recorded) are out of your main list.",
        "Those charges between others don't disappear — they're kept in a separate “Charges I recorded between others” menu, without counting toward your balance.",
      ],
      es: [
        'El ajuste de cuentas ahora muestra solo lo tuyo: quién te debe y a quién le debes. Las deudas entre otras personas (que solo registraste) salieron de tu lista principal.',
        'Esos cobros entre otros no desaparecen — quedan en un menú aparte “Cobros entre otros (que registré)”, sin contar en tu saldo.',
      ],
    },
  },
  {
    version: '1.7.4-rc',
    date: '2026-06-27',
    items: {
      'pt-BR': [
        'Quando você (ou a IA) dá o nome do lugar de um gasto, o app agora procura o local exato desse nome e coloca o gasto no mapa ali — buscando perto de onde você está.',
        'Se não encontrar o local pelo nome, o gasto é salvo com a localização de onde você estava, então ele nunca fica sem lugar no mapa.',
      ],
      en: [
        'When you (or the AI) name the place of a spend, the app now looks up that exact name and pins the spend on the map there — searching near where you are.',
        "If it can't find the place by name, the spend is saved with where you were, so it never ends up with no spot on the map.",
      ],
      es: [
        'Cuando tú (o la IA) das el nombre del lugar de un gasto, la app ahora busca ese lugar exacto y coloca el gasto en el mapa allí — buscando cerca de dónde estás.',
        'Si no encuentra el lugar por el nombre, el gasto se guarda con dónde estabas, así nunca se queda sin sitio en el mapa.',
      ],
    },
  },
  {
    version: '1.7.3-rc',
    date: '2026-06-27',
    items: {
      'pt-BR': [
        'Quando um evento termina e ainda sobra dinheiro reservado, o app pergunta uma vez para onde a sobra vai: de volta para o seu "livre", guardada num cofrinho rotulado, ou para um pote separado.',
        'A escolha conserva o valor exato e nunca é automática — enquanto você não decidir, a sobra fica pendente e o app volta a perguntar.',
      ],
      en: [
        'When an event ends with reserve money still unspent, the app asks once where the leftover goes: back to your "free to spend", kept in a labeled piggy bank, or into a separate pot.',
        'The choice keeps the exact amount and is never automatic — until you decide, the leftover stays pending and the app asks again.',
      ],
      es: [
        'Cuando un evento termina y aún sobra dinero reservado, la app pregunta una vez a dónde va el sobrante: de vuelta a tu "libre", guardado en una alcancía etiquetada, o a un bote separado.',
        'La elección conserva el importe exacto y nunca es automática — hasta que decidas, el sobrante queda pendiente y la app vuelve a preguntar.',
      ],
    },
  },
  {
    version: '1.7.2-rc',
    date: '2026-06-27',
    items: {
      'pt-BR': [
        'Ao importar do Wise, agora dá para marcar quais transações fazem parte de um evento: quando há um evento no dia da transação, ela aparece com a opção logo abaixo — um toque atribui, e o gasto passa a consumir a reserva daquele evento.',
        'A atribuição é por transação e só aparece nas que você escolheu importar, então você decide exatamente o que entra em cada evento.',
      ],
      en: [
        'When importing from Wise you can now mark which transactions are part of an event: if an event covers the transaction\'s day, the option shows right below it — one tap attributes it, and the spend starts consuming that event\'s reserve.',
        'Attribution is per transaction and only appears on the ones you chose to import, so you decide exactly what goes into each event.',
      ],
      es: [
        'Al importar desde Wise ahora puedes marcar qué transacciones forman parte de un evento: si hay un evento en el día de la transacción, la opción aparece justo debajo — un toque la atribuye y el gasto pasa a consumir la reserva de ese evento.',
        'La atribución es por transacción y solo aparece en las que elegiste importar, así decides exactamente qué entra en cada evento.',
      ],
    },
  },
  {
    version: '1.7.1-rc',
    date: '2026-06-27',
    items: {
      'pt-BR': [
        'A reserva de um evento agora é consumida pelo gasto: quando o evento começa, ela não volta mais inteira para o "livre" — o seu "livre hoje" parou de pular e o valor do evento não conta mais em dobro.',
        'O card do evento no dia mostra quanto ainda resta da reserva e quanto dá para gastar por dia ali, ajustando sozinho conforme você gasta.',
      ],
      en: [
        'An event\'s reserve is now consumed by your spending: when the event starts it no longer snaps back in full to your "free to spend" — your "free today" stopped jumping and the event no longer counts twice.',
        "The day's event card shows how much of the reserve is still left and how much you can spend per day there, adjusting itself as you spend.",
      ],
      es: [
        'La reserva de un evento ahora se consume con el gasto: cuando el evento empieza ya no vuelve entera a tu "libre" — tu "libre hoy" dejó de saltar y el evento ya no cuenta doble.',
        'La tarjeta del evento del día muestra cuánto queda de la reserva y cuánto puedes gastar por día allí, ajustándose sola a medida que gastas.',
      ],
    },
  },
  {
    version: '1.7.0-rc',
    date: '2026-06-27',
    items: {
      'pt-BR': [
        'Agora dá para marcar um gasto como parte de um evento: quando há um evento acontecendo no dia, o app pergunta e já sugere o evento — você confirma com um toque, na entrada manual ou pela IA.',
        'Se você apagar um evento, os gastos que tinham sido marcados como dele continuam salvos (só o vínculo com o evento é removido).',
      ],
      en: [
        "You can now mark a spend as part of an event: when an event is happening that day, the app asks and pre-suggests it — confirm with one tap, in manual or AI entry.",
        'If you delete an event, the spends you had marked as belonging to it stay saved (only the link to the event is removed).',
      ],
      es: [
        'Ahora puedes marcar un gasto como parte de un evento: cuando hay un evento ese día, la app pregunta y ya sugiere el evento — lo confirmas con un toque, en la entrada manual o por IA.',
        'Si borras un evento, los gastos que habías marcado como suyos siguen guardados (solo se elimina el vínculo con el evento).',
      ],
    },
  },
  {
    version: '1.6.4-rc',
    date: '2026-06-27',
    items: {
      'pt-BR': [
        'No Android, o leitor de QR agora prefere a câmera traseira principal em vez da grande-angular — fica mais fácil ler o código para conectar com um amigo.',
      ],
      en: [
        'On Android, the QR scanner now prefers the main rear camera over the ultra-wide — making it easier to read the code to connect with a friend.',
      ],
      es: [
        'En Android, el lector de QR ahora prefiere la cámara trasera principal en lugar de la gran angular — facilita leer el código para conectar con un amigo.',
      ],
    },
  },
  {
    version: '1.6.3-rc',
    date: '2026-06-27',
    items: {
      'pt-BR': [
        'Os avisos no topo da home não deixam mais um espaço vazio embaixo dos cards mais curtos.',
        'Tiramos o card de "instalar" repetido — agora só aparece um convite de instalação por vez.',
        'O convite para instalar o app agora só tira uma soneca quando você fecha (volta depois), em vez de sumir para sempre.',
        'Quando uma tela pede o modo completo, "ir para os ajustes" já te leva direto ao botão de App simples/completo e o destaca.',
      ],
      en: [
        'The home alerts no longer leave an empty gap under the shorter cards.',
        'Removed the duplicate "install" card — you now see a single install invite at a time.',
        'Closing the install invite now just snoozes it (it comes back later) instead of hiding it forever.',
        'When a screen needs the full mode, "go to settings" now takes you straight to the simple/complete switch and highlights it.',
      ],
      es: [
        'Los avisos del inicio ya no dejan un espacio vacío debajo de las tarjetas más cortas.',
        'Quitamos la tarjeta de "instalar" repetida — ahora ves una sola invitación de instalación a la vez.',
        'Cerrar la invitación de instalar ahora solo la pospone (vuelve más tarde) en lugar de ocultarla para siempre.',
        'Cuando una pantalla necesita el modo completo, "ir a ajustes" te lleva directo al botón de App simple/completa y lo resalta.',
      ],
    },
  },
  {
    version: '1.6.2-rc',
    date: '2026-06-27',
    items: {
      'pt-BR': [
        'Ao marcar um gasto como compartilhado, o app não seleciona mais todo mundo de uma vez — você escolhe quem realmente participou (bem melhor com grupos grandes).',
        'Um ponto verde agora mostra quem está conectado nas listas de pessoas, pra você saber de relance quem uma cobrança alcança de verdade.',
      ],
      en: [
        'When you mark an expense as shared, the app no longer selects everyone at once — you choose who actually took part (much better with big groups).',
        'A green dot now shows who is connected in the people pickers, so you can tell at a glance who a charge actually reaches.',
      ],
      es: [
        'Al marcar un gasto como compartido, la app ya no selecciona a todos de una vez — eliges quién participó de verdad (mucho mejor con grupos grandes).',
        'Un punto verde ahora muestra quién está conectado en las listas de personas, para que sepas de un vistazo a quién llega realmente un cobro.',
      ],
    },
  },
  {
    version: '1.6.1-rc',
    date: '2026-06-27',
    items: {
      'pt-BR': [
        'Dividir um gasto que você registrou com alguém conectado agora envia a cobrança automaticamente — igual ao “Dividir conta”. Não precisa mais cobrar à mão depois.',
        'Enquanto a pessoa não aceita, você vê “Aguardando aceite” em vez de “em dia”, então o acerto sempre conta a verdade.',
      ],
      en: [
        'Splitting an expense you logged with a connected person now delivers the charge automatically — just like “Split the bill”. No more charging by hand afterwards.',
        'Until they accept, you see “Awaiting acceptance” instead of “all settled”, so the settle-up always tells the truth.',
      ],
      es: [
        'Dividir un gasto que registraste con alguien conectado ahora envía el cobro automáticamente — igual que “Dividir la cuenta”. Ya no hace falta cobrar a mano después.',
        'Hasta que la persona acepte, ves “Esperando aceptación” en vez de “al día”, así el ajuste de cuentas siempre dice la verdad.',
      ],
    },
  },
  {
    version: '1.6.0-rc',
    date: '2026-06-27',
    items: {
      'pt-BR': [
        'Conexão nos dois aparelhos: quando alguém conecta com você, essa pessoa já aparece pronta para cobrar ou dividir — sem refazer o QR. É só tocar nela no Acerto.',
        'Mensagem honesta no envio: quando uma cobrança ou pagamento não chega, o app agora diz o motivo de verdade (sem internet, erro do servidor ou falta conectar) — nunca mais “sem internet” quando você está online — e oferece “tentar de novo” quando faz sentido.',
      ],
      en: [
        'Connection on both phones: when someone connects with you, that person now shows up ready to charge or split — no need to redo the QR. Just tap them in the settle-up.',
        'Honest send status: when a charge or payment doesn’t go through, the app now tells the real reason (offline, server error or not connected yet) — never again “no internet” while you’re online — and offers “try again” when it makes sense.',
      ],
      es: [
        'Conexión en los dos dispositivos: cuando alguien conecta contigo, esa persona ya aparece lista para cobrar o dividir — sin rehacer el QR. Solo tócala en el ajuste de cuentas.',
        'Mensaje honesto al enviar: cuando un cobro o pago no llega, la app ahora dice el motivo real (sin internet, error del servidor o falta conectar) — nunca más “sin internet” cuando estás en línea — y ofrece “reintentar” cuando tiene sentido.',
      ],
    },
  },
  {
    version: '1.5.6-rc',
    date: '2026-06-27',
    items: {
      'pt-BR': [
        'Sincronização entre aparelhos mais leve e estável: o transporte em tempo real agora hiberna quando está ocioso, consumindo muito menos recursos.',
        'O app ganhou um sinal de saúde da conexão, para nunca mais dizer “sem internet” quando você está online — quando algo falha, a mensagem passa a ser honesta.',
      ],
      en: [
        'Lighter, steadier sync between devices: the real-time transport now hibernates while idle, using far fewer resources.',
        'The app gained a connection health signal, so it never again says “no internet” while you’re online — when something fails, the message is now honest.',
      ],
      es: [
        'Sincronización entre dispositivos más ligera y estable: el transporte en tiempo real ahora hiberna cuando está inactivo, consumiendo muchos menos recursos.',
        'La app ahora tiene una señal de salud de la conexión, para no volver a decir “sin internet” cuando estás en línea — cuando algo falla, el mensaje es honesto.',
      ],
    },
  },
  {
    version: '1.5.5-rc',
    date: '2026-06-27',
    items: {
      'pt-BR': [
        'Ajustes finos de visual nas telas de detalhe (gasto, lista e impacto): os botões de excluir e os avisos passaram a usar a cor de alerta padrão do app, com contraste melhor, e o valor do gasto no detalhe ganhou um pouco mais de destaque.',
      ],
      en: [
        'Visual refinements on the detail screens (expense, list and impact): delete buttons and alerts now use the app’s standard alert color with better contrast, and the expense amount in the detail is a bit more prominent.',
      ],
      es: [
        'Ajustes finos de diseño en las pantallas de detalle (gasto, lista e impacto): los botones de eliminar y los avisos ahora usan el color de alerta estándar de la app, con mejor contraste, y el importe del gasto en el detalle resalta un poco más.',
      ],
    },
  },
  {
    version: '1.5.4-rc',
    date: '2026-06-27',
    items: {
      'pt-BR': [
        'Agora você pode remover uma pessoa conectada. As divisões e pagamentos antigos continuam no seu histórico — nada é apagado — e você pode conectar de novo quando quiser.',
        'Nas conexões, no QR e nos envios, agora aparece o seu nome (o que você colocou no início) em vez do rótulo técnico do aparelho.',
      ],
      en: [
        'You can now remove a connected person. Past splits and payments stay in your history — nothing is deleted — and you can connect again anytime.',
        'In connections, the QR code and shared items, your name (the one you set at the start) now shows instead of the technical device label.',
      ],
      es: [
        'Ahora puedes quitar a una persona conectada. Las divisiones y pagos anteriores siguen en tu historial — no se borra nada — y puedes conectar de nuevo cuando quieras.',
        'En las conexiones, el QR y los envíos, ahora aparece tu nombre (el que pusiste al inicio) en lugar de la etiqueta técnica del dispositivo.',
      ],
    },
  },
  {
    version: '1.5.3-rc',
    date: '2026-06-27',
    items: {
      'pt-BR': [
        'Cada gasto agora guarda o ponto no mapa quando você salva — mesmo sem abrir os detalhes — e sem atrasar o registro (o local é capturado em segundo plano).',
        'O detalhe do gasto mostra um mapa interativo do lugar. Quando o app adivinha o nome do local, ele aparece como "provavelmente …" e marcado como não confirmado.',
      ],
      en: [
        'Every expense now saves its point on the map when you save — even without opening the details — without slowing the entry down (the location is captured in the background).',
        'The expense detail shows an interactive map of the place. When the app guesses the place name, it appears as "probably …" and flagged as unconfirmed.',
      ],
      es: [
        'Cada gasto ahora guarda su punto en el mapa cuando lo guardas — incluso sin abrir los detalles — sin ralentizar el registro (la ubicación se captura en segundo plano).',
        'El detalle del gasto muestra un mapa interactivo del lugar. Cuando la app adivina el nombre del lugar, aparece como "probablemente …" y marcado como no confirmado.',
      ],
    },
  },
  {
    version: '1.5.2-rc',
    date: '2026-06-27',
    items: {
      'pt-BR': [
        'O leitor de QR do app agora entende qualquer QR do TripPilot — conexão, extrato, divisão em grupo, link compartilhado — e abre a tela certa na hora. Antes, ele só servia para conectar pessoas.',
        'Todo QR que o app mostra é um link: a câmera comum do celular abre direto, sem aquele "nenhum dado usável".',
      ],
      en: [
        'The app’s QR reader now understands any TripPilot QR — connect, statement, group split, shared link — and opens the right screen instantly. Before, it only worked for connecting people.',
        'Every QR the app shows is a link, so your phone’s default camera opens it directly — no more "no usable data".',
      ],
      es: [
        'El lector de QR de la app ahora entiende cualquier QR de TripPilot — conexión, extracto, división en grupo, enlace compartido — y abre la pantalla correcta al instante. Antes solo servía para conectar personas.',
        'Cada QR que muestra la app es un enlace, así que la cámara normal del teléfono lo abre directamente — sin el "no hay datos utilizables".',
      ],
    },
  },
  {
    version: '1.5.1-rc',
    date: '2026-06-27',
    items: {
      'pt-BR': [
        'Pendências de acerto agora abrem uma tela de detalhe: toque em uma cobrança ou pagamento recebido para ver de quem é, o valor, a data e o status — e aja ali mesmo (aceitar a divisão, confirmar recebimento ou recusar).',
        'Os botões ficaram mais claros: "Aceitar a divisão" e "Confirmar recebimento" agora são ações distintas. A pendência também aparece no perfil da pessoa.',
      ],
      en: [
        'Settle-up pending items now open a detail screen: tap a charge or a received payment to see who it’s from, the amount, the date and the status — and act right there (accept the split, confirm receipt or decline).',
        'Clearer buttons: "Accept the split" and "Confirm receipt" are now distinct actions. The pending item also shows in the person’s profile.',
      ],
      es: [
        'Los pendientes de ajuste ahora abren una pantalla de detalle: toca un cobro o un pago recibido para ver de quién es, el importe, la fecha y el estado — y actúa ahí mismo (aceptar la división, confirmar recepción o rechazar).',
        'Botones más claros: "Aceptar la división" y "Confirmar recepción" ahora son acciones distintas. El pendiente también aparece en el perfil de la persona.',
      ],
    },
  },
  {
    version: '1.5.0-rc',
    date: '2026-06-27',
    items: {
      'pt-BR': [
        'Acerto com quem usa o app ficou direto: ao cobrar o saldo de uma pessoa conectada, a cobrança chega na hora no celular dela — com aviso, na tela inicial e no Acerto de contas — para aceitar com um toque. Não precisa mais mandar link.',
        'Para quem ainda não usa o app, continua o envio por link/QR. O resumo informativo virou opcional, fora do caminho principal.',
      ],
      en: [
        'Settling up with people on the app is now direct: when you charge a connected person’s balance, it arrives instantly on their phone — with a notification, on the home screen and in Settle up — to accept in one tap. No more sending a link.',
        'For people not on the app yet, link/QR sharing still works. The informative summary is now optional, off the main path.',
      ],
      es: [
        'Saldar con quien usa la app ahora es directo: al cobrar el saldo de una persona conectada, le llega al instante a su teléfono — con aviso, en la pantalla de inicio y en Ajuste de cuentas — para aceptar con un toque. Ya no hace falta enviar un enlace.',
        'Para quienes aún no usan la app, sigue el envío por enlace/QR. El resumen informativo ahora es opcional, fuera del camino principal.',
      ],
    },
  },
  {
    version: '1.4.16-rc',
    date: '2026-06-27',
    items: {
      'pt-BR': [
        'Textos mais claros no app: trocamos termos técnicos como "caixa postal" e "Recebidos de outros aparelhos" por linguagem do dia a dia.',
        'O explicador "Como funciona a divisão" saiu da tela de Acerto de contas — ele continua nas telas onde você realmente lança uma divisão.',
      ],
      en: [
        'Clearer wording across the app: we replaced technical terms like "mailbox" and "Received from other devices" with everyday language.',
        'The "How splitting works" explainer was removed from the settle-up screen — it stays on the screens where you actually create a split.',
      ],
      es: [
        'Textos más claros en la app: reemplazamos términos técnicos como "buzón" y "Recibidos de otros dispositivos" por lenguaje cotidiano.',
        'El explicador "Cómo funciona la división" salió de la pantalla de ajuste de cuentas — sigue en las pantallas donde realmente creas una división.',
      ],
    },
  },
  {
    version: '1.4.15-rc',
    date: '2026-06-27',
    items: {
      'pt-BR': [
        'Privacidade do microfone: depois de usar a voz na Entrada por IA, o microfone é liberado na hora — antes, no iPhone, o indicador podia ficar aceso como se ainda estivesse gravando.',
        'A tela mostra claramente os estados da voz (ouvindo… / processando…), e fechar ou cancelar libera o microfone imediatamente.',
      ],
      en: [
        'Microphone privacy: after using voice in AI Quick Entry, the mic is released right away — before, on iPhone, the indicator could stay lit as if it were still recording.',
        'The screen now clearly shows the voice states (listening… / processing…), and closing or cancelling frees the microphone immediately.',
      ],
      es: [
        'Privacidad del micrófono: después de usar la voz en la Entrada por IA, el micrófono se libera al instante — antes, en iPhone, el indicador podía quedar encendido como si siguiera grabando.',
        'La pantalla ahora muestra claramente los estados de la voz (escuchando… / procesando…), y cerrar o cancelar libera el micrófono de inmediato.',
      ],
    },
  },
  {
    version: '1.4.14-rc',
    date: '2026-06-27',
    items: {
      'pt-BR': [
        'Instalar ficou mais claro e sem becos sem saída: o aviso de instalar agora abre as opções de verdade (antes ele sumia sem levar a lugar nenhum).',
        'A comparação mostra só o que faz sentido pro seu aparelho — no iPhone não aparece mais a coluna de APK, que o iPhone não consegue instalar.',
        'No Android sempre dá pra colocar o atalho na tela inicial, mesmo quando o navegador não abre o instalador automático — o que importa é ter o TripPilot instalado.',
      ],
      en: [
        'Installing is clearer with no dead ends: the install banner now actually opens the options (before it just disappeared and led nowhere).',
        'The comparison shows only what makes sense for your device — on iPhone the APK column is gone, since an iPhone can’t install an APK.',
        'On Android you can always add the home-screen shortcut, even when the browser won’t open the automatic installer — what matters is having TripPilot installed.',
      ],
      es: [
        'Instalar es más claro y sin callejones sin salida: el aviso de instalar ahora abre las opciones de verdad (antes desaparecía sin llevar a ningún lado).',
        'La comparación muestra solo lo que tiene sentido para tu dispositivo — en iPhone ya no aparece la columna de APK, que el iPhone no puede instalar.',
        'En Android siempre puedes añadir el acceso directo a la pantalla de inicio, incluso cuando el navegador no abre el instalador automático — lo que importa es tener TripPilot instalado.',
      ],
    },
  },
  {
    version: '1.4.13-rc',
    date: '2026-06-27',
    items: {
      'pt-BR': [
        'Base para deixar divisões e cobranças entre pessoas mais claras e confiáveis: mapeamos todos os fluxos de acerto e os estados de cada divisão/cobrança/pagamento. As melhorias visíveis chegam nas próximas versões.',
      ],
      en: [
        'Groundwork to make person-to-person splits and charges clearer and more reliable: we mapped every settle flow and the states of each split/charge/payment. The visible improvements land in the next versions.',
      ],
      es: [
        'Base para que las divisiones y cobros entre personas sean más claros y confiables: mapeamos todos los flujos de ajuste y los estados de cada división/cobro/pago. Las mejoras visibles llegan en las próximas versiones.',
      ],
    },
  },
  {
    version: '1.4.12-rc',
    date: '2026-06-26',
    items: {
      'pt-BR': [
        'Comprovante de pagamento: ao dizer "paguei" — numa divisão de grupo ou num pagamento direto entre pessoas — você pode anexar uma foto do comprovante (opcional). Quem recebe vê a miniatura e confirma com mais segurança. Continua tudo ponta a ponta: só a imagem que você escolher anexar viaja, sem expor dados bancários.',
      ],
      en: [
        'Payment proof: when you say "I paid" — in a group split or a direct person-to-person payment — you can attach a photo of the receipt (optional). The person receiving sees the thumbnail and confirms with more confidence. Still end-to-end: only the image you choose to attach travels, with no bank details exposed.',
      ],
      es: [
        'Comprobante de pago: al decir "pagué" — en una división de grupo o en un pago directo entre personas — puedes adjuntar una foto del comprobante (opcional). Quien recibe ve la miniatura y confirma con más seguridad. Sigue siendo de extremo a extremo: solo viaja la imagen que elijas adjuntar, sin exponer datos bancarios.',
      ],
    },
  },
  {
    version: '1.4.11-rc',
    date: '2026-06-26',
    items: {
      'pt-BR': [
        'Instalar o TripPilot ficou simples: uma tela única (em Ajustes ou no link /install) compara App (APK) × Atalho (PWA) × Navegador e instala do jeito certo pro seu aparelho — APK no Android, atalho pelo navegador, e o passo a passo do Safari no iPhone. Um aviso discreto sugere instalar e some por 7 dias quando você fecha (ou para sempre, se preferir).',
      ],
      en: [
        'Installing TripPilot is now simple: a single screen (in Settings or at the /install link) compares App (APK) × Shortcut (PWA) × Browser and installs the right way for your device — APK on Android, shortcut from the browser, and the Safari step-by-step on iPhone. A gentle banner suggests installing and hides for 7 days when you dismiss it (or forever, if you prefer).',
      ],
      es: [
        'Instalar TripPilot ahora es simple: una sola pantalla (en Ajustes o en el enlace /install) compara App (APK) × Acceso directo (PWA) × Navegador e instala de la forma correcta para tu dispositivo — APK en Android, acceso directo desde el navegador y el paso a paso de Safari en iPhone. Un aviso discreto sugiere instalar y se oculta 7 días al cerrarlo (o para siempre, si lo prefieres).',
      ],
    },
  },
  {
    version: '1.4.10-rc',
    date: '2026-06-26',
    items: {
      'pt-BR': [
        'O orçamento de uma parte da viagem agora se chama Verba (antes "Trecho") — um nome que soa a dinheiro. Potes e reservas continuam com o mesmo nome.',
      ],
      en: [
        'The budget for a part of the trip is now called an Allowance (was "Segment") — a name that actually sounds like money. Pots and reserves keep their names.',
      ],
      es: [
        'El presupuesto de una parte del viaje ahora se llama Asignación (antes "Tramo") — un nombre que suena a dinero. Los fondos y reservas mantienen su nombre.',
      ],
    },
  },
  {
    version: '1.4.9-rc',
    date: '2026-06-26',
    items: {
      'pt-BR': [
        'Barra de rolagem: reforço extra para não reaparecer no app instalado em Android (WebView com zoom) — e um teste que trava esse caso. Se você usa um APK antigo, instale a versão mais nova para garantir.',
      ],
      en: [
        'Scrollbar: extra hardening so it can\'t reappear in the installed Android app (zoomed WebView) — plus a test locking that case. If you\'re on an old APK, install the latest build to be sure.',
      ],
      es: [
        'Barra de desplazamiento: refuerzo extra para que no reaparezca en la app instalada en Android (WebView con zoom) — y una prueba que fija ese caso. Si usas un APK antiguo, instala la versión más reciente.',
      ],
    },
  },
  {
    version: '1.4.8-rc',
    date: '2026-06-26',
    items: {
      'pt-BR': [
        'A tela de "Dividir" agora deixa óbvio o que escolher: a pergunta "uma conta agora ou várias ao longo do tempo?", um exemplo real e um selo de escopo em cada opção (agora · 1 conta × contínuo · a viagem toda).',
      ],
      en: [
        'The "Split" chooser now makes the choice obvious: the question "one bill now or many bills over time?", a real example and a scope tag on each option (now · 1 bill × ongoing · the whole trip).',
      ],
      es: [
        'La pantalla de "Dividir" ahora deja claro qué elegir: la pregunta "¿una cuenta ahora o varias a lo largo del tiempo?", un ejemplo real y una etiqueta de alcance en cada opción (ahora · 1 cuenta × continuo · todo el viaje).',
      ],
    },
  },
  {
    version: '1.4.7-rc',
    date: '2026-06-26',
    items: {
      'pt-BR': [
        'Vocabulário Trecho/Pote agora também na renda, em pagamentos recebidos, no card de potes da tela inicial e ao associar um trecho a uma fase — os últimos rótulos "Fundo" da interface sumiram.',
      ],
      en: [
        'Segment/Pot vocabulary now also in income, received payments, the home pots card, and when linking a segment to a phase — the last "Fund" labels are gone.',
      ],
      es: [
        'Vocabulario Tramo/Fondo también en ingresos, pagos recibidos, la tarjeta de fondos del inicio y al asociar un tramo a una fase — desaparecen las últimas etiquetas "Fondo".',
      ],
    },
  },
  {
    version: '1.4.6-rc',
    date: '2026-06-26',
    items: {
      'pt-BR': [
        'Coerência: na tela da viagem, a seção e o botão de orçamento agora dizem Trecho/Pote (antes "Fundos"), batendo com a tela de Trechos e potes.',
      ],
      en: [
        'Consistency: on the trip screen, the budget section and button now say Segment/Pot (was "Funds"), matching the Segments & pots screen.',
      ],
      es: [
        'Coherencia: en la pantalla del viaje, la sección y el botón de presupuesto ahora dicen Tramo/Fondo (antes "Fondos"), igual que la pantalla de Tramos y fondos.',
      ],
    },
  },
  {
    version: '1.4.5-rc',
    date: '2026-06-26',
    items: {
      'pt-BR': [
        'Ajuda, tutoriais e textos do app foram revisados para refletir tudo que chegou recentemente (acerto de contas, lista única de Pessoas, convites de grupo e atualização em tempo real).',
        'Os "fundos" agora aparecem com o nome certo: Trecho (orçamento de uma parte da viagem) ou Pote (dinheiro guardado para um objetivo) — com uma etiqueta em cada um, na tela de orçamento e ao mover despesas.',
      ],
      en: [
        'Help, tutorials and in-app copy were reviewed to reflect everything added recently (settle-up, the single People list, group invites and real-time updates).',
        '"Funds" now show their real name: Segment (the budget for a part of the trip) or Pot (money set aside for a goal) — with a label on each, on the budget screen and when moving expenses.',
      ],
      es: [
        'Se revisaron la ayuda, los tutoriales y los textos de la app para reflejar todo lo añadido recientemente (ajuste de cuentas, la lista única de Personas, invitaciones de grupo y actualización en tiempo real).',
        'Los "fondos" ahora muestran su nombre real: Tramo (el presupuesto de una parte del viaje) o Fondo (dinero apartado para un objetivo) — con una etiqueta en cada uno, en la pantalla de presupuesto y al mover gastos.',
      ],
    },
  },
  {
    version: '1.4.4-rc',
    date: '2026-06-26',
    items: {
      'pt-BR': [
        'No histórico do grupo, quando você confirma o pagamento de outra pessoa, fica marcado como "ação do organizador" — e mostra o que mudou (ex.: estava em aberto).',
        'Agora dá para marcar um amigo como confiável: os próximos convites de grupo dele entram automaticamente, sem precisar aceitar um a um.',
      ],
      en: [
        'In the group history, confirming someone else\u2019s payment is now flagged as an "organizer action" — and shows what it changed (e.g. was unpaid).',
        'You can now trust a friend: their future group invites join automatically, with no need to accept each one.',
      ],
      es: [
        'En el historial del grupo, al confirmar el pago de otra persona ahora se marca como "acción del organizador" — y muestra qué cambió (p. ej. estaba pendiente).',
        'Ahora puedes marcar a un amigo como de confianza: sus próximas invitaciones de grupo se aceptan automáticamente, sin tener que aceptar una por una.',
      ],
    },
  },
  {
    version: '1.4.3-rc',
    date: '2026-06-26',
    items: {
      'pt-BR': [
        'Acerto de contas mais claro: seu saldo (a receber/a pagar) e "o que resolver agora" aparecem logo no topo.',
        'Uma só lista de Pessoas, com etiquetas de status (conectado · convidado · sem app) — acabou a confusão entre Pessoas e Conexões.',
        '"Ver todas as pessoas" abre uma tela com busca e a linha de conectar (Meu QR · Ler QR · Adicionar).',
        'Divisões em grupo agora têm entrada própria na viagem, com a contagem de grupos ativos; e uma ajuda explica quando usar Dividir conta x Divisão em grupo.',
      ],
      en: [
        'Clearer settle-up: your balance (to receive / to pay) and "what to resolve now" sit right at the top.',
        'One single People list with status badges (connected · invited · no app) — no more People-vs-Connections confusion.',
        '"See all people" opens a screen with search and the connect row (My QR · Scan QR · Add).',
        'Group splits now have their own entry on the trip, with the active-group count; and a hint explains when to use Split a bill vs Group split.',
      ],
      es: [
        'Ajuste de cuentas más claro: tu saldo (a recibir / a pagar) y "qué resolver ahora" aparecen arriba del todo.',
        'Una sola lista de Personas con etiquetas de estado (conectado · invitado · sin app) — se acabó la confusión Personas vs Conexiones.',
        '"Ver todas las personas" abre una pantalla con búsqueda y la fila de conectar (Mi QR · Leer QR · Añadir).',
        'Las divisiones en grupo ahora tienen su propia entrada en el viaje, con el conteo de grupos activos; y una ayuda explica cuándo usar Dividir una cuenta vs División en grupo.',
      ],
    },
  },
  {
    version: '1.4.2-rc',
    date: '2026-06-26',
    items: {
      'pt-BR': [
        'Ao criar um grupo, agora dá para escolher amigos conectados e pessoas da viagem — sem digitar tudo de novo.',
        'O amigo escolhido recebe um convite: o grupo só entra na conta dele quando ele aceita.',
        'Quem você digita à mão e quem você escolhe da lista convivem no mesmo grupo.',
      ],
      en: [
        'When creating a group you can now pick connected friends and trip people — no need to retype names.',
        'A picked friend gets an invite: the group only joins their app once they accept it.',
        'Manually-typed names and picked people live together in the same group.',
      ],
      es: [
        'Al crear un grupo ahora puedes elegir amigos conectados y personas del viaje — sin volver a escribir.',
        'El amigo elegido recibe una invitación: el grupo entra en su app solo cuando la acepta.',
        'Los nombres escritos a mano y las personas elegidas conviven en el mismo grupo.',
      ],
    },
  },
  {
    version: '1.4.1-rc',
    date: '2026-06-26',
    items: {
      'pt-BR': [
        'Pagamentos de grupo mais justos: quem marcou como pago nunca aparece em vermelho enquanto aguarda confirmação.',
        'Quem recebeu é quem confirma — se o organizador confirmar no lugar, fica registrado no histórico.',
        'Novo painel "quem já pagou / quem falta" e um histórico de tudo que aconteceu no grupo.',
      ],
      en: [
        'Fairer group payments: a person who marked paid never shows red while awaiting confirmation.',
        'The receiver is who confirms — if the organizer confirms instead, it is logged in the history.',
        'New "who paid / who is left" panel and a full history of everything that happened in the group.',
      ],
      es: [
        'Pagos de grupo más justos: quien marcó como pagado nunca aparece en rojo mientras espera confirmación.',
        'Quien recibió es quien confirma — si el organizador confirma en su lugar, queda registrado en el historial.',
        'Nuevo panel de "quién ya pagó / quién falta" y un historial de todo lo que pasó en el grupo.',
      ],
    },
  },
  {
    version: '1.4.0-rc',
    date: '2026-06-26',
    items: {
      'pt-BR': [
        'Cobranças e pagamentos de amigos agora chegam na hora — sem precisar recarregar o app.',
        'O que chega aparece na central de notificações, num card na tela inicial e como notificação do celular.',
        'Se o app estiver fechado, a cobrança aparece assim que você abrir (nada se perde).',
      ],
      en: [
        'Charges and payments from friends now arrive instantly — no need to reload the app.',
        'What arrives shows in the notification center, a home-screen card, and a phone notification.',
        'If the app is closed, the charge appears as soon as you open it (nothing is lost).',
      ],
      es: [
        'Los cobros y pagos de amigos ahora llegan al instante — sin recargar la app.',
        'Lo que llega aparece en el centro de notificaciones, en una tarjeta de inicio y como notificación del celular.',
        'Si la app está cerrada, el cobro aparece en cuanto la abres (no se pierde nada).',
      ],
    },
  },
  {
    version: '1.3.5-rc',
    date: '2026-06-26',
    items: {
      'pt-BR': [
        'Todo QR code do app agora é um link: a câmera comum do celular abre direto o TripPilot (ou a versão web), sem mais aquele texto embaralhado.',
        'Funciona para conectar com amigos (seu QR) e para receber um acerto de contas por QR.',
      ],
      en: [
        'Every QR code in the app is now a link: your phone\'s default camera opens TripPilot directly (or the web version), with no more scrambled text.',
        'Works for connecting with friends (your QR) and for receiving a settle-up by QR.',
      ],
      es: [
        'Todo código QR de la app ahora es un enlace: la cámara normal del celular abre TripPilot directo (o la versión web), sin más texto enredado.',
        'Funciona para conectar con amigos (tu QR) y para recibir un ajuste de cuentas por QR.',
      ],
    },
  },
  {
    version: '1.3.4-rc',
    date: '2026-06-26',
    items: {
      'pt-BR': [
        'Seus amigos agora te veem pelo seu nome (o que você colocou na viagem), nunca mais como "Android Chrome".',
        'Ao conectar com alguém, os dois lados passam a aparecer com o nome certo, sem precisar de uma segunda ação.',
        'O zoom da câmera ao ler QR code voltou no Android (1×/2×/3× ou um controle deslizante).',
        'Novo campo "Seu nome" nas configurações, caso queira usar um nome diferente do da viagem.',
      ],
      en: [
        'Friends now see you by your name (the one you set on your trip), never again as "Android Chrome".',
        'When you connect with someone, both sides now show up with the right name, with no second action.',
        'QR camera zoom is back on Android (1×/2×/3× or a slider).',
        'New "Your name" field in settings, in case you want a name different from your trip one.',
      ],
      es: [
        'Tus amigos ahora te ven por tu nombre (el que pusiste en tu viaje), nunca más como "Android Chrome".',
        'Al conectar con alguien, ambos lados aparecen con el nombre correcto, sin una segunda acción.',
        'El zoom de la cámara al leer QR volvió en Android (1×/2×/3× o un control deslizante).',
        'Nuevo campo "Tu nombre" en ajustes, por si quieres usar un nombre distinto al del viaje.',
      ],
    },
  },
  {
    version: '1.3.3-rc',
    date: '2026-06-26',
    items: {
      'pt-BR': [
        'O quadro do grupo agora é ao vivo: o que um convidado adiciona aparece para todo mundo na hora, sem o organizador precisar abrir o app.',
        'Apagar uma despesa corrige o total e os saldos na mesma hora (acabou o total que ficava "preso" no valor antigo).',
      ],
      en: [
        'The group board is now live: whatever a guest adds shows up for everyone right away, without the organizer opening the app.',
        'Deleting an expense fixes the total and balances instantly (no more total stuck on the old value).',
      ],
      es: [
        'El tablero del grupo ahora es en vivo: lo que agrega un invitado aparece para todos al instante, sin que el organizador abra la app.',
        'Borrar un gasto corrige el total y los saldos al instante (se acabó el total que quedaba "pegado" en el valor anterior).',
      ],
    },
  },
  {
    version: '1.3.2-rc',
    date: '2026-06-26',
    items: {
      'pt-BR': [
        'Fotos de comprovantes agora salvam na hora e continuam lá quando você reabre a despesa.',
        'Dá para anexar várias fotos em uma mesma despesa.',
        'As fotos aparecem para todo mundo que abre o link compartilhado — inclusive quem não tem o app — e podem ser baixadas.',
      ],
      en: [
        'Receipt photos now save instantly and stay there when you reopen the expense.',
        'You can attach several photos to a single expense.',
        'Photos are visible to everyone who opens the shared link — including people without the app — and can be downloaded.',
      ],
      es: [
        'Las fotos de comprobantes ahora se guardan al instante y siguen ahí cuando vuelves a abrir el gasto.',
        'Puedes adjuntar varias fotos en un mismo gasto.',
        'Las fotos se ven para todos los que abren el enlace compartido — incluso quienes no tienen la app — y se pueden descargar.',
      ],
    },
  },
  {
    version: '1.3.1-rc',
    date: '2026-06-26',
    items: {
      'pt-BR': [
        'Na divisão em grupo, "Pagamentos" e "Quem paga quem" agora abrem um de cada vez — a tela fica limpa e fácil de ler.',
        'Escolher quem divide a conta ficou mais fácil de tocar: nomes maiores, duas colunas e caixas de seleção bem maiores.',
        'Ao adicionar uma despesa, os botões de captura ficaram mais claros e agora dá pra digitar os itens da conta na mão (a soma vira o total).',
      ],
      en: [
        'In group split, "Payments" and "Who pays whom" now open one at a time — the screen stays clean and easy to read.',
        'Picking who shares a bill is easier to tap: bigger names, two columns and much larger checkboxes.',
        'When adding an expense, the capture buttons are clearer and you can now type the bill items by hand (the sum becomes the total).',
      ],
      es: [
        'En la división en grupo, "Pagos" y "Quién paga a quién" ahora se abren de a uno — la pantalla queda limpia y fácil de leer.',
        'Elegir quién comparte la cuenta es más fácil de tocar: nombres más grandes, dos columnas y casillas mucho más grandes.',
        'Al agregar un gasto, los botones de captura son más claros y ahora puedes escribir los ítems de la cuenta a mano (la suma pasa a ser el total).',
      ],
    },
  },
  {
    version: '1.3.0-rc',
    date: '2026-06-25',
    items: {
      'pt-BR': [
        'Dívidas ao vivo: depois de conectar uma vez, toque em "Cobrar pelo app" para mandar uma cobrança a um amigo. Chega uma notificação no aparelho dele e, com um toque, ele aceita — a dívida passa a aparecer para os dois (recusar avisa você).',
        'Pagamentos que fecham a conta dos dois lados: registre "Eu paguei" ou "Eu recebi" e a obrigação some para ambos, sem ninguém ficar "no vermelho".',
        'Quem recebe escolhe onde o dinheiro entrou: um pagamento recebido é uma entrada real, então você indica o fundo e a carteira que cresceram — não é uma cópia da despesa.',
      ],
      en: [
        'Live debts: once connected, tap "Charge via app" to send a friend a charge. A notification lands on their phone and, with one tap, they accept — the debt then shows for both of you (declining lets you know).',
        'Payments that close the account on both sides: record "I paid" or "I received" and the obligation clears for everyone, with no one left "in the red".',
        'The receiver picks where the money landed: money received is a real inflow, so you choose the fund and wallet it grew — it is not a copy of the expense.',
      ],
      es: [
        'Deudas en vivo: una vez conectados, toca "Cobrar por la app" para enviarle un cobro a un amigo. Le llega una notificación y, con un toque, lo acepta — la deuda aparece para ambos (rechazar te avisa).',
        'Pagos que cierran la cuenta de ambos lados: registra "Yo pagué" o "Yo recibí" y la obligación se salda para todos, sin que nadie quede "en rojo".',
        'Quien recibe elige dónde entró el dinero: un pago recibido es una entrada real, así que indicas el fondo y la billetera que crecieron — no es una copia del gasto.',
      ],
    },
  },
  {
    version: '1.2.5-rc',
    date: '2026-06-25',
    items: {
      'pt-BR': [
        'Conexão em duas vias: agora basta UMA pessoa escanear o QR da outra (ou abrir o link) — vocês passam a aparecer um no aparelho do outro automaticamente, sem o segundo escaneamento de volta.',
        'A tela de "Acerto de contas" ficou mais clara: o botão "Meu QR" fica fixo no topo (alguém pode te adicionar a qualquer momento) e suas conexões já aparecem abertas.',
        'Separamos "conectar um amigo" de "backup entre seus aparelhos" — o envio por QR entre seus próprios aparelhos agora está rotulado como backup, sem confundir com adicionar uma pessoa.',
      ],
      en: [
        'Two-way connect: now just ONE person scans the other\'s QR (or opens the link) — you both show up on each other\'s phones automatically, with no second scan back.',
        'The "Settle up" screen is clearer: the "My QR" button is pinned at the top (someone can add you any time) and your connections are shown expanded.',
        'We split "connect a friend" from "device backup" — sending by QR between your own phones is now labelled as a backup, so it no longer reads as a second way to add a person.',
      ],
      es: [
        'Conexión en dos vías: ahora basta con que UNA persona escanee el QR de la otra (o abra el enlace) — ambos aparecen en el teléfono del otro automáticamente, sin un segundo escaneo de vuelta.',
        'La pantalla de "Ajustar cuentas" quedó más clara: el botón "Mi QR" está fijo arriba (alguien puede añadirte en cualquier momento) y tus conexiones se muestran abiertas.',
        'Separamos "conectar a un amigo" de "copia entre tus dispositivos" — enviar por QR entre tus propios teléfonos ahora se llama copia de dispositivo, sin confundirse con añadir a una persona.',
      ],
    },
  },
  {
    version: '1.2.4-rc',
    date: '2026-06-25',
    items: {
      'pt-BR': [
        'Agora você pode anexar uma foto a uma despesa do grupo — um recibo, um comprovante, uma lembrança da conta.',
        'A foto vai criptografada de ponta a ponta: a nuvem guarda só o conteúdo embaralhado e a chave viaja dentro do link do grupo, então nem o servidor consegue abrir a imagem.',
        'Todo mundo do grupo vê e baixa a foto — inclusive quem abre o link pelo navegador, sem instalar nada. Ao revogar o link, as fotos também somem.',
      ],
      en: [
        'You can now attach a photo to a group expense — a receipt, a proof of payment, a snapshot of the bill.',
        'The photo is end-to-end encrypted: the cloud stores only scrambled bytes and the key travels inside the group link, so not even the server can open the image.',
        'Everyone in the group can view and download it — including people who open the link in a browser, with nothing to install. Revoking the link also deletes the photos.',
      ],
      es: [
        'Ahora puedes adjuntar una foto a un gasto del grupo — un recibo, un comprobante, una imagen de la cuenta.',
        'La foto va cifrada de extremo a extremo: la nube guarda solo el contenido cifrado y la clave viaja dentro del enlace del grupo, así ni el servidor puede abrir la imagen.',
        'Todos en el grupo la ven y la descargan — incluso quien abre el enlace en el navegador, sin instalar nada. Al revocar el enlace, las fotos también se borran.',
      ],
    },
  },
  {
    version: '1.2.3-rc',
    date: '2026-06-25',
    items: {
      'pt-BR': [
        'Agora todo mundo do grupo pode ajudar a registrar as contas: quem abrir o link do grupo pode lançar uma despesa direto pelo navegador, sem instalar nada.',
        'A despesa lançada por um convidado aparece como "pendente" e entra para todos assim que o organizador sincroniza. O organizador continua sendo a autoridade do dinheiro.',
        'Só quem criou a despesa (ou o organizador) pode removê-la — e nada é duplicado, mesmo se o link for reaberto.',
      ],
      en: [
        'Everyone in the group can now help log the bills: whoever opens the group link can add an expense straight from the browser, with nothing to install.',
        'A guest-added expense shows as "pending" and reaches everyone once the organizer syncs. The organizer stays the money authority.',
        'Only the person who added an expense (or the organizer) can remove it — and nothing is duplicated, even if the link is reopened.',
      ],
      es: [
        'Ahora todos en el grupo pueden ayudar a registrar las cuentas: quien abra el enlace del grupo puede añadir un gasto directo desde el navegador, sin instalar nada.',
        'El gasto que añade un invitado aparece como "pendiente" y llega a todos cuando el organizador sincroniza. El organizador sigue siendo la autoridad del dinero.',
        'Solo quien añadió un gasto (o el organizador) puede quitarlo — y nada se duplica, aunque se reabra el enlace.',
      ],
    },
  },
  {
    version: '1.2.2-rc',
    date: '2026-06-25',
    items: {
      'pt-BR': [
        'Ao criar um grupo, agora você adiciona as pessoas ali mesmo — o teclado continua aberto e o foco volta para o próximo nome, então dá para cadastrar várias seguidas.',
        'O grupo abre já com todo mundo dentro. (Criar sem adicionar ninguém continua funcionando.)',
      ],
      en: [
        'When you create a group you can now add the people right there — the keyboard stays open and focus returns to the next name, so you can add several in a row.',
        'The group opens with everyone already in it. (Creating with no one added still works.)',
      ],
      es: [
        'Al crear un grupo ahora agregas a las personas allí mismo — el teclado sigue abierto y el foco vuelve al próximo nombre, así cargas varias seguidas.',
        'El grupo se abre con todos ya dentro. (Crear sin agregar a nadie sigue funcionando.)',
      ],
    },
  },
  {
    version: '1.2.1-rc',
    date: '2026-06-25',
    items: {
      'pt-BR': [
        'Cada despesa de grupo agora tem uma data (começa em hoje) — e a lista agrupa as despesas por dia quando o grupo passa de um dia.',
        'Ao fotografar a nota, você escolhe entre "Nota completa" (lança o total) ou "Selecionar itens" (marca só o que o grupo divide; o valor vira a soma dos itens marcados).',
        'Abrir uma despesa mostra os itens que vieram da nota.',
        'Nomes das pessoas e valores ganharam fontes maiores, mais fáceis de ler.',
      ],
      en: [
        'Every group expense now has a date (it starts on today) — and the list groups expenses by day once a group spans more than one day.',
        'When you photograph the receipt you choose between "Whole bill" (logs the total) or "Pick items" (keep only what the group shares; the amount becomes the sum of the kept items).',
        'Opening an expense shows the items it came from.',
        'People names and amounts got bigger, easier-to-read fonts.',
      ],
      es: [
        'Cada gasto de grupo ahora tiene una fecha (empieza en hoy) — y la lista agrupa los gastos por día cuando el grupo abarca más de un día.',
        'Al fotografiar el recibo eliges entre "Recibo completo" (registra el total) o "Elegir ítems" (conserva solo lo que el grupo divide; el importe pasa a ser la suma de los ítems elegidos).',
        'Al abrir un gasto se ven los ítems de los que proviene.',
        'Los nombres de las personas y los importes tienen fuentes más grandes y legibles.',
      ],
    },
  },
  {
    version: '1.2.0-rc',
    date: '2026-06-25',
    items: {
      'pt-BR': [
        'A divisão em grupo ficou mais clara: a tela agora abre pelas Despesas (o principal). Os saldos e o "quem paga quem" ficam atrás de botões, para não atrapalhar.',
        '"Saldos" virou "Pagamentos" — uma palavra mais fácil.',
        'Ao adicionar pessoas no grupo, o teclado continua aberto e o foco já volta para o próximo nome — dá para cadastrar várias pessoas em sequência.',
        'O convite do grupo agora mostra um QR Code além do link: a pessoa aponta a câmera e entra.',
        'O botão Voltar não entra mais em loop entre a lista de grupos e o grupo.',
      ],
      en: [
        'Group split is clearer: the screen now opens with Expenses (the main thing). Balances and "who pays whom" sit behind buttons so they stay out of the way.',
        '"Balances" became "Payments" — an easier word.',
        'When you add people to a group, the keyboard stays open and focus returns to the next name — so you can add several people in a row.',
        'The group invite now shows a QR code as well as the link: point the camera and join.',
        'The Back button no longer loops between the groups list and a group.',
      ],
      es: [
        'La división en grupo es más clara: la pantalla ahora abre con los Gastos (lo principal). Los saldos y el "quién paga a quién" quedan detrás de botones para no estorbar.',
        '"Saldos" pasó a llamarse "Pagos" — una palabra más fácil.',
        'Al agregar personas al grupo, el teclado sigue abierto y el foco vuelve al próximo nombre — puedes cargar varias personas seguidas.',
        'La invitación del grupo ahora muestra un código QR además del enlace: apunta la cámara y entra.',
        'El botón Atrás ya no entra en bucle entre la lista de grupos y un grupo.',
      ],
    },
  },
  {
    version: '1.1.9-rc',
    date: '2026-06-25',
    items: {
      'pt-BR': [
        'No copiloto, quando o app diz que você está "acima do ritmo" mas o cofrinho ainda tem dinheiro guardado, agora aparece uma linha explicando que uma coisa não anula a outra: o cofrinho é o que você poupou nos dias mais calmos; o ritmo é a tendência dos últimos dias. (As contas não mudaram — só ficaram mais claras.)',
        'A tela de backup ficou mais clara e honesta: "Salvar no aparelho" agora diz que salva na pasta Downloads (antes falava "Documentos"), os botões deixaram de falar "JSON", e as ações foram agrupadas em "Enviar e guardar" e "Importar e receber".',
        'O tutorial (?) da tela de backup foi atualizado para os botões atuais — não fala mais em "exportar JSON" e agora cobre "Salvar no aparelho" e a planilha (CSV).',
      ],
      en: [
        'In the copilot, when it says you are "above pace" but your piggy bank still holds money, a line now explains that one does not cancel the other: the piggy is what you saved on calmer days; pace is the trend of your recent days. (The maths did not change — it is just clearer.)',
        'The backup screen is clearer and more honest: "Save to device" now says it saves to the Downloads folder (it used to say "Documents"), the buttons no longer say "JSON", and the actions are grouped into "Send & save" and "Import & receive".',
        'The backup screen tutorial (?) was refreshed to the current buttons — it no longer mentions "export JSON" and now covers "Save to device" and the spreadsheet (CSV).',
      ],
      es: [
        'En el copiloto, cuando dice que estás "por encima del ritmo" pero tu alcancía aún guarda dinero, ahora una línea explica que una cosa no anula la otra: la alcancía es lo que ahorraste en los días más calmados; el ritmo es la tendencia de los últimos días. (Las cuentas no cambiaron — solo son más claras.)',
        'La pantalla de copia de seguridad es más clara y honesta: "Guardar en el dispositivo" ahora dice que guarda en la carpeta Descargas (antes decía "Documentos"), los botones ya no dicen "JSON", y las acciones se agruparon en "Enviar y guardar" e "Importar y recibir".',
        'El tutorial (?) de la pantalla de copia se actualizó a los botones actuales — ya no menciona "exportar JSON" y ahora cubre "Guardar en el dispositivo" y la hoja de cálculo (CSV).',
      ],
    },
  },
  {
    version: '1.1.8-rc',
    date: '2026-06-25',
    items: {
      'pt-BR': [
        'O comparador de custo-benefício voltou para o menu rápido (+): agora ele fica visível ao lado de "Planejar gasto", "Simular" e "Converter" — não precisa mais abrir "Mais ações".',
        'As fotos do comparador voltaram a funcionar: dá para mandar uma ou várias de uma vez. (Um bug fazia o app perder as imagens escolhidas antes de lê-las.)',
        'No assistente, o botão de câmera agora aparece sempre. Ao tocar, ele pede a permissão na hora e abre a mesma escolha de todo o app: tirar foto com a câmera ou buscar da galeria.',
      ],
      en: [
        'The cost-benefit comparator is back in the quick menu (+): it now sits next to "Plan a spend", "Simulate" and "Convert" — no need to open "More actions".',
        'Comparator photos work again: send one or several at once. (A bug dropped the picked images before they could be read.)',
        'In the assistant, the camera button is always shown now. Tapping it asks for permission on the spot and opens the same choice used everywhere: take a photo or pick from the gallery.',
      ],
      es: [
        'El comparador de costo-beneficio volvió al menú rápido (+): ahora aparece junto a "Planear gasto", "Simular" y "Convertir" — ya no hace falta abrir "Más acciones".',
        'Las fotos del comparador vuelven a funcionar: puedes enviar una o varias a la vez. (Un error descartaba las imágenes elegidas antes de leerlas.)',
        'En el asistente, el botón de cámara ahora se muestra siempre. Al tocarlo pide el permiso en el momento y abre la misma opción de toda la app: tomar una foto o elegir de la galería.',
      ],
    },
  },
  {
    version: '1.1.7-rc',
    date: '2026-06-25',
    items: {
      'pt-BR': [
        'O check-in do dia agora mora na tela inicial, ao lado do "Posso gastar": uma linha discreta que você toca para abrir (escolher como vai ser o dia) e toca de novo para recolher.',
        'Quando o "Livre hoje" fica negativo e o cofrinho cobre a diferença, a tela passa a dizer isso claramente — quanto o cofrinho cobriu e que os seus outros dias seguem iguais. (As contas não mudaram, só ficaram mais honestas.)',
        'Na primeira vez no app, um convite "Descobrir o app" aparece em destaque (e o sininho vazio some) até você abrir a central de descoberta uma vez — depois ele volta a ser um ícone pequeno.',
      ],
      en: [
        'The day check-in now lives on the Home, next to "Can I spend": a discreet line you tap to open (pick how the day will go) and tap again to collapse.',
        'When "Free today" goes negative and the piggy bank covers the gap, the Home now says so plainly \u2014 how much the piggy covered and that your other days stay the same. (The maths did not change, it is just more honest.)',
        'On first run, a highlighted "Discover the app" invite appears (and the empty bell is hidden) until you open the discovery hub once \u2014 then it shrinks back to a small icon.',
      ],
      es: [
        'El check-in del d\u00eda ahora vive en la pantalla inicial, junto a "Puedo gastar": una l\u00ednea discreta que tocas para abrir (elegir c\u00f3mo ser\u00e1 el d\u00eda) y tocas de nuevo para cerrar.',
        'Cuando "Libre hoy" queda negativo y la alcanc\u00eda cubre la diferencia, la pantalla ahora lo dice con claridad \u2014 cu\u00e1nto cubri\u00f3 la alcanc\u00eda y que tus otros d\u00edas siguen igual. (Las cuentas no cambiaron, solo son m\u00e1s honestas.)',
        'En el primer uso, una invitaci\u00f3n destacada "Descubrir la app" aparece (y la campana vac\u00eda se oculta) hasta que abras el centro de descubrimiento una vez \u2014 luego vuelve a ser un \u00edcono peque\u00f1o.',
      ],
    },
  },
  {
    version: '1.1.6-rc',
    date: '2026-06-25',
    items: {
      'pt-BR': [
        'Planejar ficou mais claro: primeiro você escolhe o que quer criar — um gasto/evento ou um pote/fundo. Assim o app sabe a diferença antes de você decidir.',
        'Um pote/fundo agora pode ser de uma fase específica (ex.: o fundo da Eurotrip enquanto você ainda está em Burgos). Ele não vira mais um evento com contagem na tela inicial nem polui a fase atual — fica guardado na fase certa.',
        'E esse fundo de outra fase continua pronto para uso: na hora de registrar um gasto, ele aparece selecionável em "Fundos de outras fases".',
      ],
      en: [
        'Planning is clearer: first you pick what you want to create \u2014 a spend/event or a pot/fund. The app understands the difference before you choose.',
        'A pot/fund can now belong to a specific phase (e.g. the Eurotrip fund while you\u2019re still in Burgos). It no longer turns into a countdown event on the Home or clutters the current phase \u2014 it stays parked in the right phase.',
        'And that other-phase fund stays ready to use: when you log a spend, it shows up, selectable, under "Funds from other phases".',
      ],
      es: [
        'Planear es m\u00e1s claro: primero eliges qu\u00e9 quieres crear \u2014 un gasto/evento o un fondo. La app entiende la diferencia antes de que elijas.',
        'Un fondo ahora puede ser de una fase espec\u00edfica (ej.: el fondo de la Eurotrip mientras a\u00fan est\u00e1s en Burgos). Ya no se convierte en un evento con cuenta regresiva en la pantalla inicial ni ensucia la fase actual \u2014 queda guardado en la fase correcta.',
        'Y ese fondo de otra fase sigue listo para usar: al registrar un gasto, aparece seleccionable en "Fondos de otras fases".',
      ],
    },
  },
  {
    version: '1.1.5-rc',
    date: '2026-06-25',
    items: {
      'pt-BR': [
        'Agora dá para registrar um gasto — e também uma entrada — em um fundo de outra fase da viagem. Exemplo: você está na fase de Burgos, mas quer lançar algo no fundo da Eurotrip que criou para mais adiante.',
        'Esses fundos aparecem numa seção "Fundos de outras fases", logo abaixo do fundo da fase atual e do fundo global. Eles ficam selecionáveis, mas nunca são escolhidos sozinhos — o padrão continua sendo o fundo da fase em que você está.',
      ],
      en: [
        'You can now log an expense \u2014 and an income \u2014 against a fund from another phase of the trip. Example: you\u2019re in the Burgos phase but want to record something in the Eurotrip fund you set up for later.',
        'Those funds show up in a "Funds from other phases" section, right below the current-phase fund and the global fund. They are selectable but never auto-picked \u2014 the default is still the fund for the phase you\u2019re in.',
      ],
      es: [
        'Ahora puedes registrar un gasto \u2014 y tambi\u00e9n un ingreso \u2014 en un fondo de otra fase del viaje. Ejemplo: est\u00e1s en la fase de Burgos pero quieres anotar algo en el fondo de la Eurotrip que creaste para m\u00e1s adelante.',
        'Esos fondos aparecen en una secci\u00f3n "Fondos de otras fases", justo debajo del fondo de la fase actual y del fondo global. Son seleccionables pero nunca se eligen solos \u2014 lo predeterminado sigue siendo el fondo de la fase en la que est\u00e1s.',
      ],
    },
  },
  {
    version: '1.1.4-rc',
    date: '2026-06-25',
    items: {
      'pt-BR': [
        'O botão de IA na tela de registrar gasto e de registrar entrada agora abre o assistente — antes ele não fazia nada nessas telas.',
        'O botão de importar extrato (na tela de gastos) ganhou um rótulo de texto "Importar", do mesmo jeito que o "Escanear" ao lado — agora dá para saber para que ele serve.',
        'Travamos de vez a barra de rolagem lateral: ela foi removida de todas as telas e protegida por um teste, para nunca mais voltar em uma atualização.',
      ],
      en: [
        'The AI button on the log-expense and log-income screens now opens the assistant \u2014 before, it did nothing on those screens.',
        'The statement-import button (on the expenses screen) now has a text label, "Import", just like the "Scan" chip next to it \u2014 so you can tell what it does.',
        'We permanently locked the side scrollbar: it is gone on every screen and guarded by a test, so it can never come back in an update.',
      ],
      es: [
        'El bot\u00f3n de IA en las pantallas de registrar gasto y registrar ingreso ahora abre el asistente \u2014 antes no hac\u00eda nada en esas pantallas.',
        'El bot\u00f3n de importar extracto (en la pantalla de gastos) ahora tiene una etiqueta de texto, "Importar", igual que el "Escanear" de al lado \u2014 as\u00ed se sabe para qu\u00e9 sirve.',
        'Bloqueamos de forma permanente la barra de desplazamiento lateral: se elimin\u00f3 en todas las pantallas y est\u00e1 protegida por una prueba, para que nunca vuelva en una actualizaci\u00f3n.',
      ],
    },
  },
  {
    version: '1.1.3-rc',
    date: '2026-06-25',
    items: {
      'pt-BR': [
        'Histórico de preço por item: ao abrir um gasto que você já registrou antes (mesmo nome), o app mostra quanto pagou nas vezes anteriores — o menor, a média e o maior preço.',
        'Ele ainda diz, em uma frase, se desta vez você pagou acima ou abaixo da sua média (ou se foi o menor/maior preço de todos), e mostra a lista completa das compras com um toque.',
        'Tudo calculado na moeda base da viagem (compara compra no exterior com compra em casa) e sem precisar de internet.',
      ],
      en: [
        'Per-item price history: open an expense you\u2019ve logged before (same name) and the app shows what you paid the previous times \u2014 the lowest, the average and the highest price.',
        'It also says, in one line, whether this time you paid above or below your average (or if it was your cheapest/priciest ever), and the full purchase list is one tap away.',
        'All computed in the trip\u2019s base currency (it lines up a purchase abroad with one at home) and fully offline.',
      ],
      es: [
        'Historial de precio por ítem: al abrir un gasto que ya registraste antes (mismo nombre), la app muestra cuánto pagaste las veces anteriores \u2014 el mínimo, el promedio y el máximo.',
        'Además dice, en una frase, si esta vez pagaste por encima o por debajo de tu promedio (o si fue el precio más bajo/alto de todos), y la lista completa de compras está a un toque.',
        'Todo calculado en la moneda base del viaje (compara una compra en el exterior con una en casa) y sin necesidad de internet.',
      ],
    },
  },
  {
    version: '1.1.2-rc',
    date: '2026-06-25',
    items: {
      'pt-BR': [
        'Potes por fase: um pote criado para uma fase futura não polui mais a tela de início da fase atual. Ele fica numa área "Potes de outras fases" (recolhida) e aparece em destaque quando você entra na fase dele.',
        'Esse mesmo pote continua selecionável na hora de registrar um gasto — ele só sai do destaque, nunca fica indisponível.',
        'A criação separa claramente Evento (tem data e contagem regressiva, como um show) de Pote/Fundo (sem contagem regressiva, recebe gastos a qualquer momento).',
      ],
      en: [
        'Phase-scoped pots: a pot created for a future phase no longer clutters the current phase\u2019s home screen. It lives in a collapsed \u201cPots from other phases\u201d area and comes into focus when you reach its phase.',
        'That same pot stays selectable when you log an expense \u2014 it just leaves the focus, it\u2019s never made unavailable.',
        'Creating things now clearly separates an Event (has a date and a countdown, like a show) from a Pot/Fund (no countdown, takes spend at any time).',
      ],
      es: [
        'Sobres por fase: un sobre creado para una fase futura ya no satura la pantalla de inicio de la fase actual. Queda en un área \u201cSobres de otras fases\u201d (recogida) y aparece destacado cuando llegas a su fase.',
        'Ese mismo sobre sigue siendo seleccionable al registrar un gasto \u2014 solo sale del destaque, nunca queda no disponible.',
        'La creación separa claramente un Evento (tiene fecha y cuenta regresiva, como un concierto) de un Sobre/Fondo (sin cuenta regresiva, recibe gastos en cualquier momento).',
      ],
    },
  },
  {
    version: '1.1.1-rc',
    date: '2026-06-25',
    items: {
      'pt-BR': [
        'Ficou claro para onde vai a economia do dia: o check-in mostra UM destino só — quando a fase tem datas, vai para o cofrinho; quando não tem, dilui nos próximos dias. Nunca os dois ao mesmo tempo.',
        'A tela "De onde vem esse número" agora também explica o dinheiro do dia: como o cofrinho funciona (guarda quando você gasta menos, cobre quando gasta mais) e o que muda nos próximos dias.',
        'O atalho "Posso gastar um valor?" virou um chip discreto logo abaixo do "livre para hoje" — sem ocupar a tela.',
      ],
      en: [
        'It\u2019s clear where the day\u2019s saving goes: the check-in shows just ONE destination \u2014 the piggy bank when the phase has dates, otherwise diluted across the next days. Never both at once.',
        'The \u201cWhere this number comes from\u201d sheet now also explains the daily money: how the piggy bank works (keeps when you spend less, covers when you spend more) and what changes on the next days.',
        'The \u201cCan I spend ___?\u201d shortcut is now a discreet chip right under \u201cfree today\u201d \u2014 no longer a tall card.',
      ],
      es: [
        'Quedó claro a dónde va el ahorro del día: el check-in muestra UN solo destino \u2014 la alcancía cuando la fase tiene fechas, si no se diluye en los próximos días. Nunca los dos a la vez.',
        'La pantalla \u201cDe dónde viene este número\u201d ahora también explica el dinero del día: cómo funciona la alcancía (guarda cuando gastas menos, cubre cuando gastas más) y qué cambia en los próximos días.',
        'El atajo \u201c\u00bfPuedo gastar ___?\u201d ahora es un chip discreto justo debajo de \u201clibre para hoy\u201d \u2014 ya no es una tarjeta grande.',
      ],
    },
  },
  {
    version: '1.1.0-rc',
    date: '2026-06-25',
    items: {
      'pt-BR': [
        'Agora tem um lugar só para descobrir tudo que o app faz: toque na bússola no topo da tela de início para buscar pelo que você quer fazer (ex.: "dividir um valor", "converter moeda") e navegar pelas funções por intenção.',
        '"Dividir" virou uma porta única: ao tocar em Dividir, o app pergunta como você quer dividir — Por itens (uma conta na mesa) ou Valor em grupo (despesas de um grupo ou evento) — para você nunca escolher a opção errada.',
        'O botão + ficou mais enxuto: registrar gasto, IA, Dividir e iniciar saída ficam na frente; "Registrar mercado" foi para "Mais ações" (e continua à mão no modo dia a dia).',
      ],
      en: [
        'There\u2019s now a single place to discover everything the app does: tap the compass at the top of the home screen to search by what you want to do (e.g. \u201csplit an amount\u201d, \u201cconvert currency\u201d) and browse features by intent.',
        '\u201cSplit\u201d is now one clear door: when you tap Split, the app asks how you want to split \u2014 By items (one bill at the table) or As a group amount (expenses across a group or event) \u2014 so you never pick the wrong one.',
        'The + button is leaner: log expense, AI, Split and start an outing come first; \u201cLog groceries\u201d moved to \u201cMore actions\u201d (still handy in day-to-day mode).',
      ],
      es: [
        'Ahora hay un solo lugar para descubrir todo lo que hace la app: toca la br\u00fajula en la parte superior de la pantalla de inicio para buscar por lo que quieres hacer (p. ej. \u201cdividir un importe\u201d, \u201cconvertir moneda\u201d) y explorar las funciones por intenci\u00f3n.',
        '\u201cDividir\u201d ahora es una sola puerta: al tocar Dividir, la app te pregunta c\u00f3mo quieres dividir \u2014 Por \u00edtems (una cuenta en la mesa) o Importe en grupo (gastos de un grupo o evento) \u2014 para que nunca elijas la opci\u00f3n equivocada.',
        'El bot\u00f3n + es m\u00e1s simple: registrar gasto, IA, Dividir e iniciar salida van primero; \u201cRegistrar mercado\u201d pas\u00f3 a \u201cM\u00e1s acciones\u201d (y sigue a mano en el modo d\u00eda a d\u00eda).',
      ],
    },
  },
  {
    version: '1.0.3-rc',
    date: '2026-06-25',
    items: {
      'pt-BR': [
        '"Tudo que dá para fazer" e a Central de ajuda agora cobrem a Divisão em grupo (Tricount) — antes ela só aparecia na busca da ajuda.',
        'Ficou mais fácil entender a diferença entre Dividir conta (uma conta agora, na mesa) e Divisão em grupo (várias despesas de um grupo ou evento) — o texto de cada uma deixa isso claro antes de você escolher.',
      ],
      en: [
        '"Everything you can do" and the Help Center now cover Group split (Tricount) — until now it only showed up in help search.',
        'It\u2019s clearer what sets Split a bill (one bill now, at the table) apart from Group split (many expenses across a group or event) — each one\u2019s blurb spells out the difference before you pick.',
      ],
      es: [
        '"Todo lo que puedes hacer" y el Centro de ayuda ahora incluyen la División en grupo (Tricount) — antes solo aparecía en el buscador de la ayuda.',
        'Es más claro en qué se diferencian Dividir la cuenta (una cuenta ahora, en la mesa) y División en grupo (varios gastos de un grupo o evento) — el texto de cada una lo explica antes de elegir.',
      ],
    },
  },
  {
    version: '1.0.2-rc',
    date: '2026-06-25',
    items: {
      'pt-BR': [
        'O menu de ações rápidas (o botão +) agora fecha sozinho quando você troca de aba ou toca fora — não fica mais aberto por cima da tela seguinte.',
        'O Amigo Sincero passou a falar só a opinião dele. Os números que ele mostrava (quanto você guardou, quanto falta na fase, o gasto do dia, a categoria que mais pesa e quem tem a receber) viraram cartões de insight na tela de início, sem repetir.',
      ],
      en: [
        'The quick-actions menu (the + button) now closes on its own when you switch tabs or tap outside — it no longer stays open over the next screen.',
        'The Honest Friend now shows only its take. The numbers it used to carry (how much you saved, what\u2019s left in the phase, today\u2019s spend, your heaviest category and who owes you) became insight cards on the home screen, with no duplicates.',
      ],
      es: [
        'El menú de acciones rápidas (el botón +) ahora se cierra solo cuando cambias de pestaña o tocas fuera — ya no queda abierto sobre la pantalla siguiente.',
        'El Amigo Sincero ahora muestra solo su opinión. Los números que mostraba (cuánto guardaste, cuánto falta en la fase, el gasto de hoy, tu categoría más pesada y quién tiene por cobrar) pasaron a ser tarjetas de insight en la pantalla de inicio, sin repetir.',
      ],
    },
  },
  {
    version: '1.0.1-rc',
    date: '2026-06-25',
    items: {
      'pt-BR': [
        'Notas importadas (pela IA ou pela foto) e o CSV da Wise agora entram na fase certa pela data do gasto — e na hora de importar você pode escolher a fase manualmente, se quiser.',
        'Dá pra mudar a fase e o fundo de vários gastos de uma vez: selecione os gastos (ou uma nota/saída inteira) e mova tudo junto, sem precisar editar item por item.',
        'Reserva de um evento de vários dias agora é distribuída pela média dos dias — o "disponível por dia" fica certo, em vez de jogar tudo no primeiro dia.',
        'O simulador passou a usar o saldo da fase de hoje, não o de outra fase.',
        'Os campos de digitação não mostram mais aquela borda ao tocar, e a tela de início pode exibir até 6 insights.',
      ],
      en: [
        'Imported receipts (via AI or photo) and the Wise CSV now land in the right phase based on the expense date — and at import time you can pick the phase by hand if you prefer.',
        'You can change the phase and fund of several expenses at once: select the expenses (or a whole receipt/outing) and move them together, no more editing item by item.',
        'A multi-day event reserve is now spread evenly across its days — the "available per day" is correct instead of dumping it all on the first day.',
        'The simulator now uses today\u2019s phase balance, not another phase\u2019s.',
        'Input fields no longer show a border when tapped, and the home screen can show up to 6 insights.',
      ],
      es: [
        'Los tickets importados (con IA o foto) y el CSV de Wise ahora entran en la fase correcta según la fecha del gasto — y al importar puedes elegir la fase a mano si lo prefieres.',
        'Puedes cambiar la fase y el fondo de varios gastos a la vez: selecciona los gastos (o un ticket/salida entero) y muévelos juntos, sin editar uno por uno.',
        'La reserva de un evento de varios días ahora se reparte por la media de los días — el "disponible por día" queda correcto en lugar de cargarlo todo al primer día.',
        'El simulador ahora usa el saldo de la fase de hoy, no el de otra fase.',
        'Los campos de texto ya no muestran un borde al tocarlos, y la pantalla de inicio puede mostrar hasta 6 insights.',
      ],
    },
  },
  {
    version: '1.0.0-rc',
    date: '2026-06-24',
    items: {
      'pt-BR': [
        'Chegou a Divisão de grupo (estilo Tricount): crie um evento, junte várias despesas com várias pessoas e deixe o app calcular quem deve a quem.',
        'Cada despesa pode ter um ou vários pagadores e ser dividida igualmente ou de forma personalizada — e você pode lançar pela foto da nota ou pela IA, igual no resto do app.',
        'Compartilhe um link e cada pessoa escolhe o próprio nome, vê quanto deve ou tem a receber e marca como pago — sem precisar instalar o app.',
        'Quando o grupo é de uma viagem, os pagamentos confirmados aparecem no acerto da viagem, sem misturar com o caixa principal.',
        'A Central de ajuda ganhou um guia sobre a divisão de grupo.',
      ],
      en: [
        'Group split is here (Tricount-style): create an event, gather many expenses across many people and let the app work out who owes whom.',
        'Each expense can have one or many payers and be split equally or custom — and you can log it from a receipt photo or with AI, just like everywhere else.',
        'Share a link and each person picks their own name, sees what they owe or are owed and marks it paid — no app install needed.',
        'When the group belongs to a trip, confirmed payments show up in the trip settle-up, without mixing into the main balance.',
        'The Help Center gained a guide about group splitting.',
      ],
      es: [
        'Llegó la División de grupo (estilo Tricount): crea un evento, junta varios gastos con varias personas y deja que la app calcule quién le debe a quién.',
        'Cada gasto puede tener uno o varios pagadores y dividirse en partes iguales o personalizado — y puedes registrarlo con la foto del ticket o con IA, como en el resto de la app.',
        'Comparte un enlace y cada persona elige su propio nombre, ve cuánto debe o tiene por cobrar y lo marca como pagado — sin instalar la app.',
        'Cuando el grupo es de un viaje, los pagos confirmados aparecen en el ajuste del viaje, sin mezclarse con el saldo principal.',
        'El Centro de ayuda sumó una guía sobre la división de grupo.',
      ],
    },
  },
  {
    version: '0.99.64',
    date: '2026-06-24',
    items: {
      'pt-BR': [
        'No modo simples, a barra de baixo ficou equilibrada: Início e Gastos de um lado, Viagem e Ajustes do outro, com o botão de adicionar no centro.',
        'Cada cartão de padrão do Copiloto agora tem uma leitura em palavras — "bom sinal", "de olho" ou "informativo" — pra você saber na hora se é algo positivo, um alerta leve ou só informação.',
        'A prévia da fase separou melhor o que é dinheiro reservado (pote) do que é gasto planejado, e os fundos mostram o essencial primeiro, com o avançado depois.',
        'A Central de ajuda foi revisada e ganhou um guia novo sobre o modo simples.',
      ],
      en: [
        'In simple mode the bottom bar is now balanced: Home and Expenses on one side, Trip and Settings on the other, with the add button in the center.',
        'Every Copilot pattern card now has a worded read — "good sign", "worth a look" or "informational" — so you instantly know if it is positive, a light heads-up or just info.',
        'The phase preview now clearly separates reserved money (a pot) from planned spending, and funds show the essentials first with advanced options after.',
        'The Help Center was reviewed and gained a new guide about simple mode.',
      ],
      es: [
        'En el modo simple la barra inferior quedó equilibrada: Inicio y Gastos de un lado, Viaje y Ajustes del otro, con el botón de agregar en el centro.',
        'Cada tarjeta de patrón del Copiloto ahora tiene una lectura en palabras — "buena señal", "para vigilar" o "informativo" — para saber al instante si es algo positivo, un aviso leve o solo información.',
        'La vista previa de la fase separa mejor el dinero reservado (un bote) del gasto planificado, y los fondos muestran lo esencial primero y lo avanzado después.',
        'El Centro de ayuda fue revisado y sumó una nueva guía sobre el modo simple.',
      ],
    },
  },
  {
    version: '0.99.63',
    date: '2026-06-24',
    items: {
      'pt-BR': [
        'No acerto de contas, cada divisão agora mostra em que ponto do ciclo cada pessoa está: pendente (esperando o aceite), confirmado (combinado, já é dívida) e o novo "pago" quando a pessoa marcou que pagou.',
        'O botão "Compartilhar" da retrospectiva agora sempre dá um retorno visível — "compartilhado", "imagem salva" ou um aviso de erro — então no computador nunca mais parece que "não acontece nada".',
      ],
      en: [
        'In settle-up, each split now shows where each person is in the cycle: pending (waiting to accept), confirmed (agreed, already a debt) and the new "paid" once they mark it paid.',
        'The wrapped "Share" button now always gives visible feedback — "shared", "image saved" or an error notice — so on desktop it never again looks like "nothing happens".',
      ],
      es: [
        'En el ajuste de cuentas, cada división ahora muestra en qué punto del ciclo está cada persona: pendiente (esperando aceptar), confirmado (acordado, ya es deuda) y el nuevo "pagado" cuando la persona marca que pagó.',
        'El botón "Compartir" de la retrospectiva ahora siempre da una respuesta visible — "compartido", "imagen guardada" o un aviso de error — así en la computadora nunca más parece que "no pasa nada".',
      ],
    },
  },
  {
    version: '0.99.62',
    date: '2026-06-24',
    items: {
      'pt-BR': [
        'O botão do Amigo Sincero agora segue o cartão que você está lendo: no veredito leva ao impacto, no cartão de categoria também, no "te sobra por dia" abre a simulação e no movimento do cofrinho vai pro extrato.',
        'Quando um cartão não tem uma ação útil, o botão simplesmente não aparece — acabou o "Ver impacto" repetido que não levava a nada.',
        'Na tela inicial, o Amigo Sincero só aparece quando tem algo novo: ele não repete mais o que o carrossel de insights logo acima já está mostrando.',
      ],
      en: [
        'The Honest Friend button now follows the card you\'re reading: the verdict and the category card go to impact, "left per day" opens the simulator, and the piggy movement opens the statement.',
        'When a card has no useful action, the button simply doesn\'t show — no more repeated "See impact" that led nowhere.',
        'On the home screen, the Honest Friend only appears when it has something new to say: it no longer repeats what the insights carousel right above already shows.',
      ],
      es: [
        'El botón del Amigo Sincero ahora sigue la tarjeta que estás leyendo: el veredicto y la tarjeta de categoría van al impacto, "te queda por día" abre el simulador y el movimiento de la alcancía abre el extracto.',
        'Cuando una tarjeta no tiene una acción útil, el botón simplemente no aparece — se acabó el "Ver impacto" repetido que no llevaba a nada.',
        'En la pantalla inicial, el Amigo Sincero solo aparece cuando tiene algo nuevo que decir: ya no repite lo que el carrusel de insights justo arriba ya muestra.',
      ],
    },
  },
  {
    version: '0.99.61',
    date: '2026-06-24',
    items: {
      'pt-BR': [
        'O cofrinho ganhou uma seção fixa no Copiloto: você vê quanto já guardou e o último depósito, e abre o extrato completo num toque.',
        'Rótulos do cofrinho ficaram claros: "simulado", "será guardado no fechamento" e "já guardado" — sem mais confusão sobre o que já é seu.',
        'O resumo de ontem agora leva ao lugar certo: dia de economia abre o cofrinho (onde o dinheiro foi), dia de estouro abre a lista de gastos.',
        'A medalha de disciplina só aparece quando a sequência está de pé; quando ela zera, o ícone fica neutro em vez de parecer punição.',
        'Copiloto e Planejador deixaram de se contradizer: quando o vermelho do Planejador é só plano (alocação futura), o app diz que seu gasto real está em dia — ajuste o plano, não o ritmo.',
      ],
      en: [
        'The piggy bank now has a fixed section in the Copilot: see how much you\'ve already saved and your latest deposit, and open the full statement in one tap.',
        'Piggy labels are now clear: "simulated", "will be saved at close" and "already saved" — no more confusion about what is actually yours.',
        'Yesterday\'s recap now lands in the right place: a saving day opens the piggy (where the money went), an over day opens the expense list.',
        'The discipline medal only shows while the streak is alive; when it resets, the icon goes neutral instead of feeling like a punishment.',
        'The Copilot and the Planner stopped contradicting each other: when the Planner\'s red is just plan (future allocation), the app says your real spend is on track — adjust the plan, not your pace.',
      ],
      es: [
        'La alcancía ahora tiene una sección fija en el Copiloto: ves cuánto has guardado y tu último depósito, y abres el extracto completo con un toque.',
        'Las etiquetas de la alcancía quedaron claras: "simulado", "se guardará al cierre" y "ya guardado" — sin más confusión sobre lo que ya es tuyo.',
        'El resumen de ayer ahora cae en el lugar correcto: un día de ahorro abre la alcancía (a dónde fue el dinero), un día de exceso abre la lista de gastos.',
        'La medalla de disciplina solo aparece mientras la racha está viva; cuando se reinicia, el ícono se vuelve neutro en lugar de sentirse como un castigo.',
        'El Copiloto y el Planificador dejaron de contradecirse: cuando el rojo del Planificador es solo plan (asignación futura), la app dice que tu gasto real está al día — ajusta el plan, no tu ritmo.',
      ],
    },
  },
  {
    version: '0.99.60',
    date: '2026-06-24',
    items: {
      'pt-BR': [
        'A tela de uma saída deixou de ser só leitura: agora você renomeia a saída e muda a data dela ali mesmo.',
        'Cada item da saída virou um atalho — toque para ver ou editar aquele gasto sem precisar caçar item por item.',
        'Quando a saída foi paga por uma pessoa, aparece "pago por…"; e se ela foi dividida, dá para abrir a divisão completa (quem ficou com o quê) num toque.',
        'Todo gasto que faz parte de uma saída agora mostra um atalho "Parte de · [saída]" que leva direto para a saída.',
      ],
      en: [
        'An outing screen is no longer read-only: you can rename the outing and change its date right there.',
        'Each outing item is now a shortcut — tap to view or edit that expense without hunting item by item.',
        'When one person paid, a "paid by…" tag shows up; and if the outing was split, the full division (who got what) is one tap away.',
        'Every expense that belongs to an outing now shows a "Part of · [outing]" shortcut that jumps straight to it.',
      ],
      es: [
        'La pantalla de una salida ya no es solo lectura: ahora puedes renombrar la salida y cambiar su fecha ahí mismo.',
        'Cada ítem de la salida es ahora un atajo — toca para ver o editar ese gasto sin buscar ítem por ítem.',
        'Cuando una persona pagó, aparece "pagado por…"; y si la salida se dividió, la división completa (quién se quedó con qué) está a un toque.',
        'Todo gasto que forma parte de una salida ahora muestra un atajo "Parte de · [salida]" que lleva directo a ella.',
      ],
    },
  },
  {
    version: '0.99.59',
    date: '2026-06-24',
    items: {
      'pt-BR': [
        'Lista de gastos mais coerente: tocar numa categoria (ou num cartão do painel) não estoura mais a nota em itens soltos. Cada saída continua sendo uma linha só, agora com o subtotal daquela categoria e quantos itens dela entraram ("3 itens nesta categoria").',
        'O toque na saída abre o detalhe completo — total cheio e todos os itens — então nada se perde.',
        'Só a busca por texto mostra item a item, que é quando você está mesmo caçando uma linha específica.',
      ],
      en: [
        'More coherent expense list: tapping a category (or a dashboard card) no longer explodes a receipt into loose items. Each outing stays a single row, now showing that category\'s subtotal and how many of its items matched ("3 items in this category").',
        'Tapping the outing opens the full detail — full total and every item — so nothing is lost.',
        'Only a text search itemises, which is exactly when you are hunting a specific line.',
      ],
      es: [
        'Lista de gastos más coherente: tocar una categoría (o una tarjeta del panel) ya no estalla el recibo en ítems sueltos. Cada salida sigue siendo una sola línea, ahora con el subtotal de esa categoría y cuántos de sus ítems coincidieron ("3 ítems en esta categoría").',
        'Tocar la salida abre el detalle completo — total entero y todos los ítems — así no se pierde nada.',
        'Solo la búsqueda por texto muestra ítem por ítem, que es justo cuando buscas una línea concreta.',
      ],
    },
  },
  {
    version: '0.99.58',
    date: '2026-06-24',
    items: {
      'pt-BR': [
        'Cores mais honestas: as barras de progresso só ficam vermelhas quando há um problema de verdade (o dinheiro acabou, estourou o limite ou entrou na reserva). Chegar perto do fim de uma fase não assusta mais.',
        'Foco dos campos mais discreto: ao tocar num campo de texto, sumiu aquela borda laranja forte — o foco por teclado continua visível para quem navega sem o dedo.',
        'Atalhos mais equilibrados: no botão (+), "Iniciar saída" e "Dividir conta" agora ficam lado a lado; nas Configurações, "Guia" e "Central de ajuda" abrem em dupla.',
        'Sem barra de rolagem aparecendo onde não devia — a rolagem continua funcionando, só a barrinha some.',
      ],
      en: [
        'More honest colors: progress bars only turn red on a real problem (money is out, over the limit, or into your reserve). Being near the end of a phase no longer looks scary.',
        'Subtler field focus: tapping a text field no longer draws that bold orange border — the keyboard focus ring stays visible for people navigating without touch.',
        'More balanced shortcuts: in the (+) button, "Start an outing" and "Split a bill" now sit side by side; in Settings, "Guide" and "Help center" open as a pair.',
        'No scrollbar showing up where it should not — scrolling still works, only the little bar is gone.',
      ],
      es: [
        'Colores más honestos: las barras de progreso solo se ponen rojas cuando hay un problema real (se acabó el dinero, te pasaste del límite o entraste en la reserva). Acercarse al fin de una fase ya no asusta.',
        'Foco de los campos más discreto: tocar un campo de texto ya no dibuja ese borde naranja fuerte — el foco por teclado sigue visible para quien navega sin tocar.',
        'Atajos más equilibrados: en el botón (+), "Iniciar salida" y "Dividir cuenta" ahora van lado a lado; en Ajustes, "Guía" y "Centro de ayuda" abren en pareja.',
        'Sin barra de desplazamiento apareciendo donde no debe — el desplazamiento sigue funcionando, solo desaparece la barrita.',
      ],
    },
  },
  {
    version: '0.99.57',
    date: '2026-06-24',
    items: {
      'pt-BR': [
        'Divisão de contas mais clara: o saldo de cada pessoa ("recebe" ou "deve") fica sempre legível, sem ambiguidade sobre quem deve quanto.',
        'Quando todo mundo se acerta, aparece um selo "Tudo acertado ✓" — o fechamento tranquilo que mostra que ninguém deve mais nada a ninguém.',
      ],
      en: [
        'Clearer bill splitting: each person\'s balance ("gets back" or "owes") stays always legible, with no doubt about who owes how much.',
        'When everyone is square, an "All settled ✓" seal appears — the calm closing that shows nobody owes anyone anymore.',
      ],
      es: [
        'División de cuentas más clara: el saldo de cada persona ("recibe" o "debe") queda siempre legible, sin dudas sobre quién debe cuánto.',
        'Cuando todos se saldan, aparece un sello "Todo saldado ✓" — el cierre tranquilo que muestra que nadie le debe nada a nadie.',
      ],
    },
  },
  {
    version: '0.99.56',
    date: '2026-06-24',
    items: {
      'pt-BR': [
        'Planner mais claro: uma legenda explica o que é "essencial" e "opcional", e um item travado agora diz por que está bloqueado (toque no cadeado para ajustar).',
        'Conversor já abre com a sua moeda de casa do outro lado e mostra um exemplo no campo, em vez de um "0" sem graça.',
        'Resiliência visível: um selo discreto "funciona offline" no Conversor e no Comparador deixa claro que dá pra usar mesmo sem rede.',
        'No Comparador por foto, uma dica ensina a enquadrar a etiqueta de preço (não o produto inteiro) para a leitura acertar mais.',
      ],
      en: [
        'Clearer Planner: a legend explains what "essential" and "optional" mean, and a locked item now says why it is blocked (tap the lock to adjust).',
        'The Converter now opens with your home currency on the other side and shows an example in the field instead of a bare "0".',
        'Visible resilience: a discreet "works offline" seal on the Converter and Comparator makes it clear you can use them with no network.',
        'In the photo Comparator, a tip teaches you to frame the price tag (not the whole product) so the read lands more often.',
      ],
      es: [
        'Planner más claro: una leyenda explica qué es "esencial" y "opcional", y un ítem bloqueado ahora dice por qué lo está (toca el candado para ajustar).',
        'El Conversor ahora abre con tu moneda de casa del otro lado y muestra un ejemplo en el campo en vez de un "0" soso.',
        'Resiliencia visible: un sello discreto "funciona sin conexión" en el Conversor y el Comparador deja claro que puedes usarlos sin red.',
        'En el Comparador por foto, un consejo enseña a encuadrar la etiqueta de precio (no el producto entero) para que la lectura acierte más.',
      ],
    },
  },
  {
    version: '0.99.55',
    date: '2026-06-24',
    items: {
      'pt-BR': [
        'O Amigo Sincero ganhou vozes de verdade: ao trocar o tom (suave, sincero, durão ou econômico), o texto muda de personalidade — o durão fala na lata, o suave acalma, o econômico pensa na sua reserva.',
        'Ao encerrar uma saída, aparece um resumo carinhoso: total gasto, duração, quantas rodadas e como você foi em relação ao alvo — com um atalho para o resumo completo.',
      ],
      en: [
        'The Honest Friend now has real voices: switching the tone (gentle, honest, blunt or thrifty) actually changes the personality of the text — blunt tells it straight, gentle soothes, thrifty thinks of your reserve.',
        'When you wrap up an outing, a warm recap appears: total spent, duration, rounds and how you did versus your target — with a shortcut to the full summary.',
      ],
      es: [
        'El Amigo Sincero ahora tiene voces de verdad: al cambiar el tono (suave, sincero, directo o ahorrador), el texto cambia de personalidad — el directo habla sin rodeos, el suave calma, el ahorrador piensa en tu reserva.',
        'Al cerrar una salida, aparece un resumen cálido: total gastado, duración, rondas y cómo te fue respecto al objetivo — con un atajo al resumen completo.',
      ],
    },
  },
  {
    version: '0.99.54',
    date: '2026-06-24',
    items: {
      'pt-BR': [
        'Primeiro minuto mais calmo: os avisos do topo (demonstração, backup, localização) agora giram num único espaço, em vez de empilhar — nada some, é só deslizar.',
        'O número "livre" ficou mais claro: ganhou uma linha de explicação e um atalho "posso gastar?" que já abre o simulador.',
        'Quando a fase está toda planejada, no lugar de um "€0" que assusta aparece uma frase tranquila ("tudo planejado").',
        'O chip do topo agora mostra o modo (Viagem ou Dia a dia), e um ⓘ explica os termos de dinheiro com link para a Ajuda.',
      ],
      en: [
        'Calmer first minute: the top notices (demo, backup, location) now rotate in a single slot instead of stacking — nothing is gone, just swipe.',
        'The "free" number is clearer: it now has a one-line explanation and a "can I spend?" shortcut that opens the simulator.',
        'When the phase is fully planned, a reassuring line ("all planned") replaces a bare "€0" that read as broke.',
        'The top chip now shows the mode (Trip or Day-to-day), and an ⓘ explains the money terms with a link to Help.',
      ],
      es: [
        'Primer minuto más tranquilo: los avisos de arriba (demo, copia, ubicación) ahora rotan en un solo espacio en vez de apilarse — nada desaparece, solo desliza.',
        'El número "libre" es más claro: ahora tiene una línea de explicación y un atajo "¿puedo gastar?" que abre el simulador.',
        'Cuando la fase está toda planificada, una frase tranquila ("todo planificado") reemplaza un "€0" seco que parecía estar sin dinero.',
        'El chip de arriba ahora muestra el modo (Viaje o Día a día), y un ⓘ explica los términos de dinero con enlace a la Ayuda.',
      ],
    },
  },
  {
    version: '0.99.53',
    date: '2026-06-24',
    items: {
      'pt-BR': [
        'Boas-vindas renovadas: já na primeira tela você escolhe entre criar uma Viagem (com datas) ou começar no Dia a dia (contínuo, sem data para acabar).',
        'O Dia a dia agora nasce direto no primeiro acesso — dê um nome e, se quiser, um teto mensal; nada é obrigatório.',
        'Importar backup, receber de outro aparelho e os dados de demonstração continuam ali, agrupados de forma mais discreta — e o botão de demonstração ficou mais fácil de ver.',
      ],
      en: [
        'Refreshed welcome: right on the first screen you choose between creating a Trip (with dates) or starting a Day-to-day (continuous, no end date).',
        'The Day-to-day can now be created right at first launch — give it a name and, if you like, a monthly cap; nothing is required.',
        'Import backup, receive from another device and the demo data are still there, grouped more discreetly — and the demo button is now easier to see.',
      ],
      es: [
        'Bienvenida renovada: ya en la primera pantalla eliges entre crear un Viaje (con fechas) o empezar el Día a día (continuo, sin fecha de fin).',
        'El Día a día ahora se crea desde el primer acceso — ponle un nombre y, si quieres, un tope mensual; nada es obligatorio.',
        'Importar copia, recibir de otro dispositivo y los datos de demostración siguen ahí, agrupados de forma más discreta — y el botón de demostración es más fácil de ver.',
      ],
    },
  },
  {
    version: '0.99.52',
    date: '2026-06-24',
    items: {
      'pt-BR': [
        'A aba Viagem agora reúne tudo num só lugar: a antiga tela de "Visão geral" foi incorporada ao hub da viagem.',
        'Compartilhar ficou mais fácil: o resumo da viagem (em imagem) agora sai direto de um botão no topo da aba Viagem.',
        'Links e atalhos antigos para a Visão geral continuam funcionando — levam direto para a aba Viagem.',
      ],
      en: [
        'The Trip tab now brings everything together: the old "Overview" screen is folded into the trip hub.',
        'Sharing is easier: the trip summary (as an image) now comes straight from a button at the top of the Trip tab.',
        'Old links and shortcuts to the Overview still work — they take you right to the Trip tab.',
      ],
      es: [
        'La pestaña Viaje ahora reúne todo en un solo lugar: la antigua pantalla de "Resumen" se integró al hub del viaje.',
        'Compartir es más fácil: el resumen del viaje (como imagen) ahora sale directo de un botón en la parte superior de la pestaña Viaje.',
        'Los enlaces y accesos antiguos al Resumen siguen funcionando — te llevan directo a la pestaña Viaje.',
      ],
    },
  },
  {
    version: '0.99.51',
    date: '2026-06-24',
    items: {
      'pt-BR': [
        'Telas mais legíveis: textos secundários e o botão principal ganharam mais contraste, mais fáceis de ler em qualquer tema.',
        'Mais acessível: anel de foco visível ao navegar pelo teclado e a aba ativa do menu agora é anunciada por leitores de tela.',
        'Acabamento visual: a cor da inteligência (índigo) ficou consistente em todo o app, inclusive no tema claro, e as animações ficaram mais suaves.',
      ],
      en: [
        'More legible screens: secondary text and the primary button got more contrast, easier to read in any theme.',
        'More accessible: a visible focus ring when navigating by keyboard, and the active menu tab is now announced by screen readers.',
        'Visual polish: the AI color (indigo) is now consistent across the app, including the light theme, and animations are smoother.',
      ],
      es: [
        'Pantallas más legibles: el texto secundario y el botón principal ganaron más contraste, más fáciles de leer en cualquier tema.',
        'Más accesible: un anillo de foco visible al navegar con el teclado, y la pestaña activa del menú ahora la anuncian los lectores de pantalla.',
        'Acabado visual: el color de la IA (índigo) ahora es consistente en toda la app, incluido el tema claro, y las animaciones son más suaves.',
      ],
    },
  },
  {
    version: '0.99.50',
    date: '2026-06-22',
    items: {
      'pt-BR': [
        'O Comparador de custo-benefício agora lê fotos: fotografe as etiquetas (várias de uma vez) e ele preenche preço e quantidade sozinho — depois é só conferir e ver qual vale mais por kg, litro ou unidade.',
        'O que vem da foto fica marcado em amarelo ("confira") pra você confirmar antes de decidir; sem conexão ou sem foto, dá pra digitar normalmente.',
        'Reorganizamos o botão +: "Registrar mercado" voltou para a fila principal e o Comparador foi para "Mais ações" (continua a um toque, e a leitura por foto fica na própria tela do comparador).',
      ],
      en: [
        'The Cost-benefit comparator now reads photos: snap the shelf tags (several at once) and it fills in price and quantity for you — then just confirm and see which is the better buy per kg, litre or unit.',
        'Anything read from a photo is marked in amber ("check") for you to confirm before deciding; with no connection or no photo, you can still type it in.',
        'We reorganized the + button: "Register groceries" is back in the main row and the Comparator moved to "More actions" (still one tap away — its photo reading lives on the comparator screen).',
      ],
      es: [
        'El Comparador de costo-beneficio ahora lee fotos: fotografía las etiquetas (varias a la vez) y completa precio y cantidad por ti — luego solo confirma y mira qué conviene más por kg, litro o unidad.',
        'Lo leído de una foto se marca en ámbar ("revisar") para que lo confirmes antes de decidir; sin conexión o sin foto, puedes escribirlo igual.',
        'Reorganizamos el botón +: "Registrar mercado" volvió a la fila principal y el Comparador pasó a "Más acciones" (sigue a un toque; la lectura por foto está en la pantalla del comparador).',
      ],
    },
  },
  {
    version: '0.99.49',
    date: '2026-06-22',
    items: {
      'pt-BR': [
        'Chegou o Comparador de custo-benefício: descubra na hora qual embalagem vale mais por kg, litro ou unidade — ex.: 120 g por 1€ ou 200 g por 2€ — sem fazer conta de cabeça.',
        'Use no mercado por texto ou voz ("o que vale mais, 120g por 1 euro ou 200g por 2 euros?") ou preencha os itens na tela. É tudo local: não cria gasto, não gasta internet e funciona offline.',
        'Abra pelo botão + (em Planejar), pelo Guia ou pela Central de ajuda.',
      ],
      en: [
        'The Cost-benefit comparator has arrived: instantly see which pack is the better buy per kg, litre or unit — e.g. 120 g for €1 vs 200 g for €2 — with no mental math.',
        'Use it at the store by text or voice ("which is better, 120g for €1 or 200g for €2?") or fill the items on screen. It\'s all local: it logs no expense, uses no internet and works offline.',
        'Open it from the + button (under Plan), the Guide or the Help center.',
      ],
      es: [
        'Llegó el Comparador de costo-beneficio: descubre al instante qué envase conviene más por kg, litro o unidad — ej.: 120 g por 1€ o 200 g por 2€ — sin cálculos mentales.',
        'Úsalo en el súper por texto o voz ("¿qué conviene más, 120g por 1€ o 200g por 2€?") o completa los ítems en pantalla. Todo es local: no registra gastos, no usa internet y funciona sin conexión.',
        'Ábrelo desde el botón + (en Planificar), desde la Guía o el Centro de ayuda.',
      ],
    },
  },
  {
    version: '0.99.48',
    date: '2026-06-22',
    items: {
      'pt-BR': [
        'Chegou a Central de ajuda: tire suas dúvidas sobre o app buscando por uma palavra ou navegando por tema. Cada resposta traz um passo a passo e um atalho que abre a tela certa.',
        'É tudo local e instantâneo — a busca não usa internet nem IA, então funciona offline e na hora.',
        'Abra pela engrenagem (Configurações), pelo Copiloto ou pela busca: tente "dividir conta", "câmbio" ou "reembolso".',
      ],
      en: [
        'The Help center has arrived: get answers about the app by searching a word or browsing by topic. Every answer brings step-by-step instructions and a shortcut that opens the right screen.',
        "It's all local and instant — search uses no internet and no AI, so it works offline and right away.",
        'Open it from the gear (Settings), from the Copilot or via search: try "split bill", "exchange" or "reimbursement".',
      ],
      es: [
        'Llegó el Centro de ayuda: resuelve tus dudas sobre la app buscando una palabra o navegando por tema. Cada respuesta trae un paso a paso y un atajo que abre la pantalla correcta.',
        'Todo es local e instantáneo — la búsqueda no usa internet ni IA, así que funciona sin conexión y al momento.',
        'Ábrelo desde el engranaje (Configuración), desde el Copiloto o buscando: prueba "dividir cuenta", "cambio" o "reembolso".',
      ],
    },
  },
  {
    version: '0.99.47',
    date: '2026-06-22',
    items: {
      'pt-BR': [
        'Registrar reembolso ficou fácil: no Acerto de contas, marque que recebeu de alguém e escolha como (Pix, Wise, conta, dinheiro ou outro). O valor que a pessoa te devia diminui na hora e fica no histórico.',
        'Viagens novas já começam com o registro de local ligado — seus gastos guardam onde foram feitos. O GPS só é lido com a sua permissão e você desliga quando quiser nas Configurações (a gente avisa isso logo de cara).',
        'O planejador ficou mais tranquilo: abrir a tela não cria mais planos sozinho, e no Dia a dia ele explica que cenários são para viagens com datas.',
      ],
      en: [
        'Recording a reimbursement is now easy: in Settle-up, mark that someone paid you back and pick how (Pix, Wise, bank, cash or other). What that person owed you drops right away and shows in the history.',
        'New trips now start with location tagging on — your expenses remember where they happened. GPS is only read with your permission, and you can turn it off anytime in Settings (we tell you up front).',
        'The planner is calmer: opening it no longer creates plans on its own, and in Day-to-day it explains that scenarios are for dated trips.',
      ],
      es: [
        'Registrar un reembolso ahora es fácil: en el Ajuste de cuentas, marca que alguien te pagó y elige cómo (Pix, Wise, banco, efectivo u otro). Lo que esa persona te debía baja al instante y queda en el historial.',
        'Los viajes nuevos empiezan con el registro de lugar activado — tus gastos recuerdan dónde se hicieron. El GPS solo se lee con tu permiso y lo apagas cuando quieras en Configuración (te lo avisamos de entrada).',
        'El planificador está más tranquilo: abrirlo ya no crea planes solo, y en Día a día explica que los escenarios son para viajes con fechas.',
      ],
    },
  },
  {
    version: '0.99.46',
    date: '2026-06-22',
    items: {
      'pt-BR': [
        'Quando a IA bate o limite gratuito, agora ela é honesta: mostra o tempo real de espera (uma contagem regressiva de verdade) ou avisa “volta mais tarde” — nunca um erro seco.',
        'O registro manual fica a um toque e não perde o que você já tinha digitado: o texto vira a descrição do gasto na hora.',
        'Nos bastidores, o painel interno ganhou governança de IA (uso do dia/mês, % do limite gratuito e projeção de usuários) e mais detalhes por usuário para suporte.',
      ],
      en: [
        'When AI hits the free limit it’s now honest: it shows the real wait time (a true countdown) or says “comes back later” — never a blunt error.',
        'Manual entry is one tap away and keeps what you already typed: your text becomes the expense description right away.',
        'Behind the scenes, the internal panel gained AI governance (today/month usage, % of the free limit and a user projection) plus more per-user detail for support.',
      ],
      es: [
        'Cuando la IA alcanza el límite gratuito ahora es honesta: muestra el tiempo real de espera (una cuenta regresiva de verdad) o avisa “vuelve más tarde” — nunca un error seco.',
        'El registro manual queda a un toque y no pierde lo que ya escribiste: tu texto se vuelve la descripción del gasto al instante.',
        'En segundo plano, el panel interno ganó gobernanza de IA (uso del día/mes, % del límite gratuito y proyección de usuarios) y más detalle por usuario para soporte.',
      ],
    },
  },
  {
    version: '0.99.45',
    date: '2026-06-22',
    items: {
      'pt-BR': [
        'Chegou o conversor de moedas: digite um valor, escolha as duas moedas e veja na hora quanto dá.',
        'Ele usa a cotação que o app já guardou — com a data dela sempre à vista — e oferece taxa manual para quando você estiver sem internet.',
        'Abra pelo botão +, pelo Copiloto ou pelo guia. E dá para perguntar à IA: “quanto é 20 euros em reais?”.',
      ],
      en: [
        'The currency converter is here: type an amount, pick the two currencies and see the result instantly.',
        'It uses the rate the app already saved — with its date always in view — and offers a manual rate for when you’re offline.',
        'Open it from the + button, the Copilot or the guide. You can also ask the AI: “how much is 20 euros in reais?”.',
      ],
      es: [
        'Llegó el conversor de monedas: escribe un monto, elige las dos monedas y ve el resultado al instante.',
        'Usa la cotización que la app ya guardó — con su fecha siempre a la vista — y ofrece tasa manual para cuando estés sin internet.',
        'Ábrelo desde el botón +, el Copiloto o la guía. Y puedes preguntarle a la IA: “¿cuánto es 20 euros en reales?”.',
      ],
    },
  },
  {
    version: '0.99.44',
    date: '2026-06-22',
    items: {
      'pt-BR': [
        'A nota lida por IA agora vem completa: ela também identifica a data da compra, o local e a categoria de cada item.',
        'Esses detalhes já chegam preenchidos no bloco “Data e local” — e você edita a data e o lugar com um toque antes de salvar.',
        'Resultado: a nota cai no dia em que aconteceu e com o lugar certo, do jeito que um gasto manual ficaria.',
      ],
      en: [
        'AI-read receipts now come complete: they also pick up the purchase date, the place and each item’s category.',
        'Those details arrive pre-filled in the “Date and place” block — edit the date and the place in one tap before saving.',
        'The upshot: the note lands on the day it happened and with the right place, just like a manual expense would.',
      ],
      es: [
        'La cuenta leída por IA ahora viene completa: también detecta la fecha de compra, el lugar y la categoría de cada ítem.',
        'Esos detalles llegan ya rellenados en el bloque “Fecha y lugar” — edita la fecha y el lugar en un toque antes de guardar.',
        'El resultado: la cuenta cae en el día en que ocurrió y con el lugar correcto, igual que un gasto manual.',
      ],
    },
  },
  {
    version: '0.99.43',
    date: '2026-06-22',
    items: {
      'pt-BR': [
        'Toda foto agora te dá as duas opções num toque: tirar a foto na hora ou escolher da galeria — no recibo, nos anexos e na saída.',
        'Dá pra adicionar uma pessoa na hora, sem sair da tela: ao registrar um gasto ou conferir uma nota, toque em “+ pessoa” e ela já entra na divisão.',
        'A entrada por IA agora aceita foto: fotografe a nota e ela vira um gasto resumido — e, se quiser detalhar item a item, toque em “abrir itens”. O registro manual também ganhou um atalho ✨ IA.',
      ],
      en: [
        'Every photo now gives you both options in one tap: take it now or pick from the gallery — on receipts, attachments and outings.',
        'You can add a person on the spot, without leaving the screen: while logging an expense or reviewing a receipt, tap “+ person” and they join the split right away.',
        'AI entry now takes photos: snap the receipt and it becomes one summarized expense — tap “open items” to break it down line by line. The manual form also got an ✨ AI shortcut.',
      ],
      es: [
        'Cada foto ahora te da las dos opciones en un toque: tomarla al momento o elegir de la galería — en recibos, adjuntos y salidas.',
        'Puedes agregar una persona al instante, sin salir de la pantalla: al registrar un gasto o revisar una cuenta, toca “+ persona” y entra en la división enseguida.',
        'La entrada con IA ahora acepta fotos: fotografía la cuenta y se convierte en un gasto resumido — toca “abrir ítems” para desglosarla. El registro manual también tiene un atajo ✨ IA.',
      ],
    },
  },
  {
    version: '0.99.42',
    date: '2026-06-22',
    items: {
      'pt-BR': [
        'A tela de iniciar uma saída ganhou as margens certas — o conteúdo não fica mais colado na borda.',
        'Configurar uma saída agora só pergunta o que faz sentido pra ela: o preço médio da bebida aparece só em saída de bar/balada, não no mercado nem no transporte.',
        'Dá pra encerrar uma saída sem salvar: começou errado? Toque em encerrar e escolha “Descartar” — tudo o que você registrou some e o orçamento volta ao que era antes de começar.',
      ],
      en: [
        'The “start an outing” screen now has the right margins — the content no longer sticks to the edge.',
        'Configuring an outing now only asks what’s relevant to it: the average drink price shows up only for a bar/night out, not for the market or transport.',
        'You can end an outing without saving it: started it wrong? Tap end and choose “Discard” — everything you logged disappears and your budget goes back to what it was.',
      ],
      es: [
        'La pantalla de iniciar una salida ahora tiene los márgenes correctos — el contenido ya no queda pegado al borde.',
        'Configurar una salida ahora solo pregunta lo que tiene sentido para ella: el precio medio de la bebida aparece solo en una salida de bar/noche, no en el mercado ni en el transporte.',
        'Puedes terminar una salida sin guardarla: ¿empezaste mal? Toca terminar y elige “Descartar” — todo lo que registraste desaparece y tu presupuesto vuelve a como estaba.',
      ],
    },
  },
  {
    version: '0.99.41',
    date: '2026-06-22',
    items: {
      'pt-BR': [
        'O Cofrinho agora tem voz e extrato: toque no card pra abrir o histórico e ver, dia a dia, de onde veio cada centavo guardado e pra onde foi quando você passou do ritmo.',
        'O Amigo Sincero te avisa quando o cofrinho mexe (“rendeu X” ou “cobriu X”) e, com um toque, abre o extrato.',
        'Escolha o tom do Amigo Sincero — Padrão, Zen, Durão ou Econômico — em Configurações. Dica: deslize o carrossel até o fim pra descobrir.',
        'Notas e saídas agora contam como 1 ocasião no carrossel da tela inicial — uma nota de 40 itens não vira mais 40 “outros”.',
      ],
      en: [
        'The Cofrinho now has a voice and a statement: tap the card to open its history and see, day by day, where each saved cent came from and where it went when you went over pace.',
        'The Amigo Sincero tells you when the cofrinho moves (“earned X” or “covered X”) and, with a tap, opens the statement.',
        'Choose the Amigo Sincero’s tone — Default, Zen, Tough or Frugal — in Settings. Tip: swipe the carousel to the end to discover it.',
        'Receipts and outings now count as 1 occasion in the home carousel — a 40-item receipt no longer shows up as 40 “other”.',
      ],
      es: [
        'El Cofrinho ahora tiene voz y extracto: toca la tarjeta para abrir su historial y ver, día a día, de dónde vino cada moneda ahorrada y a dónde fue cuando te pasaste del ritmo.',
        'El Amigo Sincero te avisa cuando el cofrinho se mueve (“ganó X” o “cubrió X”) y, con un toque, abre el extracto.',
        'Elige el tono del Amigo Sincero — Estándar, Zen, Duro o Ahorrador — en Configuración. Tip: desliza el carrusel hasta el final para descubrirlo.',
        'Notas y salidas ahora cuentan como 1 ocasión en el carrusel de inicio — una nota de 40 ítems ya no aparece como 40 “otros”.',
      ],
    },
  },
  {
    version: '0.99.40',
    date: '2026-06-22',
    items: {
      'pt-BR': [
        'Agora você pode ter várias viagens ao mesmo tempo: abra os Espaços (no topo da tela inicial) e troque entre elas num toque — cada uma com seu próprio orçamento e histórico.',
        'Novo modo Dia a dia: crie um espaço sem data de fim (Casa, gastos do mês…), com teto mensal opcional, só pra registrar seus gastos fora de uma viagem.',
        'O menu “+” agora fecha quando você aperta o botão Voltar do celular — sem sair da tela em que você estava.',
        'Seu aparelho ganha um nome automático (como “Android · Chrome”) quando você não escolhe um, pra aparecer direitinho em backups e divisões. Dá pra trocar em Configurações.',
      ],
      en: [
        'You can now keep several trips at once: open Spaces (at the top of the home screen) and switch between them in one tap — each with its own budget and history.',
        'New Day-to-day mode: create a space with no end date (Home, this month’s spending…), with an optional monthly cap, just to track expenses outside a trip.',
        'The “+” menu now closes when you press your phone’s Back button — without leaving the screen you were on.',
        'Your device gets an automatic name (like “Android · Chrome”) when you don’t pick one, so it shows up nicely in backups and splits. You can change it in Settings.',
      ],
      es: [
        'Ahora puedes tener varios viajes a la vez: abre los Espacios (en la parte superior de la pantalla de inicio) y cambia entre ellos con un toque — cada uno con su propio presupuesto e historial.',
        'Nuevo modo Día a día: crea un espacio sin fecha de fin (Casa, gastos del mes…), con tope mensual opcional, solo para registrar tus gastos fuera de un viaje.',
        'El menú “+” ahora se cierra cuando presionas el botón Atrás del teléfono — sin salir de la pantalla en la que estabas.',
        'Tu dispositivo recibe un nombre automático (como “Android · Chrome”) cuando no eliges uno, para que aparezca bien en copias de seguridad y divisiones. Puedes cambiarlo en Configuración.',
      ],
    },
  },
  {
    version: '0.99.39',
    date: '2026-06-21',
    items: {
      'pt-BR': [
        'Quando o app trava, agora ele envia um relatório de erro anônimo pra gente consertar mais rápido — só a mensagem técnica do erro, nunca seus valores nem o conteúdo dos gastos. Continua junto da telemetria e desativável em Configurações.',
      ],
      en: [
        'When the app crashes, it now sends an anonymous error report so we can fix it faster — just the technical error message, never your amounts or the content of your expenses. It rides with telemetry and stays off-switchable in Settings.',
      ],
      es: [
        'Cuando la app falla, ahora envía un informe de error anónimo para arreglarlo más rápido — solo el mensaje técnico del error, nunca tus importes ni el contenido de tus gastos. Va junto con la telemetría y se puede desactivar en Configuración.',
      ],
    },
  },
  {
    version: '0.99.38',
    date: '2026-06-21',
    items: {
      'pt-BR': [
        'TripPilot está com a cara nova: um novo ícone — um pin de viagem com uma bússola. No iPhone e na web ele já aparece; no Android, ao instalar a próxima versão do app.',
      ],
      en: [
        'TripPilot has a fresh look: a new icon — a travel pin with a compass. On iPhone and the web it shows up right away; on Android, after you install the next app version.',
      ],
      es: [
        'TripPilot estrena imagen: un nuevo ícono — un pin de viaje con una brújula. En iPhone y en la web ya aparece; en Android, al instalar la próxima versión de la app.',
      ],
    },
  },
  {
    version: '0.99.37',
    date: '2026-06-21',
    items: {
      'pt-BR': [
        'Ao começar, o app agora sempre pergunta o seu nome (e um e-mail opcional, que fica só no seu aparelho) — assim você nunca mais aparece como “Eu”.',
      ],
      en: [
        'When you start, the app now always asks your name (plus an optional e-mail that stays only on your device) — so you never show up as “Me” again.',
      ],
      es: [
        'Al empezar, la app ahora siempre pregunta tu nombre (y un correo opcional, que se queda solo en tu dispositivo) — así nunca más apareces como “Yo”.',
      ],
    },
  },
  {
    version: '0.99.36',
    date: '2026-06-21',
    items: {
      'pt-BR': [
        'Refinamos a telemetria de uso anônima: agora ela só conta quem realmente configurou o app, sem ruído de visitas vazias. Nada muda pra você — continua sem valores e desativável nas Configurações.',
      ],
      en: [
        'We refined the anonymous usage telemetry: it now only counts people who actually set up the app, with no noise from empty visits. Nothing changes for you — still no amounts, still off-switchable in Settings.',
      ],
      es: [
        'Refinamos la telemetría de uso anónima: ahora solo cuenta a quienes realmente configuraron la app, sin ruido de visitas vacías. Nada cambia para ti — sigue sin importes y desactivable en Configuración.',
      ],
    },
  },
  {
    version: '0.99.35',
    date: '2026-06-21',
    items: {
      'pt-BR': [
        'Ajude o app a melhorar: agora enviamos, de forma anônima e ligada por padrão, dados de uso (seu nome e quantas viagens, gastos e divisões você criou) — nunca valores nem o conteúdo dos seus gastos. Dá pra desativar em Configurações a qualquer momento.',
      ],
      en: [
        'Help the app improve: we now send anonymous usage data (your name and how many trips, expenses and splits you created), on by default — never amounts or the content of your expenses. You can turn it off in Settings anytime.',
      ],
      es: [
        'Ayuda a mejorar la app: ahora enviamos datos de uso anónimos (tu nombre y cuántos viajes, gastos y divisiones creaste), activado por defecto — nunca importes ni el contenido de tus gastos. Puedes desactivarlo en Configuración cuando quieras.',
      ],
    },
  },
  {
    version: '0.99.34',
    date: '2026-06-21',
    items: {
      'pt-BR': [
        'Cobrar/adicionar ficou tão fácil quanto dividir: em Acerto de contas, ao adicionar uma pessoa, agora vem a lista de “Amigos conectados” — toque num e ele entra como pessoa da viagem na hora, sem digitar nome nem refazer QR. A dívida já passa a ir pra ele.',
        'Trocou de celular? Quando um amigo conectado aparece com um aparelho novo, surge um botão “Reconectar novo aparelho de {nome}”: um toque religa a pessoa ao novo aparelho sem recadastrar nada — e suas dívidas continuam exatamente as mesmas.',
      ],
      en: [
        'Charging/adding is now as easy as splitting: in Settle up, when you add a person, a “Connected friends” list appears — tap one and they become a trip person right away, no typing a name, no QR redo. Their debts start flowing to them.',
        'New phone? When a connected friend shows up on a new device, a “Reconnect {name}’s new device” button appears: one tap re-links the person to the new device with no re-adding — and your debts stay exactly the same.',
      ],
      es: [
        'Cobrar/agregar es ahora tan fácil como dividir: en Ajuste de cuentas, al agregar a una persona aparece la lista de “Amigos conectados” — toca uno y entra como persona del viaje al instante, sin escribir el nombre ni rehacer el QR. Sus deudas empiezan a llegarle.',
        '¿Cambió de teléfono? Cuando un amigo conectado aparece con un dispositivo nuevo, surge un botón “Reconectar el nuevo dispositivo de {nombre}”: un toque revincula a la persona al nuevo dispositivo sin volver a registrar nada — y tus deudas quedan exactamente iguales.',
      ],
    },
  },
  {
    version: '0.99.33',
    date: '2026-06-21',
    items: {
      'pt-BR': [
        'Sua agenda de amigos num lugar só: em Acerto de contas → Conexões agora aparece a lista de todos os aparelhos que você já pareou, com status honesto — conectado (dá pra avisar agora), aguardando (mandamos, falta responder) ou reconectar (precisa parear de novo) — e quando cada um foi visto pela última vez.',
        'É o mesmo teto pra tudo de conexão: ver seus amigos, mostrar seu QR pra parear e receber de outro aparelho, lado a lado.',
      ],
      en: [
        'Your friends, all in one place: in Settle up → Connections you now see every device you’ve paired with, each with an honest status — connected (we can ping now), waiting (sent, awaiting reply) or reconnect (needs to pair again) — plus when each was last seen.',
        'One roof for everything connection: see your friends, show your QR to pair, and receive from another device, side by side.',
      ],
      es: [
        'Tu agenda de amigos en un solo lugar: en Ajuste de cuentas → Conexiones ahora ves todos los dispositivos con los que te conectaste, cada uno con estado honesto — conectado (podemos avisar ahora), esperando (enviado, falta respuesta) o reconectar (hay que parear de nuevo) — y cuándo se vio cada uno por última vez.',
        'Un mismo techo para todo lo de conexión: ver a tus amigos, mostrar tu QR para parear y recibir desde otro dispositivo, lado a lado.',
      ],
    },
  },
  {
    version: '0.99.32',
    date: '2026-06-21',
    items: {
      'pt-BR': [
        'Agora seus amigos já conectados aparecem na divisão: ao adicionar uma pessoa à conta, vem uma lista de “Amigos conectados” — toque num e ele entra na divisão na hora, sem refazer QR. Quando esse amigo já é uma pessoa da viagem atual, a divisão se liga a ele automaticamente (a dívida vai direto pra ele).',
        'Cada amigo mostra um status honesto: conectado (dá pra avisar agora), aguardando (mandamos, falta ele responder) ou reconectar (precisa parear de novo). A caixa de digitar um nome novo continua ali, do lado.',
      ],
      en: [
        'Your already-connected friends now show up in the split: when you add someone to the bill, a “Connected friends” list appears — tap one and they join the split right away, no QR redo. When that friend is already a person on the current trip, the split links to them automatically (the debt goes straight to them).',
        'Each friend shows an honest status: connected (we can ping now), waiting (sent, awaiting their reply) or reconnect (needs to pair again). The type-a-new-name box is still right there.',
      ],
      es: [
        'Tus amigos ya conectados ahora aparecen en la división: al agregar a alguien a la cuenta, sale una lista de “Amigos conectados” — toca uno y entra en la división al instante, sin rehacer el QR. Cuando ese amigo ya es una persona del viaje actual, la división se vincula a él automáticamente (la deuda le llega directo).',
        'Cada amigo muestra un estado honesto: conectado (podemos avisar ahora), esperando (enviado, falta su respuesta) o reconectar (hay que parear de nuevo). La caja para escribir un nombre nuevo sigue ahí al lado.',
      ],
    },
  },
  {
    version: '0.99.31',
    date: '2026-06-21',
    items: {
      'pt-BR': [
        'Agora a Saída e a divisão de conta conversam: ao encerrar uma saída, além de “Confirmar e encerrar”, aparece “Dividir esta saída com outras pessoas”. Toque e a tela de divisão já abre com cada rodada virando um item — sem refazer nada. Marque quem pegou o quê, passe o celular pela mesa ou compartilhe ao vivo, igual a qualquer divisão.',
        'O gasto é MOVIDO, não duplicado: quando você fecha a divisão, a saída original sai do orçamento na mesma hora (nada conta em dobro), e o “Desfazer” traz a saída de volta exatamente como estava.',
      ],
      en: [
        'Outings and bill-splitting now talk to each other: when you end an outing, alongside “Confirm and end” there’s now “Split this outing with others”. Tap it and the divide screen opens with each round already turned into an item — no redo. Mark who got what, pass the phone around the table, or share it live, just like any split.',
        'The expense is MOVED, not duplicated: when you close the split, the original outing leaves your budget at once (nothing is counted twice), and “Undo” brings the outing back exactly as it was.',
      ],
      es: [
        'Ahora la Salida y la división de cuenta se hablan: al finalizar una salida, junto a “Confirmar y finalizar” aparece “Dividir esta salida con otras personas”. Tócalo y la pantalla de división se abre con cada ronda ya convertida en ítem — sin rehacer nada. Marca quién consumió qué, pasa el teléfono por la mesa o compártelo en vivo, como cualquier división.',
        'El gasto se MUEVE, no se duplica: al cerrar la división, la salida original sale del presupuesto al instante (nada se cuenta dos veces), y “Deshacer” devuelve la salida tal como estaba.',
      ],
    },
  },
  {
    version: '0.99.30',
    date: '2026-06-21',
    items: {
      'pt-BR': [
        'A entrada por IA ganhou um “O que eu posso pedir?”: um guia clicável, dividido em categorias que abrem e fecham (gastos rápidos, alguém pagou, paguei por alguém, dividir, vários gastos numa frase, entradas, carteiras, dívidas, planejar, abrir telas). Toque em qualquer exemplo e ele já entra na caixa pronto pra enviar ou ajustar — é a forma mais rápida de descobrir tudo o que dá pra falar com a IA.',
      ],
      en: [
        'AI entry now has a “What can I ask?” guide: a tappable cheat-sheet split into collapsible categories (quick expenses, someone paid, I paid for someone, split, several expenses in one sentence, income, wallets, debts, plan, open screens). Tap any example and it drops into the box ready to send or tweak — the fastest way to discover everything you can say to the AI.',
      ],
      es: [
        'La entrada por IA ahora tiene un “¿Qué puedo pedir?”: una guía con ejemplos, dividida en categorías que se abren y cierran (gastos rápidos, alguien pagó, pagué por alguien, dividir, varios gastos en una frase, ingresos, billeteras, deudas, planear, abrir pantallas). Toca cualquier ejemplo y entra en la caja listo para enviar o ajustar — la forma más rápida de descubrir todo lo que puedes decirle a la IA.',
      ],
    },
  },
  {
    version: '0.99.29',
    date: '2026-06-21',
    items: {
      'pt-BR': [
        'A entrada por IA (texto ou voz) agora entende uma frase com VÁRIOS gastos de uma vez. Dá pra contar a noite inteira numa tacada: “o Bruno me pagou um sorvete de 2, a Débora uma água de 1, dividi um bolo de 10 com ela, paguei 4 de estacionamento e rachamos uma pizza de 10 nós 3”. A IA monta a lista na ordem — quem pagou, quanto e quem fica devendo a quem — e você confirma tudo num toque, com um “Desfazer” único.',
        'Se a frase citar gente que ainda não está na viagem, ela junta todos num único “adicionar” (em vez de perguntar um por um). Gastos em outra moeda ficam separados para você ajustar o câmbio na tela completa, sem bagunçar o orçamento.',
      ],
      en: [
        'AI entry (text or voice) now understands a single sentence with SEVERAL expenses at once. You can narrate the whole night in one go: “Bruno paid for my €2 ice cream, Débora a €1 water, I split a €10 cake with her, paid €4 parking and we split a €10 pizza 3 ways.” The AI builds the list in order — who paid, how much, who owes whom — and you confirm it all in one tap, with a single “Undo”.',
        'If the sentence mentions people not yet on the trip, it groups them into one “add” step (instead of asking one by one). Foreign-currency expenses are kept aside so you can set the rate in the full screen without skewing the budget.',
      ],
      es: [
        'La entrada por IA (texto o voz) ahora entiende una frase con VARIOS gastos a la vez. Puedes contar toda la noche de una: “Bruno me pagó un helado de 2, Débora un agua de 1, dividí un pastel de 10 con ella, pagué 4 de estacionamiento y repartimos una pizza de 10 entre los 3”. La IA arma la lista en orden — quién pagó, cuánto y quién le debe a quién — y lo confirmas todo de un toque, con un único “Deshacer”.',
        'Si la frase menciona personas que aún no están en el viaje, las agrupa en un solo “agregar” (en vez de preguntar una por una). Los gastos en otra moneda quedan aparte para que ajustes el cambio en la pantalla completa sin descuadrar el presupuesto.',
      ],
    },
  },
  {
    version: '0.99.28',
    date: '2026-06-21',
    items: {
      'pt-BR': [
        'Escanear nota e Dividir conta deixaram de ser “dois apps para a mesma foto”: depois de ler uma nota em Gastos → Escanear nota, agora aparece “Dividir ao vivo”. Com um toque, a mesma leitura vira uma mesa ao vivo (cada pessoa marca o que pegou no próprio celular) — sem precisar fotografar de novo.',
      ],
      en: [
        'Scan receipt and Split the bill stopped being “two apps for the same photo”: after reading a receipt in Expenses → Scan receipt, a “Split live” action now appears. One tap turns that same read into a live table (everyone marks what they had on their own phone) — no re-scan needed.',
      ],
      es: [
        'Escanear recibo y Dividir la cuenta dejaron de ser “dos apps para la misma foto”: tras leer un recibo en Gastos → Escanear recibo, ahora aparece “Dividir en vivo”. Con un toque, esa misma lectura se vuelve una mesa en vivo (cada persona marca lo que pidió en su propio teléfono) — sin volver a escanear.',
      ],
    },
  },
  {
    version: '0.99.27',
    date: '2026-06-20',
    items: {
      'pt-BR': [
        'No simulador “posso gastar?”, depois do veredito agora aparece “Salvar como planejado”: cria um planejamento (evento ou pote) já com o valor que você simulou preenchido — não precisa mais reescrever tudo num planner em branco.',
      ],
      en: [
        'In the “can I spend?” simulator, after the verdict there’s now a “Save as planned” action: it creates a plan (event or pot) with the amount you just simulated already filled in — no more retyping it on a blank planner.',
      ],
      es: [
        'En el simulador “¿puedo gastar?”, tras el veredicto ahora aparece “Guardar como planeado”: crea un plan (evento o bote) con el monto que simulaste ya cargado — sin reescribir todo en un planner en blanco.',
      ],
    },
  },
  {
    version: '0.99.26',
    date: '2026-06-20',
    items: {
      'pt-BR': [
        'Mesa ao vivo ficou mais esperta com quem já usa o TripPilot: ao abrir o link, você é reconhecido pelo seu próprio perfil e não precisa mais digitar o nome — entra direto na mesa.',
        'No fim, quando você marcou seus itens, aparece um botão “Registrar minha parte no meu app”: com um toque, o seu pedaço da conta vira um gasto no SEU app, já mostrando o impacto no seu orçamento (“cabe no teto de hoje; sobram €X”). É à prova de duplicar — reabrir o link não cria o gasto de novo.',
        'Se a conta estiver em outra moeda, o botão abre a tela completa já preenchida para você ajustar o câmbio.',
      ],
      en: [
        'The live table is smarter with people who already use TripPilot: when you open the link you’re recognized by your own profile, so you no longer have to type your name — you go straight to the table.',
        'At the end, once you’ve claimed your items, a “Add my part to my app” button appears: one tap turns your slice of the bill into an expense in YOUR app, showing the budget impact (“fits today’s cap; €X left”). It’s duplicate-proof — reopening the link won’t book it twice.',
        'If the bill is in another currency, the button opens the full screen pre-filled so you can set the exchange rate.',
      ],
      es: [
        'La mesa en vivo es más inteligente con quienes ya usan TripPilot: al abrir el enlace eres reconocido por tu propio perfil, así que ya no tienes que escribir tu nombre — entras directo a la mesa.',
        'Al final, cuando marcaste tus ítems, aparece un botón “Registrar mi parte en mi app”: con un toque, tu parte de la cuenta se vuelve un gasto en TU app, mostrando el impacto en tu presupuesto (“cabe en el tope de hoy; quedan €X”). Es a prueba de duplicados — reabrir el enlace no lo crea de nuevo.',
        'Si la cuenta está en otra moneda, el botón abre la pantalla completa ya cargada para que ajustes el cambio.',
      ],
    },
  },
  {
    version: '0.99.25',
    date: '2026-06-20',
    items: {
      'pt-BR': [
        'Durante uma saída ao vivo agora dá pra adicionar gasto de dois jeitos novos, sem sair da tela: tocar em “Falar” e dizer o que foi (“cerveja 5 euros”), ou tocar em “Escanear nota” e fotografar a conta. Os dois caem direto na saída — abre uma confirmação rápida com o valor e o nome já preenchidos, é só conferir e adicionar.',
        'A voz usa a mesma captura confiável do resto do app e a leitura de nota usa o mesmo motor de OCR; se faltar internet ou o microfone, a saída segue funcionando normal no toque.',
      ],
      en: [
        'During a live outing you can now add an expense two new ways without leaving the screen: tap “Speak” and say what it was (“beer 5 euros”), or tap “Scan note” and photograph the bill. Both drop straight into the outing — a quick confirm opens with the amount and name pre-filled, just check and add.',
        'Voice uses the same reliable capture as the rest of the app and note-reading uses the same OCR engine; if the network or mic is unavailable, the outing keeps working normally by tap.',
      ],
      es: [
        'Durante una salida en vivo ahora puedes agregar un gasto de dos formas nuevas sin salir de la pantalla: toca “Hablar” y di qué fue (“cerveza 5 euros”), o toca “Escanear nota” y fotografía la cuenta. Ambos caen directo en la salida — se abre una confirmación rápida con el monto y el nombre ya cargados, solo revisa y agrega.',
        'La voz usa la misma captura confiable del resto de la app y la lectura de nota usa el mismo motor de OCR; si falta internet o el micrófono, la salida sigue funcionando normal al toque.',
      ],
    },
  },
  {
    version: '0.99.24',
    date: '2026-06-20',
    items: {
      'pt-BR': [
        'Conta com itens repetidos ficou justa: quando a nota traz “2 pedidos” do mesmo item, agora dá para pegar por unidade. Duas pessoas pegam um cada e pagam o preço cheio de uma unidade (sem dividir o item ao meio), e quem pega só uma de duas paga só uma — a outra fica livre para alguém. Na divisão, itens com quantidade mostram um seletor “− 1 +” por pessoa e o preço por unidade.',
        'Editar item agora tem controle de quantidade, então você corrige no app quando a leitura da nota errar o número de unidades.',
      ],
      en: [
        'Bills with repeated items are fairer now: when the receipt has “2 orders” of the same item, you can claim by the unit. Two people each take one and pay the full unit price (no halving the item), and taking one of two charges you for just one — the other stays free for someone else. In the split, multi-quantity items show a per-person “− 1 +” stepper and the per-unit price.',
        'The item editor now has a quantity control, so you can fix the unit count in-app when the receipt read it wrong.',
      ],
      es: [
        'Las cuentas con ítems repetidos quedaron más justas: cuando la nota trae “2 pedidos” del mismo ítem, ahora puedes tomarlo por unidad. Dos personas toman uno cada una y pagan el precio completo de una unidad (sin dividir el ítem a la mitad), y tomar una de dos te cobra solo una — la otra queda libre para alguien. En la división, los ítems con cantidad muestran un selector “− 1 +” por persona y el precio por unidad.',
        'El editor de ítem ahora tiene control de cantidad, así corriges en la app cuando la lectura de la nota se equivoca con el número de unidades.',
      ],
    },
  },
  {
    version: '0.99.23',
    date: '2026-06-20',
    items: {
      'pt-BR': [
        'Na aba “Viagem”, ao focar num trecho específico, a seção “Potes e planejados” agora mostra só o que pertence àquele trecho. Antes, um pote datado para outra fase (ex.: um pote que começa 23/jul) aparecia mesmo enquanto você via um trecho que termina antes (ex.: 15/jul). Potes sem data continuam aparecendo em todos os trechos, e a visão “Todas” continua mostrando tudo.',
      ],
      en: [
        'On the “Trip” tab, focusing on a specific leg now shows only the pots and plans that belong to that leg in “Pots & planned”. Before, a pot dated for another phase (e.g. one starting Jul 23) showed up even while you were viewing a leg that ends earlier (e.g. Jul 15). Dateless pots still appear on every leg, and the “All” view still shows everything.',
      ],
      es: [
        'En la pestaña “Viaje”, al enfocar un tramo específico, la sección “Potes y planificados” ahora muestra solo lo que pertenece a ese tramo. Antes, un pote con fecha de otra fase (p. ej. uno que empieza el 23/jul) aparecía aunque estuvieras viendo un tramo que termina antes (p. ej. 15/jul). Los potes sin fecha siguen apareciendo en todos los tramos, y la vista “Todas” sigue mostrando todo.',
      ],
    },
  },
  {
    version: '0.99.22',
    date: '2026-06-20',
    items: {
      'pt-BR': [
        'Gasto criado em “Dividir conta” agora mostra a divisão completa (quem pegou o quê e quanto cada um paga) ao abrir pelo histórico em “Todos” — antes essa parte só aparecia no filtro “sem carteira”. E ele deixou de aparecer duplicado na aba “Saídas”: divisão de conta é gasto, e fica só em Gastos.',
      ],
      en: [
        'An expense from “Split the bill” now opens straight to the full division (who took what and how much each owes) from the “All” history — before that detail only showed under the “no wallet” filter. It also no longer appears duplicated in the “Outings” tab: a split is an expense, so it lives only under Expenses.',
      ],
      es: [
        'El gasto creado en “Dividir cuenta” ahora muestra la división completa (quién tomó qué y cuánto paga cada uno) al abrirlo desde el historial en “Todos” — antes eso solo aparecía con el filtro “sin billetera”. Además dejó de aparecer duplicado en la pestaña “Salidas”: dividir una cuenta es un gasto y vive solo en Gastos.',
      ],
    },
  },
  {
    version: '0.99.21',
    date: '2026-06-20',
    items: {
      'pt-BR': [
        'Dividir conta: agora você consegue desmarcar um item que pegou mesmo quando é o único que pegou ele. Antes, se você marcasse sem querer, só dava pra desmarcar depois que outra pessoa também marcasse — corrigido.',
      ],
      en: [
        'Bill split: you can now un-tap an item you took even when you’re the only one who took it. Before, an accidental tap could only be undone after someone else also took it — fixed.',
      ],
      es: [
        'Dividir cuenta: ahora puedes desmarcar un ítem que tomaste aunque seas el único que lo tomó. Antes, si lo marcabas sin querer, solo podías deshacerlo cuando otra persona también lo marcaba — corregido.',
      ],
    },
  },
  {
    version: '0.99.20',
    date: '2026-06-20',
    items: {
      'pt-BR': [
        'Amigo sincero voltou a ser amigo: em vez de uma lista de números, ele fala com você de novo (“segura aí”, “ainda dá pra curtir”, “vai cobrar quem te deve”). Agora você desliza o dedo pra passar entre os recados — igual ao carrossel de insights — e ele some quando não tem nada pra dizer.',
      ],
      en: [
        'Honest friend feels like a friend again: instead of a list of numbers it talks to you (“ease off a bit”, “still room to enjoy”, “go collect what you’re owed”). Swipe to move between its reads — just like the insights carousel — and it hides when there’s nothing to say.',
      ],
      es: [
        'El amigo sincero volvió a ser un amigo: en vez de una lista de números te habla otra vez (“aflojá un poco”, “aún hay margen”, “ve a cobrar lo que te deben”). Desliza para pasar entre sus mensajes — igual que el carrusel de insights — y se oculta cuando no tiene nada que decir.',
      ],
    },
  },
  {
    version: '0.99.19',
    date: '2026-06-20',
    items: {
      'pt-BR': [
        'Voz muito mais confiável (testado internamente com áudio real, não só no aparelho). A gravação perdia o começo da fala e falhava nas tentativas seguintes porque reabria o microfone toda vez; agora reaproveita um único canal de áudio — grava desde o primeiro segundo e funciona toda vez que você toca em falar, não só na primeira.',
        'Se o microfone recusar o formato preferido, o app tenta um formato simples em vez de desistir.',
      ],
      en: [
        'Much more reliable voice (verified internally with real audio, not just on-device). Recording used to drop the first words and fail on later tries because it reopened the mic every time; it now reuses a single audio channel — it records from the first second and works every time you tap to speak, not only the first.',
        'If the mic rejects the preferred format, the app falls back to a plain request instead of giving up.',
      ],
      es: [
        'Voz mucho más confiable (verificado internamente con audio real, no solo en el dispositivo). La grabación perdía el inicio del habla y fallaba en los intentos siguientes porque reabría el micrófono cada vez; ahora reutiliza un único canal de audio — graba desde el primer segundo y funciona cada vez que tocas para hablar, no solo la primera.',
        'Si el micrófono rechaza el formato preferido, la app prueba uno simple en vez de rendirse.',
      ],
    },
  },
  {
    version: '0.99.18',
    date: '2026-06-20',
    items: {
      'pt-BR': [
        'Transcrição de voz consertada no Android: a gravação antiga virava um áudio sem duração definida e o reconhecimento só pegava um pedaço (aquele “E aí” do nada). Agora gravamos em WAV 16 kHz limpo — o que você fala é transcrito de verdade.',
        'Quando não dá pra captar áudio (toque sem querer, microfone mudo), o app avisa “não captei, tenta de novo” em vez de mandar um texto vazio pra IA.',
      ],
      en: [
        'Voice transcription fixed on Android: the old recording produced an audio clip with no defined duration and only a fragment got transcribed (the random “E aí”). We now capture clean 16 kHz WAV — what you say is actually transcribed.',
        'When no audio is captured (accidental tap, muted mic), the app says “didn’t catch that, try again” instead of sending empty text to the AI.',
      ],
      es: [
        'Transcripción de voz corregida en Android: la grabación anterior generaba un audio sin duración definida y solo se transcribía un fragmento (ese “E aí” de la nada). Ahora capturamos WAV 16 kHz limpio — lo que dices se transcribe de verdad.',
        'Cuando no se capta audio (toque accidental, micrófono en silencio), la app avisa “no capté, intenta de nuevo” en vez de mandar texto vacío a la IA.',
      ],
    },
  },
  {
    version: '0.99.17',
    date: '2026-06-20',
    items: {
      'pt-BR': [
        'Acerto de contas mais legível: quando você importa uma nota com vários itens, eles deixam de virar uma lista enorme — agora aparecem como UM evento (com o nome do lugar, a quantidade de itens e o total). Toque pra abrir e ver item por item.',
        'A tela de acerto de contas e o extrato de cada pessoa agora mostram só os primeiros e trazem um “Ver todos (N)” — nada de rolar sem parar quando há muitos gastos.',
        'Amigo sincero virou carrossel: em vez de travar num único recado (“esse gasto levou 1%…”), ele passa por vários — quanto já usou da fase, quanto sobra por dia, onde mais gastou e quanto têm a te devolver. Toque nas bolinhas pra navegar.',
      ],
      en: [
        'Cleaner settle-up: importing a receipt with many items no longer floods the list — they show as ONE event (place name, item count and total). Tap to open and see item by item.',
        'The settle-up screen and each person’s statement now show only the first few with a “View all (N)” toggle — no more endless scrolling when there are lots of expenses.',
        'Honest friend is now a carousel: instead of being stuck on a single line (“this spend took 1%…”), it cycles through several reads — how much of the phase you’ve used, how much is left per day, where most went, and what you’re owed. Tap the dots to navigate.',
      ],
      es: [
        'Ajuste de cuentas más legible: al importar un recibo con muchos ítems ya no se llena la lista — aparecen como UN evento (nombre del lugar, cantidad de ítems y total). Tócalo para abrir y ver ítem por ítem.',
        'La pantalla de ajuste de cuentas y el estado de cada persona ahora muestran solo los primeros con un “Ver todos (N)” — sin scroll infinito cuando hay muchos gastos.',
        'El amigo sincero ahora es un carrusel: en vez de quedarse en un solo mensaje (“este gasto se llevó 1%…”), pasa por varios — cuánto usaste de la fase, cuánto queda por día, dónde gastaste más y cuánto te deben. Toca los puntos para navegar.',
      ],
    },
  },
  {
    version: '0.99.16',
    date: '2026-06-20',
    items: {
      'pt-BR': [
        'Divisão pela IA corrigida: quando alguém paga e vocês dividem, o preview agora mostra a SUA parte (ex.: € 4 numa conta de € 12 ÷ 3) — antes ele mostrava o total errado. A gravação já estava certa; era só o texto do preview.',
        'Microfone (“Falar”) agora declarado no app para o Android pedir permissão. Requer instalar o APK novo — só a atualização automática (OTA) não habilita o microfone.',
      ],
      en: [
        'AI split fixed: when someone else pays and you split, the preview now shows YOUR share (e.g. € 4 of a € 12 ÷ 3 bill) — it used to show the wrong total. The saved debt was already correct; only the preview text was wrong.',
        'Microphone (“Speak”) is now declared so Android prompts for permission. Requires installing the new APK — the over-the-air update alone can’t enable the mic.',
      ],
      es: [
        'División por IA corregida: cuando otro paga y dividen, la vista previa ahora muestra TU parte (p. ej. € 4 de una cuenta de € 12 ÷ 3) — antes mostraba el total equivocado. La deuda guardada ya era correcta; solo el texto de la vista previa fallaba.',
        'El micrófono (“Hablar”) ahora está declarado para que Android pida permiso. Requiere instalar el nuevo APK — la actualización automática (OTA) por sí sola no habilita el micrófono.',
      ],
    },
  },
  {
    version: '0.99.15',
    date: '2026-06-20',
    items: {
      'pt-BR': [
        'A entrada por IA agora salva TUDO que um lançamento normal salva. Toque em “Ajustar detalhes” no preview pra revisar e editar valor, categoria, descrição, data, local, fundo e carteira — a IA já chega com tudo preenchido, você só ajusta o que precisar.',
        'Tira mais do que você fala: entende o local (“no bar do Zé”), a forma de pagamento (“no crédito”, “em dinheiro”) e datas relativas (“ontem”, “3 dias atrás”) — e só pergunta o que realmente falta.',
        'Mostra os mesmos avisos da entrada manual: gasto bem acima do normal, quanto sobra no fundo depois do gasto e o lembrete pra cobrar quem dividiu com você.',
        'Casos pesados (moeda estrangeira, divisão personalizada, fotos) agora abrem a edição completa já pré-preenchida com o que a IA entendeu — nada de recomeçar do zero.',
        'Igual à entrada manual: o local vira sticky e a categoria vira o próximo padrão depois de salvar pela IA.',
      ],
      en: [
        'AI quick entry now saves EVERYTHING a normal entry does. Tap “Adjust details” in the preview to review and edit amount, category, description, date, place, fund and wallet — the AI pre-fills it all, you only tweak what’s needed.',
        'Captures more of what you say: it understands the place (“at Zé’s bar”), the payment method (“on credit”, “cash”) and relative dates (“yesterday”, “3 days ago”) — and only asks for what’s genuinely missing.',
        'Shows the same hints as manual entry: an unusually high amount, how much is left in the fund after the expense, and the reminder to charge whoever split with you.',
        'Heavy cases (foreign currency, custom split, photos) now open the full editor already pre-filled with what the AI understood — no starting over.',
        'Just like manual entry: the place becomes sticky and the category becomes the next default after an AI save.',
      ],
      es: [
        'La entrada por IA ahora guarda TODO lo que guarda un registro normal. Toca “Ajustar detalles” en la vista previa para revisar y editar importe, categoría, descripción, fecha, lugar, fondo y billetera — la IA lo rellena todo, tú solo ajustas lo necesario.',
        'Capta más de lo que dices: entiende el lugar (“en el bar de Zé”), el medio de pago (“a crédito”, “en efectivo”) y fechas relativas (“ayer”, “hace 3 días”) — y solo pregunta lo que realmente falta.',
        'Muestra los mismos avisos que la entrada manual: un importe muy por encima de lo normal, cuánto queda en el fondo tras el gasto y el recordatorio para cobrar a quien dividió contigo.',
        'Los casos pesados (moneda extranjera, división personalizada, fotos) ahora abren la edición completa ya rellenada con lo que entendió la IA — sin empezar de cero.',
        'Igual que la entrada manual: el lugar se vuelve fijo y la categoría pasa a ser el próximo valor por defecto tras guardar con IA.',
      ],
    },
  },
  {
    version: '0.99.14',
    date: '2026-06-20',
    items: {
      'pt-BR': [
        'Entrada rápida com IA mais esperta nas divisões: quando outra pessoa paga e vocês racham (ex.: “o Bruno pagou 12,80 pelas tortilhas, dividimos entre ele, eu e a Débora”), agora entra só a SUA parte como dívida — não a conta inteira.',
        'Entende valores com vírgula e ponto de milhar (12,80 · 3,50 · 1.250,00) e não chuta mais uma moeda que você não falou (usa a moeda base da viagem).',
        'Resolve “ele/ela” pelo nome citado e ignora o “eu” na lista de quem dividiu, então a conta fecha certinha.',
      ],
      en: [
        'Smarter AI quick entry for splits: when someone else pays and you split it (“Bruno paid 12.80 for the tortillas, we split it between him, me and Débora”), only YOUR share is recorded as a debt — not the whole bill.',
        'Reads comma decimals and thousands dots (12,80 · 3,50 · 1.250,00) and no longer guesses a currency you didn’t say (it uses the trip’s base currency).',
        'Resolves “he/she” to the named person and ignores “me” in the list of who shared, so the math adds up.',
      ],
      es: [
        'Entrada rápida con IA más lista en las divisiones: cuando otra persona paga y lo reparten (“Bruno pagó 12,80 por las tortillas, lo dividimos entre él, yo y Débora”), ahora entra solo TU parte como deuda, no la cuenta entera.',
        'Entiende decimales con coma y separador de miles (12,80 · 3,50 · 1.250,00) y ya no adivina una moneda que no dijiste (usa la moneda base del viaje).',
        'Resuelve “él/ella” por el nombre mencionado e ignora el “yo” en la lista de quién dividió, para que las cuentas cuadren.',
      ],
    },
  },
  {
    version: '0.99.13',
    date: '2026-06-20',
    items: {
      'pt-BR': [
        'Retrospectiva da viagem no Copiloto: um resumo comemorativo com o total gasto, o maior dia, a categoria nº1, quanto rolou com outras pessoas, a sua hora de pico e a sua sequência de disciplina.',
        'Pode abrir a qualquer momento — antes da viagem terminar aparece como “prévia” — e compartilhar tudo como uma imagem bonita.',
        'Só mostra o que tem dado real: cada número some sozinho se ainda não houver gasto suficiente pra calcular.',
      ],
      en: [
        'Trip Wrapped in the Copilot: a celebratory recap with total spent, your biggest day, the #1 category, how much was shared with others, your peak hour and your discipline streak.',
        'Open it any time — before the trip ends it shows as a “preview” — and share the whole thing as a nice image.',
        'It only shows what the data supports: each stat hides itself when there isn\u2019t enough spend to compute it.',
      ],
      es: [
        'Resumen del viaje en el Copiloto: un repaso celebratorio con el total gastado, tu mayor día, la categoría nº1, cuánto fue con otras personas, tu hora pico y tu racha de disciplina.',
        'Se puede abrir en cualquier momento — antes de que termine el viaje aparece como “vista previa” — y compartir todo como una imagen.',
        'Solo muestra lo que los datos permiten: cada dato se oculta si aún no hay gasto suficiente para calcularlo.',
      ],
    },
  },
  {
    version: '0.99.12',
    date: '2026-06-20',
    items: {
      'pt-BR': [
        'Entrada rápida com IA: uma caixa nova (texto e voz) no topo do botão “+” pra registrar do seu jeito — “o Bruno me pagou uma cerveja de 2 euros”, “almoço 35 dividido com a Ana”, “tirei 100 do caixa”. A IA entende e leva pra ação certa (gasto, dívida, divisão, saque, transferência…).',
        'Você confirma antes de salvar: aparece uma prévia do que ela entendeu, ela pergunta só quando precisa (ex.: adicionar uma pessoa nova) e dá pra desfazer com um toque.',
        'Privacidade: as contas e os seus dados continuam 100% no aparelho — a IA recebe só nomes e o necessário pra ler a frase. Dá pra desligar ou esconder nomes em Ajustes.',
        'Sem internet ou IA indisponível? Cai automaticamente no registro manual de sempre — nada trava.',
      ],
      en: [
        'AI Quick Entry: a new box (text and voice) at the top of the “+” button to log things in your own words — “Bruno paid for my 2-euro beer”, “lunch 35 split with Ana”, “took 100 out of cash”. The AI understands and routes it to the right action (expense, debt, split, withdrawal, transfer…).',
        'You confirm before saving: it shows a preview of what it understood, asks only when needed (e.g. add a new person) and lets you undo with one tap.',
        'Privacy: the math and your data stay 100% on device — the AI only gets names and what it needs to read the sentence. You can turn it off or hide names in Settings.',
        'No internet or AI unavailable? It falls back to the usual manual entry automatically — nothing breaks.',
      ],
      es: [
        'Entrada rápida con IA: una caja nueva (texto y voz) arriba del botón “+” para registrar a tu manera — “Bruno me pagó una cerveza de 2 euros”, “almuerzo 35 dividido con Ana”, “saqué 100 de efectivo”. La IA entiende y lo lleva a la acción correcta (gasto, deuda, división, retiro, transferencia…).',
        'Confirmas antes de guardar: muestra una vista previa de lo que entendió, pregunta solo cuando hace falta (p. ej. agregar una persona nueva) y puedes deshacer con un toque.',
        'Privacidad: los cálculos y tus datos siguen 100% en el dispositivo — la IA solo recibe nombres y lo necesario para leer la frase. Puedes desactivarla u ocultar nombres en Ajustes.',
        '¿Sin internet o IA no disponible? Vuelve automáticamente al registro manual de siempre — nada se traba.',
      ],
    },
  },
  {
    version: '0.99.11',
    date: '2026-06-20',
    items: {
      'pt-BR': [
        'Dividiu uma transferência da Wise com alguém? A tela de classificar transferência agora mostra o mesmo explicador “Como funciona a divisão” que já aparece ao registrar, escanear nota e no Acerto de contas — a explicação fica idêntica nas quatro telas de divisão.',
      ],
      en: [
        'Splitting a Wise transfer with someone? The classify-transfer screen now shows the same “How splitting works” explainer used in Quick add, Receipt scan and Settle-up — identical wording across all four split screens.',
      ],
      es: [
        '¿Dividiste una transferencia de Wise con alguien? La pantalla de clasificar transferencia ahora muestra el mismo explicador “Cómo funciona la división” que ya aparece al registrar, escanear y en Ajuste de cuentas — idéntico en las cuatro pantallas de división.',
      ],
    },
  },
  {
    version: '0.99.10',
    date: '2026-06-20',
    items: {
      'pt-BR': [
        'Cobrança mais fácil de descobrir: quando alguém te deve e você ainda não cadastrou uma forma de pagamento, a tela de Acerto de contas mostra um atalho para adicionar a sua chave Pix, @tag da Wise ou conta — pra já entrar no lembrete.',
        'Polimento: a vibração do app agora só dispara depois do seu primeiro toque na tela, evitando uma falha silenciosa na abertura.',
      ],
      en: [
        'Easier to collect: when someone owes you and you haven\u2019t set up a payment method yet, the Settle-up screen shows a shortcut to add your Pix key, Wise @tag or bank — so it rides along in the reminder.',
        'Polish: the app\u2019s haptics now fire only after your first tap, avoiding a silent failure on launch.',
      ],
      es: [
        'M\u00e1s f\u00e1cil de cobrar: cuando alguien te debe y a\u00fan no configuraste una forma de pago, la pantalla de Ajuste de cuentas muestra un atajo para agregar tu clave Pix, @tag de Wise o cuenta — para que entre en el recordatorio.',
        'Pulido: la vibraci\u00f3n de la app ahora se activa solo despu\u00e9s de tu primer toque, evitando un fallo silencioso al abrir.',
      ],
    },
  },
  {
    version: '0.99.9',
    date: '2026-06-19',
    items: {
      'pt-BR': [
        'Formas de pagamento: cadastre como as pessoas podem te pagar — chave Pix, @tag da Wise, dados bancários ou um texto livre. Você escolhe quais e quantas quer deixar disponíveis.',
        'A mensagem de "Lembrar/Cobrar" já sai com as suas formas de pagamento no final — é só mandar no WhatsApp e a pessoa sabe exatamente como te pagar.',
        'Quem não cadastrar nenhuma forma continua com a mensagem de sempre — nada muda. Configure em Ajustes › Conexões › Formas de pagamento.',
      ],
      en: [
        'Payment methods: set up how people can pay you back — a Pix key, a Wise @tag, bank details or free text. You pick which ones and how many to publish.',
        'The "Remind" message now ends with your payment methods — just send it and the other person knows exactly how to pay you.',
        'If you set none, the message stays exactly as before — nothing changes. Configure it in Settings › Connections › Payment methods.',
      ],
      es: [
        'Formas de pago: configura cómo pueden pagarte — una clave Pix, una @tag de Wise, datos bancarios o un texto libre. Tú eliges cuáles y cuántas publicar.',
        'El mensaje de "Recordar/Cobrar" ahora termina con tus formas de pago — solo envíalo y la persona sabe exactamente cómo pagarte.',
        'Si no configuras ninguna, el mensaje queda igual que antes — nada cambia. Configúralo en Ajustes › Conexiones › Formas de pago.',
      ],
    },
  },
  {
    version: '0.99.8',
    date: '2026-06-19',
    items: {
      'pt-BR': [
        'As barras de rolagem voltaram a sumir em todas as telas — visual mais limpo, sem mudar nada do conteúdo.',
        'Nos gastos do dia e no calendário, os valores agora mostram o símbolo da moeda (ex.: € 46), não mais um número solto.',
        'Ao selecionar vários gastos, as ações (Categoria, Mover de fundo, Excluir) agora aparecem todas, lado a lado — nenhuma fica escondida.',
      ],
      en: [
        'Scrollbars are hidden again on every screen — cleaner look, same content.',
        'Daily spend and the calendar now show the currency symbol (e.g. €46), not a bare number.',
        'When you select several expenses, every action (Category, Move fund, Delete) is fully visible side by side — none are hidden.',
      ],
      es: [
        'Las barras de desplazamiento vuelven a ocultarse en todas las pantallas — más limpio, sin cambiar el contenido.',
        'En los gastos del día y en el calendario, los montos ahora muestran el símbolo de la moneda (ej.: €46), no un número suelto.',
        'Al seleccionar varios gastos, todas las acciones (Categoría, Mover de fondo, Eliminar) ahora se ven completas, una al lado de la otra — ninguna queda oculta.',
      ],
    },
  },
  {
    version: '0.99.7',
    date: '2026-06-19',
    items: {
      'pt-BR': [
        'Cobrar ficou instantâneo: logo depois de dividir um gasto, dá para "Lembrar" cada pessoa ali mesmo — com a mensagem pronta e o valor certo de cada um.',
        'A mensagem de cobrança já sai formatada para o Pix: é só mandar no WhatsApp.',
        'O valor de cada dívida ficou mais fácil de ler na tela de Acerto de contas.',
      ],
      en: [
        'Charging is now instant: right after you split an expense, you can "Remind" each person on the spot — with the message ready and each person\'s exact amount.',
        'The reminder message comes ready to pay: just send it in your chat.',
        'Each debt amount is now easier to read on the Settle up screen.',
      ],
      es: [
        'Cobrar ahora es instantáneo: justo después de dividir un gasto, puedes "Recordar" a cada persona ahí mismo — con el mensaje listo y el monto exacto de cada una.',
        'El mensaje de cobro sale listo para pagar: solo envíalo en tu chat.',
        'El monto de cada deuda ahora se lee más fácil en la pantalla de Ajuste de cuentas.',
      ],
    },
  },
  {
    version: '0.99.6',
    date: '2026-06-19',
    items: {
      'pt-BR': [
        'A tela de divisões virou "Acerto de contas": logo no topo você vê quanto tem a receber e a pagar, com o saldo do grupo de uma olhada.',
        'Botão "Lembrar" em quem te deve: gera uma mensagem pronta ("você me deve X") para você mandar no WhatsApp em um toque.',
        'Quem está conectado pelo app ou link e ainda não aceitou a parte agora aparece separado, em "Aguardando aceite" — sem se misturar com quem realmente já te deve.',
        'No Início, um novo card "Acerto de contas" mostra na hora quanto te devem e quanto você deve.',
      ],
      en: [
        'The split screen is now "Settle up": right at the top you see how much you\'re owed and how much you owe, with the group balance at a glance.',
        '"Remind" button on whoever owes you: it builds a ready-to-send message ("you owe me X") to fire off in your chat in one tap.',
        'People connected via the app or link who haven\'t accepted their share yet now show separately under "Awaiting acceptance" — no longer mixed in with who actually owes you.',
        'On Home, a new "Settle up" card shows at a glance how much you\'re owed and how much you owe.',
      ],
      es: [
        'La pantalla de divisiones ahora es "Ajuste de cuentas": arriba del todo ves cuánto tienes por cobrar y por pagar, con el saldo del grupo de un vistazo.',
        'Botón "Recordar" en quien te debe: arma un mensaje listo ("me debes X") para enviarlo en tu chat con un toque.',
        'Quienes están conectados por la app o el enlace y aún no aceptaron su parte ahora aparecen aparte, en "Esperando aceptación" — sin mezclarse con quien realmente te debe.',
        'En Inicio, una nueva tarjeta "Ajuste de cuentas" muestra al instante cuánto te deben y cuánto debes.',
      ],
    },
  },
  {
    version: '0.99.5',
    date: '2026-06-19',
    items: {
      'pt-BR': [
        'Corrigimos o "está me devendo": quando você divide um gasto com alguém que não usa o app, a dívida aparece na hora — não precisa mais ninguém confirmar para você ver quem te deve.',
        '"Pendente" agora é só para quem está conectado pelo próprio celular e ainda vai aceitar a parte — você não fica mais sendo cobrado para confirmar a dívida dos outros.',
      ],
      en: [
        'Fixed "who owes me": when you split an expense with someone who isn\'t on the app, the debt shows up right away — nobody has to confirm it for you to see who owes you.',
        '"Pending" is now only for people connected from their own phone who still have to accept their share — you\'re no longer nagged to confirm other people\'s debts.',
      ],
      es: [
        'Arreglamos "quién me debe": cuando divides un gasto con alguien que no usa la app, la deuda aparece al instante — nadie tiene que confirmarla para que veas quién te debe.',
        '"Pendiente" ahora es solo para quienes están conectados desde su propio teléfono y aún deben aceptar su parte — ya no se te pide confirmar la deuda de los demás.',
      ],
    },
  },
  {
    version: '0.99.4',
    date: '2026-06-19',
    items: {
      'pt-BR': [
        'Histórico completo da divisão, dos dois jeitos: "Por pessoa" (o que cada um pegou) e "Por item" (esse item foi pra quem). Itens que ninguém pegou aparecem como "cai em você", então você vê a conta toda.',
        'Na hora de registrar, "O que é meu" agora aparece em destaque — o que você paga é a primeira coisa que você vê.',
        'Notificação da divisão ao vivo: enquanto a mesa está rolando, uma notificação mostra o total e quem entrou, e um toque te leva direto de volta para a mesa.',
        'Novo modo "passar o celular pela mesa": entregue o aparelho, cada um diz o nome e marca o que pegou, toca em "próximo" e passa adiante. Dá para juntar com quem já tem o app.',
      ],
      en: [
        'Full split history, both ways: "By person" (what each one took) and "By item" (which item went to whom). Items nobody took show as "falls to you", so you always see the whole bill.',
        'At register time, "What\'s mine" is now front and center — what you pay is the first thing you see.',
        'Live-split notification: while the table is going, a notification shows the total and who joined, and a tap takes you straight back to the table.',
        'New "pass the phone around" mode: hand over the device, each person says their name and marks what they had, taps "next" and passes it on. You can merge with people who already have the app.',
      ],
      es: [
        'Historial completo de la división, de las dos formas: "Por persona" (lo que tomó cada uno) y "Por ítem" (ese ítem fue para quién). Los ítems que nadie tomó aparecen como "cae sobre ti", así ves la cuenta completa.',
        'Al registrar, "Lo que es mío" ahora aparece destacado — lo que pagas es lo primero que ves.',
        'Notificación de la mesa en vivo: mientras está en curso, una notificación muestra el total y quién entró, y un toque te lleva directo de vuelta a la mesa.',
        'Nuevo modo "pasar el teléfono por la mesa": entrega el dispositivo, cada uno dice su nombre y marca lo que pidió, toca "siguiente" y lo pasa. Puedes unir con quienes ya tienen la app.',
      ],
    },
  },
  {
    version: '0.99.3',
    date: '2026-06-19',
    items: {
      'pt-BR': [
        'A divisão agora é como uma saída de bar: enquanto está rolando, aparece um card na tela inicial e uma bolha flutuante em todas as telas para você voltar nela a qualquer momento.',
        'Tocou em "Dividir conta" com uma divisão aberta? O app pergunta se você quer voltar para ela ou começar uma nova.',
        '"Encerrar" agora é claro: registre a divisão como um gasto no histórico ou apenas pare de compartilhar o link e continue editando.',
        'Veja a divisão completa: quem ficou com o quê e como cada um entrou — você, alguém pelo link sem conta, ou um acompanhante pelo próprio app.',
      ],
      en: [
        'A split now behaves like a night out: while it\'s happening, a card shows on the home screen and a floating bubble follows you across every screen so you can jump back in anytime.',
        'Tapped "Split bill" with one already open? The app asks whether to resume it or start a new one.',
        '"End" is now clear: register the split as an expense in your history, or just stop sharing the link and keep editing.',
        'See the full split: who ended up with what and how each person joined — you, someone via the link with no account, or a companion through their own app.',
      ],
      es: [
        'La división ahora funciona como una salida: mientras está en curso, aparece una tarjeta en la pantalla de inicio y una burbuja flotante en todas las pantallas para volver a ella cuando quieras.',
        '¿Tocaste "Dividir cuenta" con una ya abierta? La app te pregunta si quieres volver a ella o empezar una nueva.',
        '"Cerrar" ahora es claro: registra la división como un gasto en tu historial, o solo deja de compartir el enlace y sigue editando.',
        'Ve la división completa: quién se quedó con qué y cómo entró cada uno — tú, alguien por el enlace sin cuenta, o un acompañante desde su propia app.',
      ],
    },
  },
  {
    version: '0.99.2',
    date: '2026-06-19',
    items: {
      'pt-BR': [
        'Correção crítica da mesa ao vivo: o app guardava uma versão antiga em cache e travava a sincronização — por isso o organizador ficava preso em "esperando alguém entrar" e ninguém via as escolhas dos outros. Agora tudo aparece em tempo real em todos os celulares.',
        'Compartilhar a mesa ficou completo: um toque abre QR code (para os outros escanearem na hora), copiar link e o menu de compartilhar do celular — as três opções sempre disponíveis.',
      ],
      en: [
        'Critical live-table fix: the app was keeping an old cached version that froze syncing — so the organizer was stuck on "waiting for someone to join" and nobody saw each other\'s picks. Everything now updates in real time on every phone.',
        'Sharing the table is now complete: one tap opens a QR code (for others to scan on the spot), copy link, and the phone\'s share menu — all three always available.',
      ],
      es: [
        'Corrección crítica de la mesa en vivo: la app guardaba una versión antigua en caché y trababa la sincronización — por eso el organizador quedaba en "esperando que alguien entre" y nadie veía las elecciones de los demás. Ahora todo aparece en tiempo real en todos los celulares.',
        'Compartir la mesa ahora es completo: un toque abre código QR (para que los demás escaneen al instante), copiar enlace y el menú de compartir del celular — las tres opciones siempre disponibles.',
      ],
    },
  },
  {
    version: '0.99.1',
    date: '2026-06-19',
    items: {
      'pt-BR': [
        'Dividir um gasto com alguém já conectado ficou automático: ao abrir a tela dessa pessoa, o extrato mais recente é enviado na hora para o aparelho dela — sem precisar tocar em "Atualizar".',
        'Quem recebeu um extrato compartilhado vê as novidades assim que volta ao app, mesmo que a tela tenha ficado em segundo plano.',
      ],
      en: [
        'Splitting an expense with someone already connected is now automatic: opening that person\'s screen sends the latest statement straight to their device — no "Refresh" tap needed.',
        'Anyone who received a shared statement sees the latest the moment they return to the app, even if the screen was in the background.',
      ],
      es: [
        'Dividir un gasto con alguien ya conectado ahora es automático: al abrir la pantalla de esa persona, se le envía al instante el resumen más reciente — sin tocar "Actualizar".',
        'Quien recibió un resumen compartido ve las novedades apenas vuelve a la app, aunque la pantalla haya estado en segundo plano.',
      ],
    },
  },
  {
    version: '0.99.0',
    date: '2026-06-18',
    items: {
      'pt-BR': [
        'A mesa ao vivo agora vive no servidor: mesmo que o organizador feche o app sem querer, todo mundo continua vendo em tempo real o que cada um escolheu.',
        'Reabriu o app? A mesa volta sozinha no mesmo link — sem precisar criar um link novo nem perder as escolhas.',
        'O status de conexão agora é de verdade — ao vivo, sincronizando ou sem conexão, com "atualizado há Xs" e um toque para reconectar.',
      ],
      en: [
        'The live table now lives on the server: even if the organizer closes the app by accident, everyone keeps seeing everyone\'s picks in real time.',
        'Reopen the app and the table comes back on the same link by itself — no new link, no lost picks.',
        'The connection status is now honest — live, syncing or offline, with "updated Xs ago" and a tap to reconnect.',
      ],
      es: [
        'La mesa en vivo ahora vive en el servidor: aunque el organizador cierre la app sin querer, todos siguen viendo en tiempo real lo que eligió cada uno.',
        '¿Reabriste la app? La mesa vuelve sola en el mismo enlace — sin crear un enlace nuevo ni perder las elecciones.',
        'El estado de conexión ahora es real — en vivo, sincronizando o sin conexión, con "actualizado hace Xs" y un toque para reconectar.',
      ],
    },
  },
  {
    version: '0.98.1',
    date: '2026-06-18',
    items: {
      'pt-BR': [
        'Corrigido o link da mesa ao vivo: no app ele estava saindo como "localhost" e não abria; agora vai com o endereço certo e funciona em qualquer celular.',
        'A mesa ao vivo volta a sincronizar na hora quando você reabre o app — as escolhas que chegaram com a tela em segundo plano aparecem na hora.',
      ],
      en: [
        'Fixed the live-table link: in the app it was going out as "localhost" and would not open; now it carries the correct address and works on any phone.',
        'The live table re-syncs the moment you return to the app — picks that arrived while it was in the background show up right away.',
      ],
      es: [
        'Corregido el enlace de la mesa en vivo: en la app salía como "localhost" y no abría; ahora lleva la dirección correcta y funciona en cualquier celular.',
        'La mesa en vivo se sincroniza al instante cuando vuelves a la app — las elecciones que llegaron con la pantalla en segundo plano aparecen enseguida.',
      ],
    },
  },
  {
    version: '0.98.0',
    date: '2026-06-18',
    items: {
      'pt-BR': [
        'Na mesa ao vivo, toque em "+" no nome de um convidado para torná-lo uma pessoa da viagem: a parte dele deixa de ser só um nome e vira uma dívida real.',
        'Se essa pessoa tiver o app, a fatia cai no celular dela e se atualiza sozinha quando você edita a conta — ela confirma ou contesta e você vê.',
        'Quem abre o link sem ter o app vê um convite discreto para começar a própria viagem no TripPilot.',
      ],
      en: [
        'On the live table, tap "+" on a guest\'s name to make them a trip person: their part stops being just a name and becomes a real debt.',
        'If that person has the app, their slice lands on their phone and updates itself when you edit the bill — they confirm or dispute and you see it.',
        'Anyone who opens the link without the app sees a gentle invite to start their own trip in TripPilot.',
      ],
      es: [
        'En la mesa en vivo, toca "+" en el nombre de un invitado para convertirlo en una persona del viaje: su parte deja de ser solo un nombre y pasa a ser una deuda real.',
        'Si esa persona tiene la app, su parte llega a su celular y se actualiza sola cuando editas la cuenta — confirma o reclama y tú lo ves.',
        'Quien abre el enlace sin la app ve una invitación discreta para empezar su propio viaje en TripPilot.',
      ],
    },
  },
  {
    version: '0.97.0',
    date: '2026-06-18',
    items: {
      'pt-BR': [
        'Dividir conta agora tem mesa ao vivo: toque em "Mesa ao vivo", mande o link no grupo e cada pessoa marca no próprio celular o que consumiu.',
        'As escolhas de todo mundo aparecem na hora na sua tela; o que ninguém pega cai em você, e a sua parte continua certa em tempo real.',
        'No fim vira um único gasto, como sempre — e o link expira sozinho. Você segue como a fonte da verdade da divisão.',
      ],
      en: [
        'Split a bill now has a live table: tap "Live table", drop the link in the group, and everyone taps what they had on their own phone.',
        'Everyone\'s picks show up on your screen instantly; whatever no one claims falls to you, and your part stays correct in real time.',
        'It still ends as a single expense — and the link expires on its own. You remain the source of truth for the split.',
      ],
      es: [
        'Dividir cuenta ahora tiene mesa en vivo: toca "Mesa en vivo", envía el enlace al grupo y cada uno marca en su celular lo que consumió.',
        'Las elecciones de todos aparecen al instante en tu pantalla; lo que nadie toma cae en ti, y tu parte se mantiene correcta en tiempo real.',
        'Al final queda como un único gasto, como siempre — y el enlace expira solo. Sigues siendo la fuente de la verdad del reparto.',
      ],
    },
  },
  {
    version: '0.96.0',
    date: '2026-06-18',
    items: {
      'pt-BR': [
        'Nova tela "Dividir conta": tire uma foto da conta (ou digite os itens) e divida por item, por igual ou só o seu.',
        'Cada pessoa toca no que consumiu (passa o celular): meio item ou dividido entre vários sai em um toque, e a taxa de serviço entra sozinha e é rateada.',
        'No fim vira um único gasto, já mostrando quanto a sua parte pesa no orçamento de hoje — e com desfazer caso erre.',
      ],
      en: [
        'New "Split a bill" screen: snap a photo of the bill (or type the items) and split by item, equally, or just yours.',
        'Everyone taps what they had (pass the phone): half an item or shared by several is one tap, and the service charge is added and split automatically.',
        'It ends as a single expense, already showing how much your part weighs on today\'s budget — with undo if you slip.',
      ],
      es: [
        'Nueva pantalla "Dividir cuenta": saca una foto de la cuenta (o escribe los ítems) y divide por ítem, por igual o solo lo tuyo.',
        'Cada persona toca lo que consumió (pasa el teléfono): medio ítem o dividido entre varios sale en un toque, y el cargo por servicio entra solo y se reparte.',
        'Al final queda como un único gasto, mostrando cuánto pesa tu parte en el presupuesto de hoy — con deshacer por si te equivocas.',
      ],
    },
  },
  {
    version: '0.95.0',
    date: '2026-06-18',
    items: {
      'pt-BR': [
        'No "Disponível por dia", tocar num dia agora explica o número: ele vem da sua reserva livre da fase, distribuída pelos dias.',
        'Num dia de pico, o app mostra que aquele dia recebe mais que um dia comum (e quanto seria num dia comum).',
        'No "Gastos por dia", tocar num dia mostra um resumo do que foi gasto por categoria (ex.: Mercado, Bar, Transporte) — não só o total. A lista completa continua em Gastos recentes.',
      ],
      en: [
        'In "Available per day", tapping a day now explains the number: it comes from your free phase reserve, spread across the days.',
        'On a peak day, the app shows that the day gets more than a regular day (and what a regular day would be).',
        'In "Spending per day", tapping a day shows a summary of what was spent by category (e.g. Groceries, Bar, Transport) — not just the total. The full list stays in Recent expenses.',
      ],
      es: [
        'En "Disponible por día", tocar un día ahora explica el número: viene de tu reserva libre de la fase, repartida entre los días.',
        'En un día pico, la app muestra que ese día recibe más que un día normal (y cuánto sería un día normal).',
        'En "Gastos por día", tocar un día muestra un resumen de lo gastado por categoría (ej.: Mercado, Bar, Transporte) — no solo el total. La lista completa sigue en Gastos recientes.',
      ],
    },
  },
  {
    version: '0.94.0',
    date: '2026-06-18',
    items: {
      'pt-BR': [
        'Menu do botão "+" reequilibrado: "Planejar um gasto" e "Simular compra" agora aparecem direto, sem precisar abrir um submenu.',
        '"Começar saída" segue em destaque, logo acima dos dois botões principais (registrar gasto e escanear nota).',
        '"Registrar mercado" — que é só um registrar gasto já com a categoria preenchida — saiu do destaque e foi para dentro de "Outros registros", junto com transferência, saque e entrada.',
      ],
      en: [
        'The "+" menu was rebalanced: "Plan an expense" and "Simulate a purchase" now show up directly, no submenu to open.',
        '"Start an outing" stays prominent, right above the two main buttons (register expense and scan receipt).',
        '"Add groceries" — which is just an expense with the category pre-filled — was moved out of the spotlight into "Other entries", alongside transfer, withdrawal and income.',
      ],
      es: [
        'El menú del botón "+" fue reequilibrado: "Planear un gasto" y "Simular compra" ahora aparecen directamente, sin abrir un submenú.',
        '"Comenzar salida" sigue destacado, justo encima de los dos botones principales (registrar gasto y escanear recibo).',
        '"Registrar mercado" — que es solo un registrar gasto con la categoría ya puesta — salió del destaque y pasó a "Otros registros", junto con transferencia, retiro e ingreso.',
      ],
    },
  },
  {
    version: '0.93.0',
    date: '2026-06-18',
    items: {
      'pt-BR': [
        'Os cards de atividade na tela inicial voltaram a abrir mostrando primeiro as suas metas planejadas (bar, restaurante, mercado…) — coloridas e com ícone — em vez de pular pros "outros gastos".',
        'Corrigido o carrossel que se reposicionava sozinho num card do meio quando você rolava a tela; agora ele fica parado no começo e você desliza pro lado quando quiser.',
      ],
      en: [
        'The activity cards on the home screen open again showing your planned goals first (bar, restaurant, groceries…) — colourful and with their icon — instead of jumping to "other spending".',
        'Fixed the carousel that re-positioned itself on a middle card when you scrolled the page; it now stays put at the start and you swipe sideways when you want.',
      ],
      es: [
        'Las tarjetas de actividad en la pantalla de inicio vuelven a abrir mostrando primero tus metas planificadas (bar, restaurante, mercado…) — con color e icono — en vez de saltar a los "otros gastos".',
        'Corregido el carrusel que se reposicionaba solo en una tarjeta del medio al desplazar la pantalla; ahora se queda al inicio y deslizas al lado cuando quieras.',
      ],
    },
  },
  {
    version: '0.92.0',
    date: '2026-06-18',
    items: {
      'pt-BR': [
        'Amigo sincero repensado pra quando o dinheiro acaba: quando o livre da fase chega a zero, ele diz a verdade — "acabou o dinheiro livre desta fase" — em vez de dizer que ainda cabe dentro do plano.',
        'Ele agora deixa claro o seu estado real: se você já entrou na reserva protegida (e quanto), ou se o que resta já está todo reservado pro seu plano.',
        '"Ver impacto completo" passou a destacar o MAIOR gasto da fase — o que realmente pesou — em vez de um gasto pequeno qualquer.',
        'Modo resgate, quando não há mais livre, virou um plano de recuperação: mostra o que dá pra cortar e quanto você recupera, sem a calculadora de "guardar X" que não fazia sentido ali.',
      ],
      en: [
        'Honest friend rethought for when the money runs out: when the phase has no free money left, it tells the truth — "you\'re out of free money this phase" — instead of saying it still fits within the plan.',
        'It now makes your real state clear: whether you\'ve dipped into your protected reserve (and by how much), or what\'s left is fully reserved for your plan.',
        '"See full impact" now highlights the BIGGEST spend of the phase — the one that really weighed — instead of some small spend.',
        'Rescue mode, when there is no free money left, becomes a recovery plan: it shows what you can cut and how much you get back, dropping the "save €X" calculator that made no sense there.',
      ],
      es: [
        'Amigo sincero repensado para cuando el dinero se acaba: cuando la fase se queda sin dinero libre, dice la verdad — "se acabó el dinero libre de esta fase" — en vez de decir que aún cabe dentro del plan.',
        'Ahora deja claro tu estado real: si ya entraste en tu reserva protegida (y cuánto), o si lo que queda está todo reservado para tu plan.',
        '"Ver impacto completo" ahora destaca el MAYOR gasto de la fase — el que de verdad pesó — en vez de un gasto pequeño cualquiera.',
        'El modo rescate, cuando no queda nada libre, se convierte en un plan de recuperación: muestra qué puedes recortar y cuánto recuperas, sin la calculadora de "guardar X" que no tenía sentido ahí.',
      ],
    },
  },
  {
    version: '0.91.0',
    date: '2026-06-18',
    items: {
      'pt-BR': [
        'A saída ativa não rola mais a tela: o bloco de fotos saiu de dentro dela (as fotos entram na revisão da saída) e a linha de "próxima rodada" que ocupava espaço foi removida.',
        'Ao adicionar uma foto (em qualquer tela), você escolhe: "Tirar foto agora" abre a câmera, ou "Escolher da galeria" usa uma foto do aparelho.',
        'Os avisos do topo só desfazem quando você toca no botão "Desfazer" — tocar em qualquer outro lugar não desfaz mais; e dá pra deslizar o aviso pro lado pra tirá-lo da tela na hora.',
        'Os insights da tela inicial ganharam uma barrinha "Veja mais no copiloto" que leva direto ao Copiloto, com mais análises.',
      ],
      en: [
        'The active outing no longer scrolls: the photo block moved out of it (photos now go on the outing review) and the space-eating "next round" line was removed.',
        'Adding a photo (on any screen) now lets you choose: "Take a photo now" opens the camera, or "Choose from gallery" uses a photo already on your device.',
        'Top toasts only undo when you tap the "Undo" button — tapping anywhere else no longer undoes anything; and you can swipe a toast aside to dismiss it instantly.',
        'Home insights gained a thin "See more in the copilot" bar that takes you straight to the Copilot, with more analyses.',
      ],
      es: [
        'La salida activa ya no hace scroll: el bloque de fotos salió de dentro (las fotos van a la revisión de la salida) y se quitó la línea de "próxima ronda" que ocupaba espacio.',
        'Al añadir una foto (en cualquier pantalla) ahora eliges: "Tomar una foto ahora" abre la cámara, o "Elegir de la galería" usa una foto del dispositivo.',
        'Los avisos de arriba solo deshacen cuando tocas el botón "Deshacer" — tocar en cualquier otro lugar ya no deshace nada; y puedes deslizar el aviso a un lado para quitarlo al instante.',
        'Los insights de la pantalla de inicio tienen una barrita "Ver más en el copiloto" que te lleva directo al Copiloto, con más análisis.',
      ],
    },
  },
  {
    version: '0.90.0',
    date: '2026-06-18',
    items: {
      'pt-BR': [
        'No começo, o app recomenda um modo pra você e explica a "reserva protegida" com um exemplo em dinheiro.',
        'O editor da viagem agora explica "ritmo da fase", "dias de pico" e a diferença entre evento e sub-destino.',
        'A "Visão geral" diz, em uma linha, pra que serve (resumo) e onde editar (na Viagem).',
        'As Configurações ganharam um grupo próprio de "Conexões e compartilhamento", separado de "Backup e segurança". Nada mudou no funcionamento.',
      ],
      en: [
        'At the start, the app recommends a mode for you and explains the "protected reserve" with a money example.',
        'The trip editor now explains "phase rhythm", "peak days" and the difference between an event and a sub-destination.',
        'The "Overview" says in one line what it is for (a summary) and where to edit (in Trip).',
        'Settings now has its own "Connections & sharing" group, split out of "Backup & security". Nothing changed in how it works.',
      ],
      es: [
        'Al empezar, la app te recomienda un modo y explica la "reserva protegida" con un ejemplo en dinero.',
        'El editor del viaje ahora explica "ritmo de la fase", "días de pico" y la diferencia entre evento y sub-destino.',
        'La "Visión general" dice en una línea para qué sirve (un resumen) y dónde editar (en Viaje).',
        'Ajustes ahora tiene su propio grupo "Conexiones y compartir", separado de "Copia y seguridad". Nada cambió en el funcionamiento.',
      ],
    },
  },
  {
    version: '0.89.0',
    date: '2026-06-18',
    items: {
      'pt-BR': [
        'A Home agora mostra no máximo 4 análises de uma vez, já ordenadas pela mais importante — o resto fica a um toque em "Ver mais".',
        'Nada foi removido: é só um teto para a tela não virar uma parede de avisos.',
        'Tocar em uma análise continua abrindo o "Como cheguei nisso", que explica por que aquele número apareceu.',
      ],
      en: [
        'The Home now shows at most 4 insights at a time, already ordered by what matters most — the rest are one tap away under "See more".',
        'Nothing was removed: it is just a cap so the screen never becomes a wall of warnings.',
        'Tapping an insight still opens "How I got here", which explains why that number showed up.',
      ],
      es: [
        'La pantalla principal ahora muestra como máximo 4 análisis a la vez, ya ordenados por lo más importante — el resto queda a un toque en "Ver más".',
        'No se quitó nada: es solo un tope para que la pantalla no se vuelva un muro de avisos.',
        'Tocar un análisis sigue abriendo "Cómo llegué a esto", que explica por qué apareció ese número.',
      ],
    },
  },
  {
    version: '0.88.0',
    date: '2026-06-18',
    items: {
      'pt-BR': [
        'Iniciar uma saída agora explica, em uma linha, o que é uma "saída" — um rolê com teto, registrado em 1 toque.',
        'Quando o seu ritmo começa a comer a reserva da fase, o card do "amigo sincero" oferece um atalho direto pro Plano de resgate.',
        'O modo resgate continua sendo uma simulação (nada é gravado). Nada mudou no funcionamento.',
      ],
      en: [
        'Starting an outing now explains, in one line, what an "outing" is — a capped night out, logged in one tap.',
        'When your pace starts eating into the phase reserve, the "honest friend" card offers a direct shortcut to the Rescue plan.',
        'Rescue mode is still a simulation (nothing is saved). Nothing changed in how it works.',
      ],
      es: [
        'Iniciar una salida ahora explica, en una línea, qué es una "salida" — un plan con tope, registrado en 1 toque.',
        'Cuando tu ritmo empieza a comerse la reserva de la fase, la tarjeta del "amigo sincero" ofrece un atajo directo al Plan de rescate.',
        'El modo rescate sigue siendo una simulación (nada se guarda). Nada cambió en el funcionamiento.',
      ],
    },
  },
  {
    version: '0.87.0',
    date: '2026-06-18',
    items: {
      'pt-BR': [
        'Divisão de gastos com uma explicação única: o mesmo "como funciona a divisão" aparece em registrar gasto, escanear nota e na tela de pessoas.',
        'Vem recolhida — toque para abrir os 3 passos (quem pagou, a sua parte, acertar depois).',
        'No detalhe de um gasto dividido, "fluxo financeiro" e "custo pessoal" agora têm uma frase explicando cada um. Nada mudou no funcionamento.',
      ],
      en: [
        'Expense splitting now has a single explainer: the same "how splitting works" shows up on register expense, scan receipt and the people screen.',
        "It starts collapsed — tap to open the 3 steps (who paid, your share, settle later).",
        'On a split expense\'s detail, "financial flow" and "personal cost" now carry a one-line explanation each. Nothing changed in how it works.',
      ],
      es: [
        'La división de gastos ahora tiene una explicación única: el mismo "cómo funciona la división" aparece en registrar gasto, escanear recibo y la pantalla de personas.',
        'Viene recogida — toca para abrir los 3 pasos (quién pagó, tu parte, saldar después).',
        'En el detalle de un gasto dividido, "flujo financiero" y "costo personal" ahora llevan una frase que explica cada uno. Nada cambió en el funcionamiento.',
      ],
    },
  },
  {
    version: '0.86.0',
    date: '2026-06-18',
    items: {
      'pt-BR': [
        'Planejador mais fácil de entender: uma linha no topo explica pra que serve a tela.',
        'Os termos ganharam uma frase curta: “margem livre” × “alocado”, a classificação (essencial/planejado/opcional) e os presets.',
        'Só texto de ajuda — o funcionamento do planejador é exatamente o mesmo.',
      ],
      en: [
        'Easier-to-grasp planner: a line at the top explains what the screen is for.',
        'The terms now carry a short caption: “free margin” vs “allocated”, the classification (essential/planned/optional) and the presets.',
        'Help text only — the planner works exactly as before.',
      ],
      es: [
        'Planificador más fácil de entender: una línea arriba explica para qué sirve la pantalla.',
        'Los términos ahora llevan una frase corta: “margen libre” vs “asignado”, la clasificación (esencial/planificado/opcional) y los presets.',
        'Solo texto de ayuda — el planificador funciona exactamente igual.',
      ],
    },
  },
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
