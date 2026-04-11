export type IntentType =
  | 'metrics'
  | 'rules'
  | 'logs'
  | 'traffic'
  | 'domains'
  | 'alerts'
  | 'general';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  message: string;
  history?: ChatMessage[];
}

export interface ChatResponse {
  reply: string;
  model: string;
  intents: IntentType[];
}

export interface SystemContextSection {
  label: string;
  data: string;
}
