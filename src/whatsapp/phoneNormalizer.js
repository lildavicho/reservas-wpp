const ECUADOR_MOBILE = /^09\d{8}$/;
const INTERNATIONAL = /^\d{8,15}$/;

export const normalizeEcuadorPhone = (phone) => {
  const digits = String(phone ?? '').replace(/\D/g, '');

  if (ECUADOR_MOBILE.test(digits)) {
    return `593${digits.slice(1)}`;
  }

  if (digits.startsWith('593') && /^\d{12}$/.test(digits) && digits[3] === '9') {
    return digits;
  }

  throw new Error('Número ecuatoriano inválido.');
};

export const normalizePhone = (phone, country = 'EC') => {
  if (country === 'EC') {
    return normalizeEcuadorPhone(phone);
  }

  const digits = String(phone ?? '').replace(/\D/g, '');
  if (!INTERNATIONAL.test(digits)) {
    throw new Error('Número internacional inválido.');
  }
  return digits;
};

export const toWhatsAppId = (phone, country = 'EC') => `${normalizePhone(phone, country)}@c.us`;
