import { Request, Response } from 'express';
import {
  listProviders,
  getProvider,
  createProvider,
  updateProvider,
  deleteProvider,
} from './ai-provider.service';
import { PROVIDER_PRESETS } from './ai-provider.types';

export async function handleListProviders(req: Request, res: Response) {
  const providers = await listProviders();
  res.json({ success: true, data: providers });
}

export async function handleGetPresets(_req: Request, res: Response) {
  res.json({ success: true, data: PROVIDER_PRESETS });
}

export async function handleCreateProvider(req: Request, res: Response) {
  const { name, label, baseUrl, apiKey, model, enabled, priority } = req.body;

  if (!name || !label || !baseUrl || !model) {
    return res.status(400).json({ success: false, message: 'name, label, baseUrl, model are required' });
  }

  try {
    const provider = await createProvider({ name, label, baseUrl, apiKey, model, enabled, priority });
    res.status(201).json({ success: true, data: provider });
  } catch (err: any) {
    if (err?.code === 'P2002') {
      return res.status(409).json({ success: false, message: `Provider name "${name}" already exists` });
    }
    throw err;
  }
}

export async function handleUpdateProvider(req: Request, res: Response) {
  const { id } = req.params;
  const result = await updateProvider(id, req.body);
  if (!result) return res.status(404).json({ success: false, message: 'Provider not found' });
  res.json({ success: true, data: result });
}

export async function handleDeleteProvider(req: Request, res: Response) {
  const { id } = req.params;
  const existing = await getProvider(id);
  if (!existing) return res.status(404).json({ success: false, message: 'Provider not found' });
  await deleteProvider(id);
  res.json({ success: true, message: 'Provider deleted' });
}

export async function handleTestProvider(req: Request, res: Response) {
  const { baseUrl, apiKey, model } = req.body;
  if (!baseUrl || !model) {
    return res.status(400).json({ success: false, message: 'baseUrl and model are required' });
  }

  const axios = (await import('axios')).default;
  try {
    const response = await axios.post(
      `${baseUrl.replace(/\/$/, '')}/chat/completions`,
      {
        model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
        stream: false,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey ?? ''}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );
    const content = response.data?.choices?.[0]?.message?.content ?? '';
    res.json({ success: true, message: 'Connection successful', reply: content });
  } catch (err: any) {
    const status = err?.response?.status;
    const msg = err?.response?.data?.error?.message || err?.message || 'Connection failed';
    res.status(200).json({ success: false, message: `${status ? `HTTP ${status}: ` : ''}${msg}` });
  }
}
