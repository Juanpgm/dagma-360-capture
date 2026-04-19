import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
  PageBreak, Header, Footer, TabStopPosition, TabStopType,
  TableOfContents, StyleLevel, LevelFormat, convertInchesToTwip
} from 'docx';
import { writeFileSync } from 'fs';

// ============================================================
// COLORES CORPORATIVOS
// ============================================================
const COLORS = {
  primary: '1B5E20',    // Verde DAGMA oscuro
  accent: '2E7D32',     // Verde medio
  light: 'E8F5E9',      // Verde claro fondo
  critical: 'B71C1C',   // Rojo crítico
  criticalBg: 'FFEBEE',
  high: 'E65100',       // Naranja alto
  highBg: 'FFF3E0',
  medium: 'F57F17',     // Amarillo medio
  mediumBg: 'FFFDE7',
  low: '1565C0',        // Azul bajo
  lowBg: 'E3F2FD',
  positive: '2E7D32',   // Verde positivo
  positiveBg: 'E8F5E9',
  gray: '616161',
  lightGray: 'F5F5F5',
  white: 'FFFFFF',
  black: '212121',
  headerBg: '1B5E20',
  tableBorder: 'BDBDBD',
};

// ============================================================
// HELPERS
// ============================================================
function heading(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({ heading: level, spacing: { before: 300, after: 150 }, children: [new TextRun({ text, bold: true, color: COLORS.primary, font: 'Calibri' })] });
}

function subheading(text) {
  return heading(text, HeadingLevel.HEADING_2);
}

function subsubheading(text) {
  return heading(text, HeadingLevel.HEADING_3);
}

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    alignment: opts.align || AlignmentType.LEFT,
    children: [new TextRun({ text, size: 22, font: 'Calibri', color: opts.color || COLORS.black, bold: opts.bold || false, italics: opts.italics || false })],
  });
}

function richPara(runs, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.after || 120, before: opts.before || 0 },
    alignment: opts.align || AlignmentType.LEFT,
    indent: opts.indent ? { left: convertInchesToTwip(opts.indent) } : undefined,
    children: runs.map(r => new TextRun({ size: 22, font: 'Calibri', ...r })),
  });
}

function bullet(text, level = 0) {
  return new Paragraph({
    bullet: { level },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 22, font: 'Calibri', color: COLORS.black })],
  });
}

function richBullet(runs, level = 0) {
  return new Paragraph({
    bullet: { level },
    spacing: { after: 60 },
    children: runs.map(r => new TextRun({ size: 22, font: 'Calibri', ...r })),
  });
}

function codeBlock(text) {
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    indent: { left: convertInchesToTwip(0.3) },
    shading: { type: ShadingType.SOLID, color: 'F5F5F5' },
    children: [new TextRun({ text, size: 18, font: 'Consolas', color: '37474F' })],
  });
}

function emptyLine() {
  return new Paragraph({ spacing: { after: 80 }, children: [] });
}

function tableCell(text, opts = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.bg ? { type: ShadingType.SOLID, color: opts.bg } : undefined,
    verticalAlign: 'center',
    children: [
      new Paragraph({
        alignment: opts.align || AlignmentType.LEFT,
        spacing: { before: 40, after: 40 },
        children: [new TextRun({ text: String(text), size: opts.size || 20, font: 'Calibri', bold: opts.bold || false, color: opts.color || COLORS.black })],
      }),
    ],
  });
}

function headerCell(text, width) {
  return tableCell(text, { bold: true, color: COLORS.white, bg: COLORS.headerBg, width, align: AlignmentType.CENTER, size: 20 });
}

function simpleTable(headers, rows, colWidths) {
  const borderStyle = { style: BorderStyle.SINGLE, size: 1, color: COLORS.tableBorder };
  const borders = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders,
    rows: [
      new TableRow({ children: headers.map((h, i) => headerCell(h, colWidths?.[i])), tableHeader: true }),
      ...rows.map(row => new TableRow({
        children: row.map((cell, i) => {
          if (typeof cell === 'object' && cell._isTableCell) return cell;
          return tableCell(cell, { width: colWidths?.[i] });
        }),
      })),
    ],
  });
}

function severityBadge(severity) {
  const map = {
    'CRÍTICA': { color: COLORS.critical, bg: COLORS.criticalBg, icon: '●' },
    'ALTA': { color: COLORS.high, bg: COLORS.highBg, icon: '●' },
    'MEDIA': { color: COLORS.medium, bg: COLORS.mediumBg, icon: '●' },
    'BAJA': { color: COLORS.low, bg: COLORS.lowBg, icon: '●' },
  };
  const s = map[severity] || map['BAJA'];
  return tableCell(`${s.icon} ${severity}`, { color: s.color, bg: s.bg, bold: true, align: AlignmentType.CENTER });
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

// ============================================================
// SECCIONES DEL DOCUMENTO
// ============================================================

function buildCoverPage() {
  return [
    emptyLine(), emptyLine(), emptyLine(), emptyLine(),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', size: 28, color: COLORS.primary, font: 'Calibri' })] }),
    emptyLine(),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: 'DIAGNÓSTICO DE SEGURIDAD', size: 52, bold: true, color: COLORS.primary, font: 'Calibri' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: 'Y CALIDAD DE SOFTWARE', size: 52, bold: true, color: COLORS.primary, font: 'Calibri' })] }),
    emptyLine(),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', size: 28, color: COLORS.primary, font: 'Calibri' })] }),
    emptyLine(), emptyLine(),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: 'DAGMA 360 Capture', size: 40, bold: true, color: COLORS.accent, font: 'Calibri' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'Aplicación de Gestión Ambiental', size: 26, color: COLORS.gray, font: 'Calibri', italics: true })] }),
    emptyLine(), emptyLine(),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'Repositorio: Juanpgm/dagma-360-capture', size: 22, color: COLORS.gray, font: 'Calibri' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'Rama: master', size: 22, color: COLORS.gray, font: 'Calibri' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: `Fecha de Auditoría: 17 de Abril de 2026`, size: 22, color: COLORS.gray, font: 'Calibri' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'Generado automáticamente por análisis estático de código', size: 20, color: COLORS.gray, font: 'Calibri', italics: true })] }),
    emptyLine(), emptyLine(), emptyLine(),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [
      new TextRun({ text: 'Evaluación Global de Riesgo: ', size: 28, color: COLORS.black, font: 'Calibri', bold: true }),
      new TextRun({ text: '● CRÍTICO', size: 32, color: COLORS.critical, font: 'Calibri', bold: true }),
    ] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Credenciales de producción expuestas en repositorio público — acción inmediata requerida', size: 22, color: COLORS.critical, font: 'Calibri', italics: true })] }),
    pageBreak(),
  ];
}

