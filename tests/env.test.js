import { describe, expect, it } from 'vitest';
import { validateConfig } from '../src/config/env.js';

const validConfig = {
  laravelApiUrl: 'https://ejemplo.com',
  laravelApiToken: 'token-de-prueba',
  nodeEnv: 'production',
  timezone: 'America/Guayaquil'
};

describe('validateConfig', () => {
  it('acepta una configuración válida', () => {
    expect(validateConfig(validConfig)).toBe(true);
  });

  it('rechaza una URL inválida', () => {
    expect(() => validateConfig({ ...validConfig, laravelApiUrl: 'no-es-url' }))
      .toThrow('LARAVEL_API_URL debe ser una URL válida.');
  });

  it('exige token en producción', () => {
    expect(() => validateConfig({ ...validConfig, laravelApiToken: '' }))
      .toThrow('LARAVEL_API_TOKEN es obligatorio en producción.');
  });
});
