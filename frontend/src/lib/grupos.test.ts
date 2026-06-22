import { describe, it, expect, vi } from 'vitest';
import { normalizeGrupo, gruposMatch, canonicalGrupoKey, GRUPO_KEYS, GRUPO_DISPLAY_NAMES } from './grupos';

// Mock the ApiClient to avoid actual network calls
vi.mock('./api-client', () => ({
    ApiClient: {
        get: vi.fn().mockRejectedValue(new Error('Network error')),
    },
}));

describe('canonicalGrupoKey', () => {
    it('maps cuadrilla to flora_urbana', () => {
        expect(canonicalGrupoKey('cuadrilla')).toBe('flora_urbana');
    });
    it('maps Cuadrilla (capitalized) to flora_urbana', () => {
        expect(canonicalGrupoKey('Cuadrilla')).toBe('flora_urbana');
    });
    it('maps Flora Urbana to flora_urbana', () => {
        expect(canonicalGrupoKey('Flora Urbana')).toBe('flora_urbana');
    });
    it('maps Flora urbana to flora_urbana', () => {
        expect(canonicalGrupoKey('Flora urbana')).toBe('flora_urbana');
    });
    it('maps Flora urbana (cuadrilla) to flora_urbana', () => {
        expect(canonicalGrupoKey('Flora urbana (cuadrilla)')).toBe('flora_urbana');
    });
    it('is idempotent for flora_urbana', () => {
        expect(canonicalGrupoKey('flora_urbana')).toBe('flora_urbana');
    });
    it('does not remap vivero', () => {
        expect(canonicalGrupoKey('vivero')).toBe('vivero');
    });
    it('normalizes Gobernanza to gobernanza', () => {
        expect(canonicalGrupoKey('Gobernanza')).toBe('gobernanza');
    });
    it('returns empty string for null', () => {
        expect(canonicalGrupoKey(null)).toBe('');
    });
    it('returns empty string for undefined', () => {
        expect(canonicalGrupoKey(undefined)).toBe('');
    });
    it('returns empty string for empty string', () => {
        expect(canonicalGrupoKey('')).toBe('');
    });
});

describe('GRUPO_DISPLAY_NAMES', () => {
    it('shows Flora urbana for flora_urbana key', () => {
        expect(GRUPO_DISPLAY_NAMES['flora_urbana']).toBe('Flora urbana');
    });
    it('does not have cuadrilla key', () => {
        expect('cuadrilla' in GRUPO_DISPLAY_NAMES).toBe(false);
    });
});

describe('GRUPO_KEYS', () => {
    it('includes flora_urbana', () => {
        expect(GRUPO_KEYS).toContain('flora_urbana');
    });
    it('does not include cuadrilla', () => {
        expect(GRUPO_KEYS).not.toContain('cuadrilla');
    });
});