function buildTableOfContents() {
  const items = [
    '1. Resumen Ejecutivo',
    '2. Alcance de la Auditoría',
    '3. Vulnerabilidades Críticas',
    '4. Vulnerabilidades de Severidad Alta',
    '5. Vulnerabilidades de Severidad Media',
    '6. Problemas de Calidad de Código',
    '7. Vulnerabilidades XSS Específicas',
    '8. Problemas de Accesibilidad (WCAG)',
    '9. Validación de Formularios',
    '10. Dependencias y Paquetes',
    '11. Testing y Cobertura',
    '12. Plan de Acción Priorizado',
    '13. Aspectos Positivos',
    '14. Conclusiones',
  ];
  return [
    heading('TABLA DE CONTENIDOS'),
    emptyLine(),
    ...items.map(item => richPara([{ text: item, color: COLORS.primary }], { after: 80 })),
    pageBreak(),
  ];
}

function buildExecutiveSummary() {
  return [
    heading('1. RESUMEN EJECUTIVO'),
    emptyLine(),
    para('Se realizó una auditoría exhaustiva de seguridad y calidad de código de la aplicación DAGMA 360 Capture, una aplicación web de gestión ambiental construida con Svelte + TypeScript en el frontend y Firebase como backend. El análisis abarcó autenticación, gestión de secretos, seguridad de APIs, componentes frontend, configuración de despliegue, accesibilidad y calidad de código.'),
    emptyLine(),
    subsubheading('Resumen de Hallazgos'),
    emptyLine(),
    simpleTable(
      ['Severidad', 'Cantidad', 'Estado', 'Descripción'],
      [
        [severityBadge('CRÍTICA'), '5', 'Acción inmediata', 'Credenciales expuestas, tokens inseguros, SSL deshabilitado'],
        [severityBadge('ALTA'), '5', 'Esta semana', 'URLs hardcodeadas, refresh token roto, logs sensibles'],
        [severityBadge('MEDIA'), '5', 'Este mes', 'Sin CSP, sin rate limiting, sin CSRF, geolocalización'],
        [severityBadge('BAJA'), '5', 'Planificar', 'Tipado débil, sin error boundaries, sin monitoreo'],
      ],
      [20, 12, 20, 48]
    ),
    emptyLine(),
    subsubheading('Tecnologías Analizadas'),
    simpleTable(
      ['Componente', 'Tecnología', 'Versión'],
      [
        ['Frontend', 'Svelte + TypeScript', '4.2.8 / 5.3.3'],
        ['Backend', 'Firebase (Auth, Firestore)', '12.6.0'],
        ['Build Tool', 'Vite', '5.x'],
        ['Despliegue', 'Vercel', '-'],
        ['API Backend', 'Railway (Node.js)', '-'],
      ],
      [30, 40, 30]
    ),
    pageBreak(),
  ];
}

function buildScope() {
  return [
    heading('2. ALCANCE DE LA AUDITORÍA'),
    emptyLine(),
    para('La auditoría cubrió los siguientes aspectos de la aplicación:'),
    emptyLine(),
    bullet('Autenticación y autorización (Firebase Auth, gestión de tokens)'),
    bullet('Gestión de secretos y credenciales (variables de entorno, service accounts)'),
    bullet('Seguridad de las APIs (validación de inputs, CORS, CSRF)'),
    bullet('Componentes frontend (XSS, inyección HTML, manejo de datos)'),
    bullet('Configuración de despliegue (Vercel, headers de seguridad)'),
    bullet('Accesibilidad web (WCAG 2.1)'),
    bullet('Calidad de código (TypeScript, manejo de errores, logging)'),
    bullet('Dependencias y paquetes (versiones, vulnerabilidades conocidas)'),
    bullet('Testing y cobertura de pruebas'),
    bullet('Geolocalización y privacidad de datos'),
    emptyLine(),
    subsubheading('Archivos Analizados'),
    para('Se analizaron un total de 50+ archivos incluyendo componentes Svelte, módulos TypeScript, archivos de configuración, scripts de despliegue y documentación.'),
    emptyLine(),
    subsubheading('Metodología'),
    bullet('Análisis estático de código fuente'),
    bullet('Revisión manual de configuraciones de seguridad'),
    bullet('Verificación de mejores prácticas OWASP Top 10'),
    bullet('Evaluación de conformidad WCAG 2.1'),
    bullet('Auditoría de dependencias con npm audit'),
    pageBreak(),
  ];
}

function buildVulnerabilitySection(title, vulns, severityKey) {
  const colorMap = {
    'CRÍTICA': { color: COLORS.critical, bg: COLORS.criticalBg },
    'ALTA': { color: COLORS.high, bg: COLORS.highBg },
    'MEDIA': { color: COLORS.medium, bg: COLORS.mediumBg },
    'BAJA': { color: COLORS.low, bg: COLORS.lowBg },
  };
  const s = colorMap[severityKey];
  const sections = [heading(title), emptyLine()];

  vulns.forEach((v, idx) => {
    sections.push(
      richPara([
        { text: `${idx + 1}. `, bold: true, color: s.color, size: 24 },
        { text: v.title, bold: true, color: s.color, size: 24 },
      ], { before: 200 }),
    );
    sections.push(emptyLine());

    // Tabla de metadatos
    sections.push(simpleTable(
      ['Campo', 'Detalle'],
      [
        ['Severidad', `● ${severityKey}`],
        ['Archivo(s)', v.files],
        ['Impacto', v.impact],
      ],
      [25, 75]
    ));
    sections.push(emptyLine());

    // Descripción
    sections.push(richPara([{ text: 'Descripción: ', bold: true }, { text: v.description }]));

    // Código si existe
    if (v.code) {
      sections.push(richPara([{ text: 'Código afectado:', bold: true }]));
      v.code.forEach(line => sections.push(codeBlock(line)));
    }
    sections.push(emptyLine());

    // Recomendación
    sections.push(richPara([{ text: 'Recomendación:', bold: true, color: COLORS.positive }]));
    v.recommendations.forEach(r => sections.push(bullet(r)));
    sections.push(emptyLine());
  });

  sections.push(pageBreak());
  return sections;
}

