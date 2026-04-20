// Verifica qué personas de personal_operativo están registradas en la app
// PATCH /personal_operativo/verificar-registro

import { ApiClient } from '../lib/api-client';

export interface VerificarRegistroRequest {
  personal_ids: string[]; // IDs de personal_operativo a verificar
}

export interface VerificarRegistroResult {
  id: string;
  nombre_completo: string;
  registrado: boolean;
  email?: string;
}

export interface VerificarRegistroResponse {
  registrados: VerificarRegistroResult[];
  no_registrados: VerificarRegistroResult[];
}

export async function verificarRegistroPersonalOperativo(
  personal_ids: string[],
): Promise<VerificarRegistroResponse> {
  const url = '/personal_operativo/verificar-registro';
  const response = await ApiClient.patch(url, { personal_ids });
  if (!response) throw new Error('No se pudo verificar el registro');
  return response;
}
