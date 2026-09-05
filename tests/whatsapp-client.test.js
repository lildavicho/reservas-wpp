import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockedConfig } = vi.hoisted(() => ({
  mockedConfig: {
    whatsappClientId: 'test-client',
    localAuthPath: './.test-auth'
  }
}));

vi.mock('../src/config/env.js', () => ({ config: mockedConfig }));
vi.mock('qrcode-terminal', () => ({ default: { generate: vi.fn() } }));

const { createWhatsAppClient, sendManualMessage, toChatId } =
  await import('../src/whatsapp/client.js');

describe('WhatsApp client', () => {
  let handlers;
  let fakeClient;
  let FakeClient;
  let FakeLocalAuth;

  beforeEach(() => {
    handlers = new Map();
    fakeClient = {
      on: vi.fn((event, handler) => handlers.set(event, handler)),
      initialize: vi.fn(),
      sendMessage: vi.fn().mockResolvedValue({ id: { id: 'message-1' } }),
      info: { wid: { user: 'institution' } }
    };
    FakeClient = vi.fn(() => fakeClient);
    FakeLocalAuth = vi.fn();
  });

  it('configura LocalAuth y registra los eventos mínimos', () => {
    const client = createWhatsAppClient({
      Client: FakeClient,
      LocalAuth: FakeLocalAuth,
      qrRenderer: vi.fn(),
      logger: { info: vi.fn(), error: vi.fn() }
    });

    expect(client).toBe(fakeClient);
    expect(FakeLocalAuth).toHaveBeenCalledWith({
      clientId: 'test-client',
      dataPath: './.test-auth'
    });
    expect([...handlers.keys()]).toEqual([
      'qr',
      'authenticated',
      'ready',
      'auth_failure',
      'disconnected'
    ]);
  });

  it('no envía si WhatsApp no está listo', async () => {
    fakeClient.info = null;

    await expect(sendManualMessage(fakeClient, '593991234567', 'Prueba'))
      .rejects.toThrow('WhatsApp no está listo');
    expect(fakeClient.sendMessage).not.toHaveBeenCalled();
  });

  it('vuelve a bloquear envíos después de una desconexión', async () => {
    const client = createWhatsAppClient({
      Client: FakeClient,
      LocalAuth: FakeLocalAuth,
      qrRenderer: vi.fn(),
      logger: { info: vi.fn(), error: vi.fn() }
    });

    handlers.get('ready')();
    expect(client.isReady()).toBe(true);
    handlers.get('disconnected')('logout');

    await expect(sendManualMessage(client, '593991234567', 'Prueba'))
      .rejects.toThrow('WhatsApp no está listo');
    expect(client.sendMessage).not.toHaveBeenCalled();
  });

  it('convierte un teléfono válido al chat id de WhatsApp', () => {
    expect(toChatId('593 991 234 567')).toBe('593991234567@c.us');
  });

  it('rechaza destinos claramente inválidos', () => {
    expect(() => toChatId('abc')).toThrow('entre 8 y 15 dígitos');
  });
});
