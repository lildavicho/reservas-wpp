import { describe, expect, it, vi } from 'vitest';
import { LaravelApiError, LaravelClient } from '../src/api/laravelClient.js';

const clientConfig = {
  laravelApiUrl: 'https://laravel.example',
  laravelApiToken: 'secret-token',
  requestTimeoutMs: 50,
  maxRetries: 2
};

const response = (status, payload) => ({
  ok: status >= 200 && status < 300,
  status,
  json: vi.fn().mockResolvedValue(payload)
});

describe('LaravelClient', () => {
  it('consulta reservas pendientes con autenticación y valida la lista', async () => {
    const fetch = vi.fn().mockResolvedValue(response(200, [{ id: 123, nombre: 'María' }]));
    const client = new LaravelClient({ config: clientConfig, fetch });

    await expect(client.getDueReminders()).resolves.toEqual([{ id: 123, nombre: 'María' }]);
    expect(fetch).toHaveBeenCalledWith(
      'https://laravel.example/api/internal/reminders/due',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer secret-token' })
      })
    );
  });

  it('no reintenta un token incorrecto', async () => {
    const fetch = vi.fn().mockResolvedValue(response(401, { message: 'unauthorized' }));
    const client = new LaravelClient({
      config: clientConfig,
      fetch,
      sleep: vi.fn()
    });

    await expect(client.getDueReminders()).rejects.toMatchObject({
      code: 'HTTP_401',
      retryable: false
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('reintenta errores temporales con backoff limitado', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(response(503, {}))
      .mockResolvedValueOnce(response(200, []));
    const sleep = vi.fn().mockResolvedValue(undefined);
    const client = new LaravelClient({ config: clientConfig, fetch, sleep, random: () => 0 });

    await expect(client.getDueReminders()).resolves.toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(250);
  });

  it('rechaza JSON inválido', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockRejectedValue(new SyntaxError('invalid json'))
    });
    const client = new LaravelClient({ config: clientConfig, fetch });

    await expect(client.getDueReminders()).rejects.toMatchObject({
      code: 'INVALID_JSON'
    });
  });

  it('reporta enviados y fallidos con los payloads esperados', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(response(200, { ok: true }))
      .mockResolvedValueOnce(response(200, { ok: true }));
    const client = new LaravelClient({ config: clientConfig, fetch });

    await client.markSent(123, { messageId: 'wamid.1', sentAt: '2026-09-08T14:00:00-05:00' });
    await client.markFailed(123, {
      errorCode: 'INVALID_PHONE',
      errorMessage: 'Número inválido',
      failedAt: '2026-09-08T14:00:00-05:00'
    });

    expect(fetch.mock.calls[0][1].body).toBe(JSON.stringify({
      message_id: 'wamid.1',
      sent_at: '2026-09-08T14:00:00-05:00'
    }));
    expect(fetch.mock.calls[1][1].body).toBe(JSON.stringify({
      error_code: 'INVALID_PHONE',
      error_message: 'Número inválido',
      failed_at: '2026-09-08T14:00:00-05:00'
    }));
  });

  it('reclama una reserva y valida la respuesta booleana', async () => {
    const fetch = vi.fn().mockResolvedValue(response(200, { claimed: true }));
    const client = new LaravelClient({ config: clientConfig, fetch });

    await expect(client.claimReminder(123)).resolves.toEqual({ claimed: true });
    expect(fetch).toHaveBeenCalledWith(
      'https://laravel.example/api/internal/reminders/123/claim',
      expect.objectContaining({ method: 'POST', body: '{}' })
    );
  });

  it('interpreta HTTP 409 del claim como no reclamado', async () => {
    const fetch = vi.fn().mockResolvedValue(response(409, { claimed: false }));
    const client = new LaravelClient({ config: clientConfig, fetch });

    await expect(client.claimReminder(123)).resolves.toEqual({ claimed: false });
  });

  it('expone un error de red tras agotar reintentos', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('offline'));
    const client = new LaravelClient({
      config: clientConfig,
      fetch,
      sleep: vi.fn().mockResolvedValue(undefined)
    });

    await expect(client.getDueReminders()).rejects.toBeInstanceOf(LaravelApiError);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
