import pino from 'pino';

export const maskPhone = (phone) => {
  const value = String(phone ?? '');

  if (value.length <= 4) {
    return '****';
  }

  const visiblePrefix = value.slice(0, Math.min(5, value.length - 2));
  const visibleSuffix = value.slice(-2);
  return `${visiblePrefix}*****${visibleSuffix}`;
};

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'headers.authorization',
      'token',
      'laravelApiToken',
      'telefono',
      'phone'
    ],
    censor: '[REDACTED]'
  }
});
