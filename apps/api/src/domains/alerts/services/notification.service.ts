

import axios from 'axios';
import nodemailer from 'nodemailer';
import logger from '../../../utils/logger';
import {
  NotificationConfig,
  TestNotificationResponse,
  SendNotificationResponse,
  NotificationResult
} from '../alerts.types';
export async function sendTelegramNotification(
  chatId: string,
  botToken: string,
  message: string
): Promise<boolean> {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const response = await axios.post(url, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });

    if (response.data.ok) {
      logger.info(`Telegram notification dispatched to chat ${chatId}`);
      return true;
    } else {
      logger.error('Telegram API returned non-ok response:', response.data);
      return false;
    }
  } catch (error: any) {
    logger.error('Telegram dispatch failed:', error.response?.data || error.message);
    throw new Error(`Telegram delivery error: ${error.response?.data?.description || error.message}`);
  }
}
export async function sendEmailNotification(
  to: string,
  subject: string,
  message: string
): Promise<boolean> {
  try {
    if (!process.env.SMTP_HOST) {
      logger.warn('SMTP relay not configured — skipping email dispatch');
      throw new Error(
        'SMTP relay not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS in the server environment to enable email dispatch.'
      );
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text: message,
      html: `<div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 24px; max-width: 600px; color: #1f2937;">
        <div style="border-left: 4px solid #1d4ed8; padding-left: 16px; margin-bottom: 20px;">
          <h2 style="margin: 0 0 4px; font-size: 16px; font-weight: 600; color: #111827;">${subject}</h2>
          <p style="margin: 0; font-size: 12px; color: #6b7280;">Bach Dang WAF — Alert Notification</p>
        </div>
        <p style="font-size: 14px; line-height: 1.7; color: #374151; white-space: pre-line;">${message}</p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
        <p style="font-size: 11px; color: #9ca3af; margin: 0;">
          This is an automated notification from Bach Dang WAF Management Console. Do not reply to this message.
        </p>
      </div>`,
    });

    logger.info(`Email dispatched to ${to} — Message-ID: ${info.messageId}`);
    return true;
  } catch (error: any) {
    logger.error('Email dispatch failed:', error.message);
    throw new Error(`Email delivery error: ${error.message}`);
  }
}
export async function sendTestNotification(
  channelName: string,
  channelType: string,
  config: NotificationConfig
): Promise<TestNotificationResponse> {
  const ts = new Date().toUTCString();
  const testMessage = [
    `[CHANNEL TEST] Bach Dang WAF`,
    ``,
    `This is an automated connectivity test from Bach Dang WAF Management Console.`,
    ``,
    `Channel  : ${channelName}`,
    `Protocol : ${channelType.toUpperCase()}`,
    `Timestamp: ${ts}`,
    ``,
    `Channel is operational. No action required.`,
  ].join('\n');

  try {
    if (channelType === 'telegram') {
      if (!config.chatId || !config.botToken) {
        throw new Error('Telegram channel misconfigured: Bot Token and Chat ID are required.');
      }

      await sendTelegramNotification(config.chatId, config.botToken, testMessage);

      return {
        success: true,
        message: `Test dispatch delivered to Telegram chat ${config.chatId}`
      };
    } else if (channelType === 'email') {
      if (!config.email) {
        throw new Error('Email channel misconfigured: recipient address is required.');
      }

      await sendEmailNotification(
        config.email,
        '[TEST] Alert Channel Verification — Bach Dang WAF',
        testMessage
      );

      return {
        success: true,
        message: `Test dispatch delivered to ${config.email}`
      };
    } else {
      throw new Error(`Unsupported channel protocol: ${channelType}`);
    }
  } catch (error: any) {
    logger.error(`Test dispatch failed for channel "${channelName}":`, error.message);
    return {
      success: false,
      message: error.message
    };
  }
}
export async function sendAlertNotification(
  alertName: string,
  alertMessage: string,
  severity: string,
  channels: Array<{ name: string; type: string; config: NotificationConfig }>
): Promise<SendNotificationResponse> {
  const results: NotificationResult[] = [];

  const severityLabel = severity === 'critical' ? '[CRITICAL]' : severity === 'warning' ? '[WARNING]' : '[INFO]';
  const ts = new Date().toUTCString();
  const message = [
    `${severityLabel} ${alertName}`,
    ``,
    `Severity : ${severity.toUpperCase()}`,
    `Details  : ${alertMessage}`,
    `Timestamp: ${ts}`,
    `Source   : Bach Dang WAF Management Console`,
  ].join('\n');

  for (const channel of channels) {
    try {
      if (channel.type === 'telegram' && channel.config.chatId && channel.config.botToken) {
        await sendTelegramNotification(channel.config.chatId, channel.config.botToken, message);
        results.push({ channel: channel.name, success: true });
      } else if (channel.type === 'email' && channel.config.email) {
        await sendEmailNotification(
          channel.config.email,
          `[${severity.toUpperCase()}] ${alertName} — Bach Dang WAF`,
          message
        );
        results.push({ channel: channel.name, success: true });
      } else {
        results.push({
          channel: channel.name,
          success: false,
          error: 'Channel configuration is incomplete or invalid.'
        });
      }
    } catch (error: any) {
      results.push({
        channel: channel.name,
        success: false,
        error: error.message
      });
    }
  }

  const allSuccess = results.every(r => r.success);
  return { success: allSuccess, results };
}
