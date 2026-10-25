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
import { createMailProvider, passwordResetLink } from '../mail/mail-provider';

const mail = createMailProvider();
const webOrigin = () => process.env.WEB_ORIGIN || 'http://127.0.0.1:3000';
const resetText = (token: string) =>
  `Reset your OMA AI password (link valid for 1 hour):\n${passwordResetLink(webOrigin(), token)}\n\nIf you didn't request this, ignore this email.`;

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
    const jobRunId = newId();
    const idempotencyKey = `mail.recovery:${tokenHash}`;
    await getPrisma().$transaction(async (tx) => {
      await tx.jobRun.create({
        data: {
          id: jobRunId,
          tenantId: null,
          queue: 'mail',
          jobType: 'mail.recovery',
          status: 'QUEUED',
          payloadJson: JSON.stringify({ to: user.email, token }),
          actorUserId: user.id,
          idempotencyKey,
        },
      });
      await writeOutbox(tx, {
        eventType: 'mail.recovery',
        payload: {
          to: user.email,
          token,
          jobRunId,
          actorUserId: user.id,
          idempotencyKey,
          subject: 'Reset your OMA AI password',
          text: resetText(token),
        },
      });
    });
    // Immediate console delivery for UX; worker path remains authoritative for JobRun.
    await mail
      .send({
        to: user.email,
        subject: 'Reset your OMA AI password',
        text: resetText(token),
      })
      .catch(() => undefined);
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
