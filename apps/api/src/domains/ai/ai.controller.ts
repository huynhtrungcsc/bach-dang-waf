import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth';
import logger from '../../utils/logger';
import { processChat } from './ai.service';
import { ChatRequest } from './ai.types';

export async function chatHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { message, history } = req.body as ChatRequest;

    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ success: false, message: 'Message is required.' });
      return;
    }

    const trimmed = message.trim().slice(0, 2000); // cap input length

    const result = await processChat(trimmed, history ?? []);

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    logger.error('[AI] Chat error:', err.message);
    res.status(502).json({
      success: false,
      message: err.message || 'Không thể kết nối với dịch vụ AI. Vui lòng thử lại.',
    });
  }
}
