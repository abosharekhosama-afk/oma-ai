import { Injectable } from '@nestjs/common';
import { getPrisma, writeOutbox } from '@oma/db';
import {
  DomainError,
  assertPasswordPolicy,
  hashPassword,
  hashSessionToken,
  issueSessionToken,
  newId,
} from '@oma/domain';
import { ConsoleMailAdapter } from '../mail/console-mail.adapter';

const mail = new ConsoleMailAdapter();

@Injectable()
export class RecoveryService {
  async request(email: string) {
    const user = await getPrisma().user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user) return { ok: true };
    const { token, tokenHash } = issueSessionToken();
    await getPrisma().recoveryToken.create({
      data: { id: newId(), userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 3600_000) },
    });
    await getPrisma().$transaction(async (tx) => {
      await writeOutbox(tx, {
        eventType: 'mail.recovery',
        payload: { to: user.email, token },
      });
    });
    await mail.send({
      to: user.email,
      subject: 'OMA AI password recovery',
      text: `Recovery token (console adapter): ${token}`,
    });
    return { ok: true };
  }

  async confirm(token: string, newPassword: string) {
    const row = await getPrisma().recoveryToken.findUnique({
      where: { tokenHash: hashSessionToken(token) },
    });
    if (!row || row.usedAt || row.expiresAt < new Date()) {
      throw new DomainError('NOT_FOUND', 'Recovery token not found', 404, 'errors.not_found');
    }
    assertPasswordPolicy(newPassword);
    await getPrisma().$transaction(async (tx) => {
      await tx.user.update({
        where: { id: row.userId },
        data: { passwordHash: await hashPassword(newPassword) },
      });
      await tx.recoveryToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
      await tx.session.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
    return { ok: true };
  }
}

export const recoveryService = new RecoveryService();
