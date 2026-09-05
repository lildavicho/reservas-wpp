import { startWhatsAppClient, sendManualMessage } from './client.js';
import { logger, maskPhone } from '../config/logger.js';

const [, , phone, ...messageParts] = process.argv;
const message = messageParts.join(' ').trim();

if (process.env.WHATSAPP_MANUAL_TEST_CONFIRM !== 'YES') {
  throw new Error(
    'Prueba bloqueada. Defina WHATSAPP_MANUAL_TEST_CONFIRM=YES para confirmar un envío real.'
  );
}

if (!phone || !message) {
  throw new Error('Uso: npm run whatsapp:test -- <telefono> <mensaje>');
}

const client = await startWhatsAppClient();

try {
  const sentMessage = await sendManualMessage(client, phone, message);
  logger.info({ phone: maskPhone(phone), messageId: sentMessage.id.id }, 'Mensaje manual enviado');
} finally {
  await client.destroy();
}
