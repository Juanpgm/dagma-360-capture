import type { ReporteIntervencion } from '../api/visitas';

/** Combining diacritical marks (U+0300–U+036F), built without literal accents. */
const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');

/** Lowercase + strip accents for accent-insensitive matching. */
function norm(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().normalize('NFD').replace(DIACRITICS, '');
}

export interface ReporteFilters {
  /** Free-text search across description, type, barrio, comuna, address. */
  search?: string;
  /** Exact match on tipo_intervencion. */
  tipoIntervencion?: string;
}

/**
 * Returns true when a report passes every active filter.
 * Empty/undefined filters are treated as "no constraint".
 */
export function matchReporte(r: ReporteIntervencion, filters: ReporteFilters = {}): boolean {
  const term = norm(filters.search);
  if (term) {
    const haystack = [
      r.descripcion_intervencion,
      r.tipo_intervencion,
      r.barrio_vereda,
      r.comuna_corregimiento,
      r.direccion,
    ];
    if (!haystack.some((f) => norm(f).includes(term))) return false;
  }

  if (filters.tipoIntervencion) {
    if ((r.tipo_intervencion ?? '').trim() !== filters.tipoIntervencion) return false;
  }

  return true;
}

/** Distinct, sorted tipo_intervencion values present across the given reports. */
export function tipoIntervencionOptions(reportes: ReporteIntervencion[]): string[] {
  const set = new Set<string>();
  for (const r of reportes) {
    const t = (r.tipo_intervencion ?? '').trim();
    if (t) set.add(t);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'es'));
}