function buildCriticalVulnerabilities() {
  return buildVulnerabilitySection('3. VULNERABILIDADES CRÍTICAS', [
    {
      title: 'Llave Privada de Firebase Service Account Expuesta',
      files: 'env/dagma-85aad-b7afe1c0f77f.json',
      impact: 'Un atacante puede suplantar la service account de Firebase, obteniendo acceso completo a Firestore, Authentication y todos los servicios de Firebase. Compromiso total del proyecto Google Cloud.',
      description: 'El archivo de credenciales de la service account de Firebase se encuentra almacenado en texto plano dentro del repositorio. Contiene la llave privada RSA completa (private_key) y el ID de la llave privada (private_key_id), lo que permite acceso administrativo completo al proyecto Firebase.',
      code: [
        '// env/dagma-85aad-b7afe1c0f77f.json',
        '"private_key_id": "b7afe1c0f77f..."',
        '"private_key": "-----BEGIN RSA PRIVATE KEY-----\\nMIIEv..."',
      ],
      recommendations: [
        'URGENTE: Revocar inmediatamente esta service account desde Firebase Console',
        'Generar una nueva service account con permisos mínimos necesarios',
        'Eliminar el archivo env/ del repositorio y del historial de git (usar git filter-repo o BFG Repo Cleaner)',
        'Agregar env/ al .gitignore',
        'Usar variables de entorno del proveedor de hosting (Vercel) para secretos',
      ],
    },
    {
      title: 'Credenciales Firebase Completas en .env.local Versionado',
      files: 'frontend/.env.local (líneas 19-23)',
      impact: 'Mismas consecuencias que la vulnerabilidad anterior. Doble exposición de credenciales críticas incluyendo la service account JSON completa con llave privada.',
      description: 'El archivo .env.local contiene el JSON completo de la service account de Firebase incluyendo la llave privada. Este archivo está incluido en el control de versiones (git), lo que expone las credenciales a cualquier persona con acceso al repositorio.',
      code: [
        '// frontend/.env.local',
        'VITE_FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...,"private_key":"-----BEGIN RSA PRIVATE KEY-----..."}',
      ],
      recommendations: [
        'Eliminar .env.local del repositorio y del historial de git',
        'Agregar .env.local al .gitignore (verificar que esté y que se respete)',
        'Rotar TODAS las credenciales de Firebase inmediatamente',
        'Configurar variables de entorno en Vercel Dashboard en vez de archivos locales',
      ],
    },
    {
      title: 'API Key de Firebase Expuesta en Código y Documentación',
      files: 'frontend/.env.local (línea 7), AUTENTICACION_API.md (línea 35)',
      impact: 'Permite a atacantes hacer requests al proyecto Firebase, potencial para bypass de autenticación, enumeración de datos y ataques de consumo de cuota.',
      description: 'La API Key de Firebase está hardcodeada en archivos versionados (.env.local) y además documentada en texto plano en AUTENTICACION_API.md. Aunque las API Keys de Firebase tienen protecciones limitadas, su exposición facilita ataques dirigidos.',
      code: [
        'VITE_FIREBASE_API_KEY=AIzaSyAVVewMgunLWBiZz5XU-GjrzbO3ZKcyvD0',
      ],
      recommendations: [
        'Revocar esta API Key desde Firebase Console y generar una nueva',
        'Configurar restricciones de dominio en la nueva API Key (solo dominios autorizados)',
        'Eliminar la API Key de AUTENTICACION_API.md',
        'Nunca documentar credenciales en archivos de documentación',
        'Usar App Check de Firebase para proteger contra uso no autorizado',
      ],
    },
    {
      title: 'Tokens de Autenticación Almacenados en localStorage (Vulnerable a XSS)',
      files: 'frontend/src/stores/authStore.ts (líneas 25-29)',
      impact: 'Cualquier vulnerabilidad XSS permite al atacante robar tokens de sesión. Los tokens persisten entre sesiones del navegador y no tienen protección contra acceso desde JavaScript.',
      description: 'Los tokens de autenticación y datos del usuario se almacenan tanto en localStorage como en sessionStorage usando llamadas directas sin encriptación. localStorage es accesible desde cualquier script JavaScript ejecutándose en la misma origen, lo que lo convierte en un vector de ataque si existe cualquier vulnerabilidad XSS.',
      code: [
        "localStorage.setItem('token', token);",
        "sessionStorage.setItem('authToken', token);",
        "localStorage.setItem('user', JSON.stringify(user));",
      ],
      recommendations: [
        'Migrar a cookies HttpOnly + Secure + SameSite=Strict para tokens',
        'Si no es posible usar cookies, implementar almacenamiento en memoria (se pierde al refrescar pero es más seguro)',
        'Implementar Content Security Policy (CSP) estricto para prevenir XSS',
        'Sanitizar todos los inputs de usuario para prevenir XSS',
        'Nunca almacenar el perfil completo del usuario — solo el ID, obtener datos desde el backend',
      ],
    },
    {
      title: 'Verificación SSL Deshabilitada en Proxy de Vite',
      files: 'frontend/vite.config.ts (línea 65)',
      impact: 'Vulnerable a ataques Man-in-the-Middle (MITM). La verificación SSL/TLS se omite, permitiendo intercepción y espionaje del tráfico de red.',
      description: 'La configuración del proxy de desarrollo en vite.config.ts tiene la opción secure: false, lo que deshabilita la verificación de certificados SSL al hacer proxy de requests hacia el backend en Railway. Aunque esto es común en desarrollo, la misma configuración puede propagarse a producción.',
      code: [
        "proxy: {",
        "  '/api': {",
        "    target: 'https://web-production-2d737.up.railway.app',",
        "    changeOrigin: true,",
        "    secure: false  // ⚠️ DESHABILITA VERIFICACIÓN SSL",
        "  }",
        "}",
      ],
      recommendations: [
        'Eliminar secure: false (el valor por defecto es true)',
        'Si el certificado del backend es inválido, corregir el certificado en vez de deshabilitar la verificación',
        'Usar configuraciones diferentes para desarrollo y producción',
      ],
    },
  ], 'CRÍTICA');
}

