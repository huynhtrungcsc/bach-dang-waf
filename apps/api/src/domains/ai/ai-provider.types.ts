export interface AiProviderConfigDto {
  id: string;
  name: string;
  label: string;
  baseUrl: string;
  apiKey?: string | null;
  model: string;
  enabled: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProviderBody {
  name: string;
  label: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
  enabled?: boolean;
  priority?: number;
}

export interface UpdateProviderBody {
  label?: string;
  baseUrl?: string;
  apiKey?: string | null;
  model?: string;
  enabled?: boolean;
  priority?: number;
}

// Well-known provider presets that the UI can offer
export interface ProviderPreset {
  name: string;
  label: string;
  baseUrl: string;
  modelSuggestions: string[];
  requiresKey: boolean;
  description: string;
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    name: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    modelSuggestions: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    requiresKey: true,
    description: 'GPT-4o, GPT-4 Turbo, GPT-3.5',
  },
  {
    name: 'anthropic',
    label: 'Anthropic (Claude)',
    baseUrl: 'https://api.anthropic.com/v1',
    modelSuggestions: [
      'claude-opus-4-5',
      'claude-sonnet-4-5',
      'claude-3-5-haiku-latest',
      'claude-3-opus-20240229',
    ],
    requiresKey: true,
    description: 'Claude Opus, Sonnet, Haiku',
  },
  {
    name: 'google-gemini',
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    modelSuggestions: [
      'gemini-2.5-pro-preview-05-06',
      'gemini-2.0-flash',
      'gemini-1.5-pro',
      'gemini-1.5-flash',
    ],
    requiresKey: true,
    description: 'Gemini 2.5 Pro, 2.0 Flash, 1.5',
  },
  {
    name: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    modelSuggestions: [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'mixtral-8x7b-32768',
      'gemma2-9b-it',
    ],
    requiresKey: true,
    description: 'Llama, Mixtral — ultra-fast inference',
  },
  {
    name: 'together-ai',
    label: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    modelSuggestions: [
      'meta-llama/Llama-3.3-70B-Instruct-Turbo',
      'deepseek-ai/DeepSeek-R1',
      'Qwen/Qwen2.5-72B-Instruct-Turbo',
      'mistralai/Mistral-7B-Instruct-v0.2',
    ],
    requiresKey: true,
    description: 'Open-source models — Llama, DeepSeek, Qwen',
  },
  {
    name: 'fireworks-ai',
    label: 'Fireworks AI',
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    modelSuggestions: [
      'accounts/fireworks/models/llama-v3p3-70b-instruct',
      'accounts/fireworks/models/deepseek-r1',
      'accounts/fireworks/models/mixtral-8x22b-instruct',
    ],
    requiresKey: true,
    description: 'Fast serving of open-source models',
  },
  {
    name: 'mistral',
    label: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    modelSuggestions: [
      'mistral-large-latest',
      'mistral-small-latest',
      'codestral-latest',
      'open-mistral-nemo',
    ],
    requiresKey: true,
    description: 'Mistral Large, Small, Codestral',
  },
  {
    name: 'cohere',
    label: 'Cohere',
    baseUrl: 'https://api.cohere.ai/compatibility/v1',
    modelSuggestions: ['command-r-plus', 'command-r', 'command-light'],
    requiresKey: true,
    description: 'Command R+, Command R',
  },
  {
    name: 'perplexity',
    label: 'Perplexity',
    baseUrl: 'https://api.perplexity.ai',
    modelSuggestions: [
      'sonar-pro',
      'sonar',
      'sonar-reasoning-pro',
      'llama-3.1-sonar-large-128k-online',
    ],
    requiresKey: true,
    description: 'Web-search augmented LLM',
  },
  {
    name: 'deepseek',
    label: 'DeepSeek (Direct)',
    baseUrl: 'https://api.deepseek.com/v1',
    modelSuggestions: ['deepseek-chat', 'deepseek-reasoner'],
    requiresKey: true,
    description: 'DeepSeek V3, DeepSeek-R1',
  },
  {
    name: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    modelSuggestions: [
      'openai/gpt-4o',
      'anthropic/claude-opus-4-5',
      'google/gemini-2.5-pro',
      'meta-llama/llama-3.3-70b-instruct',
      'deepseek/deepseek-r1',
    ],
    requiresKey: true,
    description: 'Unified access to 200+ models',
  },
  {
    name: 'megallm',
    label: 'MegaLLM',
    baseUrl: 'https://ai.megallm.io/v1',
    modelSuggestions: [
      'deepseek/deepseek-r1',
      'qwen/qwen3-72b',
      'meta-llama/llama-3.3-70b-instruct',
      'mistralai/mistral-large-2411',
      'google/gemini-2.0-flash-001',
      'openai/gpt-4o-mini',
    ],
    requiresKey: true,
    description: 'MegaLLM gateway — open-source models',
  },
  {
    name: 'ollama',
    label: 'Ollama (Local)',
    baseUrl: 'http://localhost:11434/v1',
    modelSuggestions: ['llama3.2', 'qwen2.5', 'mistral', 'deepseek-r1', 'gemma3'],
    requiresKey: false,
    description: 'Run models locally with Ollama',
  },
  {
    name: 'lm-studio',
    label: 'LM Studio (Local)',
    baseUrl: 'http://localhost:1234/v1',
    modelSuggestions: ['local-model'],
    requiresKey: false,
    description: 'Run models locally with LM Studio',
  },
  {
    name: 'custom',
    label: 'Custom Endpoint',
    baseUrl: '',
    modelSuggestions: [],
    requiresKey: false,
    description: 'Any OpenAI-compatible API endpoint',
  },
];
