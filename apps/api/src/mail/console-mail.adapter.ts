import type { MailMessage, MailProviderPort } from '@oma/domain';
import { createLogger } from '@oma/observability';

const log = createLogger('mail');

export class ConsoleMailAdapter implements MailProviderPort {
  async send(message: MailMessage): Promise<void> {
    log.info({ to: message.to, subject: message.subject, text: message.text }, 'console mail');
  }
}
