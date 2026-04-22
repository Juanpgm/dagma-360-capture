// Verifica qué personas de personal_operativo están registradas en la app
// PATCH /personal_operativo/verificar-registro
// Sin body — parámetro opcional: grupo (query)
// Respuesta: { status, total_procesados, registrados, no_registrados, detalle: [...] }

import { ApiClient } from '../lib/api-client';

export interface VerificarRegistroDetalle {
  id: string;
  nombre_completo: string;
  email?: string;
  estado_registro: 'Usuario registrado' | 'Usuario no registrado' | string;
}

export interface VerificarRegistroResponse {
  status: string;
  total_procesados: number;
  registrados: number;
  no_registrados: number;
  detalle: VerificarRegistroDetalle[];
}

/** Llama al endpoint y devuelve un Map<id, boolean> para consulta rápida */
export async function verificarRegistroPersonalOperativo(
  grupo?: string,
): Promise<Map<string, boolean>> {
  let url = '/personal_operativo/verificar-registro';
  if (grupo) url += `?grupo=${encodeURIComponent(grupo)}`;

  const res: any = await ApiClient.patch(url, {});
  if (!res) throw new Error('Sin respuesta del servidor');

  const detalle: VerificarRegistroDetalle[] = Array.isArray(res.detalle)
    ? res.detalle
    : Array.isArray(res.data?.detalle)
    ? res.data.detalle
    : [];

  const map = new Map<string, boolean>();
  for (const p of detalle) {
    map.set(p.id, p.estado_registro === 'Usuario registrado');
  }
  return map;
}
