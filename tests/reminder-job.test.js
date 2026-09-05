import { describe, expect, it, vi } from 'vitest';
import { createJobLock, runReminderJob } from '../src/jobs/reminderJob.js';
import { ReminderService } from '../src/services/reminderService.js';

describe('reminder job', () => {
  it('evita solapamiento con un lock activo', async () => {
    const lock = { acquire: vi.fn().mockResolvedValue(false), release: vi.fn() };
    const service = { processDueReminders: vi.fn() };

    await expect(runReminderJob({ service, lock })).resolves.toEqual({ skipped: true });
    expect(service.processDueReminders).not.toHaveBeenCalled();
  });

  it('libera el lock aunque el servicio falle', async () => {
    const lock = {
      acquire: vi.fn().mockResolvedValue(true),
      release: vi.fn().mockResolvedValue(undefined)
    };
    const service = { processDueReminders: vi.fn().mockRejectedValue(new Error('failure')) };

    await expect(runReminderJob({ service, lock })).rejects.toThrow('failure');
    expect(lock.release).toHaveBeenCalledOnce();
  });

  it('procesa una reserva y reporta sent a Laravel', async () => {
    const laravelClient = {
      getDueReminders: vi.fn().mockResolvedValue([{
        id: 44,
        nombre: 'María',
        telefono: '0991234567',
        fecha_misa: '2026-09-10',
        hora_misa: '14:00',
        lugar: 'Parroquia X'
      }]),
      claimReminder: vi.fn().mockResolvedValue({ claimed: true }),
      markSent: vi.fn().mockResolvedValue({})
    };
    const whatsappClient = {
      isReady: vi.fn().mockReturnValue(true),
      sendMessage: vi.fn().mockResolvedValue({ id: { id: 'wamid.44' } })
    };
    const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const service = new ReminderService({
      laravelClient,
      whatsappClient,
      logger
    });

    await expect(service.processDueReminders()).resolves.toMatchObject({ processed: 1 });
    expect(whatsappClient.sendMessage).toHaveBeenCalledWith(
      '593991234567@c.us',
      expect.stringContaining('Hola María')
    );
    expect(laravelClient.markSent).toHaveBeenCalledWith(
      '44',
      expect.objectContaining({ messageId: 'wamid.44' })
    );
    expect(laravelClient.claimReminder).toHaveBeenCalledWith('44');
  });

  it('no procesa si WhatsApp no está listo', async () => {
    const service = new ReminderService({
      laravelClient: { getDueReminders: vi.fn() },
      whatsappClient: { isReady: () => false },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    });

    await expect(service.processDueReminders()).resolves.toEqual({
      processed: 0,
      skipped: 0,
      failed: 0
    });
  });

  it('no reporta failed después de que WhatsApp confirmó el envío', async () => {
    const laravelClient = {
      getDueReminders: vi.fn().mockResolvedValue([{
        id: 45,
        nombre: 'María',
        telefono: '0991234567',
        fecha_misa: '2026-09-10',
        hora_misa: '14:00',
        lugar: 'Parroquia X'
      }]),
      claimReminder: vi.fn().mockResolvedValue({ claimed: true }),
      markSent: vi.fn().mockRejectedValue(new Error('Laravel offline')),
      markFailed: vi.fn()
    };
    const whatsappClient = {
      isReady: () => true,
      sendMessage: vi.fn().mockResolvedValue({ id: { id: 'wamid.45' } })
    };
    const service = new ReminderService({
      laravelClient,
      whatsappClient,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    });

    await expect(service.processDueReminders()).resolves.toMatchObject({ failed: 1 });
    expect(laravelClient.markFailed).not.toHaveBeenCalled();
  });

  it('no reporta failed si el resultado del claim es desconocido', async () => {
    const laravelClient = {
      getDueReminders: vi.fn().mockResolvedValue([{ id: 46 }]),
      claimReminder: vi.fn().mockRejectedValue(new Error('network')),
      markFailed: vi.fn()
    };
    const service = new ReminderService({
      laravelClient,
      whatsappClient: { isReady: () => true, sendMessage: vi.fn() },
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    });

    await expect(service.processDueReminders()).resolves.toMatchObject({ failed: 1 });
    expect(laravelClient.markFailed).not.toHaveBeenCalled();
  });

  it('persiste el lock local y lo libera', async () => {
    const lockPath = `./.test-lock-${process.pid}-${Date.now()}`;
    const first = createJobLock(lockPath);
    const second = createJobLock(lockPath);

    await expect(first.acquire()).resolves.toBe(true);
    await expect(second.acquire()).resolves.toBe(false);
    await first.release();
    await expect(second.acquire()).resolves.toBe(true);
    await second.release();
  });
});
