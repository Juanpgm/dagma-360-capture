// Exporta toda la cola pendiente como JSON descargable.
// Salvavidas de último recurso para que el usuario pueda enviar manualmente sus reportes.
import { listQueue, getFotoBlob } from './offlineQueue';

interface SerializedFoto {
  filename: string;
  mimeType: string;
  size: number;
  base64: string;
}

interface SerializedItem {
  id: string;
  kind: string;
  createdAt: string;
  attempts: number;
  lastError?: string;
  data: unknown;
  fotos?: SerializedFoto[];
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function exportPendingBackup(): Promise<void> {
  const items = await listQueue();
  const serialized: SerializedItem[] = [];

  for (const item of items) {
    const base: SerializedItem = {
      id: item.id,
      kind: item.kind,
      createdAt: new Date(item.createdAt).toISOString(),
      attempts: item.attempts,
      lastError: item.lastError,
      data: item,
    };
    if (item.kind === 'reporte_intervencion') {
      base.fotos = [];
      for (const fotoId of item.fotoIds) {
        const blob = await getFotoBlob(fotoId);
        if (!blob) continue;
        base.fotos.push({
          filename: `${fotoId}.jpg`,
          mimeType: blob.type || 'image/jpeg',
          size: blob.size,
          base64: await blobToBase64(blob),
        });
      }
    }
    serialized.push(base);
  }

  const payload = {
    exportedAt: new Date().toISOString(),
    appVersion: 'DAGMA 360',
    items: serialized,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `dagma360-respaldo-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
