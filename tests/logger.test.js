import { describe, expect, it } from 'vitest';
import { maskPhone } from '../src/config/logger.js';

describe('maskPhone', () => {
  it('enmascara la parte central de un teléfono', () => {
    expect(maskPhone('593991234567')).toBe('59399*****67');
  });

  it('enmascara valores cortos completamente', () => {
    expect(maskPhone('1234')).toBe('****');
  });

  it('maneja valores ausentes sin exponer información', () => {
    expect(maskPhone()).toBe('****');
  });
});
