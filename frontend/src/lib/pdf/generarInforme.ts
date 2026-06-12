/**
 * generarInforme.ts
 * Generación de informe institucional en PDF usando jsPDF + html2canvas.
 *
 * Estructura:
 *  Pág. 1  — Portada
 *  Pág. 2  — Resumen ejecutivo (KPIs + tabla por grupo)
 *  Pág. 3  — Distribución territorial (comunas / barrios)
 *  Pág. 4+ — Detalle por grupo operativo
 *  Pág. final — Evidencias (fotos + descripciones)
 */

import jsPDF from "jspdf";
import type { ReporteIntervencion } from "../../api/visitas";
import { GRUPO_DISPLAY_NAMES } from "../grupos";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export type PeriodPreset = "semana" | "mes" | "trimestre" | "semestre" | "anio" | "personalizado";

export interface InformeConfig {
  titulo: string;
  periodo: PeriodPreset;
  fechaDesde: string;      // YYYY-MM-DD
  fechaHasta: string;      // YYYY-MM-DD
  gruposIncluidos: string[];
  incluirFotos: boolean;
  incluirDescripciones: boolean;
  agruparPor: "grupo" | "comuna" | "barrio" | "tipo";
}

export interface InformeData {
  reportes: ReporteIntervencion[];
  config: InformeConfig;
}

// ─────────────────────────────────────────────────────────────────────────────
// Paleta institucional
// ─────────────────────────────────────────────────────────────────────────────

const COLORS = {
  primary:    [10,  94,  58] as const,   // #0a5e3a verde DAGMA
  accent:     [212, 160, 23] as const,   // #d4a017 dorado
  dark:       [15,  23,  42] as const,   // #0f172a
  gray:       [71,  85, 105] as const,   // #475569
  lightGray:  [241, 245, 249] as const,  // #f1f5f9
  white:      [255, 255, 255] as const,
  border:     [209, 213, 219] as const,

  cuadrilla:  [16,  185, 129] as const,
  vivero:     [59,  130, 246] as const,
  gobernanza: [245, 158, 11] as const,
  ecosistemas:[139, 92, 246] as const,
  umata:      [239, 68,  68] as const,
};

function grupoColor(grupo: string): readonly [number, number, number] {
  const g = (grupo ?? "").toLowerCase();
  if (g.includes("cuadrilla"))   return COLORS.cuadrilla;
  if (g.includes("vivero"))      return COLORS.vivero;
  if (g.includes("gobernanza"))  return COLORS.gobernanza;
  if (g.includes("ecosistema"))  return COLORS.ecosistemas;
  if (g.includes("umata"))       return COLORS.umata;
  return COLORS.gray;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de layout
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_W = 210;   // A4 mm
const PAGE_H = 297;
const MARGIN  = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;

type RGB = readonly [number, number, number];

function applyFill(doc: jsPDF, color: RGB) {
  doc.setFillColor(color[0], color[1], color[2]);
}
function applyDraw(doc: jsPDF, color: RGB) {
  doc.setDrawColor(color[0], color[1], color[2]);
}
function applyText(doc: jsPDF, color: RGB) {
  doc.setTextColor(color[0], color[1], color[2]);
}

/** Retorna una nueva página y resetea el cursor al margen. */
function newPage(doc: jsPDF): number {
  doc.addPage();
  return MARGIN;
}

/** Encabezado repetido en cada página interna. */
function pageHeader(doc: jsPDF, titulo: string, pageNum: number, totalPages: number): number {
  // Línea superior fina
  applyFill(doc, COLORS.primary);
  doc.rect(0, 0, PAGE_W, 8, "F");

  // Título del informe (top center)
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  applyText(doc, COLORS.white);
  doc.text(titulo, PAGE_W / 2, 5.2, { align: "center" });

  // Número de página
  doc.text(`Pág. ${pageNum}`, PAGE_W - MARGIN, 5.2, { align: "right" });

  return 14; // cursor Y tras el encabezado
}

/** Pie de página con logo text y fecha. */
function pageFooter(doc: jsPDF, generadoEn: string) {
  applyDraw(doc, COLORS.border);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, PAGE_H - 12, PAGE_W - MARGIN, PAGE_H - 12);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  applyText(doc, COLORS.gray);
  doc.text("DAGMA — Alcaldía de Santiago de Cali", MARGIN, PAGE_H - 7);
  doc.text(`Generado: ${generadoEn}`, PAGE_W - MARGIN, PAGE_H - 7, { align: "right" });
}

