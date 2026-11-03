import { Request, Response, NextFunction } from 'express';
import { SenderRepository } from './sender.repository';
import { CryptoUtil } from '../../shared/utils/crypto.util';

export class SenderController {
  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const senders = await SenderRepository.listByUser(userId);

      res.status(200).json({
        success: true,
        data: senders,
      });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { email, displayName, smtpHost, smtpPort, smtpUsername, smtpPassword } = req.body;

      const encryptedPassword = CryptoUtil.encrypt(smtpPassword);

      const sender = await SenderRepository.create({
        userId,
        email,
        displayName,
        smtpHost,
        smtpPort,
        smtpUsername,
        smtpPasswordEncrypted: encryptedPassword,
      });

      res.status(201).json({
        success: true,
        message: 'Sender account created successfully',
        data: {
          id: sender.id,
          email: sender.email,
          displayName: sender.displayName,
          smtpHost: sender.smtpHost,
          smtpPort: sender.smtpPort,
          isActive: sender.isActive,
          createdAt: sender.createdAt,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

