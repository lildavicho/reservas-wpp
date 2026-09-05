import qrcode from 'qrcode-terminal';
import whatsappWeb from 'whatsapp-web.js';
import { config } from '../config/env.js';
import { logger } from '../config/logger.js';

const { Client, LocalAuth } = whatsappWeb;

const createPuppeteerOptions = () => {
  const options = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  };

  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    options.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  return options;
};

export const createWhatsAppClient = (dependencies = {}) => {
  const ClientConstructor = dependencies.Client ?? Client;
  const LocalAuthConstructor = dependencies.LocalAuth ?? LocalAuth;
  const qrRenderer = dependencies.qrRenderer ?? qrcode.generate;
  const log = dependencies.logger ?? logger;
  let ready = false;

  const client = new ClientConstructor({
    authStrategy: new LocalAuthConstructor({
      clientId: config.whatsappClientId,
      dataPath: config.localAuthPath
    }),
    puppeteer: createPuppeteerOptions()
  });

  client.on('qr', (qr) => {
    log.info('QR recibido. Escanéelo desde WhatsApp > Dispositivos vinculados.');
    qrRenderer(qr, { small: true });
  });

  client.on('authenticated', () => {
    log.info('WhatsApp autenticado');
  });

  client.on('ready', () => {
    ready = true;
    log.info('WhatsApp listo para operar');
  });

  client.on('auth_failure', (message) => {
    ready = false;
    log.error({ error: message }, 'Falló la autenticación de WhatsApp');
  });

  client.on('disconnected', (reason) => {
    ready = false;
    log.error({ reason }, 'WhatsApp se desconectó');
  });

  client.isReady = () => ready;
  return client;
};

export const startWhatsAppClient = async (dependencies = {}) => {
  const client = createWhatsAppClient(dependencies);
  await client.initialize();
  return client;
};

export const toChatId = (phone) => {
  const normalized = String(phone ?? '').replace(/\D/g, '');

  if (!/^\d{8,15}$/.test(normalized)) {
    throw new Error('El destino debe contener entre 8 y 15 dígitos.');
  }

  return `${normalized}@c.us`;
};

export const sendManualMessage = async (client, phone, message) => {
  const whatsappReady = typeof client.isReady === 'function'
    ? client.isReady()
    : Boolean(client.info);

  if (!whatsappReady) {
    throw new Error('WhatsApp no está listo; no se enviará el mensaje.');
  }

  if (!message?.trim()) {
    throw new Error('El mensaje no puede estar vacío.');
  }

  return client.sendMessage(toChatId(phone), message);
};
