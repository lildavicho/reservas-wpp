import { describe, expect, it } from 'vitest';
import { normalizeEcuadorPhone, toWhatsAppId } from '../src/whatsapp/phoneNormalizer.js';
import { formatReminderMessage } from '../src/whatsapp/messageFormatter.js';
import { formatMassDate } from '../src/utils/dates.js';

describe('phoneNormalizer', () => {
  it('normaliza celulares ecuatorianos', () => {
    expect(normalizeEcuadorPhone('0990000000')).toBe('593990000000');
    expect(toWhatsAppId('0990000000')).toBe('593990000000@c.us');
  });

  it('rechaza números ecuatorianos inválidos', () => {
    expect(() => normalizeEcuadorPhone('098123')).toThrow('inválido');
  });
});

describe('messageFormatter', () => {
  it('forma el recordatorio con fecha localizada', () => {
    const message = formatReminderMessage({
      nombre: 'María Rodríguez',
      fecha_misa: '2026-09-10',
      hora_misa: '14:00',
      lugar: 'Parroquia X'
    });

    expect(message).toContain('Hola María Rodríguez');
    expect(message).toContain('jueves, 10 de septiembre');
    expect(message).toContain('📍 Parroquia X');
  });
});

describe('dates', () => {
  it('formatea explícitamente en America/Guayaquil', () => {
    expect(formatMassDate('2026-09-10', 'America/Guayaquil'))
      .toBe('jueves, 10 de septiembre');
  });
});
