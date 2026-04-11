import prisma from '../../config/database';
import { CreateProviderBody, UpdateProviderBody } from './ai-provider.types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function maskKey(key: string | null | undefined): string | null {
  if (!key) return null;
  if (key.length <= 8) return '••••••••';
  return key.slice(0, 4) + '••••••••' + key.slice(-4);
}

function toDto(row: any, exposeKey = false) {
  return {
    id: row.id,
    name: row.name,
    label: row.label,
    baseUrl: row.baseUrl,
    apiKey: exposeKey ? row.apiKey : maskKey(row.apiKey),
    model: row.model,
    enabled: row.enabled,
    priority: row.priority,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

export async function listProviders() {
  const rows = await prisma.aiProviderConfig.findMany({
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map(r => toDto(r));
}

export async function getProvider(id: string) {
  const row = await prisma.aiProviderConfig.findUnique({ where: { id } });
  if (!row) return null;
  return toDto(row);
}

export async function createProvider(body: CreateProviderBody) {
  const row = await prisma.aiProviderConfig.create({
    data: {
      name: body.name,
      label: body.label,
      baseUrl: body.baseUrl,
      apiKey: body.apiKey || null,
      model: body.model,
      enabled: body.enabled ?? false,
      priority: body.priority ?? 99,
    },
  });
  return toDto(row);
}

export async function updateProvider(id: string, body: UpdateProviderBody) {
  const existing = await prisma.aiProviderConfig.findUnique({ where: { id } });
  if (!existing) return null;

  const data: any = {};
  if (body.label !== undefined) data.label = body.label;
  if (body.baseUrl !== undefined) data.baseUrl = body.baseUrl;
  if (body.model !== undefined) data.model = body.model;
  if (body.enabled !== undefined) data.enabled = body.enabled;
  if (body.priority !== undefined) data.priority = body.priority;

  // Update apiKey only if explicitly provided (null = clear it)
  if ('apiKey' in body) {
    data.apiKey = body.apiKey || null;
  }

  const row = await prisma.aiProviderConfig.update({ where: { id }, data });
  return toDto(row);
}

export async function deleteProvider(id: string) {
  await prisma.aiProviderConfig.delete({ where: { id } });
}

// ─── For AI service: return active providers with real keys ──────────────────

export async function getEnabledProvidersWithKeys() {
  const rows = await prisma.aiProviderConfig.findMany({
    where: { enabled: true },
    orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    label: r.label,
    baseUrl: r.baseUrl,
    apiKey: r.apiKey ?? '',
    model: r.model,
  }));
}
