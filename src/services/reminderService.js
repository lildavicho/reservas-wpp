import { formatReminderMessage } from '../whatsapp/messageFormatter.js';
import { normalizeEcuadorPhone, toWhatsAppId } from '../whatsapp/phoneNormalizer.js';
import { nowIso } from '../utils/dates.js';

const sentLocally = new Set();

export class ReminderService {
  constructor({ laravelClient, whatsappClient, logger, timezone = 'America/Guayaquil' }) {
    this.laravelClient = laravelClient;
    this.whatsappClient = whatsappClient;
    this.logger = logger;
    this.timezone = timezone;
  }

  async processDueReminders() {
    if (!this.whatsappClient.isReady()) {
      this.logger.warn('WhatsApp no está listo; no se procesarán recordatorios');
      return { processed: 0, skipped: 0, failed: 0 };
    }

    const reservations = await this.laravelClient.getDueReminders();
    let processed = 0;
    let skipped = 0;
    let failed = 0;

    for (const reservation of reservations) {
      const key = String(reservation.id);
      if (sentLocally.has(key) || reservation.estado === 'sent' || reservation.status === 'sent') {
        skipped += 1;
        continue;
      }

      let claim;
      try {
        claim = await this.laravelClient.claimReminder(key);
      } catch (error) {
        failed += 1;
        this.logger.error(
          { reminderId: key, errorCode: 'CLAIM_UNKNOWN' },
          'No se pudo determinar si Laravel reclamó la reserva'
        );
        continue;
      }

      if (!claim.claimed) {
        skipped += 1;
        continue;
      }

      let messageSent = false;
      try {
        const phone = normalizeEcuadorPhone(reservation.telefono);
        const message = formatReminderMessage(reservation, this.timezone);
        const sent = await this.whatsappClient.sendMessage(toWhatsAppId(phone), message);
        messageSent = true;
        await this.laravelClient.markSent(key, {
          messageId: sent.id?.id ?? sent.id,
          sentAt: nowIso()
        });
        sentLocally.add(key);
        processed += 1;
        this.logger.info({ reminderId: key }, 'Recordatorio enviado');
      } catch (error) {
        failed += 1;
        if (messageSent) {
          this.logger.error(
            { reminderId: key, errorCode: 'SENT_CONFIRMATION_FAILED' },
            'Mensaje enviado, pero no se pudo confirmar en Laravel'
          );
          continue;
        }

        await this.laravelClient.markFailed(key, {
          errorCode: error.code ?? 'REMINDER_FAILED',
          errorMessage: error.message,
          failedAt: nowIso()
        });
        this.logger.error({ reminderId: key, errorCode: error.code }, 'Falló el recordatorio');
      }
    }

    return { processed, skipped, failed };
  }
}
