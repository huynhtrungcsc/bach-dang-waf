

import logger from '../../utils/logger';
import {
  notificationChannelRepository,
  alertRuleRepository
} from './alerts.repository';
import { sendTestNotification } from './services/notification.service';
import {
  CreateNotificationChannelDto,
  UpdateNotificationChannelDto,
  CreateAlertRuleDto,
  UpdateAlertRuleDto,
  NotificationChannelResponseDto,
  AlertRuleResponseDto
} from './dto';
import { NotificationChannel, AlertRuleWithChannels } from './alerts.types';
export class NotificationChannelService {
  async listChannels(): Promise<NotificationChannelResponseDto[]> {
    return await notificationChannelRepository.listAll();
  }
  async findChannel(id: string): Promise<NotificationChannelResponseDto | null> {
    return await notificationChannelRepository.getById(id);
  }
  async addChannel(data: CreateNotificationChannelDto, username?: string): Promise<NotificationChannelResponseDto> {
    // Validation
    if (!data.name || !data.type || !data.config) {
      throw new Error('Name, type, and config are required');
    }

    if (data.type === 'email' && !data.config.email) {
      throw new Error('Email is required for email channel');
    }

    if (data.type === 'telegram' && (!data.config.chatId || !data.config.botToken)) {
      throw new Error('Chat ID and Bot Token are required for Telegram channel');
    }

    const channel = await notificationChannelRepository.insert(data);

    logger.info(`User ${username} created notification channel: ${channel.name}`);

    return channel;
  }
  async editChannel(
    id: string,
    data: UpdateNotificationChannelDto,
    username?: string
  ): Promise<NotificationChannelResponseDto> {
    const existingChannel = await notificationChannelRepository.getById(id);

    if (!existingChannel) {
      throw new Error('Notification channel not found');
    }

    const channel = await notificationChannelRepository.patch(id, data);

    logger.info(`User ${username} updated notification channel: ${channel.name}`);

    return channel;
  }
  async removeChannel(id: string, username?: string): Promise<void> {
    const channel = await notificationChannelRepository.getById(id);

    if (!channel) {
      throw new Error('Notification channel not found');
    }

    await notificationChannelRepository.remove(id);

    logger.info(`User ${username} deleted notification channel: ${channel.name}`);
  }
  async pingChannel(id: string) {
    const channel = await notificationChannelRepository.getById(id);

    if (!channel) {
      throw new Error('Notification channel not found');
    }

    if (!channel.enabled) {
      throw new Error('Channel is disabled');
    }

    // Send actual test notification
    logger.info(`Sending test notification to channel: ${channel.name} (type: ${channel.type})`);

    const result = await sendTestNotification(
      channel.name,
      channel.type,
      channel.config as any
    );

    if (result.success) {
      logger.info(`✅ ${result.message}`);
    } else {
      logger.error(`❌ Failed to send test notification: ${result.message}`);
    }

    return result;
  }
}
export class AlertRuleService {
  private transformAlertRule(rule: AlertRuleWithChannels): AlertRuleResponseDto {
    return {
      id: rule.id,
      name: rule.name,
      condition: rule.condition,
      threshold: rule.threshold,
      severity: rule.severity,
      enabled: rule.enabled,
      channels: rule.channels.map(rc => rc.channelId),
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt
    };
  }
  async listRules(): Promise<AlertRuleResponseDto[]> {
    const rules = await alertRuleRepository.listAll();
    return rules.map(rule => this.transformAlertRule(rule));
  }
  async findRule(id: string): Promise<AlertRuleResponseDto | null> {
    const rule = await alertRuleRepository.getById(id);
    if (!rule) {
      return null;
    }
    return this.transformAlertRule(rule);
  }
  async addRule(data: CreateAlertRuleDto, username?: string): Promise<AlertRuleResponseDto> {
    // Validation
    if (!data.name || !data.condition || data.threshold === undefined || !data.severity) {
      throw new Error('Name, condition, threshold, and severity are required');
    }

    // Verify channels exist
    if (data.channels && data.channels.length > 0) {
      const existingChannels = await notificationChannelRepository.findByIds(data.channels);

      if (existingChannels.length !== data.channels.length) {
        throw new Error('One or more notification channels not found');
      }
    }

    const rule = await alertRuleRepository.insert(data);

    logger.info(`User ${username} created alert rule: ${rule.name}`);

    return this.transformAlertRule(rule);
  }
  async editRule(
    id: string,
    data: UpdateAlertRuleDto,
    username?: string
  ): Promise<AlertRuleResponseDto> {
    const existingRule = await alertRuleRepository.getById(id);

    if (!existingRule) {
      throw new Error('Alert rule not found');
    }

    // If channels are being updated, verify they exist
    if (data.channels) {
      const existingChannels = await notificationChannelRepository.findByIds(data.channels);

      if (existingChannels.length !== data.channels.length) {
        throw new Error('One or more notification channels not found');
      }

      // Delete existing channel associations
      await alertRuleRepository.deleteChannelAssociations(id);
    }

    // Update rule
    const rule = await alertRuleRepository.patch(id, data);

    logger.info(`User ${username} updated alert rule: ${rule.name}`);

    return this.transformAlertRule(rule);
  }
  async removeRule(id: string, username?: string): Promise<void> {
    const rule = await alertRuleRepository.getById(id);

    if (!rule) {
      throw new Error('Alert rule not found');
    }

    await alertRuleRepository.remove(id);

    logger.info(`User ${username} deleted alert rule: ${rule.name}`);
  }
}

// Export singleton instances
export const notificationChannelService = new NotificationChannelService();
export const alertRuleService = new AlertRuleService();
