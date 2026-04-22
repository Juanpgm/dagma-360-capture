/**
 * Tests for obtenerReportesAll() — verifies adaptation to the new paginated
 * flat-array response from GET /reportes_intervenciones
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock ApiClient before importing the module under test ──
vi.mock('../lib/api-client', () => ({
  ApiClient: {
    get: vi.fn(),
  },
}));

// Must import AFTER the mock is registered
import { obtenerReportesAll } from './visitas';
import { ApiClient } from '../lib/api-client';

const mockGet = vi.mocked(ApiClient.get);

// ── Helpers ──

const makePagination = (overrides = {}) => ({
  page: 1,
  per_page: 30,
  total: 2,
  total_pages: 1,
  has_next: false,
  has_prev: false,
  ...overrides,
});

const makeRawReporte = (overrides = {}) => ({
  id: 'rep-001',
  registrado_por: 'Juan Pérez',
  grupo: 'cuadrilla',
  observaciones: '',
  coordinates: { type: 'Point', coordinates: [-76.532, 3.4516] },
  tipo_intervencion: 'Poda',
  id_actividad: 'act-1',
  descripcion_intervencion: 'Poda de árboles en parque',
  timestamp: '20260401_093045',
  photos_uploaded: 2,
  photosUrl: ['https://example.com/photo1.jpg', 'https://example.com/photo2.jpg'],
  barrio_vereda: 'El Poblado',
  comuna_corregimiento: 'Comuna 14',
  direccion: 'Calle 10 # 45-30',
  ...overrides,
});

// ── Tests ──

describe('obtenerReportesAll()', () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it('parses the new flat-array response with pagination metadata', async () => {
    const rawData = [makeRawReporte({ id: 'rep-001' }), makeRawReporte({ id: 'rep-002' })];
    mockGet.mockResolvedValue({
      status: 'success',
      data: rawData,
      pagination: makePagination({ total: 60, total_pages: 2, has_next: true }),
      totals: { cuadrilla: 2 },
      total_general: 60,
    });

    const result = await obtenerReportesAll({ page: 1, per_page: 30, slim: true });

    expect(result.data).toHaveLength(2);
    expect(result.data[0].id).toBe('rep-001');
    expect(result.data[1].id).toBe('rep-002');
    expect(result.pagination.total).toBe(60);
    expect(result.pagination.has_next).toBe(true);
    expect(result.pagination.total_pages).toBe(2);
    expect(result.totals).toEqual({ cuadrilla: 2 });
    expect(result.total_general).toBe(60);
  });

  it('sends page, per_page and slim as query params', async () => {
    mockGet.mockResolvedValue({
      data: [],
      pagination: makePagination({ total: 0 }),
      totals: {},
      total_general: 0,
    });

    await obtenerReportesAll({ page: 2, per_page: 30, slim: true, grupo: 'vivero' });

    const calledUrl: string = mockGet.mock.calls[0][0] as string;
    expect(calledUrl).toContain('page=2');
    expect(calledUrl).toContain('per_page=30');
    expect(calledUrl).toContain('slim=true');
    expect(calledUrl).toContain('grupo=vivero');
  });

  it('normalizes coordinates when slim=true (coordinates field absent)', async () => {
    // slim mode: coordinates is absent from the payload
    const slimReporte = makeRawReporte({ id: 'slim-001' });
    // Remove coordinates to simulate slim response
    delete (slimReporte as any).coordinates;

    mockGet.mockResolvedValue({
      data: [slimReporte],
      pagination: makePagination({ total: 1 }),
      totals: {},
      total_general: 1,
    });

    const result = await obtenerReportesAll({ slim: true });

    expect(result.data[0].coordinates_data).toEqual([-76.532, 3.4516]);
  });

  it('uses documentos_con_enlaces url_visualizar for photosUrl when available', async () => {
    const presignedUrl = 'https://catatrack-photos.s3.amazonaws.com/path/photo.jpg?X-Amz-Signature=abc123';
    const reporteWithDocs = makeRawReporte({
      id: 'doc-001',
      photosUrl: ['https://360-dagma-photos.s3.amazonaws.com/path/photo.jpg'], // raw, would 403
      documentos_con_enlaces: [
        {
          filename: 'photo.jpg',
          s3_url: 'https://360-dagma-photos.s3.amazonaws.com/path/photo.jpg',
          url_visualizar: presignedUrl,
          url_presigned: presignedUrl,
          content_type: 'image/jpeg',
        },
      ],
    });

    mockGet.mockResolvedValue({
      data: [reporteWithDocs],
      pagination: makePagination({ total: 1 }),
      totals: {},
      total_general: 1,
    });

    const result = await obtenerReportesAll({ slim: true });

    // Should use the presigned URL, not the raw S3 URL
    expect(result.data[0].photosUrl).toEqual([presignedUrl]);
  });

  it('falls back to raw photosUrl when documentos_con_enlaces is empty', async () => {
    const rawUrl = 'https://360-dagma-photos.s3.amazonaws.com/path/photo.jpg';
    const reporteNoPresigned = makeRawReporte({
      id: 'fallback-001',
      photosUrl: [rawUrl],
      documentos_con_enlaces: [],
    });

    mockGet.mockResolvedValue({
      data: [reporteNoPresigned],
      pagination: makePagination({ total: 1 }),
      totals: {},
      total_general: 1,
    });

    const result = await obtenerReportesAll();

    expect(result.data[0].photosUrl).toEqual([rawUrl]);
  });

  it('normalizes alias fields (fecha_registro, comuna, barrio)', async () => {
    mockGet.mockResolvedValue({
      data: [makeRawReporte()],
      pagination: makePagination({ total: 1 }),
      totals: {},
      total_general: 1,
    });

    const result = await obtenerReportesAll();
    const r = result.data[0];

    expect(r.fecha_registro).toBe(r.timestamp);
    expect(r.comuna).toBe(r.comuna_corregimiento);
    expect(r.barrio).toBe(r.barrio_vereda);
  });

  it('handles empty data array without crashing', async () => {
    mockGet.mockResolvedValue({
      data: [],
      pagination: makePagination({ total: 0, total_pages: 0, has_next: false }),
      totals: {},
      total_general: 0,
    });

    const result = await obtenerReportesAll({ page: 1 });

    expect(result.data).toHaveLength(0);
    expect(result.pagination.total).toBe(0);
    expect(result.pagination.has_next).toBe(false);
  });

  it('falls back gracefully when API returns no pagination object', async () => {
    // Some older backend response without pagination key
    mockGet.mockResolvedValue({
      data: [makeRawReporte()],
      totals: { cuadrilla: 1 },
      total_general: 1,
      // No pagination field
    });

    const result = await obtenerReportesAll();

    // Should synthesize pagination from the data length
    expect(result.pagination.total).toBe(1);
    expect(result.pagination.has_next).toBe(false);
    expect(result.data).toHaveLength(1);
  });
});
