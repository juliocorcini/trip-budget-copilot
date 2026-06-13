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
