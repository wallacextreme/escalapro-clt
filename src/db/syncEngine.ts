import { db } from './database';
import type { AuditLogEntry, SyncQueueItem } from '../types/domain';

export interface FirebaseSyncConfig {
  enabled: boolean;
  databaseUrl: string;
  tenantId: string;
  authToken?: string;
}

const SYNC_CONFIG_STORAGE_KEY = 'escalapro_firebase_sync_config';

export function loadFirebaseSyncConfig(): FirebaseSyncConfig {
  try {
    const raw = localStorage.getItem(SYNC_CONFIG_STORAGE_KEY);
    if (!raw) {
      return { enabled: false, databaseUrl: '', tenantId: 'empresa-matriz' };
    }
    const parsed = JSON.parse(raw) as Partial<FirebaseSyncConfig>;
    return {
      enabled: Boolean(parsed.enabled),
      databaseUrl: parsed.databaseUrl ?? '',
      tenantId: parsed.tenantId ?? 'empresa-matriz',
      authToken: parsed.authToken
    };
  } catch {
    return { enabled: false, databaseUrl: '', tenantId: 'empresa-matriz' };
  }
}

export function saveFirebaseSyncConfig(config: FirebaseSyncConfig): void {
  localStorage.setItem(SYNC_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

export async function computeSha256Hex(input: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback determinístico caso executado em contexto sem crypto.subtle (ex: HTTP legado)
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  const part = `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0)
    .toString(16)
    .padStart(8, '0')}`;
  return part.repeat(4).slice(0, 64);
}

export async function recordDualWriteMutation(params: {
  entity: string;
  entityId: string;
  operation: 'UPSERT' | 'DELETE';
  action: string;
  summary: string;
  payload: unknown;
  actor?: string;
}): Promise<void> {
  const timestamp = new Date().toISOString();
  const payloadJson = JSON.stringify(params.payload);
  const payloadHash = await computeSha256Hex(
    `${params.entity}:${params.entityId}:${params.operation}:${payloadJson}`
  );

  const auditEntry: AuditLogEntry = {
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp,
    actor: params.actor ?? 'Gestor de Escala',
    action: params.action,
    entity: params.entity,
    entityId: params.entityId,
    summary: params.summary,
    payloadHash
  };

  const queueItem: SyncQueueItem = {
    id: `sync-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    entity: params.entity,
    entityId: params.entityId,
    operation: params.operation,
    payloadJson,
    payloadHash,
    status: 'PENDING',
    createdAt: timestamp
  };

  await db.transaction('rw', db.auditLogs, db.syncQueue, async () => {
    await db.auditLogs.put(auditEntry);
    await db.syncQueue.put(queueItem);
  });
}

export async function flushSyncQueueToFirebase(): Promise<{
  attempted: number;
  synced: number;
  failed: number;
  message: string;
}> {
  const config = loadFirebaseSyncConfig();
  const pending = await db.syncQueue.where('status').equals('PENDING').toArray();

  if (!config.enabled || !config.databaseUrl.trim()) {
    return {
      attempted: pending.length,
      synced: 0,
      failed: 0,
      message:
        pending.length > 0
          ? `${pending.length} registro(s) preservado(s) na fila offline (modo local ativo).`
          : 'Banco local sincronizado e íntegro.'
    };
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return {
      attempted: pending.length,
      synced: 0,
      failed: 0,
      message: 'Offline detectado: fila preservada no IndexedDB até reconexão.'
    };
  }

  let synced = 0;
  let failed = 0;
  const baseUrl = config.databaseUrl.replace(/\/+$/, '');

  for (const item of pending) {
    try {
      const targetUrl = `${baseUrl}/tenants/${encodeURIComponent(
        config.tenantId
      )}/${encodeURIComponent(item.entity)}/${encodeURIComponent(
        item.entityId
      )}.json${
        config.authToken ? `?auth=${encodeURIComponent(config.authToken)}` : ''
      }`;

      const response = await fetch(targetUrl, {
        method: item.operation === 'DELETE' ? 'DELETE' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: item.operation === 'DELETE' ? undefined : item.payloadJson
      });

      if (!response.ok) {
        failed += 1;
        await db.syncQueue.update(item.id, { status: 'ERROR' });
        continue;
      }

      synced += 1;
      await db.syncQueue.update(item.id, {
        status: 'SYNCED',
        syncedAt: new Date().toISOString()
      });
    } catch {
      failed += 1;
      await db.syncQueue.update(item.id, { status: 'ERROR' });
    }
  }

  return {
    attempted: pending.length,
    synced,
    failed,
    message: `Sync concluído: ${synced} enviado(s), ${failed} erro(s).`
  };
}

