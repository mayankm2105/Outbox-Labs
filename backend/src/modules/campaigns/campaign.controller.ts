import { Request, Response, NextFunction } from 'express';
import { CampaignService } from './campaign.service';
import { parsePaginationParams, buildPaginatedResponse } from '../../shared/utils/pagination.util';
import { EmailService } from '../emails/email.service';

export class CampaignController {
  static async schedule(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const data = await CampaignService.scheduleCampaign(userId, req.body);

      // Return 202 Accepted because scheduling is asynchronous as specified
      res.status(202).json({
        success: true,
        message: 'Campaign scheduled successfully',
        data,
      });
    } catch (err) {
      next(err);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { page, limit, skip } = parsePaginationParams(req.query);

      const { items, total } = await CampaignService.listCampaigns(userId, { skip, limit });
      const response = buildPaginatedResponse(items, total, page, limit);

      res.status(200).json({
        success: true,
        message: 'Campaigns retrieved successfully',
        data: response,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const campaignId = String(req.params.id);

      const campaign = await CampaignService.getCampaign(campaignId, userId);

      res.status(200).json({
        success: true,
        message: 'Campaign details retrieved',
        data: campaign,
      });
    } catch (err) {
      next(err);
    }
  }

  static async listEmails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const campaignId = String(req.params.id);
      const { page, limit, skip } = parsePaginationParams(req.query);

      // Verify campaign exists & belongs to user first
      await CampaignService.getCampaign(campaignId, userId);

      const { items, total } = await EmailService.listByCampaign(campaignId, userId, { skip, limit });
      const response = buildPaginatedResponse(items, total, page, limit);

      res.status(200).json({
        success: true,
        data: response,
      });
    } catch (err) {
      next(err);
    }
  }

  static async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const campaignId = String(req.params.id);

      const result = await CampaignService.cancelCampaign(campaignId, userId);

      res.status(200).json({
        success: true,
        message: 'Campaign cancelled successfully',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}
