import { startWhatsAppClient } from './client.js';

const client = await startWhatsAppClient();

const shutdown = async (signal) => {
  try {
    await client.destroy();
  } finally {
    process.exit(signal === 'SIGINT' ? 0 : 1);
  }
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
