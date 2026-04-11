

import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import logger from '../../utils/logger';
import { notificationChannelService, alertRuleService } from './alerts.service';
export const getNotificationChannels = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const channels = await notificationChannelService.listChannels();

    res.json({
      success: true,
      data: channels
    });
  } catch (error) {
    logger.error('Get notification channels error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
export const getNotificationChannel = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const channel = await notificationChannelService.findChannel(id);

    if (!channel) {
      res.status(404).json({
        success: false,
        message: 'Notification channel not found'
      });
      return;
    }

    res.json({
      success: true,
      data: channel
    });
  } catch (error) {
    logger.error('Get notification channel error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
export const createNotificationChannel = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, type, enabled, config } = req.body;

    const channel = await notificationChannelService.addChannel(
      { name, type, enabled, config },
      req.user?.username
    );

    res.status(201).json({
      success: true,
      data: channel
    });
  } catch (error: any) {
    logger.error('Create notification channel error:', error);
    res.status(error.message.includes('required') ? 400 : 500).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};
export const updateNotificationChannel = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, type, enabled, config } = req.body;

    const channel = await notificationChannelService.editChannel(
      id,
      { name, type, enabled, config },
      req.user?.username
    );

    res.json({
      success: true,
      data: channel
    });
  } catch (error: any) {
    logger.error('Update notification channel error:', error);
    const statusCode = error.message === 'Notification channel not found' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};
export const deleteNotificationChannel = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await notificationChannelService.removeChannel(id, req.user?.username);

    res.json({
      success: true,
      message: 'Notification channel deleted successfully'
    });
  } catch (error: any) {
    logger.error('Delete notification channel error:', error);
    const statusCode = error.message === 'Notification channel not found' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};
export const testNotificationChannel = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await notificationChannelService.pingChannel(id);

    if (result.success) {
      res.json({
        success: true,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error: any) {
    logger.error('Test notification channel error:', error);
    const statusCode = error.message === 'Notification channel not found' ? 404 :
                       error.message === 'Channel is disabled' ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};
export const getAlertRules = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rules = await alertRuleService.listRules();

    res.json({
      success: true,
      data: rules
    });
  } catch (error) {
    logger.error('Get alert rules error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
export const getAlertRule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const rule = await alertRuleService.findRule(id);

    if (!rule) {
      res.status(404).json({
        success: false,
        message: 'Alert rule not found'
      });
      return;
    }

    res.json({
      success: true,
      data: rule
    });
  } catch (error) {
    logger.error('Get alert rule error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
export const createAlertRule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, condition, threshold, severity, channels, enabled } = req.body;

    const rule = await alertRuleService.addRule(
      { name, condition, threshold, severity, channels, enabled },
      req.user?.username
    );

    res.status(201).json({
      success: true,
      data: rule
    });
  } catch (error: any) {
    logger.error('Create alert rule error:', error);
    const statusCode = error.message.includes('required') || error.message.includes('not found') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};
export const updateAlertRule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, condition, threshold, severity, channels, enabled } = req.body;

    const rule = await alertRuleService.editRule(
      id,
      { name, condition, threshold, severity, channels, enabled },
      req.user?.username
    );

    res.json({
      success: true,
      data: rule
    });
  } catch (error: any) {
    logger.error('Update alert rule error:', error);
    const statusCode = error.message === 'Alert rule not found' ? 404 :
                       error.message.includes('not found') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};
export const deleteAlertRule = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await alertRuleService.removeRule(id, req.user?.username);

    res.json({
      success: true,
      message: 'Alert rule deleted successfully'
    });
  } catch (error: any) {
    logger.error('Delete alert rule error:', error);
    const statusCode = error.message === 'Alert rule not found' ? 404 : 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Internal server error'
    });
  }
};
