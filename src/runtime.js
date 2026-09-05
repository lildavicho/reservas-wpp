import { config, validateConfig } from './config/env.js';
import { logger } from './config/logger.js';
import { LaravelClient } from './api/laravelClient.js';
import { startWhatsAppClient } from './whatsapp/client.js';
import { ReminderService } from './services/reminderService.js';
import { createJobLock, scheduleReminderJob } from './jobs/reminderJob.js';

export const startRuntime = async () => {
  validateConfig(config);
  const laravelClient = new LaravelClient();
  const whatsappClient = await startWhatsAppClient();
  const service = new ReminderService({
    laravelClient,
    whatsappClient,
    logger,
    timezone: config.timezone
  });
  const scheduledTask = scheduleReminderJob({
    service,
    lock: createJobLock(config.jobLockPath),
    schedule: config.cronSchedule,
    timezone: config.timezone,
    logger
  });
  logger.info({ schedule: config.cronSchedule, timezone: config.timezone }, 'Runtime iniciado');
  return { whatsappClient, scheduledTask };
};