/** Dibuja una tabla simple. Retorna el Y final. */
function drawTable(
  doc: jsPDF,
  headers: string[],
  rows: (string | number)[][],
  startY: number,
  colWidths?: number[],
): number {
  const ROW_H = 7;
  const HEADER_H = 8;
  const widths = colWidths ?? headers.map(() => CONTENT_W / headers.length);

  // Header
  applyFill(doc, COLORS.primary);
  doc.rect(MARGIN, startY, CONTENT_W, HEADER_H, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  applyText(doc, COLORS.white);
  let x = MARGIN;
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i], x + 2, startY + 5.5);
    x += widths[i];
  }

  // Rows
  let y = startY + HEADER_H;
  for (let r = 0; r < rows.length; r++) {
    const isEven = r % 2 === 0;
    applyFill(doc, isEven ? COLORS.lightGray : COLORS.white);
    doc.rect(MARGIN, y, CONTENT_W, ROW_H, "F");
    applyDraw(doc, COLORS.border);
    doc.setLineWidth(0.1);
    doc.rect(MARGIN, y, CONTENT_W, ROW_H, "S");

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    applyText(doc, COLORS.dark);
    x = MARGIN;
    for (let c = 0; c < rows[r].length; c++) {
      const cell = String(rows[r][c] ?? "—");
      doc.text(cell, x + 2, y + 5);
      x += widths[c];
    }
    y += ROW_H;
  }

  return y + 2;
}

/** Carga una imagen URL como base64 (solo para imágenes ya en base64 o blob). */
async function fetchImageBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Función principal
// ─────────────────────────────────────────────────────────────────────────────

