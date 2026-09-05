const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^\d{2}:\d{2}$/;

export const parseMassDateTime = (date, time, timezone = 'America/Guayaquil') => {
  if (!DATE_PATTERN.test(date) || !TIME_PATTERN.test(time)) {
    throw new Error('Fecha u hora de misa inválida.');
  }

  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const instant = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(instant);

  return { date, time, timezone, parts };
};

export const formatMassDate = (date, timezone = 'America/Guayaquil') => {
  if (!DATE_PATTERN.test(date)) {
    throw new Error('Fecha de misa inválida.');
  }

  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat('es-EC', {
    timeZone: timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(value);
};

export const nowIso = () => new Date().toISOString();
