/**
 * Janela útil de execução de OS:
 *  - Jornada: 08:00 — 18:00 (contínua)
 *  - Segunda a sexta-feira (sem trabalho em sábados/domingos)
 *
 * Dada uma data/hora de início e uma duração em minutos, distribui o tempo
 * pela janela válida, virando para o próximo dia útil quando necessário.
 */

export interface ScheduleWindowResult {
  /** Data final em ISO yyyy-MM-dd (pode ser diferente da data inicial). */
  endDate: string;
  /** Hora final em HH:mm. */
  endTime: string;
  /** True quando o término ocorre em dia diferente do início. */
  crossedDay: boolean;
  /** True se a data inicial cair em sábado/domingo. */
  weekendWarning: boolean;
  /** True se a hora inicial estiver fora da janela (08-18). */
  outOfWindowWarning: boolean;
}

const DAY_START = 8 * 60;
const DAY_END = 18 * 60;

const isWeekend = (d: Date) => d.getDay() === 0 || d.getDay() === 6;

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const minutesToHHMM = (mins: number): string => {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = Math.floor(mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

const addDays = (date: Date, n: number): Date => {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
};

const nextBusinessDay = (date: Date): Date => {
  let d = addDays(date, 1);
  while (isWeekend(d)) d = addDays(d, 1);
  return d;
};

const toISODate = (d: Date): string => {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/**
 * Calcula o término da OS distribuindo `durationMin` na janela útil 08-18.
 * Se a hora de início estiver fora da janela, ela é ancorada no próximo
 * slot válido (subindo para 08:00 ou pulando para o dia seguinte).
 */
export const computeScheduleEnd = (
  startDateISO: string,
  startTimeHHMM: string,
  durationMin: number
): ScheduleWindowResult => {
  if (!startDateISO || !startTimeHHMM || !durationMin || durationMin <= 0) {
    return {
      endDate: startDateISO,
      endTime: startTimeHHMM,
      crossedDay: false,
      weekendWarning: false,
      outOfWindowWarning: false,
    };
  }

  const startDateObj = new Date(startDateISO + 'T12:00:00');
  const weekendWarning = isWeekend(startDateObj);

  const startMin = toMinutes(startTimeHHMM);
  const outOfWindowWarning = !(startMin >= DAY_START && startMin < DAY_END);

  let currentDate = new Date(startDateObj);
  let cursorMin = startMin;
  let remaining = durationMin;
  let crossedDay = false;

  if (isWeekend(currentDate)) {
    currentDate = nextBusinessDay(currentDate);
    crossedDay = true;
  }

  const anchorToValidSlot = () => {
    if (cursorMin < DAY_START) {
      cursorMin = DAY_START;
    } else if (cursorMin >= DAY_END) {
      currentDate = nextBusinessDay(currentDate);
      cursorMin = DAY_START;
      crossedDay = true;
    }
  };

  anchorToValidSlot();

  while (remaining > 0) {
    const available = DAY_END - cursorMin;
    if (remaining <= available) {
      cursorMin += remaining;
      remaining = 0;
    } else {
      remaining -= available;
      cursorMin = DAY_END;
      anchorToValidSlot();
    }
  }

  const endDateISO = toISODate(currentDate);
  if (endDateISO !== startDateISO) crossedDay = true;

  return {
    endDate: endDateISO,
    endTime: minutesToHHMM(cursorMin),
    crossedDay,
    weekendWarning,
    outOfWindowWarning,
  };
};

/** Formata "HH:MM - HH:MM (dd/MM/yy)" quando vira o dia. */
export const formatScheduledWindow = (
  startDateISO: string | null | undefined,
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  endDateISO?: string | null
): string => {
  if (!startTime || !endTime) return '—';
  const base = `${startTime} - ${endTime}`;
  if (!endDateISO || !startDateISO || endDateISO === startDateISO) return base;
  const [, m, d] = endDateISO.split('-');
  const yy = endDateISO.slice(2, 4);
  return `${base} (${d}/${m}/${yy})`;
};

export const isHHMMInBusinessWindow = (hhmm: string): boolean => {
  const m = toMinutes(hhmm);
  return m >= DAY_START && m < DAY_END;
};