export async function generarInforme(data: InformeData): Promise<void> {
  const { reportes, config } = data;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const generadoEn = new Date().toLocaleString("es-CO", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  // ─── Filtrar por fecha ───
  const desde = config.fechaDesde ? new Date(config.fechaDesde + "T00:00:00") : null;
  const hasta = config.fechaHasta ? new Date(config.fechaHasta + "T23:59:59") : null;

  const filtrados = reportes.filter((r) => {
    if (!desde && !hasta) return true;
    const rawFecha =
      r.timestamp ??
      (r as any).fecha_registro ??
      (r as any).fecha_hora ??
      (r as any).created_at;

    if (rawFecha) {
      const ts = new Date(rawFecha);
      if (!isNaN(ts.getTime())) {
        if (desde && ts < desde) return false;
        if (hasta && ts > hasta) return false;
      }
    }
    return true;
  });

  // ─── Estadísticas ───
  const totalReportes = filtrados.length;
  const porGrupo: Record<string, number> = {};
  const porComuna: Record<string, number> = {};
  const porBarrio: Record<string, number> = {};
  const porTipo: Record<string, number> = {};
  let totalArboles = 0;
  let totalPlantas = 0;
  let totalUnidades = 0;

  for (const r of filtrados) {
    const g = (r.grupo ?? "sin grupo").toLowerCase();
    porGrupo[g] = (porGrupo[g] ?? 0) + 1;

    const com = r.comuna_corregimiento ?? "Sin ubicación";
    porComuna[com] = (porComuna[com] ?? 0) + 1;

    const bar = r.barrio_vereda ?? "Sin barrio";
    porBarrio[bar] = (porBarrio[bar] ?? 0) + 1;

    const tipo = r.tipo_intervencion ?? "Sin tipo";
    porTipo[tipo] = (porTipo[tipo] ?? 0) + 1;

    totalArboles += r.numero_individuos_intervenidos ?? 0;
    totalPlantas += r.cantidad_total_plantas ?? 0;
    totalUnidades += r.unidades_impactadas ?? 0;
  }

  const comunasUnicas = Object.keys(porComuna).length;
  const gruposActivos = Object.keys(porGrupo).length;

  // ════════════════════════════════════════
  // PÁGINA 1 — PORTADA
  // ════════════════════════════════════════
  // Fondo verde superior
  applyFill(doc, COLORS.primary);
  doc.rect(0, 0, PAGE_W, 85, "F");

  // Franja dorada
  applyFill(doc, COLORS.accent);
  doc.rect(0, 85, PAGE_W, 2, "F");

  // Logo texto DAGMA (blanco, grande)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(52);
  applyText(doc, COLORS.white);
  doc.text("DAGMA", PAGE_W / 2, 45, { align: "center" });

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Departamento Administrativo de Gestión del Medio Ambiente", PAGE_W / 2, 57, { align: "center" });
  doc.setFontSize(9);
  doc.text("Alcaldía de Santiago de Cali", PAGE_W / 2, 64, { align: "center" });

  // Título del informe
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  applyText(doc, COLORS.dark);
  doc.text(config.titulo || "Informe de Gestión Ambiental", PAGE_W / 2, 105, { align: "center" });

  // Período
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  applyText(doc, COLORS.gray);
  const periodoLabel = config.fechaDesde && config.fechaHasta
    ? `Período: ${config.fechaDesde} al ${config.fechaHasta}`
    : "Período: Todos los registros";
  doc.text(periodoLabel, PAGE_W / 2, 117, { align: "center" });

  // KPI boxes en portada
  const kpis = [
    { label: "Total Reportes",  value: String(totalReportes) },
    { label: "Comunas",         value: String(comunasUnicas) },
    { label: "Grupos Activos",  value: String(gruposActivos) },
  ];
  const kpiW = 50;
  const kpiH = 22;
  const kpiStartX = (PAGE_W - kpis.length * kpiW - (kpis.length - 1) * 5) / 2;
  let kpiX = kpiStartX;
  for (const kpi of kpis) {
    applyFill(doc, COLORS.primary);
    doc.roundedRect(kpiX, 130, kpiW, kpiH, 3, 3, "F");
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    applyText(doc, COLORS.white);
    doc.text(kpi.value, kpiX + kpiW / 2, 143, { align: "center" });
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    applyText(doc, COLORS.white);
    doc.text(kpi.label.toUpperCase(), kpiX + kpiW / 2, 149, { align: "center" });
    kpiX += kpiW + 5;
  }

  // Adicionales
  if (totalArboles > 0 || totalPlantas > 0 || totalUnidades > 0) {
    const adicionales = [
      { label: "Árboles",  value: totalArboles },
      { label: "Plantas",  value: totalPlantas },
      { label: "Unidades", value: totalUnidades },
    ].filter(k => k.value > 0);
    const adiW = 40;
    const adiStartX = (PAGE_W - adicionales.length * adiW - (adicionales.length - 1) * 5) / 2;
    let adiX = adiStartX;
    for (const a of adicionales) {
      applyFill(doc, COLORS.lightGray);
      doc.roundedRect(adiX, 160, adiW, 16, 2, 2, "F");
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      applyText(doc, COLORS.primary);
      doc.text(a.value.toLocaleString("es-CO"), adiX + adiW / 2, 170, { align: "center" });
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      applyText(doc, COLORS.gray);
      doc.text(a.label, adiX + adiW / 2, 174, { align: "center" });
      adiX += adiW + 5;
    }
  }

  pageFooter(doc, generadoEn);

  // ════════════════════════════════════════
  // PÁGINA 2 — RESUMEN EJECUTIVO
  // ════════════════════════════════════════
  let y = newPage(doc);
  const p2title = config.titulo || "Informe de Gestión Ambiental";
  y = pageHeader(doc, p2title, 2, 0);

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  applyText(doc, COLORS.primary);
  doc.text("Resumen Ejecutivo", MARGIN, y + 4);
  y += 12;

  // Tabla por grupo
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  applyText(doc, COLORS.dark);
  doc.text("Intervenciones por Grupo Operativo", MARGIN, y);
  y += 4;

  const grupoRows = Object.entries(porGrupo)
    .sort(([, a], [, b]) => b - a)
    .map(([g, count]) => {
      const displayName = (GRUPO_DISPLAY_NAMES as any)[g] ?? g;
      const pct = totalReportes > 0 ? ((count / totalReportes) * 100).toFixed(1) + "%" : "0%";
      return [displayName, count, pct];
    });

  y = drawTable(
    doc,
    ["Grupo Operativo", "Intervenciones", "Participación"],
    grupoRows,
    y,
    [90, 50, 34],
  );
  y += 6;

  // Tabla top tipos de intervención
  const topTipos = Object.entries(porTipo)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);

  if (topTipos.length > 0 && y < PAGE_H - 80) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    applyText(doc, COLORS.dark);
    doc.text("Top 10 — Tipos de Intervención", MARGIN, y + 2);
    y += 6;

    const tipoRows = topTipos.map(([tipo, count]) => {
      const pct = totalReportes > 0 ? ((count / totalReportes) * 100).toFixed(1) + "%" : "0%";
      return [tipo.length > 45 ? tipo.slice(0, 42) + "…" : tipo, count, pct];
    });
    y = drawTable(doc, ["Tipo de Intervención", "Cant.", "% del Total"], tipoRows, y, [120, 24, 30]);
  }

  pageFooter(doc, generadoEn);

  // ════════════════════════════════════════
  // PÁGINA 3 — DISTRIBUCIÓN TERRITORIAL
  // ════════════════════════════════════════
  y = newPage(doc);
  y = pageHeader(doc, p2title, 3, 0);

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  applyText(doc, COLORS.primary);
  doc.text("Distribución Territorial", MARGIN, y + 4);
  y += 12;

  // Top comunas
  const topComunas = Object.entries(porComuna)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 12);

  if (topComunas.length > 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    applyText(doc, COLORS.dark);
    doc.text("Top 12 — Comunas / Corregimientos con más intervenciones", MARGIN, y);
    y += 5;

    const comunaRows = topComunas.map(([com, count], idx) => {
      const pct = totalReportes > 0 ? ((count / totalReportes) * 100).toFixed(1) + "%" : "0%";
      return [`${idx + 1}. ${com}`, count, pct];
    });
    y = drawTable(doc, ["Comuna / Corregimiento", "Intervenciones", "% del Total"], comunaRows, y, [110, 40, 24]);
    y += 6;
  }

  // Top barrios
  const topBarrios = Object.entries(porBarrio)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 12);

  if (topBarrios.length > 0 && y < PAGE_H - 90) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    applyText(doc, COLORS.dark);
    doc.text("Top 12 — Barrios / Veredas con más intervenciones", MARGIN, y);
    y += 5;

    const barrioRows = topBarrios.map(([bar, count], idx) => {
      const pct = totalReportes > 0 ? ((count / totalReportes) * 100).toFixed(1) + "%" : "0%";
      return [`${idx + 1}. ${bar}`, count, pct];
    });
    y = drawTable(doc, ["Barrio / Vereda", "Intervenciones", "% del Total"], barrioRows, y, [110, 40, 24]);
  }

  pageFooter(doc, generadoEn);

  // ════════════════════════════════════════
  // PÁGINAS 4+ — DETALLE POR GRUPO
  // ════════════════════════════════════════
  const pageRef = { current: 4 };

  for (const grupoKey of Object.keys(porGrupo).sort()) {
    const grupoReportes = filtrados.filter(r => (r.grupo ?? "").toLowerCase() === grupoKey);
    if (grupoReportes.length === 0) continue;

    y = newPage(doc);
    y = pageHeader(doc, p2title, pageRef.current++, 0);

    const displayName = (GRUPO_DISPLAY_NAMES as any)[grupoKey] ?? grupoKey;
    const gColor = grupoColor(grupoKey);

    // Encabezado de grupo
    applyFill(doc, gColor);
    doc.roundedRect(MARGIN, y, CONTENT_W, 12, 2, 2, "F");
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    applyText(doc, COLORS.white);
    doc.text(`${displayName}`, MARGIN + 4, y + 8.5);
    doc.setFontSize(10);
    doc.text(`${grupoReportes.length} intervenciones`, MARGIN + CONTENT_W - 4, y + 8.5, { align: "right" });
    y += 18;

    // Tipos dentro del grupo
    const tiposPorGrupo: Record<string, number> = {};
    for (const r of grupoReportes) {
      const t = r.tipo_intervencion ?? "Sin tipo";
      tiposPorGrupo[t] = (tiposPorGrupo[t] ?? 0) + 1;
    }
    const tipoGrupoRows = Object.entries(tiposPorGrupo)
      .sort(([, a], [, b]) => b - a)
      .map(([tipo, count]) => [tipo.length > 55 ? tipo.slice(0, 52) + "…" : tipo, count]);

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    applyText(doc, COLORS.dark);
    doc.text("Tipos de intervención registrados:", MARGIN, y);
    y += 4;
    y = drawTable(doc, ["Tipo de Intervención", "Cantidad"], tipoGrupoRows, y, [140, 34]);
    y += 4;

    // Impacto cuantitativo del grupo
    let grupoArboles = 0, grupoPlantas = 0, grupoUnidades = 0;
    for (const r of grupoReportes) {
      grupoArboles += r.numero_individuos_intervenidos ?? 0;
      grupoPlantas += r.cantidad_total_plantas ?? 0;
      grupoUnidades += r.unidades_impactadas ?? 0;
    }

    const kpiData: { label: string; value: number }[] = [];
    if (grupoArboles > 0) kpiData.push({ label: "Árboles", value: grupoArboles });
    if (grupoPlantas > 0) kpiData.push({ label: "Plantas", value: grupoPlantas });
    if (grupoUnidades > 0) kpiData.push({ label: "Unidades", value: grupoUnidades });

    if (kpiData.length > 0 && y < PAGE_H - 60) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      applyText(doc, COLORS.dark);
      doc.text("Impacto cuantitativo:", MARGIN, y + 2);
      y += 7;

      const kw = Math.min(50, CONTENT_W / kpiData.length - 4);
      let kx = MARGIN;
      for (const k of kpiData) {
        applyFill(doc, COLORS.lightGray);
        doc.roundedRect(kx, y, kw, 14, 2, 2, "F");
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        applyText(doc, gColor);
        doc.text(k.value.toLocaleString("es-CO"), kx + kw / 2, y + 8, { align: "center" });
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        applyText(doc, COLORS.gray);
        doc.text(k.label, kx + kw / 2, y + 12.5, { align: "center" });
        kx += kw + 4;
      }
      y += 20;
    }

    pageFooter(doc, generadoEn);
  }

  // ════════════════════════════════════════
  // PÁGINAS DE EVIDENCIAS (si hay fotos y config.incluirFotos)
  // ════════════════════════════════════════
  if (config.incluirFotos) {
    const conFotos = filtrados.filter(
      r => r.documentos_con_enlaces && r.documentos_con_enlaces.length > 0
    );

    if (conFotos.length > 0) {
      y = newPage(doc);
      y = pageHeader(doc, p2title, pageRef.current++, 0);

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      applyText(doc, COLORS.primary);
      doc.text("Evidencias Fotográficas", MARGIN, y + 4);
      y += 12;

      for (const reporte of conFotos.slice(0, 8)) { // max 8 reportes con fotos para no generar PDF enorme
        if (y > PAGE_H - 80) {
          y = newPage(doc);
          y = pageHeader(doc, p2title, pageRef.current++, 0);
          pageFooter(doc, generadoEn);
          y = 14;
        }

        // Cabecera del reporte
        const gCol = grupoColor(reporte.grupo ?? "");
        applyFill(doc, gCol);
        doc.roundedRect(MARGIN, y, CONTENT_W, 8, 1, 1, "F");
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        applyText(doc, COLORS.white);
        const headerText = [
          (reporte.tipo_intervencion ?? "Intervención").slice(0, 50),
          reporte.barrio_vereda ?? reporte.comuna_corregimiento ?? "",
          reporte.timestamp ? new Date(reporte.timestamp).toLocaleDateString("es-CO") : "",
        ].filter(Boolean).join("  ·  ");
        doc.text(headerText, MARGIN + 3, y + 5.5);
        y += 10;

        // Fotos en grid 2x2
        const docs = reporte.documentos_con_enlaces!.slice(0, 4);
        const imgW = 42;
        const imgH = 30;
        const imgGap = 4;
        let ix = MARGIN;
        let imageRow = 0;

        for (let i = 0; i < docs.length; i++) {
          if (i > 0 && i % 4 === 0) {
            // nueva fila de fotos
            ix = MARGIN;
            y += imgH + imgGap;
            imageRow++;
          }

          const imgUrl = docs[i].url_visualizar ?? docs[i].url_presigned ?? docs[i].s3_url;
          if (imgUrl) {
            try {
              const b64 = await fetchImageBase64(imgUrl);
              if (b64) {
                doc.addImage(b64, "JPEG", ix, y, imgW, imgH);
              } else {
                // placeholder
                applyFill(doc, COLORS.lightGray);
                doc.rect(ix, y, imgW, imgH, "F");
                doc.setFontSize(7);
                applyText(doc, COLORS.gray);
                doc.text("Sin imagen", ix + imgW / 2, y + imgH / 2, { align: "center" });
              }
            } catch {
              applyFill(doc, COLORS.lightGray);
              doc.rect(ix, y, imgW, imgH, "F");
            }
          }
          ix += imgW + imgGap;
        }

        y += imgH + 4;

        // Descripción corta
        if (config.incluirDescripciones && reporte.descripcion_intervencion) {
          const desc = reporte.descripcion_intervencion.slice(0, 200);
          doc.setFontSize(7.5);
          doc.setFont("helvetica", "normal");
          applyText(doc, COLORS.gray);
          const lines = doc.splitTextToSize(desc, CONTENT_W);
          doc.text(lines.slice(0, 3), MARGIN, y);
          y += lines.slice(0, 3).length * 4 + 2;
        }

        y += 4;
      }

      pageFooter(doc, generadoEn);
    }
  }

  // ════════════════════════════════════════
  // Guardar PDF
  // ════════════════════════════════════════
  const fechaStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const filename = `DAGMA_Informe_${fechaStr}.pdf`;
  doc.save(filename);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: calcular preset de fechas
// ─────────────────────────────────────────────────────────────────────────────

export function calcularFechasPeriodo(preset: PeriodPreset): { desde: string; hasta: string } {
  const hoy = new Date();
  const hasta = hoy.toISOString().slice(0, 10);

  let desde: Date;
  switch (preset) {
    case "semana":
      desde = new Date(hoy);
      desde.setDate(hoy.getDate() - 7);
      break;
    case "mes":
      desde = new Date(hoy);
      desde.setMonth(hoy.getMonth() - 1);
      break;
    case "trimestre":
      desde = new Date(hoy);
      desde.setMonth(hoy.getMonth() - 3);
      break;
    case "semestre":
      desde = new Date(hoy);
      desde.setMonth(hoy.getMonth() - 6);
      break;
    case "anio":
      desde = new Date(hoy.getFullYear(), 0, 1);
      break;
    default:
      desde = new Date(hoy);
      desde.setMonth(hoy.getMonth() - 1);
  }

  return { desde: desde.toISOString().slice(0, 10), hasta };
}