function buildHighVulnerabilities() {
  return buildVulnerabilitySection('4. VULNERABILIDADES DE SEVERIDAD ALTA', [
    {
      title: 'URLs de API Hardcodeadas en Múltiples Archivos',
      files: 'frontend/src/api/auth.ts, actividades.ts, capturas.ts, api-client.ts, vite.config.ts',
      impact: 'Difícil cambiar para diferentes entornos. El endpoint de la API queda expuesto en el código compilado. Sin flexibilidad para staging/producción.',
      description: 'La URL del backend en Railway (https://web-production-2d737.up.railway.app) está hardcodeada como fallback en al menos 5 archivos diferentes. Esto expone la infraestructura del backend y dificulta el mantenimiento.',
      code: [
        "// auth.ts, actividades.ts, capturas.ts",
        "const API_URL = import.meta.env.VITE_API_URL || 'https://web-production-2d737.up.railway.app';",
      ],
      recommendations: [
        'Usar siempre variables de entorno sin fallbacks hardcodeados',
        'Implementar validación que falle si la variable de entorno no existe',
        'Centralizar la configuración de URLs en un solo archivo de configuración',
        'Nunca hardcodear URLs de producción en código fuente',
      ],
    },
    {
      title: 'Mecanismo de Refresh Token Inexistente',
      files: 'frontend/src/lib/api-client.ts (líneas 40-46)',
      impact: 'El token expira y los usuarios son deslogueados sin aviso. No hay renovación automática de tokens. Experiencia de usuario degradada.',
      description: 'El código en api-client.ts llama a authStore.refreshToken() cuando un request falla con 401, pero este método no existe en authStore. Esto causa un error silencioso y el usuario pierde su sesión sin posibilidad de recuperación automática.',
      code: [
        "// api-client.ts - Línea 41: Método inexistente",
        "const newToken = await authStore.refreshToken(); // ❌ No existe",
      ],
      recommendations: [
        'Implementar refreshToken() en authStore usando Firebase Auth onIdTokenChanged()',
        'Usar getIdToken(true) de Firebase para forzar refresh del token',
        'Implementar interceptor de requests que renueve tokens automáticamente',
        'Agregar manejo de sesión expirada con redirección al login',
      ],
    },
    {
      title: 'Datos de Usuario Almacenados Sin Encriptación',
      files: 'frontend/src/stores/authStore.ts (líneas 25-26)',
      impact: 'Información sensible del usuario (email, roles, permisos) es legible para cualquier script, extensión de navegador o ataque XSS.',
      description: 'El perfil completo del usuario incluyendo email, roles y permisos se almacena en texto plano en localStorage. Esta información puede ser extraída por extensiones maliciosas del navegador o mediante ataques XSS.',
      code: [
        "localStorage.setItem('user', JSON.stringify(user));",
        "// Contiene: { email, roles, permissions, uid, displayName }",
      ],
      recommendations: [
        'Almacenar solo el user ID en el cliente, obtener datos completos del backend',
        'Si se necesita almacenar datos, usar encriptación con una clave derivada',
        'Implementar expiración automática de datos almacenados',
        'Considerar usar sessionStorage en vez de localStorage para datos que no deben persistir',
      ],
    },
    {
      title: 'Sin Validación de Inputs en Llamadas API',
      files: 'frontend/src/api/actividades.ts (líneas 24-40), auth.ts, capturas.ts, visitas.ts',
      impact: 'Vulnerable a ataques de inyección. Respuestas malformadas no se manejan de forma segura. Errores de tipo en tiempo de ejecución.',
      description: 'Ninguna de las funciones de API valida los parámetros antes de enviarlos ni valida las respuestas del servidor antes de procesarlas. Se asume que los datos son correctos sin verificación.',
      code: [
        "// Sin validación de parámetros de entrada",
        "export async function getLideresGrupo(): Promise<LiderGrupoOption[]> {",
        "  const httpResponse = await fetch(LIDERES_GRUPO_URL, { method: 'GET' });",
        "  // Parseo sin validación de esquema",
        "  const rows = Array.isArray(response) ? response : response?.data || [];",
        "}",
      ],
      recommendations: [
        'Implementar validación de inputs con Zod o Yup antes de cada llamada API',
        'Validar respuestas del servidor contra esquemas definidos',
        'Implementar manejo robusto de errores para respuestas inesperadas',
        'Definir interfaces TypeScript estrictas y validar en runtime',
      ],
    },
    {
      title: 'Código de Debug Expone Información Sensible',
      files: 'frontend/src/api/auth.ts (líneas 78-80), authStore.ts (línea 32)',
      impact: 'Emails, tokens parciales, roles y permisos son visibles en la consola del navegador. Información visible para cualquier script que capture console.log.',
      description: 'Múltiples archivos contienen sentencias console.log que imprimen información sensible del usuario incluyendo emails, substrings de tokens, roles y permisos. Estos logs son visibles en las herramientas de desarrollo del navegador.',
      code: [
        "console.log('✅ ID token obtained:', idToken.substring(0, 20) + '...');",
        "console.log('💾 Session saved:', { email: user.email, roles: user.roles, permissions: user.permissions });",
      ],
      recommendations: [
        'Eliminar todos los console.log con información sensible',
        'Usar logging condicional: if (import.meta.env.DEV) { console.log(...) }',
        'Implementar un servicio de logging que filtre datos sensibles',
        'Configurar un linter rule para prevenir console.log en producción',
        'Nunca loguear tokens, emails ni contraseñas',
      ],
    },
  ], 'ALTA');
}

