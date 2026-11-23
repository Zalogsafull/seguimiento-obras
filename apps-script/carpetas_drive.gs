// Seguimiento de obras OICI: crea la carpeta de planos en Drive al agregar una estructura u obra.
// Se instala una sola vez en script.google.com con la cuenta dueña de la carpeta «Estructuras»
// (Implementar → Nueva implementación → Aplicación web, Ejecutar como: Yo, Acceso: Cualquier usuario).

// 1) Pegá entre las comillas el link de la carpeta «Estructuras» (el que aparece al abrirla en Drive).
const CARPETA_ESTRUCTURAS = 'PEGAR_AQUI_EL_LINK_DE_LA_CARPETA_ESTRUCTURAS';

// Data API de Neon: se usa solo para comprobar que quien pide la carpeta es un editor de la web.
const NEON_DATA_API = 'https://ep-young-snow-b64465yr.apirest.c-2.sa-east-1.aws.neon.tech/neondb/rest/v1';

function doPost(e) {
  let r;
  try { r = crearCarpeta(JSON.parse(e.postData.contents)); }
  catch (err) { r = { error: String(err && err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(r)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, carpeta: carpetaEstructuras().getName() }))
    .setMimeType(ContentService.MimeType.JSON);
}

function carpetaEstructuras() {
  const m = String(CARPETA_ESTRUCTURAS).match(/[-\w]{25,}/);
  if (!m) throw new Error('Falta pegar el link de la carpeta Estructuras en el script');
  return DriveApp.getFolderById(m[0]);
}

function crearCarpeta(p) {
  const codigo = String(p.codigo || '').trim();
  if (!codigo || codigo.length > 80 || /[\/\\]/.test(codigo)) throw new Error('Código no válido para una carpeta');
  const quien = editorDeLaWeb(p.token);
  const padre = carpetaEstructuras();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const hay = padre.getFoldersByName(codigo);
    if (hay.hasNext()) return { url: hay.next().getUrl(), nueva: false };   // ya existía: se usa la misma
    const f = padre.createFolder(codigo);
    f.setDescription('Creada desde Seguimiento de obras por ' + quien);
    return { url: f.getUrl(), nueva: true };
  } finally {
    lock.releaseLock();
  }
}

// La sesión de la web se comprueba en Neon: cada usuario solo puede leer su propia fila de usuarios_web.
function editorDeLaWeb(token) {
  if (!token) throw new Error('Iniciá sesión en la web');
  const res = UrlFetchApp.fetch(NEON_DATA_API + '/usuarios_web?select=rol,nombre', {
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' }, muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('La sesión no es válida: volvé a entrar a la web');
  const filas = JSON.parse(res.getContentText());
  if (!filas.length || filas[0].rol !== 'EDITOR') throw new Error('Solo los editores pueden crear carpetas');
  return filas[0].nombre;
}

// Para probar desde el editor (botón Ejecutar): muestra el nombre de la carpeta y pide los permisos.
function probar() {
  Logger.log('Carpeta: ' + carpetaEstructuras().getName());
  UrlFetchApp.fetch(NEON_DATA_API + '/', { muteHttpExceptions: true });
}
