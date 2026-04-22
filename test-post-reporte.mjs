import https from "node:https";
import { randomBytes } from "node:crypto";

const API_HOST = "web-production-2d737.up.railway.app";
const TOKEN    = process.argv[2] || "";

// JPEG 1x1 minimo
const JPEG = Buffer.from(
  "FFD8FFE000104A46494600010100000100010000FFDB004300080606070605080707070909080A0C140D0C0B0B0C1912130F141D1A1F1E1D1A1C1C202427262022282B1C1C2837292C303134343419273D38323C2E333432FFC00B0800010001011100FFC4001F0000010501010101010100000000000000000102030405060708090A0BFFDA00080101000003F00FFBD7FFD9",
  "hex"
);

const GRUPOS = {
  cuadrilla:   { tipo: "Poda de arboles",          desc: "Prueba POST cuadrilla",   extra: { arboles_data: '[{"especie":"Ceiba","cantidad":2}]' } },
  vivero:      { tipo: "Siembra sitio definitivo", desc: "Prueba POST vivero",       extra: { tipos_plantas: '{"Guayacan":3}' } },
  gobernanza:  { tipo: "Jornada sensibilizacion",  desc: "Prueba POST gobernanza",   extra: { unidades_impactadas: "15" } },
  ecosistemas: { tipo: "Restauracion ecologica",   desc: "Prueba POST ecosistemas",  extra: { unidades_impactadas: "200", unidad_medida: "m2" } },
  umata:       { tipo: "Visita tecnica predial",   desc: "Prueba POST umata",        extra: { unidades_impactadas: "4" } },
};

function buildMultipart(boundary, fields, photoBuffer) {
  const parts = [];
  const enc = (s) => Buffer.from(s, "utf8");
  const CRLF = "\r\n";

  for (const [name, value] of Object.entries(fields)) {
    parts.push(enc(`--${boundary}${CRLF}Content-Disposition: form-data; name="${name}"${CRLF}${CRLF}${value}${CRLF}`));
  }

  // Foto 1
  parts.push(enc(`--${boundary}${CRLF}Content-Disposition: form-data; name="photos"; filename="test.jpg"${CRLF}Content-Type: image/jpeg${CRLF}${CRLF}`));
  parts.push(photoBuffer);
  parts.push(enc(CRLF));

  // Foto 2 (workaround Pydantic v2 single-file bug)
  parts.push(enc(`--${boundary}${CRLF}Content-Disposition: form-data; name="photos"; filename="test2.jpg"${CRLF}Content-Type: image/jpeg${CRLF}${CRLF}`));
  parts.push(photoBuffer);
  parts.push(enc(CRLF));

  parts.push(enc(`--${boundary}--${CRLF}`));
  return Buffer.concat(parts);
}

function postReporte(grupoKey, cfg) {
  return new Promise((resolve) => {
    const boundary = "b" + randomBytes(16).toString("hex");
    const fields = {
      tipo_intervencion:        cfg.tipo,
      descripcion_intervencion: cfg.desc,
      direccion:                "Cra 1 No 1-01, Cali",
      grupo:                    grupoKey,
      id_actividad:             "ACT-TEST-0001",
      observaciones:            "Registro prueba automatizado",
      coordinates_type:         "Point",
      coordinates_data:         "[-76.5225,3.4516]",
      ...cfg.extra,
    };

    const body = buildMultipart(boundary, fields, JPEG);
    const headers = {
      "Content-Type":   `multipart/form-data; boundary=${boundary}`,
      "Content-Length": body.length,
      "Accept":         "application/json",
    };
    if (TOKEN) headers["Authorization"] = `Bearer ${TOKEN}`;

    const req = https.request(
      { host: API_HOST, path: `/grupos/${grupoKey}/reporte_intervencion`, method: "POST", headers },
      (res) => {
        let raw = "";
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          let parsed;
          try { parsed = JSON.parse(raw); } catch { parsed = { raw }; }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );
    req.on("error", (e) => resolve({ status: 0, body: { error: e.message } }));
    req.write(body);
    req.end();
  });
}

console.log("\n======================================");
console.log(` POST reporte_intervencion — ${TOKEN ? "CON token" : "SIN token"}`);
console.log("======================================\n");

let ok = 0, fail = 0;
for (const [key, cfg] of Object.entries(GRUPOS)) {
  process.stdout.write(`  ${key}: `);
  const { status, body } = await postReporte(key, cfg);
  if (status === 200 && body.success) {
    console.log(`\x1b[32m[OK] ${status} | id=${body.id} | fotos=${body.photos_uploaded}\x1b[0m`);
    ok++;
  } else {
    const detail = body.detail ?? body.message ?? body.raw ?? JSON.stringify(body);
    console.log(`\x1b[31m[${status}] ${detail}\x1b[0m`);
    fail++;
  }
}

console.log(`\n  OK: ${ok}/${ok+fail}  Fail: ${fail}/${ok+fail}\n`);