function buildMediumVulnerabilities() {
  return buildVulnerabilitySection('5. VULNERABILIDADES DE SEVERIDAD MEDIA', [
    {
      title: 'Sin Content Security Policy (CSP) Headers',
      files: 'frontend/vercel.json',
      impact: 'Sin protección contra XSS, clickjacking, ni inyección de scripts. HSTS, X-Frame-Options y X-Content-Type-Options ausentes.',
      description: 'La configuración de Vercel no incluye headers de seguridad HTTP. Sin CSP, el navegador no tiene instrucciones sobre qué fuentes de contenido son permitidas, dejando la aplicación vulnerable a múltiples tipos de ataques.',
      code: [
        '// vercel.json - Sin headers de seguridad configurados',
      ],
      recommendations: [
        'Agregar Content-Security-Policy header restrictivo',
        'Agregar X-Frame-Options: DENY para prevenir clickjacking',
        'Agregar X-Content-Type-Options: nosniff',
        'Agregar Referrer-Policy: strict-origin-when-cross-origin',
        'Agregar Strict-Transport-Security (HSTS) header',
        'Configurar Permissions-Policy para restringir APIs del navegador',
      ],
    },
    {
      title: 'Sin Rate Limiting en Autenticación',
      files: 'frontend/src/api/auth.ts (líneas 73-82)',
      impact: 'Posibilidad de ataques de fuerza bruta contra el login. Denegación de servicio por exceso de intentos.',
      description: 'No existe limitación de intentos de login ni del lado del cliente ni se verifica del lado del servidor. Un atacante puede realizar intentos ilimitados de autenticación.',
      recommendations: [
        'Implementar backoff exponencial en intentos fallidos de login',
        'Almacenar conteo de intentos fallidos en memoria',
        'Implementar rate limiting del lado del servidor (Firebase cuenta con algunas protecciones pero no son suficientes)',
        'Mostrar CAPTCHA después de N intentos fallidos',
        'Bloquear temporalmente cuentas después de demasiados intentos fallidos',
      ],
    },
    {
      title: 'Sin Protección CSRF en Requests',
      files: 'frontend/src/lib/api-client.ts',
      impact: 'Un sitio malicioso podría ejecutar acciones en nombre del usuario autenticado sin su consentimiento.',
      description: 'Las peticiones POST/PUT/DELETE no incluyen tokens CSRF. Si un usuario autenticado visita un sitio malicioso, ese sitio podría enviar requests al backend de DAGMA aprovechando las cookies de sesión.',
      recommendations: [
        'Implementar tokens CSRF en headers de autenticación',
        'Usar el patrón double-submit cookie',
        'Configurar SameSite=Strict en cookies de sesión',
        'Validar el header Origin en el servidor para cada request mutante',
      ],
    },
    {
      title: 'Geolocalización Sin Consentimiento Explícito de Privacidad',
      files: 'frontend/src/lib/geolocation.ts (líneas 20-51)',
      impact: 'Posibles problemas de cumplimiento con regulaciones de privacidad (GDPR, Ley de Protección de Datos). Rastreo de ubicación sin aviso claro al usuario.',
      description: 'La aplicación solicita permisos de geolocalización del navegador pero no presenta un aviso explícito de privacidad antes de recopilar datos de ubicación GPS. No hay política de retención de datos visible ni opción para deshabilitar el tracking.',
      recommendations: [
        'Agregar aviso de privacidad claro antes de solicitar geolocalización',
        'Implementar consentimiento explícito del usuario para tracking de ubicación',
        'Definir y mostrar política de retención de datos de ubicación',
        'Agregar opción para deshabilitar servicios de ubicación dentro de la app',
        'Implementar anonimización de coordenadas cuando sea posible',
      ],
    },
    {
      title: 'Validación de Variables de Entorno No Detiene la App',
      files: 'frontend/src/lib/firebase.ts (líneas 15-22)',
      impact: 'La aplicación continúa ejecutándose con configuración inválida de Firebase, causando errores confusos en runtime.',
      description: 'El código detecta variables de entorno faltantes para Firebase y las registra con console.error, pero NO detiene la inicialización de la app. Esto permite que la aplicación arranque en un estado inválido.',
      code: [
        "if (missingConfig.length > 0) {",
        "  console.error('❌ Firebase configuration is missing:', missingConfig);",
        "  // ⚠️ La app continúa ejecutándose con config inválida",
        "}",
      ],
      recommendations: [
        'Lanzar un error que detenga la inicialización si la configuración es inválida',
        'Implementar fail-fast: throw new Error() si faltan variables críticas',
        'Mostrar una pantalla de error amigable al usuario si la configuración falla',
        'Validar TODAS las variables de entorno al inicio de la app',
      ],
    },
  ], 'MEDIA');
}

function buildCodeQualityIssues() {
  return buildVulnerabilitySection('6. PROBLEMAS DE CALIDAD DE CÓDIGO', [
    {
      title: 'Uso Extensivo del Tipo "any" en TypeScript',
      files: 'frontend/src/api/auth.ts (línea 126-135), múltiples archivos API',
      impact: 'Pérdida de los beneficios de TypeScript. Errores de tipo no detectados en compilación. Menor mantenibilidad del código.',
      description: 'El proyecto usa TypeScript pero utiliza el tipo "any" extensivamente, especialmente en las funciones de API y en el manejo de respuestas del servidor. Esto anula los beneficios principales del tipado estático.',
      code: [
        "user: any;  // Debería ser interface User tipada",
        "const response: any = await httpResponse.json();",
      ],
      recommendations: [
        'Definir interfaces TypeScript estrictas para todos los modelos de datos',
        'Reemplazar "any" con tipos específicos o genéricos',
        'Habilitar la regla ESLint no-explicit-any',
        'Usar narrowing de tipos y type guards en vez de casteos a any',
      ],
    },
    {
      title: 'Sin Error Boundaries en Componentes Svelte',
      files: 'frontend/src/App.svelte (líneas 20-40)',
      impact: 'Un error en un componente individual causa el crash de toda la aplicación. Sin recuperación graceful de errores.',
      description: 'No existen mecanismos de error boundary en la aplicación. Si cualquier componente falla (por ejemplo, al renderizar un mapa o un formulario), toda la aplicación se rompe mostrando una pantalla en blanco.',
      recommendations: [
        'Implementar un componente ErrorBoundary que capture errores de renderizado',
        'Mostrar UI de fallback cuando un componente falla',
        'Registrar errores en un servicio de monitoreo (Sentry, LogRocket)',
        'Separar secciones críticas de la UI con boundaries independientes',
      ],
    },
    {
      title: 'Logging Inconsistente y Sin Monitoreo de Producción',
      files: 'Múltiples archivos en frontend/src/',
      impact: 'Difícil diagnosticar problemas en producción. Errores silenciosos. No hay alertas automáticas ante fallas.',
      description: 'El proyecto usa console.log/console.error de forma inconsistente a lo largo del código. No hay ningún servicio de monitoreo o error tracking configurado para producción.',
      recommendations: [
        'Implementar servicio de error tracking (Sentry, LogRocket, o Bugsnag)',
        'Crear una abstracción de logging que diferencie dev vs producción',
        'Establecer patrones consistentes para el manejo de errores',
        'Configurar alertas automáticas para errores críticos en producción',
      ],
    },
    {
      title: 'Sin Escaneo de Seguridad de Dependencias',
      files: 'frontend/package.json, package.json (raíz)',
      impact: 'Dependencias vulnerables no detectadas. Posibles ataques de supply chain. npm audit reporta 20 vulnerabilidades existentes.',
      description: 'No hay escaneo automatizado de dependencias configurado. Al ejecutar npm audit se encontraron 20 vulnerabilidades (11 moderadas, 8 altas, 1 crítica) sin resolver.',
      recommendations: [
        'Ejecutar npm audit regularmente y resolver vulnerabilidades',
        'Configurar GitHub Dependabot para actualizaciones automáticas',
        'Agregar npm audit como paso en el CI/CD pipeline',
        'Agregar pre-commit hook para verificar vulnerabilidades antes de commitear',
      ],
    },
    {
      title: 'Configuración de TypeScript Debilitada',
      files: 'frontend/tsconfig.json',
      impact: 'Se ocultan errores potenciales en dependencias. Menor seguridad de tipos en el proyecto.',
      description: 'La configuración de TypeScript tiene skipLibCheck: true habilitado, lo que omite la verificación de tipos en dependencias y puede ocultar incompatibilidades. Combinado con allowJs: true, reduce la seguridad de tipos efectiva.',
      code: [
        '"skipLibCheck": true,  // Oculta errores en dependencias',
        '"allowJs": true,       // Permite archivos JS sin tipado estricto',
      ],
      recommendations: [
        'Evaluar establecer skipLibCheck: false y resolver conflictos de tipos',
        'Migrar archivos .js restantes a .ts con tipado estricto',
        'Habilitar todas las opciones strict de TypeScript',
      ],
    },
  ], 'BAJA');
}

