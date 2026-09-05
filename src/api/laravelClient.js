import { config as defaultConfig } from '../config/env.js';
import { logger as defaultLogger } from '../config/logger.js';

export class LaravelApiError extends Error {
  constructor(message, { status, code = 'LARAVEL_API_ERROR', retryable = false, cause } = {}) {
    super(message, { cause });
    this.name = 'LaravelApiError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const parseJson = async (response) => {
  try {
    return await response.json();
  } catch (error) {
    throw new LaravelApiError('Laravel devolvió JSON inválido.', {
      status: response.status,
      code: 'INVALID_JSON',
      cause: error
    });
  }
};

const validateDueReminders = (payload) => {
  if (!Array.isArray(payload)) {
    throw new LaravelApiError('Laravel devolvió una lista de reservas inválida.', {
      code: 'INVALID_REMINDERS_PAYLOAD'
    });
  }

  for (const reminder of payload) {
    if (!isObject(reminder) || reminder.id === undefined || typeof reminder.id === 'object') {
      throw new LaravelApiError('Una reserva no contiene un id válido.', {
        code: 'INVALID_REMINDER'
      });
    }
  }

  return payload;
};

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const joinUrl = (baseUrl, path) => `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;

const retryableStatus = (status) => status === 408 || status === 429 || status >= 500;

export class LaravelClient {
  constructor(options = {}) {
    this.config = options.config ?? defaultConfig;
    this.fetch = options.fetch ?? globalThis.fetch;
    this.logger = options.logger ?? defaultLogger;
    this.sleep = options.sleep ?? sleep;
    this.random = options.random ?? Math.random;

    if (typeof this.fetch !== 'function') {
      throw new Error('No hay una implementación de fetch disponible.');
    }
  }

  async request(path, { method = 'GET', body } = {}) {
    const url = joinUrl(this.config.laravelApiUrl, path);
    let lastError;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);

      try {
        const response = await this.fetch(url, {
          method,
          headers: {
            Accept: 'application/json',
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
            ...(this.config.laravelApiToken
              ? { Authorization: `Bearer ${this.config.laravelApiToken}` }
              : {})
          },
          body: body === undefined ? undefined : JSON.stringify(body),
          signal: controller.signal
        });

        if (response.ok) {
          return response;
        }

        const retryable = retryableStatus(response.status);
        lastError = new LaravelApiError(
          `Laravel respondió con HTTP ${response.status}.`,
          { status: response.status, code: `HTTP_${response.status}`, retryable }
        );

        if (!retryable || attempt === this.config.maxRetries) {
          throw lastError;
        }
      } catch (error) {
        if (error instanceof LaravelApiError && !error.retryable) {
          throw error;
        }

        lastError = error.name === 'AbortError'
          ? new LaravelApiError('La solicitud a Laravel excedió el timeout.', {
            code: 'TIMEOUT',
            retryable: true,
            cause: error
          })
          : error instanceof LaravelApiError
            ? error
            : new LaravelApiError('Error de red al comunicarse con Laravel.', {
              code: 'NETWORK_ERROR',
              retryable: true,
              cause: error
            });

        if (attempt === this.config.maxRetries) {
          throw lastError;
        }
      } finally {
        clearTimeout(timeout);
      }

      const baseDelay = 250 * (2 ** attempt);
      await this.sleep(baseDelay + Math.floor(this.random() * 100));
      this.logger.warn({ attempt: attempt + 1, code: lastError.code }, 'Reintentando solicitud a Laravel');
    }

    throw lastError;
  }

  async getDueReminders() {
    const payload = await parseJson(await this.request('/api/internal/reminders/due'));
    return validateDueReminders(payload);
  }

  async claimReminder(id) {
    if (id === undefined) {
      throw new Error('claimReminder requiere id.');
    }

    let payload;
    try {
      payload = await parseJson(await this.request(
        `/api/internal/reminders/${encodeURIComponent(id)}/claim`,
        { method: 'POST', body: {} }
      ));
    } catch (error) {
      if (error instanceof LaravelApiError && error.status === 409) {
        return { claimed: false };
      }
      throw error;
    }

    if (!isObject(payload) || typeof payload.claimed !== 'boolean') {
      throw new LaravelApiError('Laravel devolvió una respuesta de claim inválida.', {
        code: 'INVALID_CLAIM_RESPONSE'
      });
    }

    return payload;
  }

  async markSent(id, { messageId, sentAt }) {
    if (id === undefined || !messageId || !sentAt) {
      throw new Error('markSent requiere id, messageId y sentAt.');
    }

    return parseJson(await this.request(`/api/internal/reminders/${encodeURIComponent(id)}/sent`, {
      method: 'POST',
      body: { message_id: messageId, sent_at: sentAt }
    }));
  }

  async markFailed(id, { errorCode, errorMessage, failedAt }) {
    if (id === undefined || !errorCode || !errorMessage || !failedAt) {
      throw new Error('markFailed requiere id, errorCode, errorMessage y failedAt.');
    }

    return parseJson(await this.request(`/api/internal/reminders/${encodeURIComponent(id)}/failed`, {
      method: 'POST',
      body: {
        error_code: errorCode,
        error_message: errorMessage,
        failed_at: failedAt
      }
    }));
  }
}
