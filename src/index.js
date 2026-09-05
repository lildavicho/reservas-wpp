import { config, validateConfig } from './config/env.js';
import { logger } from './config/logger.js';
import { startRuntime } from './runtime.js';

export const start = async () => {
  if (!config.reminderJobEnabled) {
    logger.info('Servicio iniciado con REMINDER_JOB_ENABLED=false; WhatsApp y scheduler permanecen detenidos');
    return null;
  }
  validateConfig(config);
  return startRuntime();
};

if (process.env.NODE_ENV !== 'test') {
  start().catch((error) => {
    logger.fatal({ error: error.message }, 'No se pudo iniciar el servicio');
    process.exitCode = 1;
  });
}