function buildXSSSection() {
  return [
    heading('7. VULNERABILIDADES XSS ESPECÍFICAS'),
    emptyLine(),
    para('Se encontraron múltiples puntos donde la aplicación es susceptible a ataques Cross-Site Scripting (XSS) debido al uso de renderizado HTML sin sanitización.'),
    emptyLine(),
    subsubheading('7.1 Renderizado HTML No Sanitizado en KPICard'),
    richPara([{ text: 'Archivo: ', bold: true }, { text: 'frontend/src/components/dashboard/KPICard.svelte (línea 13)' }]),
    codeBlock('{@html icon}  // Renderiza HTML arbitrario sin sanitización'),
    para('Si la propiedad "icon" proviene de una fuente externa o es manipulable, un atacante podría inyectar scripts maliciosos.'),
    emptyLine(),
    subsubheading('7.2 Múltiples innerHTML en Convocatorias'),
    richPara([{ text: 'Archivo: ', bold: true }, { text: 'frontend/src/components/convocatorias/Convocatorias.svelte (líneas 1043, 1050, 1056, 1085)' }]),
    codeBlock("container.innerHTML = `<svg ...>`;  // Múltiples asignaciones sin sanitización"),
    para('Se realizan asignaciones directas de innerHTML en bucles con contenido SVG generado dinámicamente. Si algún dato proviene de fuentes externas, constituye un vector de XSS.'),
    emptyLine(),
    subsubheading('Recomendaciones para XSS'),
    bullet('Instalar y usar DOMPurify para sanitizar todo HTML dinámico'),
    bullet('Reemplazar {@html} con componentes Svelte seguros cuando sea posible'),
    bullet('Crear componentes de iconos SVG tipados en vez de renderizar HTML arbitrario'),
    bullet('Implementar Content Security Policy para mitigar impacto de XSS'),
    bullet("Usar textContent en vez de innerHTML cuando no se necesita renderizar HTML"),
    pageBreak(),
  ];
}

function buildAccessibilitySection() {
  return [
    heading('8. PROBLEMAS DE ACCESIBILIDAD (WCAG)'),
    emptyLine(),
    para('Se identificaron múltiples violaciones de las pautas de accesibilidad web WCAG 2.1 que afectan a usuarios con discapacidades.'),
    emptyLine(),
    simpleTable(
      ['Componente', 'Problema', 'Criterio WCAG', 'Severidad'],
      [
        ['Modal.svelte', 'Sin manejo de eventos de teclado (Escape, Tab)', '2.1.1 Keyboard', 'Alta'],
        ['MultiSelect.svelte', 'Labels no-interactivos con on:click', '4.1.2 Name, Role, Value', 'Alta'],
        ['ReportesParques.svelte', 'Divs usados como botones sin role="button"', '4.1.2 Name, Role, Value', 'Alta'],
        ['Múltiples componentes', 'Falta de aria-labels en elementos interactivos', '1.1.1 Non-text Content', 'Media'],
        ['Formularios', 'Campos sin asociación label-input', '1.3.1 Info and Relationships', 'Media'],
        ['Navegación', 'Sin skip-links para contenido principal', '2.4.1 Bypass Blocks', 'Media'],
        ['Mapas', 'Sin alternativa de texto para contenido de mapas', '1.1.1 Non-text Content', 'Media'],
        ['Colores', 'Contraste de colores no verificado', '1.4.3 Contrast (Minimum)', 'Media'],
      ],
      [25, 35, 25, 15]
    ),
    emptyLine(),
    subsubheading('Recomendaciones de Accesibilidad'),
    bullet('Usar elementos HTML semánticos: <button>, <a>, <nav>, <main>'),
    bullet('Agregar manejo de teclado (Escape, Enter, Tab) en componentes interactivos'),
    bullet('Implementar ARIA roles y labels en elementos personalizados'),
    bullet('Agregar focus management en modales y diálogos'),
    bullet('Verificar contraste de colores con herramientas como Lighthouse'),
    bullet('Agregar skip-links para navegación por teclado'),
    bullet('Proporcionar alternativas de texto para mapas y gráficos'),
    pageBreak(),
  ];
}

function buildFormValidationSection() {
  return [
    heading('9. VALIDACIÓN DE FORMULARIOS'),
    emptyLine(),
    para('Los formularios de la aplicación carecen de validación robusta tanto del lado del cliente como en la preparación de datos para el servidor.'),
    emptyLine(),
    subsubheading('9.1 Step2Formulario — Formulario de Captura de Datos Botánicos'),
    richPara([{ text: 'Archivo: ', bold: true }, { text: 'frontend/src/components/visitas/Step2Formulario.svelte' }]),
    bullet('Campo unidadMedida sin validación de selección'),
    bullet('Inputs numéricos aceptan NaN sin validación'),
    bullet('Filas de datos de plantas sin validación de campos obligatorios'),
    bullet('Sin feedback visual de errores de validación'),
    emptyLine(),
    subsubheading('9.2 Coordenadas Sin Validación de Rangos'),
    richPara([{ text: 'Archivo: ', bold: true }, { text: 'frontend/src/components/convocatorias/Convocatorias.svelte (líneas 1340-1342)' }]),
    codeBlock("latitudPuntoEncuentroNumero = parseCoordinate(latitudPuntoEncuentroForm);"),
    bullet('parseCoordinate() convierte valores pero no valida rangos válidos'),
    bullet('Latitud debe estar entre -90 y 90 grados'),
    bullet('Longitud debe estar entre -180 y 180 grados'),
    bullet('No se verifica que las coordenadas estén dentro de Colombia/Valle del Cauca'),
    emptyLine(),
    subsubheading('Recomendaciones para Validación'),
    bullet('Implementar librería de validación (Zod, Yup, o Vest) para todos los formularios'),
    bullet('Validar en tiempo real mientras el usuario escribe'),
    bullet('Mostrar mensajes de error claros y específicos por campo'),
    bullet('Implementar validación de coordenadas con rangos geográficos válidos'),
    bullet('Deshabilitar botón de envío hasta que todos los campos sean válidos'),
    bullet('Agregar validación del lado del servidor como segunda capa de defensa'),
    pageBreak(),
  ];
}

