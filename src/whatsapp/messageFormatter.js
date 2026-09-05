import { formatMassDate } from '../utils/dates.js';

export const formatReminderMessage = (reservation, timezone = 'America/Guayaquil') => {
  const { nombre, fecha_misa: date, hora_misa: time, lugar } = reservation;

  if (!nombre || !date || !time || !lugar) {
    throw new Error('La reserva no contiene los datos requeridos para el mensaje.');
  }

  const formattedDate = formatMassDate(date, timezone);
  return [
    `Hola ${nombre} 👋`,
    '',
    'Te recordamos tu reserva para la Santa Misa.',
    '',
    `📅 ${formattedDate}`,
    `🕐 ${time}`,
    `📍 ${lugar}`,
    '',
    'Te esperamos. 🙏'
  ].join('\n');
};
