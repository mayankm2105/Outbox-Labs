import nodemailer, { Transporter } from 'nodemailer';
import { EmailProvider, SendEmailInput, SendEmailResult } from './email-provider.interface';
import { env } from '../../config/env';
import { logger } from '../../shared/utils/logger';

export class EtherealEmailProvider implements EmailProvider {
  private transporter: Transporter;

  constructor(customTransporter?: Transporter) {
    if (customTransporter) {
      this.transporter = customTransporter;
    } else {
      this.transporter = nodemailer.createTransport({
        host: env.ETHEREAL_HOST,
        port: env.ETHEREAL_PORT,
        secure: false, // true for 465, false for 587
        auth: {
          user: env.ETHEREAL_USER,
          pass: env.ETHEREAL_PASSWORD,
        },
      });
    }
  }

  async sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
    logger.debug({ to: input.to, subject: input.subject }, 'Sending email via Ethereal SMTP');

    const info = await this.transporter.sendMail({
      from: input.from,
      to: input.to,
      subject: input.subject,
      text: input.body,
      html: `<div style="font-family: sans-serif; line-height: 1.5;">${input.body.replace(/\n/g, '<br/>')}</div>`,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    const messageId = info.messageId || `msg_${Date.now()}`;

    logger.info(
      {
        messageId,
        to: input.to,
        previewUrl: previewUrl || undefined,
      },
      'Email accepted by Ethereal SMTP',
    );

    return {
      messageId,
      previewUrl: previewUrl ? String(previewUrl) : null,
    };
  }
}

