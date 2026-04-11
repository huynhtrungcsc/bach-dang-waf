import api from './api';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatApiResponse {
  reply: string;
  model: string;
  intents: string[];
}

export const aiService = {
  async chat(message: string, history: ChatMessage[]): Promise<ChatApiResponse> {
    const res = await api.post('/ai/chat', { message, history });
    return res.data.data as ChatApiResponse;
  },
};
