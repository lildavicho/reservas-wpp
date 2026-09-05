import cron from 'node-cron';
import fs from 'node:fs/promises';

export const createJobLock = (lockPath) => {
  let handle;

  return {
    async acquire() {
      try {
        handle = await fs.open(lockPath, 'wx');
        return true;
      } catch (error) {
        if (error.code === 'EEXIST') return false;
        throw error;
      }
    },
    async release() {
      await handle?.close();
      handle = undefined;
      await fs.rm(lockPath, { force: true });
    }
  };
};

export const runReminderJob = async ({ service, lock }) => {
  if (!(await lock.acquire())) return { skipped: true };
  try {
    return await service.processDueReminders();
  } finally {
    await lock.release();
  }
};

export const scheduleReminderJob = ({ service, lock, schedule, timezone, logger }) =>
  cron.schedule(schedule, () => {
    runReminderJob({ service, lock }).catch((error) => {
      logger.error({ error: error.message }, 'Error en el job de recordatorios');
    });
  }, { timezone });