function buildDependenciesSection() {
  return [
    heading('10. DEPENDENCIAS Y PAQUETES'),
    emptyLine(),
    para('El análisis de dependencias reveló versiones desactualizadas y vulnerabilidades conocidas que requieren atención.'),
    emptyLine(),
    subsubheading('Estado de Dependencias Principales'),
    simpleTable(
      ['Paquete', 'Versión Actual', 'Estado', 'Riesgo'],
      [
        ['svelte', '^4.2.8', 'Svelte 5 disponible', 'Bajo'],
        ['typescript', '^5.3.3', '3+ releases detrás', 'Bajo'],
        ['firebase', '^12.6.0', 'Verificar CVEs', 'Medio'],
        ['vite', '5.x', 'Verificar actualizaciones', 'Bajo'],
        ['leaflet', '^1.9.x', 'Verificar actualizaciones', 'Bajo'],
      ],
      [25, 20, 30, 25]
    ),
    emptyLine(),
    subsubheading('Resultado de npm audit'),
    simpleTable(
      ['Severidad', 'Cantidad'],
      [
        ['Crítica', '1'],
        ['Alta', '8'],
        ['Moderada', '11'],
        ['Total', '20'],
      ],
      [50, 50]
    ),
    emptyLine(),
    subsubheading('Recomendaciones'),
    bullet('Ejecutar npm audit fix para resolver vulnerabilidades automáticamente'),
    bullet('Ejecutar npm audit fix --force para resolver vulnerabilidades con breaking changes (en rama separada)'),
    bullet('Configurar GitHub Dependabot para detección automática'),
    bullet('Mantener un calendario de actualización mensual de dependencias'),
    bullet('Evaluar migración a Svelte 5 cuando sea estable para el proyecto'),
    pageBreak(),
  ];
}

function buildTestingSection() {
  return [
    heading('11. TESTING Y COBERTURA'),
    emptyLine(),
    richPara([
      { text: 'Estado actual: ', bold: true },
      { text: 'NO SE ENCONTRARON TESTS EN EL PROYECTO', bold: true, color: COLORS.critical },
    ]),
    emptyLine(),
    para('La aplicación no cuenta con ningún tipo de prueba automatizada. No se encontraron archivos de test (.test.ts, .spec.ts, .test.svelte) ni configuración de frameworks de testing en el proyecto.'),
    emptyLine(),
    subsubheading('Impacto de la Ausencia de Tests'),
    bullet('No hay garantía de que los cambios de código no rompan funcionalidad existente'),
    bullet('Refactorizaciones son de alto riesgo sin red de seguridad'),
    bullet('Bugs de regresión no se detectan hasta producción'),
    bullet('Validación de lógica de negocio depende enteramente de pruebas manuales'),
    bullet('Imposible implementar CI/CD con confianza'),
    emptyLine(),
    subsubheading('Plan de Testing Recomendado'),
    emptyLine(),
    simpleTable(
      ['Tipo de Test', 'Framework', 'Prioridad', 'Cobertura Objetivo'],
      [
        ['Unit Tests', 'Vitest', 'Alta', 'Funciones de API, stores, utilidades'],
        ['Component Tests', 'Svelte Testing Library', 'Alta', 'Componentes con lógica compleja'],
        ['Integration Tests', 'Vitest + MSW', 'Media', 'Flujos de autenticación, CRUD'],
        ['E2E Tests', 'Playwright', 'Media', 'Flujos críticos de usuario'],
        ['Visual Tests', 'Storybook + Chromatic', 'Baja', 'Componentes UI'],
      ],
      [20, 25, 15, 40]
    ),
    emptyLine(),
    subsubheading('Archivos Prioritarios para Testing'),
    bullet('frontend/src/stores/authStore.ts — Lógica de autenticación'),
    bullet('frontend/src/lib/api-client.ts — Cliente HTTP y manejo de errores'),
    bullet('frontend/src/api/*.ts — Funciones de API'),
    bullet('frontend/src/lib/geolocation.ts — Lógica de geolocalización'),
    bullet('frontend/src/components/visitas/ — Formularios de captura de datos'),
    pageBreak(),
  ];
}

function buildActionPlan() {
  return [
    heading('12. PLAN DE ACCIÓN PRIORIZADO'),
    emptyLine(),
    subsubheading('🚨 INMEDIATO — Dentro de las próximas 24 horas'),
    emptyLine(),
    simpleTable(
      ['#', 'Acción', 'Archivos Afectados', 'Esfuerzo'],
      [
        ['1', 'Revocar service account de Firebase y generar nueva', 'Firebase Console', '30 min'],
        ['2', 'Revocar API Key de Firebase y generar nueva restringida', 'Firebase Console', '30 min'],
        ['3', 'Eliminar env/ y .env.local del historial de git', 'git filter-repo', '1 hora'],
        ['4', 'Verificar .gitignore incluya .env*, env/', '.gitignore', '10 min'],
        ['5', 'Configurar variables de entorno en Vercel Dashboard', 'Vercel Dashboard', '30 min'],
        ['6', 'Notificar al equipo sobre la exposición de credenciales', '-', '15 min'],
      ],
      [5, 45, 30, 20]
    ),
    emptyLine(),
    subsubheading('⚠️ ESTA SEMANA — Dentro de los próximos 7 días'),
    emptyLine(),
    simpleTable(
      ['#', 'Acción', 'Archivos Afectados', 'Esfuerzo'],
      [
        ['7', 'Migrar tokens a cookies HttpOnly + Secure', 'authStore.ts, api-client.ts', '4 horas'],
        ['8', 'Agregar Content Security Policy headers', 'vercel.json', '2 horas'],
        ['9', 'Eliminar console.log sensibles del código', 'auth.ts, authStore.ts', '1 hora'],
        ['10', 'Implementar validación de inputs en APIs', 'api/*.ts', '4 horas'],
        ['11', 'Implementar refresh token', 'authStore.ts, api-client.ts', '3 horas'],
        ['12', 'Remover secure: false del proxy Vite', 'vite.config.ts', '10 min'],
        ['13', 'Centralizar URLs de API en config única', 'api/*.ts, api-client.ts', '2 horas'],
      ],
      [5, 45, 30, 20]
    ),
    emptyLine(),
    subsubheading('📅 ESTE MES — Dentro de los próximos 30 días'),
    emptyLine(),
    simpleTable(
      ['#', 'Acción', 'Archivos Afectados', 'Esfuerzo'],
      [
        ['14', 'Implementar rate limiting en login', 'auth.ts', '3 horas'],
        ['15', 'Agregar sanitización HTML (DOMPurify)', 'KPICard, Convocatorias', '3 horas'],
        ['16', 'Corregir problemas de accesibilidad', 'Modal, MultiSelect, etc.', '8 horas'],
        ['17', 'Implementar validación de formularios (Zod)', 'Componentes visitas/', '6 horas'],
        ['18', 'Configurar Sentry para monitoreo de errores', 'main.ts, api-client.ts', '3 horas'],
        ['19', 'Setup de testing con Vitest', 'vitest.config.ts, tests/', '8 horas'],
        ['20', 'Ejecutar npm audit fix y actualizar deps', 'package.json', '2 horas'],
        ['21', 'Implementar consentimiento de geolocalización', 'geolocation.ts', '2 horas'],
        ['22', 'Mejorar tipado TypeScript (eliminar any)', 'Múltiples archivos', '6 horas'],
        ['23', 'Agregar error boundaries en Svelte', 'App.svelte, componentes', '3 horas'],
      ],
      [5, 45, 30, 20]
    ),
    pageBreak(),
  ];
}

