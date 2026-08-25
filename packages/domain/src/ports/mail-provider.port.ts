export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface MailProviderPort {
  send(message: MailMessage): Promise<void>;
}
