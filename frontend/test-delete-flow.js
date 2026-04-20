/**
 * TEST: Flujo completo DELETE personal_asignado
 * 
 * Ejecutar en la consola del navegador (F12 → Console) estando en la app.
 * 
 * Verifica:
 * 1. GET lee datos frescos (sin caché)
 * 2. DELETE elimina de la DB
 * 3. GET post-DELETE refleja los cambios
 */

async function testDeleteFlow() {
  const API = '/api';
  const ts = Date.now();
  
  console.log('=== TEST 1: GET actividades sin caché ===');
  const r1 = await fetch(`${API}/actividades?_t=${ts}`, {
    headers: { 'Accept': 'application/json' },
    cache: 'no-store',
  });
  const d1 = await r1.json();
  const actividades = d1.data || d1 || [];
  const conPersonal = actividades.filter(a => a.personal_asignado && a.personal_asignado.length > 0);
  
  if (conPersonal.length === 0) {
    console.log('❌ No hay actividades con personal_asignado. Asigna personal primero.');
    return;
  }
  
  const act = conPersonal[0];
  console.log(`✅ Actividad: ${act.id}`);
  console.log(`   personal_asignado: ${act.personal_asignado.length} personas`);
  act.personal_asignado.forEach(p => console.log(`   - ${p.email} (${p.nombre_completo})`));
  
  const emailToDelete = act.personal_asignado[0]?.email;
  if (!emailToDelete) {
    console.log('❌ No se encontró email para eliminar');
    return;
  }
  
  console.log(`\n=== TEST 2: DELETE email "${emailToDelete}" ===`);
  const r2 = await fetch(`${API}/actividades/${act.id}/personal_asignado`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ emails: [emailToDelete] }),
    cache: 'no-store',
  });
  const d2Text = await r2.text();
  console.log(`   Status: ${r2.status}`);
  console.log(`   Response: ${d2Text}`);
  
  const d2 = JSON.parse(d2Text);
  if (d2.emails_eliminados && d2.emails_eliminados.length > 0) {
    console.log(`✅ DELETE exitoso. Eliminados: ${d2.emails_eliminados.join(', ')}`);
  } else if (d2.emails_no_encontrados && d2.emails_no_encontrados.length > 0) {
    console.log(`⚠️ DELETE: backend no encontró: ${d2.emails_no_encontrados.join(', ')}`);
    console.log('   → El backend puede estar leyendo de otra fuente. Revisa el endpoint.');
  } else {
    console.log(`   Result: ${JSON.stringify(d2)}`);
  }
  
  console.log(`\n=== TEST 3: GET post-DELETE (verificar persistencia) ===`);
  const ts2 = Date.now();
  const r3 = await fetch(`${API}/actividades?_t=${ts2}`, {
    headers: { 'Accept': 'application/json' },
    cache: 'no-store',
  });
  const d3 = await r3.json();
  const actividades2 = d3.data || d3 || [];
  const actPost = actividades2.find(a => a.id === act.id);
  
  if (!actPost) {
    console.log('❌ Actividad no encontrada después del DELETE');
    return;
  }
  
  const countBefore = act.personal_asignado.length;
  const countAfter = actPost.personal_asignado?.length ?? 0;
  const emailStillExists = actPost.personal_asignado?.some(p => p.email === emailToDelete);
  
  console.log(`   Antes: ${countBefore} personas`);
  console.log(`   Después: ${countAfter} personas`);
  
  if (countAfter < countBefore && !emailStillExists) {
    console.log(`✅ Persistido correctamente. ${emailToDelete} ya no está.`);
  } else if (emailStillExists) {
    console.log(`❌ ${emailToDelete} SIGUE en personal_asignado después del DELETE.`);
    console.log('   → El backend no eliminó de la DB, o GET lee de otra fuente.');
  } else {
    console.log(`⚠️ Count cambió (${countBefore} → ${countAfter}) pero email check inconcluso.`);
  }
  
  console.log('\n=== RESUMEN ===');
  console.log(`GET sin caché: ✅`);
  console.log(`DELETE: ${d2.emails_eliminados?.length > 0 ? '✅' : '❌'}`);
  console.log(`Persistencia: ${!emailStillExists && countAfter < countBefore ? '✅' : '❌'}`);
}

// Ejecutar:
testDeleteFlow();