function buildPositiveAspects() {
  return [
    heading('13. ASPECTOS POSITIVOS'),
    emptyLine(),
    para('A pesar de las vulnerabilidades identificadas, la aplicación cuenta con varios aspectos bien implementados:'),
    emptyLine(),
    simpleTable(
      ['Aspecto', 'Descripción', 'Valoración'],
      [
        ['Firebase Auth', 'Autenticación implementada correctamente usando Firebase Authentication', '✅ Bueno'],
        ['Rutas Protegidas', 'Las rutas de la aplicación verifican el estado de autenticación', '✅ Bueno'],
        ['Variables de Entorno', 'Se utilizan variables de entorno para configuración (aunque expuestas)', '⚠️ Parcial'],
        ['Separación de Concerns', 'Buena separación entre API, stores y componentes', '✅ Bueno'],
        ['TypeScript', 'El proyecto usa TypeScript para tipado estático', '⚠️ Parcial'],
        ['Componentes UI', 'Librería de componentes UI reutilizables bien estructurada', '✅ Bueno'],
        ['Svelte Stores', 'Uso correcto del patrón de stores reactivos de Svelte', '✅ Bueno'],
        ['Estructura de Proyecto', 'Organización clara de archivos y carpetas', '✅ Bueno'],
        ['Configuración PWA', 'Configuración de Progressive Web App razonable', '✅ Bueno'],
        ['Cartografía', 'Integración con Leaflet y datos GeoJSON para mapas', '✅ Bueno'],
      ],
      [25, 55, 20]
    ),
    pageBreak(),
  ];
}

function buildConclusions() {
  return [
    heading('14. CONCLUSIONES'),
    emptyLine(),
    para('La auditoría de seguridad y calidad de DAGMA 360 Capture reveló un total de 20 vulnerabilidades distribuidas en cuatro niveles de severidad. La evaluación global de riesgo es CRÍTICA principalmente debido a la exposición de credenciales de Firebase (service account y API key) en el repositorio de código.'),
    emptyLine(),
    richPara([
      { text: 'La acción más urgente', bold: true, color: COLORS.critical },
      { text: ' es la revocación inmediata de todas las credenciales de Firebase expuestas y la limpieza del historial de git. Este paso debe realizarse en las próximas 24 horas para minimizar el riesgo de compromiso del proyecto.' },
    ]),
    emptyLine(),
    para('La arquitectura general de la aplicación es sólida, con buena separación de concerns y uso apropiado de tecnologías modernas (Svelte, TypeScript, Firebase). Sin embargo, las prácticas de seguridad necesitan fortalecerse significativamente, especialmente en la gestión de secretos, almacenamiento de tokens y validación de datos.'),
    emptyLine(),
    para('La ausencia total de tests automatizados es una preocupación importante que limita la capacidad de evolucionar el código con confianza. Se recomienda priorizar la implementación de un framework de testing como parte del plan de acción a 30 días.'),
    emptyLine(),
    subsubheading('Próximos Pasos'),
    bullet('Ejecutar el plan de acción inmediata (24 horas) para credenciales'),
    bullet('Implementar correcciones de seguridad críticas (1 semana)'),
    bullet('Establecer pipeline de CI/CD con auditoría de seguridad automatizada'),
    bullet('Planificar y ejecutar mejoras de código y testing (1 mes)'),
    bullet('Programar auditoría de seguimiento en 3 meses'),
    emptyLine(), emptyLine(),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 }, children: [new TextRun({ text: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', size: 28, color: COLORS.primary, font: 'Calibri' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 100 }, children: [new TextRun({ text: 'Fin del Documento', size: 24, color: COLORS.gray, font: 'Calibri', italics: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Generado: 17 de Abril de 2026 | DAGMA 360 Capture Security Audit', size: 20, color: COLORS.gray, font: 'Calibri' })] }),
  ];
}

// ============================================================
// GENERAR DOCUMENTO
// ============================================================

const doc = new Document({
  creator: 'DAGMA 360 Security Audit',
  title: 'Diagnóstico de Seguridad y Calidad - DAGMA 360 Capture',
  description: 'Auditoría completa de seguridad, vulnerabilidades y puntos de mejora',
  styles: {
    default: {
      document: { run: { font: 'Calibri', size: 22, color: COLORS.black } },
      heading1: { run: { font: 'Calibri', size: 32, bold: true, color: COLORS.primary } },
      heading2: { run: { font: 'Calibri', size: 28, bold: true, color: COLORS.accent } },
      heading3: { run: { font: 'Calibri', size: 24, bold: true, color: COLORS.accent } },
    },
  },
  numbering: {
    config: [{
      reference: 'default-numbering',
      levels: [{
        level: 0,
        format: LevelFormat.BULLET,
        text: '•',
        alignment: AlignmentType.LEFT,
      }],
    }],
  },
  sections: [{
    properties: {
      page: {
        margin: { top: convertInchesToTwip(0.8), bottom: convertInchesToTwip(0.8), left: convertInchesToTwip(0.9), right: convertInchesToTwip(0.9) },
      },
    },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: 'DAGMA 360 Capture — Diagnóstico de Seguridad', size: 16, color: COLORS.gray, font: 'Calibri', italics: true })],
          }),
        ],
      }),
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: 'Confidencial — Solo para uso interno', size: 16, color: COLORS.gray, font: 'Calibri', italics: true })],
          }),
        ],
      }),
    },
    children: [
      ...buildCoverPage(),
      ...buildTableOfContents(),
      ...buildExecutiveSummary(),
      ...buildScope(),
      ...buildCriticalVulnerabilities(),
      ...buildHighVulnerabilities(),
      ...buildMediumVulnerabilities(),
      ...buildCodeQualityIssues(),
      ...buildXSSSection(),
      ...buildAccessibilitySection(),
      ...buildFormValidationSection(),
      ...buildDependenciesSection(),
      ...buildTestingSection(),
      ...buildActionPlan(),
      ...buildPositiveAspects(),
      ...buildConclusions(),
    ],
  }],
});

// Generar archivo
const buffer = await Packer.toBuffer(doc);
writeFileSync('DIAGNOSTICO_APP_DAGMA.docx', buffer);
console.log('✅ Documento generado exitosamente: DIAGNOSTICO_APP_DAGMA.docx');
console.log(`   Tamaño: ${(buffer.length / 1024).toFixed(1)} KB`);
