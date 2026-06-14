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
