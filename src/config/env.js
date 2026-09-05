import dotenv from 'dotenv';

dotenv.config();

const positiveInteger = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const config = Object.freeze({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  laravelApiUrl: process.env.LARAVEL_API_URL ?? '',
  laravelApiToken: process.env.LARAVEL_API_TOKEN ?? '',
  cronSchedule: process.env.CRON_SCHEDULE ?? '*/5 * * * *',
  timezone: process.env.TZ ?? 'America/Guayaquil',
  whatsappClientId: process.env.WHATSAPP_CLIENT_ID ?? 'misa-institucion',
  requestTimeoutMs: positiveInteger(process.env.REQUEST_TIMEOUT_MS, 10_000),
  maxRetries: positiveInteger(process.env.MAX_RETRIES, 3),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  localAuthPath: process.env.LOCAL_AUTH_PATH ?? './.wwebjs_auth',
  jobLockPath: process.env.JOB_LOCK_PATH ?? './.reminder-job.lock',
  reminderJobEnabled: process.env.REMINDER_JOB_ENABLED === 'true'
});

export const validateConfig = (values = config) => {
  const errors = [];

  if (!values.laravelApiUrl) {
    errors.push('LARAVEL_API_URL es obligatorio.');
  }

  try {
    new URL(values.laravelApiUrl);
  } catch {
    errors.push('LARAVEL_API_URL debe ser una URL válida.');
  }

  if (values.nodeEnv === 'production' && !values.laravelApiToken) {
    errors.push('LARAVEL_API_TOKEN es obligatorio en producción.');
  }

  if (!values.timezone) {
    errors.push('TZ no puede estar vacío.');
  }

  if (errors.length > 0) {
    throw new Error(`Configuración inválida: ${errors.join(' ')}`);
  }

  return true;
};
