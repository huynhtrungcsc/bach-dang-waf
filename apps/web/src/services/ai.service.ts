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

export interface AiProvider {
  id: string;
  name: string;
  label: string;
  baseUrl: string;
  apiKey: string | null;
  model: string;
  enabled: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderPreset {
  name: string;
  label: string;
  baseUrl: string;
  modelSuggestions: string[];
  requiresKey: boolean;
  description: string;
}

export interface CreateProviderPayload {
  name: string;
  label: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
  enabled?: boolean;
  priority?: number;
}

export interface UpdateProviderPayload {
  label?: string;
  baseUrl?: string;
  apiKey?: string | null;
  model?: string;
  enabled?: boolean;
  priority?: number;
}

export interface TestProviderPayload {
  baseUrl: string;
  apiKey?: string;
  model: string;
}

export const aiService = {
  async chat(message: string, history: ChatMessage[]): Promise<ChatApiResponse> {
    const res = await api.post('/ai/chat', { message, history });
    return res.data.data as ChatApiResponse;
  },

  async listProviders(): Promise<AiProvider[]> {
    const res = await api.get('/ai-providers');
    return res.data.data as AiProvider[];
  },

  async getPresets(): Promise<ProviderPreset[]> {
    const res = await api.get('/ai-providers/presets');
    return res.data.data as ProviderPreset[];
  },

  async createProvider(payload: CreateProviderPayload): Promise<AiProvider> {
    const res = await api.post('/ai-providers', payload);
    return res.data.data as AiProvider;
  },

  async updateProvider(id: string, payload: UpdateProviderPayload): Promise<AiProvider> {
    const res = await api.patch(`/ai-providers/${id}`, payload);
    return res.data.data as AiProvider;
  },

  async deleteProvider(id: string): Promise<void> {
    await api.delete(`/ai-providers/${id}`);
  },

  async testProvider(payload: TestProviderPayload): Promise<{ success: boolean; message: string }> {
    const res = await api.post('/ai-providers/test', payload);
    return res.data as { success: boolean; message: string };
  },
};
