import { describe, it, expect } from 'vitest';
import { matchReporte, tipoIntervencionOptions } from './reportesFilter';
import type { ReporteIntervencion } from '../api/visitas';

function makeReporte(overrides: Partial<ReporteIntervencion> = {}): ReporteIntervencion {
  return {
    id: 'r1',
    registrado_por: 'op@dagma.gov.co',
    grupo: 'flora_urbana',
    observaciones: '',
    tipo_intervencion: 'Poda de mantenimiento',
    id_actividad: 'ACT-1',
    descripcion_intervencion: 'Poda de árbol en parque',
    timestamp: '2026-01-01T00:00:00Z',
    photos_uploaded: 0,
    photosUrl: [],
    barrio_vereda: 'El Lido',
    comuna_corregimiento: 'Comuna 19',
    ...overrides,
  } as ReporteIntervencion;
}

describe('matchReporte', () => {
  it('returns true with no filters', () => {
    expect(matchReporte(makeReporte(), {})).toBe(true);
  });

  it('matches free-text search across fields, accent-insensitive', () => {
    const r = makeReporte({ descripcion_intervencion: 'Tala de árbol seco' });
    expect(matchReporte(r, { search: 'arbol' })).toBe(true); // no accent in query
    expect(matchReporte(r, { search: 'ÁRBOL' })).toBe(true); // upper + accent
    expect(matchReporte(r, { search: 'inexistente' })).toBe(false);
  });

  it('matches search on barrio and comuna', () => {
    const r = makeReporte();
    expect(matchReporte(r, { search: 'lido' })).toBe(true);
    expect(matchReporte(r, { search: 'comuna 19' })).toBe(true);
  });

  it('filters by exact tipo_intervencion', () => {
    const r = makeReporte({ tipo_intervencion: 'Poda de mantenimiento' });
    expect(matchReporte(r, { tipoIntervencion: 'Poda de mantenimiento' })).toBe(true);
    expect(matchReporte(r, { tipoIntervencion: 'Riego' })).toBe(false);
  });

  it('combines search AND tipo_intervencion (both must pass)', () => {
    const r = makeReporte({ tipo_intervencion: 'Riego', descripcion_intervencion: 'Riego matutino' });
    expect(matchReporte(r, { search: 'matutino', tipoIntervencion: 'Riego' })).toBe(true);
    expect(matchReporte(r, { search: 'matutino', tipoIntervencion: 'Poda' })).toBe(false);
  });
});

describe('tipoIntervencionOptions', () => {
  it('returns distinct, sorted, non-empty types', () => {
    const reportes = [
      makeReporte({ tipo_intervencion: 'Riego' }),
      makeReporte({ tipo_intervencion: 'Poda' }),
      makeReporte({ tipo_intervencion: 'Riego' }),
      makeReporte({ tipo_intervencion: '   ' }),
    ];
    expect(tipoIntervencionOptions(reportes)).toEqual(['Poda', 'Riego']);
  });

  it('returns empty array when no types present', () => {
    expect(tipoIntervencionOptions([])).toEqual([]);
  });
});
