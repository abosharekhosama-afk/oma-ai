export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  /** Optional HTML body. Providers that cannot send HTML fall back to `text`. */
  html?: string;
  /** Optional Reply-To override (otherwise the provider default, e.g. MAIL_REPLY_TO). */
  replyTo?: string;
}

export interface MailProviderPort {
  send(message: MailMessage): Promise<void>;
}
