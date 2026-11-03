import { Request, Response, NextFunction } from 'express';
import { EmailService } from './email.service';
import { parsePaginationParams, buildPaginatedResponse } from '../../shared/utils/pagination.util';
import { ListEmailsQuery } from './email.validation';

export class EmailController {
  static async listScheduled(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { page, limit, skip } = parsePaginationParams(req.query);
      const query = req.query as unknown as ListEmailsQuery;

      const { items, total } = await EmailService.listScheduled(userId, { skip, limit, query });
      const response = buildPaginatedResponse(items, total, page, limit);

      res.status(200).json({
        success: true,
        data: response,
      });
    } catch (err) {
      next(err);
    }
  }

  static async listSent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { page, limit, skip } = parsePaginationParams(req.query);
      const query = req.query as unknown as ListEmailsQuery;

      const { items, total } = await EmailService.listSent(userId, { skip, limit, query });
      const response = buildPaginatedResponse(items, total, page, limit);

      res.status(200).json({
        success: true,
        data: response,
      });
    } catch (err) {
      next(err);
    }
  }

  static async listFailed(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { page, limit, skip } = parsePaginationParams(req.query);
      const query = req.query as unknown as ListEmailsQuery;

      const { items, total } = await EmailService.listFailed(userId, { skip, limit, query });
      const response = buildPaginatedResponse(items, total, page, limit);

      res.status(200).json({
        success: true,
        data: response,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const emailId = String(req.params.id);

      const email = await EmailService.getEmailById(emailId, userId);

      res.status(200).json({
        success: true,
        data: email,
      });
    } catch (err) {
      next(err);
    }
  }
}
