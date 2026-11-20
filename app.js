import { crearApi } from "./api.js?v=2026-11-20-8";

// ------------------------------------------------------------ categorías
// Mismos colores que la simbología de QGIS.
const CAT = {
  proyecto:    { nombre: "Proyecto",                color: "#f6f6f6", grupo: "proyecto" },
  aprobado_e:  { nombre: "P. ejecutivo aprobado",   color: "#7ec8f0", grupo: "proyecto" },
  aprobado_o:  { nombre: "Proyecto aprobado",       color: "#7ec8f0", grupo: "proyecto" },
  hormigonado: { nombre: "Hormigonado",             color: "#d7191c", grupo: "obra" },
  montaje:     { nombre: "Montaje",                 color: "#f2d024", grupo: "obra" },
  infra:       { nombre: "Obra de infraestructura", color: "#2e9e44", grupo: "obra" },
  r6:          { nombre: "Recepción en 3 a 6 meses", color: "#f2d024", grupo: "recepcion", recepcion: true },
  r3:          { nombre: "Recepción en menos de 3 meses", color: "#f08a24", grupo: "recepcion", recepcion: true },
  vencida:     { nombre: "Recepción vencida",       color: "#c1272d", grupo: "recepcion", recepcion: true },
  plazo:       { nombre: "Terminada, recepción en plazo", color: "#838383", grupo: "cerrada", terminada: true },
  sinfecha:    { nombre: "Terminada, sin fecha de fin", color: "#838383", grupo: "cerrada", terminada: true },
  recibida:    { nombre: "Recibida",                color: "#838383", grupo: "cerrada", terminada: true },
  terminada:   { nombre: "Terminada",               color: "#838383", grupo: "cerrada", terminada: true },
};
// Árbol de capas, igual que en QGIS / QField.
const CAPAS = [
  { id: "obra_e", grupo: "ESTRUCTURAS", nombre: "Estructuras OICI Obra", tipo: "estructura",
    cats: ["proyecto", "aprobado_e", "hormigonado", "montaje", "infra"], on: true },
  { id: "recep", grupo: "ESTRUCTURAS", nombre: "Estructuras OICI Recepciones", tipo: "estructura",
    cats: ["r6", "r3", "vencida"], on: true },
  { id: "term_e", grupo: "ESTRUCTURAS", nombre: "Estructuras OICI (terminadas)", tipo: "estructura",
    cats: ["plazo", "sinfecha", "recibida"], on: false },
  { id: "obras", grupo: "ESTRUCTURAS", nombre: "Obras", tipo: "obra",
    cats: ["proyecto", "aprobado_o", "infra", "terminada"], on: true, apagadas: ["terminada"] },
];
const capaDe = (tipo, cat) => CAPAS.find((c) => c.tipo === tipo && c.cats.includes(cat));

// Formas de QGIS: MÁSTIL triángulo, MONOPOLO círculo, Obras cuadrado, COSITIO asterisco.
function forma(tipo, o) {
  if (tipo === "obra") return String(o.descripcion || "").toUpperCase() === "COSITIO" ? "asterisco" : "cuadrado";
  return /^M[ÁA]STIL/i.test(o.estructura || "") ? "triangulo" : "circulo";
}
function svgForma(f, relleno, borde, px, grosor = 1.2) {
  const h = px / 2, r = h - grosor;
  let d;
  if (f === "triangulo") d = `<polygon points="${h},${grosor} ${px - grosor},${px - grosor} ${grosor},${px - grosor}"/>`;
  else if (f === "cuadrado") d = `<rect x="${grosor + 1}" y="${grosor + 1}" width="${px - 2 * grosor - 2}" height="${px - 2 * grosor - 2}"/>`;
  else if (f === "asterisco") {
    const pts = [];
    for (let i = 0; i < 16; i++) {
      const a = (Math.PI / 8) * i - Math.PI / 2, rr = i % 2 ? r * 0.42 : r;
      pts.push(`${(h + rr * Math.cos(a)).toFixed(2)},${(h + rr * Math.sin(a)).toFixed(2)}`);
    }
    d = `<polygon points="${pts.join(" ")}"/>`;
  } else d = `<circle cx="${h}" cy="${h}" r="${r}"/>`;
  return `<svg width="${px}" height="${px}" viewBox="0 0 ${px} ${px}" aria-hidden="true"><g fill="${relleno}" stroke="${borde}" stroke-width="${grosor}" stroke-linejoin="round">${d}</g></svg>`;
}
function simbolo(tipo, o, cat, escala = 1) {
  const c = CAT[cat], f = forma(tipo, o);
  const grande = c.recepcion || f === "asterisco";
  const px = Math.round((grande ? 18 : 13) * escala);
  const borde = c.recepcion ? "#e0c200" : c.terminada ? "#1a1a1a" : "#7a7a7a";
  return svgForma(f, c.color, borde, px, c.recepcion ? 1.8 : 1.2);
}

const ESCALERA = {
  estructura: ["proyecto", "aprobado_e", "hormigonado", "montaje", "infra", "recepcion", "recibida"],
  obra: ["proyecto", "aprobado_o", "infra", "terminada"],
};
const NOMBRE_TRAMO = { recepcion: "Esperando recepción" };

function categoria(tipo, o) {
  const e = o.estado, et = o.etapa || 1;
  if (tipo === "obra") {
    if (e === "FIN") return "terminada";
    if (e === "CONS") return "infra";
    return et >= 2 ? "aprobado_o" : "proyecto";
  }
  if (e === "FIN" || et >= 5) {
    if (o.recepcion === "RD" || et >= 6) return "recibida";
    const d = o.dias_para_recepcion;
    if (d == null) return "sinfecha";
    if (d < 0) return "vencida";
    if (d < 90) return "r3";
    if (d < 180) return "r6";
    return "plazo";
  }
  if (e === "CONS") return et <= 2 ? "hormigonado" : et === 3 ? "montaje" : "infra";
  return et >= 2 ? "aprobado_e" : "proyecto";
}

// ------------------------------------------------------------ utilidades
const $ = (s, r = document) => r.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const hoy = () => new Date().toISOString().slice(0, 10);
const fecha = (iso) => (iso ? new Date(iso + "T12:00:00").toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—");
const normal = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

function aviso(texto, mal = false) {
  if (mal && /failed to fetch|networkerror|load failed|err_|se agotó el tiempo/i.test(texto))
    texto = "Sin conexión: no se pudo completar. Probá de nuevo cuando tengas señal.";
  const d = document.createElement("div");
  d.className = "aviso" + (mal ? " mal" : "");
  d.textContent = texto;
  $("#avisos").append(d);
  setTimeout(() => d.remove(), mal ? 6000 : 2500);
}

// ------------------------------------------------------------ estado
const S = {
  api: null, usuario: null, perfil: null,
  datos: { estructura: [], obra: [], relev: [] },
  capaOn: { ...Object.fromEntries(CAPAS.map((c) => [c.id, c.on])), relev: true },
  catOn: Object.fromEntries(CAPAS.flatMap((c) => c.cats.map((k) => [`${c.id}:${k}`, !(c.apagadas || []).includes(k)]))),
  abiertoArbol: Object.fromEntries(CAPAS.map((c) => [c.id, c.on])),
  f: { mias: false, texto: "", director: "", licitacion: "", estructura: "", anio: "" },
  abierta: null, tab: "capas",
  mapa: null, base: {}, marcadores: new Map(), primeraVez: true,
  baseNombre: "Gris (como QGIS)", deptosOn: true, callesGris: 0.3,
};
const editor = () => S.perfil?.rol === "EDITOR";

// ------------------------------------------------------------ recordar cómo dejaste las capas (en este dispositivo)
const CLAVE_ESTADO = "obras-oici-capas-v1";
function guardarEstado() {
  try {
    localStorage.setItem(CLAVE_ESTADO, JSON.stringify({
      capaOn: S.capaOn, catOn: S.catOn, abiertoArbol: S.abiertoArbol, base: S.baseNombre, deptosOn: S.deptosOn,
      callesGris: S.callesGris,
    }));
  } catch (e) { /* sin almacenamiento: se usan los valores de siempre */ }
}
function leerEstado() {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE_ESTADO) || "null");
    if (!g) return;
    for (const k of ["capaOn", "catOn", "abiertoArbol"]) {
      for (const [id, v] of Object.entries(g[k] || {})) if (id in S[k]) S[k][id] = !!v;
    }
    if (typeof g.base === "string") S.baseNombre = g.base;
    if (typeof g.deptosOn === "boolean") S.deptosOn = g.deptosOn;
    if (typeof g.callesGris === "number") S.callesGris = Math.min(Math.max(g.callesGris, 0), 0.8);
  } catch (e) { /* estado guardado inválido: se ignora */ }
}
const partesDO = (v) => String(v || "").split(/[\/,;]+|\s+y\s+/).map((p) => p.trim()).filter(Boolean);

function esMia(o) {
  const ini = normal(S.perfil?.iniciales_do);
  return !!ini && partesDO(o.director_obra).some((p) => normal(p) === ini);
}

function pasaFiltros(tipo, o) {
  const f = S.f, t = normal(f.texto);
  if (f.mias && !esMia(o)) return false;
  if (f.director && !partesDO(o.director_obra).some((p) => normal(p) === normal(f.director))) return false;
  if (f.licitacion && o.licitacion !== f.licitacion) return false;
  if (f.anio && String(o.anio ?? "") !== f.anio) return false;
  if (f.estructura) {
    if (tipo !== "estructura") return false;
    if (forma(tipo, o) !== f.estructura) return false;
  }
  if (t && ![o.codigo, o.localidad, o.licitacion, o.estructura, o.sala, o.tarea].some((v) => normal(v).includes(t))) return false;
  return true;
}
const filtrosActivos = () => ["mias", "texto", "director", "licitacion", "estructura", "anio"].filter((k) => S.f[k]).length;

function todas() {
  const out = [];
  for (const tipo of ["estructura", "obra"]) for (const o of S.datos[tipo]) {
    const cat = categoria(tipo, o);
    out.push({ tipo, o, cat, capa: capaDe(tipo, cat) });
  }
  return out;
}

function visibles() {
  const orden = ["obra", "recepcion", "proyecto", "cerrada"];
  return todas().filter((x) => x.capa && S.capaOn[x.capa.id] && S.catOn[`${x.capa.id}:${x.cat}`] && pasaFiltros(x.tipo, x.o))
    .sort((a, b) => orden.indexOf(CAT[a.cat].grupo) - orden.indexOf(CAT[b.cat].grupo)
      || String(a.o.codigo).localeCompare(String(b.o.codigo)));
}

// ------------------------------------------------------------ datos guardados en este dispositivo
// La web abre al instante con lo último que se vio y después se actualiza; sin señal sigue
// mostrando lo guardado. Al tocar Salir se borra todo.
const DEMO = new URLSearchParams(location.search).has("demo");
const CLAVE_DATOS = "obras-oici-datos-v1" + (DEMO ? "-demo" : "");
const CLAVE_FICHAS = "obras-oici-fichas-v1" + (DEMO ? "-demo" : "");
const CLAVE_VISTA = "obras-oici-vista-v1";
const leerJSON = (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } };
const escribirJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
function guardarDatos() {
  if (!S.usuario?.email || !S.perfil) return;
  escribirJSON(CLAVE_DATOS, { email: S.usuario.email, perfil: S.perfil, datos: S.datos, relevFalta: !!S.relevFalta, cuando: S.datosDe || Date.now() });
}
function borrarGuardado() {
  try { localStorage.removeItem(CLAVE_DATOS); localStorage.removeItem(CLAVE_FICHAS); } catch (e) { /* nada guardado */ }
}
const fichaGuardada = (tipo, id) => (leerJSON(CLAVE_FICHAS) || {})[`${tipo}:${id}`] || null;
function guardarFicha(tipo, id, o, hitos, notas) {
  const k = `${tipo}:${id}`, t = leerJSON(CLAVE_FICHAS) || {};
  t[k] = { o, hitos, notas, cuando: Date.now() };
  for (const v of Object.keys(t).sort((a, b) => t[b].cuando - t[a].cuando).slice(120)) delete t[v];
  if (!escribirJSON(CLAVE_FICHAS, t)) escribirJSON(CLAVE_FICHAS, { [k]: t[k] });
}
const sinRed = (e) => !navigator.onLine || /fetch|network|load failed|err_|se agotó el tiempo/i.test(String(e?.message || e));
const conTiempo = (pr, ms) => Promise.race([pr,
  new Promise((_, no) => setTimeout(() => no(new Error("Se agotó el tiempo de espera de la conexión")), ms))]);
function cuandoTexto(ms) {
  const d = new Date(ms), hora = d.toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit", hour12: false });
  return new Date().toDateString() === d.toDateString() ? `de las ${hora}`
    : `del ${d.toLocaleDateString("es-UY", { day: "2-digit", month: "2-digit" })}, ${hora}`;
}
// Cartelito arriba a la derecha del mapa: "Actualizando…" o "Sin conexión · datos de las 07:31".
function estadoDatos(modo) {
  S.estadoRed = modo;
  const el = $("#estado-datos");
  if (!el) return;
  el.hidden = !modo;
  el.dataset.modo = modo || "";
  el.textContent = modo === "actualizando" ? "Actualizando…"
    : modo === "sinred" ? `Sin conexión · datos ${cuandoTexto(S.datosDe || Date.now())}` : "";
  el.title = modo === "sinred" ? "Tocá para reintentar" : "";
}
async function salirCuenta() {
  try { await S.api?.salir(); } catch (e) { /* sin conexión: igual se borra lo guardado */ }
  borrarGuardado();
  location.reload();
}

// ------------------------------------------------------------ vistas
function mostrar(vista) {
  for (const id of ["vista-ingreso", "vista-pendiente", "vista-app"]) $("#" + id).hidden = id !== vista;
}

async function iniciar() {
  const guardado = new URLSearchParams(location.search).get("token") ? null : leerJSON(CLAVE_DATOS);
  if (guardado?.perfil && guardado.datos && guardado.email) {
    // Abre al instante con lo último que se vio y después busca lo nuevo.
    S.usuario = { email: guardado.email };
    S.perfil = guardado.perfil;
    S.datos = { estructura: [], obra: [], relev: [], ...guardado.datos };
    S.relevFalta = guardado.relevFalta;
    S.datosDe = guardado.cuando;
    mostrarApp();
    pintar();
    await actualizar();
    return;
  }
  try {
    S.api = await crearApi();
    S.usuario = await S.api.usuario();
  } catch (e) {
    mostrar("vista-ingreso");
    $("#error-ingreso").hidden = false;
    $("#error-ingreso").textContent = "No se pudo conectar con el servidor. Revisá la conexión y recargá la página.";
    return;
  }
  prepararIngreso();
  if (!S.usuario || new URLSearchParams(location.search).get("token")) return mostrar("vista-ingreso");
  await entrarApp();
}

function prepararIngreso() {
  let modo = "entrar";
  const poner = (m) => {
    modo = m;
    $("#tab-entrar").setAttribute("aria-selected", m === "entrar");
    $("#tab-crear").setAttribute("aria-selected", m === "crear");
    $("#campo-nombre").hidden = m !== "crear";
    $("#campo-repetir").hidden = m !== "crear";
    $("#form-ingreso").password2.required = m === "crear";
    $("#boton-ingreso").textContent = m === "crear" ? "Crear cuenta" : "Ingresar";
    $("#form-ingreso").password.autocomplete = m === "crear" ? "new-password" : "current-password";
    $("#error-ingreso").hidden = true;
  };
  $("#tab-entrar").onclick = () => poner("entrar");
  $("#tab-crear").onclick = () => poner("crear");
  $("#form-ingreso").onsubmit = async (ev) => {
    ev.preventDefault();
    const f = ev.target, b = $("#boton-ingreso");
    $("#error-ingreso").hidden = true;
    if (modo === "crear" && f.password.value !== f.password2.value) {
      $("#error-ingreso").textContent = "Las dos contraseñas no coinciden. Escribilas de nuevo.";
      $("#error-ingreso").hidden = false;
      f.password2.value = ""; f.password2.focus();
      return;
    }
    b.disabled = true;
    try {
      S.usuario = modo === "crear"
        ? await S.api.crearCuenta(f.email.value.trim(), f.password.value, f.nombre.value.trim() || f.email.value.trim())
        : await S.api.entrar(f.email.value.trim(), f.password.value);
      if (!S.usuario) throw new Error("No se pudo iniciar sesión. Revisá el correo y la contraseña.");
      await entrarApp();
    } catch (e) {
      $("#error-ingreso").textContent = traducir(e.message);
      $("#error-ingreso").hidden = false;
    } finally {
      b.disabled = false;
    }
  };
  // ---- olvidé mi contraseña
  const verForm = (id) => {
    for (const f of ["form-ingreso", "form-olvido", "form-nueva"]) $("#" + f).hidden = f !== id;
    document.querySelector("#vista-ingreso .pestanas").hidden = id !== "form-ingreso";
  };
  $("#olvide").onclick = () => { $("#form-olvido").email.value = $("#form-ingreso").email.value; verForm("form-olvido"); };
  $("#volver-ingreso").onclick = () => verForm("form-ingreso");
  $("#form-olvido").onsubmit = async (ev) => {
    ev.preventDefault();
    const f = ev.target, b = f.querySelector("button[type=submit]");
    b.disabled = true; b.textContent = "Enviando…"; $("#error-olvido").hidden = true; $("#ok-olvido").hidden = true;
    try {
      await Promise.race([
        S.api.pedirReseteo(f.email.value.trim(), location.origin + location.pathname),
        new Promise((_, no) => setTimeout(() => no(new Error("El servidor no respondió. Probá de nuevo en un rato.")), 20000)),
      ]);
      $("#ok-olvido").textContent = `Si ${f.email.value.trim()} tiene cuenta, te llega un correo con el enlace. Revisá también la carpeta de spam.`;
      $("#ok-olvido").hidden = false;
    } catch (e) { $("#error-olvido").textContent = traducir(e.message) || "No se pudo enviar el correo."; $("#error-olvido").hidden = false; }
    finally { b.disabled = false; b.textContent = "Enviar enlace"; }
  };
  const q = new URLSearchParams(location.search);
  if (q.get("error")) {
    $("#error-ingreso").textContent = "El enlace para cambiar la contraseña no es válido o ya venció. Pedí uno nuevo.";
    $("#error-ingreso").hidden = false;
  }
  if (q.get("token")) {
    verForm("form-nueva");
    $("#form-nueva").onsubmit = async (ev) => {
      ev.preventDefault();
      const f = ev.target;
      if (f.password.value !== f.password2.value) {
        $("#error-nueva").textContent = "Las dos contraseñas no coinciden."; $("#error-nueva").hidden = false; return;
      }
      try {
        await S.api.nuevaContrasena(q.get("token"), f.password.value);
        history.replaceState(null, "", location.pathname);
        verForm("form-ingreso");
        $("#error-ingreso").hidden = true;
        aviso("Contraseña cambiada. Ingresá con la nueva.");
      } catch (e) {
        $("#error-nueva").textContent = /invalid|expired/i.test(e.message)
          ? "El enlace no es válido o ya venció. Pedí uno nuevo desde Olvidé mi contraseña." : traducir(e.message);
        $("#error-nueva").hidden = false;
      }
    };
  }
  const salir = salirCuenta;
  $("#salir").onclick = salir;
  $("#salir-pendiente").onclick = salir;
}

function traducir(m = "") {
  if (/invalid email or password|invalid credentials/i.test(m)) return "El correo o la contraseña no coinciden.";
  if (/already exists|already registered/i.test(m)) return "Ya hay una cuenta con ese correo. Usá Ingresar.";
  if (/password.*(short|least)/i.test(m)) return "La contraseña tiene que tener al menos 8 caracteres.";
  if (/fetch|network/i.test(m)) return "No hay conexión con el servidor. Probá de nuevo en unos segundos.";
  return m;
}

async function entrarApp() {
  try {
    S.perfil = await S.api.perfil();
  } catch (e) {
    S.perfil = null;
  }
  if (!S.perfil) {
    $("#correo-pendiente").textContent = S.usuario?.email || "";
    return mostrar("vista-pendiente");
  }
  // si entra otra persona en este dispositivo, no se mezclan los datos guardados
  const g = leerJSON(CLAVE_DATOS);
  if (g && g.email !== S.usuario?.email) borrarGuardado();
  S.verificado = true;
  mostrarApp();
  await cargar();
}

function ponerUsuario() {
  $("#nombre-usuario").textContent = S.perfil.nombre;
  $("#boton-usuarios").hidden = !S.perfil.admin;
  $("#boton-nuevo").hidden = !editor();
}

function mostrarApp() {
  mostrar("vista-app");
  ponerUsuario();
  if (S.appLista) return;
  S.appLista = true;
  $("#boton-nuevo").onclick = abrirNuevo;
  $("#boton-usuarios").onclick = abrirAdmin;
  $("#salir").onclick = salirCuenta;
  $("#pestanas").onclick = (ev) => { const b = ev.target.closest("[data-tab]"); if (b) verTab(b.dataset.tab); };
  $("#estado-datos").onclick = () => { if (S.estadoRed === "sinred") actualizar(); };
  $("#actualizar-ahora").onclick = async () => { await actualizar(); pintarAjustes(); };
  prepararMapa();
  prepararPanel();
  const v = leerJSON(CLAVE_VISTA);
  if (v?.tab && v.tab !== S.tab && document.querySelector(`[data-tab="${v.tab}"]`)) verTab(v.tab);
  // al volver la señal, o al volver a la app después de un rato, se actualiza sola
  addEventListener("online", () => actualizar());
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && Date.now() - (S.datosDe || 0) > 5 * 60e3) actualizar();
  });
}

// Revisa la sesión (si arrancó con lo guardado) y trae los datos nuevos.
async function actualizar() {
  if (S.actualizando) return;
  S.actualizando = true;
  try {
    estadoDatos("actualizando");
    if (!S.api) {
      try { S.api = await conTiempo(crearApi(), 20000); prepararIngreso(); }
      catch (e) { S.api = null; return estadoDatos("sinred"); }
    }
    if (!S.verificado) {
      let u;
      try { u = await conTiempo(S.api.usuario(), 20000); } catch (e) { return estadoDatos("sinred"); }
      if (!u) {
        if (!navigator.onLine) return estadoDatos("sinred");
        estadoDatos(null);
        return mostrar("vista-ingreso"); // la sesión venció: hay que volver a ingresar
      }
      if (u.email !== S.usuario.email) { borrarGuardado(); location.reload(); return; }
      S.usuario = u;
      let p;
      try { p = await conTiempo(S.api.perfil(), 20000); } catch (e) { return estadoDatos("sinred"); }
      if (!p) { borrarGuardado(); location.reload(); return; } // le quitaron el acceso
      S.perfil = p;
      S.verificado = true;
      ponerUsuario();
    }
    await cargar();
  } finally {
    S.actualizando = false;
  }
}

async function cargar() {
  const habia = S.datos.estructura.length || S.datos.obra.length;
  estadoDatos("actualizando");
  try {
    const [e, o] = await conTiempo(Promise.all([S.api.estructuras(), S.api.obras()]), 30000);
    S.datos.estructura = e || [];
    S.datos.obra = o || [];
  } catch (e) {
    // sin señal: se siguen mostrando los datos guardados
    estadoDatos(sinRed(e) ? "sinred" : null);
    if (!(habia && sinRed(e))) aviso("No se pudieron cargar las obras: " + e.message, true);
    pintar();
    return;
  }
  try {
    S.datos.relev = (await conTiempo(S.api.relevamiento(), 20000)) || [];
    S.relevFalta = false;
  } catch (e) {
    if (!sinRed(e)) {
      S.datos.relev = [];
      S.relevFalta = true; // falta correr sql/parte5_relevamiento.sql
    }
  }
  S.datosDe = Date.now();
  guardarDatos();
  estadoDatos(null);
  pintar();
  if (UI.modo === "ajustes" && !UI.plegado) pintarAjustes();
}

// ------------------------------------------------------------ pestañas
function verTab(t) {
  S.tab = t;
  if (typeof UI !== "undefined" && UI.modo !== "capas") { UI.modo = "capas"; guardarUI(); aplicarUI(); }
  escribirJSON(CLAVE_VISTA, { ...(leerJSON(CLAVE_VISTA) || {}), tab: t });
  document.querySelectorAll("#pestanas [data-tab]").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === t));
  document.querySelectorAll("[data-panel]").forEach((d) => (d.hidden = d.dataset.panel !== t));
  pintarPanel();
}

// ------------------------------------------------------------ capas (como el panel de QField)
function pintarCapas() {
  const t = todas().filter((x) => pasaFiltros(x.tipo, x.o));
  const n = (capa, cat) => t.filter((x) => x.capa === capa && (!cat || x.cat === cat)).length;
  const ejemplo = (capa) => (capa.tipo === "obra" ? { descripcion: "OBRA" } : { estructura: "MONOPOLO" });
  const grupos = [...new Set(CAPAS.map((c) => c.grupo))];
  const html = grupos.map((g) => {
    const capas = CAPAS.filter((c) => c.grupo === g);
    const alguna = capas.some((c) => S.capaOn[c.id]), todasOn = capas.every((c) => S.capaOn[c.id]);
    return `<div class="arbol-grupo">
      <label class="nodo nodo-grupo"><input type="checkbox" data-grupo="${g}" ${alguna ? "checked" : ""} data-medio="${alguna && !todasOn}"> ${esc(g)}</label>
      ${capas.map((c) => `<div class="arbol-capa${S.capaOn[c.id] ? "" : " apagada"}">
        <div class="nodo nodo-capa">
          <button class="plegar" data-plegar="${c.id}" aria-expanded="${!!S.abiertoArbol[c.id]}" aria-label="Mostrar categorías de ${esc(c.nombre)}">${S.abiertoArbol[c.id] ? "▾" : "▸"}</button>
          <label><input type="checkbox" data-capa="${c.id}" ${S.capaOn[c.id] ? "checked" : ""}> ${esc(c.nombre)}</label>
          <span class="n">${n(c)}</span>
        </div>
        ${S.abiertoArbol[c.id] ? `<ul class="cats">${c.cats.map((k) => `<li><label class="nodo">
          <input type="checkbox" data-cat="${c.id}:${k}" ${S.catOn[`${c.id}:${k}`] ? "checked" : ""}>
          <span class="sim">${simbolo(c.tipo, ejemplo(c), k, 0.85)}</span><span>${esc(CAT[k].nombre)}</span>
          <span class="n">${n(c, k)}</span></label></li>`).join("")}</ul>` : ""}
      </div>`).join("")}
    </div>`;
  }).join("");
  const p = $("#panel-capas");
  p.innerHTML = `${referencias()}${html}

    ${filtrosActivos() ? `<p class="nota aviso-filtro">Hay ${filtrosActivos()} filtro${filtrosActivos() > 1 ? "s" : ""} activo${filtrosActivos() > 1 ? "s" : ""}: las cantidades ya los tienen en cuenta.</p>` : ""}`;
  p.querySelectorAll('[data-medio="true"]').forEach((el) => (el.indeterminate = true));
  p.onchange = (ev) => {
    const el = ev.target;
    if (el.dataset.grupo) CAPAS.filter((c) => c.grupo === el.dataset.grupo).forEach((c) => (S.capaOn[c.id] = el.checked));
    if (el.dataset.capa) S.capaOn[el.dataset.capa] = el.checked;
    if ("relev" in el.dataset) S.capaOn.relev = el.checked;
    if (el.dataset.cat) S.catOn[el.dataset.cat] = el.checked;
    pintar();
  };
  p.onclick = (ev) => {
    const b = ev.target.closest("[data-plegar]");
    if (b) { S.abiertoArbol[b.dataset.plegar] = !S.abiertoArbol[b.dataset.plegar]; guardarEstado(); pintarCapas(); }
  };
}

// ------------------------------------------------------------ editar los datos de una estructura u obra
// Campos que se pueden cambiar desde la web: [columna en la capa, campo de la vista, etiqueta, tipo]
const CAMPOS_EDITABLES = {
  estructura: [
    ["ESTRUCTURA", "estructura", "Estructura", "estructura"],
    ["LICITACIÓN", "licitacion", "Licitación", "texto"],
    ["AÑO", "anio", "Año", "anio"],
    ["D.O.", "director_obra", "Director de obra", "do"],
    ["FECHA INICIO", "fecha_inicio", "Inicio", "fecha"],
    ["FECHA FIN", "fecha_fin", "Fin", "fecha"],
    ["RECEPCIÓN", "recepcion", "Recepción", "recepcion"],
    ["PLANOS", "planos", "Planos (enlace a la carpeta)", "url"],
    ["OBSERVACIONES", "observaciones", "Observaciones", "largo"],
  ],
  obra: [
    ["Sala", "sala", "Sala", "texto"],
    ["Localidad", "localidad", "Localidad", "texto"],
    ["Departamento", "departamento", "Departamento", "texto"],
    ["Licitación", "licitacion", "Licitación", "texto"],
    ["Tarea", "tarea", "Tarea", "texto"],
    ["Descripción", "descripcion", "Tipo", "descripcion"],
    ["D.O.", "director_obra", "Director de obra", "do"],
    ["Planos", "planos", "Planos (enlace a la carpeta)", "url"],
  ],
};

function editarDatos(tipo, o) {
  const cuerpo = $("#datos-cuerpo"), lapiz = $("#editar-datos");
  if (!cuerpo) return;
  lapiz.hidden = true;
  const valores = (k) => [...new Set(S.datos[tipo].map((x) => x[k]).filter((v) => v != null && v !== ""))]
    .map(String).sort((a, b) => a.localeCompare(b, "es", { numeric: true }));
  const opciones = (lista, actual) => {
    const todas = [...new Set(["", ...lista, ...(actual ? [String(actual)] : [])])];
    return todas.map((v) => `<option value="${esc(v)}" ${String(actual ?? "") === v ? "selected" : ""}>${esc(v) || "—"}</option>`).join("");
  };
  const lista = (id, vals) => `<datalist id="${id}">${vals.map((v) => `<option value="${esc(v)}">`).join("")}</datalist>`;
  const campo = ([col, k, etiqueta, clase]) => {
    const v = o[k] ?? "";
    const nombre = `name="${esc(col)}"`;
    if (clase === "estructura") return `<label>${etiqueta}<select ${nombre}>${opciones([...LISTA_ESTRUCTURA, ...valores(k)], v)}</select></label>`;
    if (clase === "descripcion") return `<label>${etiqueta}<select ${nombre}>${opciones(["OBRA", "COSITIO", ...valores(k)], v)}</select></label>`;
    if (clase === "recepcion") return `<label>${etiqueta}<select ${nombre}>${opciones(["RP", "RD", ...valores(k)], v)}</select></label>`;
    if (clase === "anio") return `<label>${etiqueta}<input ${nombre} type="number" min="1990" max="2100" inputmode="numeric" value="${esc(v)}"></label>`;
    if (clase === "fecha") return `<label>${etiqueta}<input ${nombre} type="date" value="${esc(String(v).slice(0, 10))}"></label>`;
    if (clase === "url") return `<label>${etiqueta}<input ${nombre} type="url" value="${esc(v)}" placeholder="https://drive.google.com/…"></label>`;
    if (clase === "largo") return `<label>${etiqueta}<textarea ${nombre} rows="3">${esc(v)}</textarea></label>`;
    if (clase === "do") return `<label>${etiqueta}<input ${nombre} list="dl-ed-do" autocomplete="off" value="${esc(v)}" placeholder="Ej. G.S."></label>`;
    return `<label>${etiqueta}<input ${nombre} list="dl-ed-${k}" autocomplete="off" value="${esc(v)}"></label>`;
  };
  const campos = CAMPOS_EDITABLES[tipo];
  const dos = [...new Set([...LISTA_DO, ...valores("director_obra").flatMap(partesDO)])].sort();
  cuerpo.innerHTML = `<form class="form form-datos" id="form-datos" novalidate>
      ${campos.map(campo).join("")}
      ${lista("dl-ed-do", dos)}
      ${campos.filter((c) => c[3] === "texto").map((c) => lista(`dl-ed-${c[1]}`, valores(c[1]))).join("")}
      ${tipo === "estructura" ? `<p class="nota" style="margin:0">El fin también se completa solo al tildar el hito de fin de obra.</p>` : ""}
      <p class="error" id="error-datos" hidden></p>
      <div class="dos">
        <button class="boton" type="button" id="cancelar-datos">Cancelar</button>
        <button class="boton boton-primario" type="submit">Guardar</button>
      </div>
    </form>`;
  const f = $("#form-datos");
  f.querySelector("input, select, textarea")?.focus({ preventScroll: true });
  $("#cancelar-datos").onclick = () => pintarFicha(tipo, o, ...ultimaFicha(tipo, o.id));
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    const err = $("#error-datos");
    err.hidden = true;
    const cambios = {};
    for (const [col, k, etiqueta, clase] of campos) {
      const el = f.elements[col];
      let v = el.value.trim();
      if (clase === "url" && v && !/^https?:\/\//i.test(v)) v = "https://" + v;
      if (clase === "anio" && v && !/^\d{4}$/.test(v)) { err.textContent = "El año tiene que tener 4 cifras, por ejemplo 2025."; err.hidden = false; el.focus(); return; }
      const antes = o[k] == null ? "" : String(clase === "fecha" ? String(o[k]).slice(0, 10) : o[k]);
      if (v !== antes) cambios[col] = v === "" ? null : (clase === "anio" ? Number(v) : v);
    }
    if (!Object.keys(cambios).length) return pintarFicha(tipo, o, ...ultimaFicha(tipo, o.id));
    const b = f.querySelector("button[type=submit]");
    b.disabled = true; b.textContent = "Guardando…";
    try {
      await S.api.guardarDatos(tipo, o.id, cambios);
      aviso("Datos guardados");
      await abrirFicha(tipo, o.id);
    } catch (e) {
      err.textContent = /permission|denied|permiso/i.test(e.message)
        ? "La base todavía no deja cambiar algunos de estos datos: corré sql/parte6_editar_datos.sql en Neon y tocá Refresh schema cache."
        : /fetch|network|tiempo/i.test(e.message) ? "Sin conexión: no se guardó. Probá de nuevo cuando tengas señal." : e.message;
      err.hidden = false;
      b.disabled = false; b.textContent = "Guardar";
    }
  };
}
// hitos y cuaderno que se estaban mostrando, para volver a pintar la ficha sin pedirlos de nuevo
function ultimaFicha(tipo, id) {
  const g = fichaGuardada(tipo, id);
  return g ? [g.hitos, g.notas] : [null, null];
}

// ------------------------------------------------------------ mapa base (Gris, Calles, Satélite)
function cambiarBase(nombre) {
  if (!S.base[nombre]) return;
  S.baseNombre = nombre;
  for (const [k, l] of Object.entries(S.base)) k === nombre ? l.addTo(S.mapa) : l.remove();
  $("#mapa").classList.toggle("fondo-oscuro", nombre.startsWith("Gris"));
  guardarEstado();
  if (UI.modo === "ajustes" && !UI.plegado) pintarAjustes();
  pintarMenuBase();
}
// radios de base y control de calles dentro de un contenedor (Ajustes o el menú del botón del mapa)
function enlazarBase(cont) {
  const r = cont.querySelector("input[name=calles]");
  if (r) r.oninput = () => {
    S.callesGris = Number(r.value) / 100;
    S.base["Gris (como QGIS)"].setOpacity(S.callesGris);
    cont.querySelector(".valor-calles").textContent = r.value + "%";
  };
  cont.onchange = (ev) => {
    if (ev.target.name === "base") cambiarBase(ev.target.value);
    if (ev.target.name === "calles") guardarEstado();
  };
}
const ICONO_BASE = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 4v13.5M15 6.5V20" stroke="currentColor" stroke-width="1.8"/></svg>';
function pintarMenuBase() {
  const m = $(".menu-base");
  if (!m) return;
  m.innerHTML = `<p class="ref-titulo">Mapa de fondo</p>
    ${Object.keys(S.base).map((b) => `<label class="opcion-base"><input type="radio" name="base" value="${b}" ${S.baseNombre === b ? "checked" : ""}>
      <span class="muestra muestra-${b === "Satélite" ? "sat" : b === "Calles" ? "calles" : "gris"}"></span>${b === "Gris (como QGIS)" ? "Gris (como QGIS)" : b}</label>`).join("")}
    ${S.baseNombre.startsWith("Gris") ? `<label class="rango">Calles en el fondo gris <span class="valor-calles">${Math.round(S.callesGris * 100)}%</span>
      <input type="range" name="calles" min="0" max="80" step="5" value="${Math.round(S.callesGris * 100)}"></label>` : ""}`;
  enlazarBase(m);
}
function agregarBotonBase() {
  const Ctrl = L.Control.extend({
    options: { position: "topright" },
    onAdd() {
      const div = L.DomUtil.create("div", "leaflet-bar ctrl-base");
      const a = L.DomUtil.create("a", "", div);
      a.href = "#"; a.role = "button"; a.title = "Mapa de fondo"; a.setAttribute("aria-label", "Mapa de fondo"); a.setAttribute("aria-expanded", "false");
      a.innerHTML = ICONO_BASE;
      const menu = L.DomUtil.create("div", "menu-base", div);
      menu.hidden = true;
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.disableScrollPropagation(div);
      const cerrar = () => { menu.hidden = true; a.setAttribute("aria-expanded", "false"); div.classList.remove("activo"); };
      L.DomEvent.on(a, "click", (ev) => {
        L.DomEvent.preventDefault(ev);
        if (!menu.hidden) return cerrar();
        pintarMenuBase();
        menu.hidden = false; a.setAttribute("aria-expanded", "true"); div.classList.add("activo");
      });
      S.mapa.on("click movestart", cerrar);
      document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") cerrar(); });
      return div;
    },
  });
  new Ctrl().addTo(S.mapa);
}

// ------------------------------------------------------------ ajustes (cuenta, mapa y datos guardados)
function pintarAjustes() {
  const rol = editor() ? "Editor" : "Solo lectura";
  $("#cuenta-detalle").textContent = [S.usuario?.email, rol, S.perfil?.iniciales_do ? "D.O. " + S.perfil.iniciales_do : ""].filter(Boolean).join(" · ");
  const m = $("#ajustes-mapa");
  m.innerHTML = `
    <div class="segmentado bases-seg" role="radiogroup" aria-label="Mapa base">${Object.keys(S.base).map((b) =>
      `<label><input type="radio" name="base" value="${b}" ${S.baseNombre === b ? "checked" : ""}> ${b === "Gris (como QGIS)" ? "Gris" : b}</label>`).join("")}</div>
    ${S.baseNombre.startsWith("Gris") ? `<label class="rango">Calles en el fondo gris <span class="valor-calles">${Math.round(S.callesGris * 100)}%</span>
      <input type="range" name="calles" min="0" max="80" step="5" value="${Math.round(S.callesGris * 100)}"></label>` : ""}`;
  enlazarBase(m);
  const fichas = Object.keys(leerJSON(CLAVE_FICHAS) || {}).length;
  $("#ajustes-datos").textContent = S.datosDe
    ? `Datos ${cuandoTexto(S.datosDe)}, con ${fichas} ficha${fichas === 1 ? "" : "s"} guardada${fichas === 1 ? "" : "s"} para ver sin señal.`
    : "Todavía no hay datos guardados.";
}

// Referencias: qué quiere decir cada forma y cada borde (como la leyenda de QGIS).
function referencias() {
  const f = (tp, o, nm) => `<span>${svgForma(forma(tp, o), "#ffffff", "#7a7a7a", forma(tp, o) === "asterisco" ? 16 : 13)}${nm}</span>`;
  return `<div class="referencias" aria-label="Referencias">
    <p class="ref-titulo">Referencias</p>
    <div class="formas">
      ${f("estructura", { estructura: "MÁSTIL" }, "Mástil")}${f("estructura", { estructura: "MONOPOLO" }, "Monopolo")}
      ${f("obra", { descripcion: "OBRA" }, "Obra")}${f("obra", { descripcion: "COSITIO" }, "Cositio")}
    </div>
    <div class="formas">
      <span>${svgForma("circulo", "#f2d024", "#e0c200", 17, 1.8)}Borde amarillo: espera recepción</span>
      <span>${svgForma("circulo", "#838383", "#1a1a1a", 13)}Gris: terminada</span>
    </div>
    <p class="nota" style="margin:4px 0 0">El color es la etapa: blanco proyecto, celeste aprobado, rojo hormigonado, amarillo montaje, verde infraestructura.</p>
  </div>`;
}

// ------------------------------------------------------------ capas de utilidad
function pintarUtilidad() {
  const u = $("#panel-utilidad");
  const linea = '<svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true"><path d="M1 9 6 3l5 5 6-6" fill="none" stroke="#9a9a9a" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  u.innerHTML = `<div class="arbol-grupo">
      <div class="nodo-capa">
        <span class="sim">${svgRelev(11)}</span>
        <label><input type="checkbox" data-relev ${S.capaOn.relev ? "checked" : ""}> Relevamiento</label>
        <span class="n">${relevFiltrados().length}</span>
      </div>
      ${S.relevFalta ? `<p class="nota" style="margin:2px 0 6px 26px">Todavía no se puede leer desde la web: hay que correr sql/parte5_relevamiento.sql en Neon.</p>`
        : `<p class="nota" style="margin:0 0 6px 26px">Puntos tomados con el GPS, con su Z. Se agregan desde + Punto nuevo.</p>`}
      <div class="nodo-capa">
        <span class="sim">${linea}</span>
        <label><input type="checkbox" name="deptos" ${S.deptosOn ? "checked" : ""}> Límites de departamentos</label>
        <span class="n">19</span>
      </div>
    </div>`;
  u.onchange = (ev) => {
    const el = ev.target;
    if ("relev" in el.dataset) { S.capaOn.relev = el.checked; pintar(); }
    if (el.name === "deptos") { S.deptosOn = el.checked; el.checked ? S.deptos.addTo(S.mapa) : S.deptos.remove(); guardarEstado(); }
  };
}

// ------------------------------------------------------------ filtros
function pintarFiltros() {
  const vals = (fn) => [...new Set(todas().flatMap((x) => fn(x)).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "es", { numeric: true }));
  const opciones = (lista, actual, todos) => `<option value="">${todos}</option>` +
    lista.map((v) => `<option ${String(v) === actual ? "selected" : ""}>${esc(v)}</option>`).join("");
  const directores = vals((x) => partesDO(x.o.director_obra));
  const p = $("#panel-filtros");
  p.innerHTML = `<form class="form filtros" id="form-filtros">
    ${S.perfil.iniciales_do ? `<label class="interruptor-fila"><input type="checkbox" name="mias" ${S.f.mias ? "checked" : ""}>
      <span><b>Mis obras</b><br><small>Solo donde el director de obra es ${esc(S.perfil.iniciales_do)}</small></span></label>` : ""}
    <label>Buscar<input type="search" name="texto" value="${esc(S.f.texto)}" placeholder="Código, localidad, licitación o tarea"></label>
    <label>Director de obra<select name="director">${opciones(directores, S.f.director, "Todos")}</select></label>
    <label>Licitación<select name="licitacion">${opciones(vals((x) => [x.o.licitacion]), S.f.licitacion, "Todas")}</select></label>
    <label>Tipo de estructura<select name="estructura">
      <option value="">Todos</option>
      <option value="triangulo" ${S.f.estructura === "triangulo" ? "selected" : ""}>Mástil</option>
      <option value="circulo" ${S.f.estructura === "circulo" ? "selected" : ""}>Monopolo</option></select></label>
    <label>Año<select name="anio">${opciones(vals((x) => [x.o.anio]), S.f.anio, "Todos")}</select></label>
    <button class="boton" type="button" id="limpiar-filtros" ${filtrosActivos() ? "" : "disabled"}>Quitar filtros</button>
    <p class="nota">Los filtros se aplican a todas las capas del mapa y a la lista.</p>
  </form>`;
  const form = $("#form-filtros");
  const leer = () => {
    S.f = { mias: !!form.mias?.checked, texto: form.texto.value, director: form.director.value,
      licitacion: form.licitacion.value, estructura: form.estructura.value, anio: form.anio.value };
    S.primeraVez = true;
    pintar(false);
    $("#limpiar-filtros").disabled = !filtrosActivos();
  };
  form.onchange = leer;
  form.texto.oninput = leer;
  $("#limpiar-filtros").onclick = () => {
    S.f = { mias: false, texto: "", director: "", licitacion: "", estructura: "", anio: "" };
    pintar();
  };
}

function pintarLista(v) {
  $("#resumen-lista").textContent = `${v.length} ${v.length === 1 ? "obra visible" : "obras visibles"}` +
    (filtrosActivos() ? `, con ${filtrosActivos()} filtro${filtrosActivos() > 1 ? "s" : ""}` : "");
  const lista = $("#lista");
  lista.innerHTML = v.length ? v.map((x) => filaHtml(x)).join("")
    : `<li class="vacio">Ninguna obra coincide. Revisá las capas prendidas y los filtros.</li>`;
  enlazarFilas(lista);
}

function pintarPanel(rehacerFiltros = true) {
  const v = visibles();
  $("#cuenta-lista").textContent = v.length;
  $("#cuenta-filtros").textContent = filtrosActivos() || "";
  if (S.tab === "capas") pintarCapas();
  if (S.tab === "filtros" && rehacerFiltros) pintarFiltros();
  if (S.tab === "lista") pintarLista(v);
  if (S.tab === "venc") pintarVencimientos();
  if (UI.modo === "ajustes") pintarAjustes();
  if (UI.modo === "utilidad") pintarUtilidad();
  return v;
}

function pintar(rehacerFiltros = true) {
  guardarEstado();
  pintarMapa(pintarPanel(rehacerFiltros));
}

function filaHtml({ tipo, o, cat }, eti = "") {
  const c = CAT[cat];
  const sub = tipo === "estructura"
    ? [o.estructura, o.licitacion, o.director_obra].filter(Boolean).join(", ")
    : [o.sala, o.localidad, o.director_obra].filter(Boolean).join(", ");
  const actual = S.abierta && S.abierta.tipo === tipo && S.abierta.id === o.id;
  return `<li class="fila" tabindex="0" data-tipo="${tipo}" data-id="${o.id}" aria-current="${actual}">
    <span class="sim">${simbolo(tipo, o, cat, 0.95)}</span>
    <span class="cod">${esc(o.codigo)}</span>
    <span class="eti">${eti || esc(c.nombre)}</span>
    <span class="sub">${esc(sub) || (tipo === "obra" ? "Obra" : "Estructura")}</span></li>`;
}

function enlazarFilas(cont) {
  cont.querySelectorAll(".fila").forEach((li) => {
    const abrir = () => abrirFicha(li.dataset.tipo, Number(li.dataset.id));
    li.onclick = abrir;
    li.onkeydown = (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); abrir(); } };
  });
}

function pintarVencimientos() {
  const base = [];
  for (const x of todas()) if (pasaFiltros(x.tipo, x.o)) base.push(x);
  const rec = base.filter((x) => x.tipo === "estructura" && CAT[x.cat].recepcion && x.o.dias_para_recepcion != null)
    .sort((a, b) => a.o.dias_para_recepcion - b.o.dias_para_recepcion);
  const hit = base.filter((x) => x.o.proximo_vencimiento).sort((a, b) => a.o.proximo_vencimiento.localeCompare(b.o.proximo_vencimiento));
  const dias = (d) => (d < 0 ? `vencida hace ${-d} d` : d === 0 ? "vence hoy" : `faltan ${d} d`);
  const cont = $("#vencimientos");
  cont.className = "venc";
  const aviso = filtrosActivos() ? `<p class="resumen">Con ${filtrosActivos()} filtro${filtrosActivos() > 1 ? "s" : ""} activo${filtrosActivos() > 1 ? "s" : ""}.</p>` : "";
  cont.innerHTML = `${aviso}
    <h3>Recepciones vencidas y de los próximos 6 meses</h3>
    <ol class="lista">${rec.length ? rec.map((x) => filaHtml(x, `<span class="${x.o.dias_para_recepcion < 0 ? "mal" : ""}">${dias(x.o.dias_para_recepcion)}</span>`)).join("")
      : `<li class="vacio">No hay recepciones vencidas ni que venzan en los próximos 6 meses.</li>`}</ol>
    <h3>Hitos con fecha o recordatorio</h3>
    <ol class="lista">${hit.length ? hit.map((x) => {
      const d = Math.round((new Date(x.o.proximo_vencimiento + "T12:00:00") - new Date(hoy() + "T12:00:00")) / 864e5);
      return filaHtml(x, `<span class="${d < 0 ? "mal" : ""}">${fecha(x.o.proximo_vencimiento)}</span>`);
    }).join("") : `<li class="vacio">Ningún hito tiene fecha prevista ni recordatorio. Cargalos en la ficha de cada obra.</li>`}</ol>`;
  cont.querySelectorAll(".eti span.mal").forEach((s) => s.parentElement.classList.add("mal"));
  enlazarFilas(cont);
}

// ------------------------------------------------------------ mapa
function prepararMapa() {
  if (S.mapa) return;
  S.mapa = L.map("mapa", { zoomControl: false, attributionControl: true, maxZoom: 21 }).setView([-32.6, -56.0], 7);
  agregarBotonesPaneles();
  L.control.zoom({ position: "topright", zoomInTitle: "Acercar", zoomOutTitle: "Alejar" }).addTo(S.mapa);
  agregarBotonUbicacion();
  agregarBotonMedir();
  leerEstado();
  const vista = leerJSON(CLAVE_VISTA);
  if (vista?.centro && vista.zoom) { S.mapa.setView(vista.centro, vista.zoom, { animate: false }); S.primeraVez = false; }
  S.mapa.on("moveend", () => {
    const c = S.mapa.getCenter();
    escribirJSON(CLAVE_VISTA, { ...(leerJSON(CLAVE_VISTA) || {}), centro: [c.lat, c.lng], zoom: S.mapa.getZoom() });
  });
  // Gris como QGIS: calles en escala de grises invertida, muy atenuadas sobre el gris #212121.
  S.base["Gris (como QGIS)"] = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 21, maxNativeZoom: 19, attribution: "© OpenStreetMap", className: "tiles-gris", opacity: S.callesGris, crossOrigin: "anonymous" });
  S.base["Calles"] = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 21, maxNativeZoom: 19, attribution: "© OpenStreetMap", crossOrigin: "anonymous" });
  S.base["Satélite"] = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 21, maxNativeZoom: 18, attribution: "Imágenes © Esri", crossOrigin: "anonymous" });
  if (!S.base[S.baseNombre]) S.baseNombre = "Gris (como QGIS)";
  agregarBotonBase();
  S.base[S.baseNombre].addTo(S.mapa);
  $("#mapa").classList.toggle("fondo-oscuro", S.baseNombre.startsWith("Gris"));
  // Departamentos va de fondo: su panel queda debajo de los símbolos (que van en markerPane, 600).
  const panel = S.mapa.createPane("deptos");
  panel.style.zIndex = 350;
  panel.style.pointerEvents = "none";
  S.deptos = L.layerGroup();
  if (S.deptosOn) S.deptos.addTo(S.mapa);
  fetch("datos/departamentos.geojson").then((r) => r.json()).then((gj) => {
    S.deptosGeo = gj;
    L.geoJSON(gj, {
      pane: "deptos", interactive: false, pointToLayer: () => null,
      style: { color: "#626262", weight: 1, fill: false },
      onEachFeature: (f, capa) => {
        const nombre = String(f.properties.nombre || "").toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
        L.marker(capa.getBounds().getCenter(), { pane: "deptos", interactive: false, keyboard: false,
          icon: L.divIcon({ className: "depto-nombre", html: `<span>${esc(nombre)}</span>`, iconSize: [0, 0] }) }).addTo(S.deptos);
      },
    }).addTo(S.deptos);
  }).catch(() => {});
  const lejos = () => $("#mapa").classList.toggle("lejos", S.mapa.getZoom() < 8);
  S.mapa.on("zoomend", lejos); lejos();
}

function icono(tipo, o, cat) {
  const c = CAT[cat];
  const activo = S.abierta && S.abierta.tipo === tipo && S.abierta.id === o.id;
  const grande = c.recepcion || forma(tipo, o) === "asterisco";
  const px = grande ? 18 : 13;
  return L.divIcon({
    className: `mk${activo ? " activo" : ""}`,
    html: `${simbolo(tipo, o, cat)}<span style="left:${px + 3}px">${esc(o.codigo)}</span>`,
    iconSize: [px, px], iconAnchor: [px / 2, px / 2],
  });
}

function pintarMapa(v) {
  for (const m of S.marcadores.values()) m.remove();
  S.marcadores.clear();
  const puntos = [];
  for (const x of v) {
    if (x.o.lat == null || x.o.lon == null) continue;
    const m = L.marker([x.o.lat, x.o.lon], { icon: icono(x.tipo, x.o, x.cat), title: `${x.o.codigo}: ${CAT[x.cat].nombre}`, keyboard: false })
      .on("click", (ev) => (MED.activo ? agregarMedida(ev.target.getLatLng()) : abrirFicha(x.tipo, x.o.id))).addTo(S.mapa);
    S.marcadores.set(`${x.tipo}:${x.o.id}`, m);
    puntos.push([x.o.lat, x.o.lon]);
  }
  for (const r of relevFiltrados()) {
    if (!S.capaOn.relev || r.lat == null || r.lon == null) continue;
    const m = L.marker([r.lat, r.lon], { icon: iconoRelev(r), title: `${r.codigo || "Punto"}: relevamiento`, keyboard: false, zIndexOffset: -500 })
      .on("click", (ev) => (MED.activo ? agregarMedida(ev.target.getLatLng()) : abrirRelev(r.id))).addTo(S.mapa);
    S.marcadores.set(`relev:${r.id}`, m);
  }
  if (S.primeraVez && puntos.length) {
    S.mapa.fitBounds(puntos, { padding: [30, 30], maxZoom: 11 });
    S.primeraVez = false;
  }
}

// ------------------------------------------------------------ ficha
// Planos, Google Maps y Waze en una fila (mismos enlaces que arma QGIS).
const ICONO = {
  planos: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.6l2 2.2h8.4A1.5 1.5 0 0 1 21 8.7v9.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  maps: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.5s-6.5-6.2-6.5-11.3a6.5 6.5 0 0 1 13 0c0 5.1-6.5 11.3-6.5 11.3z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="10.2" r="2.4" fill="currentColor"/></svg>',
  waze: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 20 20.5 12 16.3 4 20.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
  copiar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8.5" y="8.5" width="11.5" height="11.5" rx="1.8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M15.5 5.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h.5" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
};
function atajo(href, icono, texto) {
  return href
    ? `<a class="atajo" href="${esc(href)}" target="_blank" rel="noopener">${ICONO[icono]}<span>${texto}</span></a>`
    : `<span class="atajo apagado" title="Sin ${texto.toLowerCase()} cargados">${ICONO[icono]}<span>${texto}</span></span>`;
}

const barraCerrar = (texto) => `<div class="cabeza-acciones">
  <button type="button" class="volver"><span aria-hidden="true">‹</span> ${texto}</button>
  <button type="button" class="cerrar" aria-label="Cerrar" title="Cerrar">✕</button></div>`;
function enlazarCerrar(cont, fn) {
  cont.querySelectorAll(".volver, .cerrar").forEach((b) => (b.onclick = fn));
}
async function abrirFicha(tipo, id) {
  S.abierta = { tipo, id };
  const ficha = $("#ficha");
  ficha.hidden = false;
  const g = fichaGuardada(tipo, id);
  const base = S.datos[tipo].find((x) => x.id === id);
  if (g) pintarFicha(tipo, g.o, g.hitos, g.notas);
  else {
    ficha.innerHTML = `<div class="ficha-cabeza">${barraCerrar("Volver a la lista")}<p class="tipo-obra">Cargando…</p></div>`;
    enlazarCerrar(ficha, cerrarFicha);
  }
  pintar();
  const m = S.marcadores.get(`${tipo}:${id}`);
  if (m && window.innerWidth > 760) S.mapa.panTo(m.getLatLng());
  const sigue = () => S.abierta && S.abierta.tipo === tipo && S.abierta.id === id;
  try {
    if (!S.api) throw new Error("Failed to fetch");
    const [o, hitos, notas] = await conTiempo(Promise.all([S.api.una(tipo, id), S.api.hitos(tipo, id), S.api.cuaderno(tipo, id)]), 20000);
    const lista = S.datos[tipo];
    const i = lista.findIndex((x) => x.id === id);
    if (i >= 0) { lista[i] = o; guardarDatos(); }
    guardarFicha(tipo, id, o, hitos || [], notas || []);
    if (!sigue()) return;
    if (g && JSON.stringify([g.o, g.hitos, g.notas]) === JSON.stringify([o, hitos || [], notas || []])) return;
    // se repinta sin perder lo que estabas escribiendo en el cuaderno
    const borrador = $("#form-nota textarea", ficha)?.value, alto = ficha.scrollTop;
    pintarFicha(tipo, o, hitos || [], notas || []);
    if (borrador) $("#form-nota textarea", ficha).value = borrador;
    ficha.scrollTop = alto;
  } catch (e) {
    if (!sigue()) return;
    if (sinRed(e)) {
      if (!g && base) pintarFicha(tipo, base, null, null);
      estadoDatos("sinred");
    } else aviso("No se pudo abrir la obra: " + e.message, true);
  }
}

function cerrarFicha() {
  S.abierta = null;
  $("#ficha").hidden = true;
  pintar();
}

function pintarFicha(tipo, o, hitos, notas) {
  const cat = categoria(tipo, o), c = CAT[cat];
  const pasos = ESCALERA[tipo];
  const clave = ["r6", "r3", "vencida", "plazo", "sinfecha"].includes(cat) ? "recepcion" : cat === "terminada" ? "terminada" : cat;
  const pos = Math.max(0, pasos.indexOf(clave));
  const tramos = pasos.map((p, i) => {
    const col = CAT[p]?.color || c.color;
    const cls = i < pos ? "tramo hecho" : i === pos ? "tramo actual" : "tramo";
    return `<span class="${cls}" style="--c:${i === pos ? c.color : col}" title="${esc(CAT[p]?.nombre || NOMBRE_TRAMO[p])}"></span>`;
  }).join("");
  const detalle = tipo === "estructura" && (c.recepcion || cat === "plazo") && o.dias_para_recepcion != null
    ? (o.dias_para_recepcion < 0 ? `vencida hace ${-o.dias_para_recepcion} días` : `vence el ${fecha(o.vence_recepcion)}`) : "";

  const datos = tipo === "estructura"
    ? [["Estructura", o.estructura], ["Licitación", o.licitacion], ["Año", o.anio], ["Director de obra", o.director_obra],
       ["Inicio", fecha(o.fecha_inicio)], ["Fin", fecha(o.fecha_fin)], ["Recepción", o.recepcion || "—"],
       ["Observaciones", o.observaciones]]
    : [["Sala", o.sala], ["Localidad", o.localidad], ["Departamento", o.departamento], ["Licitación", o.licitacion],
       ["Tarea", o.tarea], ["Descripción", o.descripcion], ["Director de obra", o.director_obra]];
  const boton = atajo;
  const enlaces = `<div class="atajos">
      ${boton(o.planos, "planos", "Planos")}
      ${boton(o.lat != null ? `https://www.google.com/maps/dir/?api=1&destination=${o.lat}%2C${o.lon}&travelmode=driving` : "", "maps", "Maps")}
      ${boton(o.lat != null ? `https://waze.com/ul?ll=${o.lat},${o.lon}&navigate=yes` : "", "waze", "Waze")}
    </div>`;

  const opciones = [["PROY", "Proyecto"], ["CONS", "En obra"], ["FIN", "Terminada"]]
    .map(([v, n]) => `<option value="${v}" ${o.estado === v ? "selected" : ""}>${n}</option>`).join("");

  const ficha = $("#ficha");
  ficha.innerHTML = `
    <div class="ficha-cabeza">
      ${barraCerrar("Volver a la lista")}
      <p class="codigo">${esc(o.codigo)}</p>
      <p class="tipo-obra">${tipo === "estructura" ? "Estructura" : "Obra"}${o.localidad ? ", " + esc(o.localidad) : ""}</p>
      <div class="escalera" aria-hidden="true">${tramos}</div>
      <p class="etapa-actual">${simbolo(tipo, o, cat)}${esc(c.nombre)} <small>${esc(detalle)}</small></p>
      ${enlaces}
    </div>

    <div class="ficha-bloque">
      <h2>Hitos</h2>
      ${hitos == null ? `<p class="nota">Sin conexión: los hitos se ven cuando vuelva la señal.</p>`
        : hitos.length ? hitos.map((h) => hitoHtml(h)).join("") : `<p class="nota">Esta obra no tiene hitos cargados.</p>`}
      ${editor() ? "" : `<p class="nota">Tu usuario es de solo lectura.</p>`}
    </div>

    <div class="ficha-bloque">
      <h2>Cuaderno de obra</h2>
      ${editor() ? `<form class="form form-nota" id="form-nota">
        <label>Fecha<input type="date" name="fecha" value="${hoy()}" required></label>
        <label>Tipo<select name="tipo">${["NOTA", "VISITA", "PROBLEMA", "PEDIDO", "ACTA"].map((t) => `<option value="${t}">${t[0] + t.slice(1).toLowerCase()}</option>`).join("")}</select></label>
        <textarea name="texto" required placeholder="Qué pasó, qué se resolvió o qué falta" aria-label="Texto de la entrada"></textarea>
        <button class="boton boton-primario" type="submit">Agregar al cuaderno</button>
      </form>` : ""}
      ${notas == null ? `<p class="nota">Sin conexión: el cuaderno se ve cuando vuelva la señal.</p>` : notas.length ? notas.map((n) => `<div class="entrada"><div class="meta"><b>${fecha(n.fecha)}</b><span>${esc(n.tipo[0] + n.tipo.slice(1).toLowerCase())}</span><span>${esc(n.autor || "")}</span></div><p>${esc(n.texto)}</p></div>`).join("")
        : `<p class="nota">Todavía no hay entradas. ${editor() ? "Escribí la primera arriba." : ""}</p>`}
    </div>

    <div class="ficha-bloque">
      <div class="bloque-titulo"><h2>Datos</h2>
        ${editor() ? `<button type="button" class="lapiz" id="editar-datos" aria-label="Editar datos" title="Editar datos"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m13.5 6.5 4 4" stroke="currentColor" stroke-width="1.8"/></svg></button>` : ""}</div>
      <div id="datos-cuerpo"><dl class="datos">${datos.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v ?? "—") || "—"}</dd>`).join("")}</dl></div>
      ${editor() ? `<label class="form" style="margin-top:10px">Situación
        <select id="cambiar-estado">${opciones}</select></label>
        <p class="nota" style="margin-top:6px">Pasá a "En obra" cuando arranca. El fin se marca con su hito.</p>` : ""}
    </div>`;

  enlazarCerrar(ficha, cerrarFicha);
  ficha.querySelectorAll(".hito").forEach((row) => enlazarHito(row, tipo, o.id));
  const fn = $("#form-nota", ficha);
  if (fn) fn.onsubmit = async (ev) => {
    ev.preventDefault();
    const b = fn.querySelector("button"); b.disabled = true;
    try {
      await S.api.agregarNota(tipo, o.id, { fecha: fn.fecha.value, tipo: fn.tipo.value, texto: fn.texto.value.trim(), autor: S.perfil.nombre });
      aviso("Entrada agregada al cuaderno");
      await abrirFicha(tipo, o.id);
    } catch (e) { aviso(e.message, true); b.disabled = false; }
  };
  const ed = $("#editar-datos", ficha);
  if (ed) ed.onclick = () => editarDatos(tipo, o);
  const ce = $("#cambiar-estado", ficha);
  if (ce) ce.onchange = async () => {
    try {
      await S.api.cambiarEstado(tipo, o.id, ce.value);
      aviso("Situación actualizada");
      await abrirFicha(tipo, o.id);
    } catch (e) { aviso(e.message, true); }
  };
}

function hitoHtml(h) {
  const hecho = h.estado === "HECHO";
  const dis = editor() ? "" : "disabled";
  return `<div class="hito${hecho ? " hecho" : ""}" data-id="${h.id}">
    <input type="checkbox" ${hecho ? "checked" : ""} ${dis} aria-label="${esc(h.nombre)} hecho">
    <span class="nom">${esc(h.nombre)}</span>
    ${hecho ? `<input type="date" value="${h.fecha_real || ""}" ${dis} aria-label="Fecha de ${esc(h.nombre)}">`
      : `<span class="pend">${h.estado === "PENDIENTE" ? (h.fecha_prevista ? "prevista " + fecha(h.fecha_prevista) : "pendiente") : esc(h.estado.toLowerCase())}</span>`}
  </div>`;
}

function enlazarHito(row, tipo, obraId) {
  const id = Number(row.dataset.id);
  const chk = row.querySelector("input[type=checkbox]");
  const fec = row.querySelector("input[type=date]");
  const guardar = async (cambios, texto) => {
    chk.disabled = true;
    try {
      await S.api.marcarHito(id, cambios);
      aviso(texto);
      await abrirFicha(tipo, obraId);
    } catch (e) { aviso(e.message, true); chk.disabled = false; }
  };
  chk.onchange = () => chk.checked
    ? guardar({ estado: "HECHO", fecha_real: hoy() }, "Hito marcado como hecho")
    : guardar({ estado: "PENDIENTE", fecha_real: null }, "Hito vuelto a pendiente");
  if (fec) fec.onchange = () => fec.value && guardar({ fecha_real: fec.value }, "Fecha del hito guardada");
}

// ------------------------------------------------------------ usuarios (solo administradores)
async function abrirAdmin() {
  const caja = $("#admin");
  caja.hidden = false;
  caja.innerHTML = `<div class="ficha-cabeza">${barraCerrar("Volver al mapa")}<h2 class="admin-titulo">Usuarios</h2></div><p class="nota" style="padding:0 16px">Cargando…</p>`;
  enlazarCerrar(caja, () => { caja.hidden = true; });
  let cuentas;
  try { cuentas = await S.api.adminUsuarios(); }
  catch (e) {
    caja.querySelector(".nota").textContent = /admin_usuarios|function|schema cache/i.test(e.message)
      ? "Falta preparar la base para administrar usuarios: corré sql/parte3_admin_usuarios.sql en Neon y tocá Refresh schema cache en la Data API."
      : e.message;
    return;
  }
  const dirs = [...new Set(todas().flatMap((x) => partesDO(x.o.director_obra)))].sort();
  const pend = cuentas.filter((c) => !c.habilitado), con = cuentas.filter((c) => c.habilitado);
  const rolSel = (r) => `<select name="rol"><option value="EDITOR" ${r === "EDITOR" ? "selected" : ""}>Editor</option><option value="LECTOR" ${r === "LECTOR" ? "selected" : ""}>Solo lectura</option></select>`;
  const reg = (c) => (c.registrado ? "se registró el " + fecha(String(c.registrado).slice(0, 10)) : "");
  caja.innerHTML = `<div class="ficha-cabeza">${barraCerrar("Volver al mapa")}<h2 class="admin-titulo">Usuarios</h2>
      <p class="nota">Quien se registra en la web aparece acá. Habilitalo para que vea las obras.</p></div>
    <datalist id="lista-do">${dirs.map((d) => `<option value="${esc(d)}">`).join("")}</datalist>
    <div class="ficha-bloque">
      <h2>Esperando habilitación <span class="cuenta">${pend.length || ""}</span></h2>
      ${pend.length ? pend.map((c) => `<form class="form cuenta-form" data-id="${esc(c.user_id)}">
          <p class="cuenta-mail"><b>${esc(c.email)}</b><br><small>${esc(c.nombre_cuenta || "")} ${reg(c)}</small></p>
          <label>Nombre<input name="nombre" value="${esc(c.nombre_cuenta || "")}" required></label>
          <div class="dos"><label>Permiso${rolSel("EDITOR")}</label>
          <label>Iniciales D.O.<input name="ini" list="lista-do" placeholder="G.S."></label></div>
          <button class="boton boton-primario" type="submit">Habilitar</button>
        </form>`).join("") : `<p class="nota">No hay cuentas nuevas. Cuando alguien use "Crear cuenta" en la web, va a aparecer acá.</p>`}
    </div>
    <div class="ficha-bloque">
      <h2>Con acceso <span class="cuenta">${con.length}</span></h2>
      ${con.map((c) => `<form class="form cuenta-form" data-id="${esc(c.user_id)}">
          <p class="cuenta-mail"><b>${esc(c.nombre)}</b>${c.admin ? ' <span class="etiqueta">administrador</span>' : ""}<br><small>${esc(c.email)}</small></p>
          <input type="hidden" name="nombre" value="${esc(c.nombre)}">
          <div class="dos"><label>Permiso${rolSel(c.rol)}</label>
          <label>Iniciales D.O.<input name="ini" list="lista-do" value="${esc(c.iniciales_do || "")}"></label></div>
          <div class="acciones"><button class="boton" type="submit">Guardar cambios</button>
          ${c.user_id === S.perfil.user_id ? "" : `<button class="boton boton-peligro" type="button" data-quitar>Quitar acceso</button>`}</div>
        </form>`).join("")}
    </div>`;
  enlazarCerrar(caja, () => { caja.hidden = true; });
  caja.querySelectorAll(".cuenta-form").forEach((f) => {
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      f.querySelectorAll("button").forEach((b) => (b.disabled = true));
      try {
        await S.api.adminHabilitar(f.dataset.id, f.nombre.value.trim(), f.rol.value, f.ini.value.trim());
        aviso(f.closest(".ficha-bloque").querySelector("h2").textContent.startsWith("Esperando") ? `${f.nombre.value} habilitado` : "Cambios guardados");
        if (f.dataset.id === S.perfil.user_id) S.perfil = await S.api.perfil();
        abrirAdmin();
      } catch (e) { aviso(e.message, true); f.querySelectorAll("button").forEach((b) => (b.disabled = false)); }
    };
    const q = f.querySelector("[data-quitar]");
    if (q) q.onclick = async () => {
      if (!confirm(`¿Quitarle el acceso a ${f.nombre.value}? Su cuenta sigue existiendo y la podés volver a habilitar.`)) return;
      try { await S.api.adminQuitar(f.dataset.id); aviso("Acceso quitado"); abrirAdmin(); }
      catch (e) { aviso(e.message, true); }
    };
  });
}

// ------------------------------------------------------------ instalar como app
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
let pedidoInstalar = null;
window.addEventListener("beforeinstallprompt", (ev) => {
  ev.preventDefault();
  pedidoInstalar = ev;
  $("#instalar").hidden = false;
});
$("#instalar").onclick = async () => {
  if (!pedidoInstalar) return;
  pedidoInstalar.prompt();
  await pedidoInstalar.userChoice;
  pedidoInstalar = null;
  $("#instalar").hidden = true;
};
window.addEventListener("appinstalled", () => { $("#instalar").hidden = true; aviso("App instalada"); });

// ------------------------------------------------------------ panel: tamaño y minimizar
// PC: arrastrar el borde derecho cambia el ancho; "‹" lo oculta.
// Celular: arrastrar la agarradera de arriba cambia el alto; tocarla o "▾" lo minimiza.
const CLAVE_UI = "obras-oici-panel-v1";
const movil = matchMedia("(max-width: 760px)");
const UI = { ancho: 380, alto: Math.round(innerHeight * 0.45), plegado: false, modo: "capas" };
try { Object.assign(UI, JSON.parse(localStorage.getItem(CLAVE_UI) || "{}")); } catch (e) { /* valores de siempre */ }
const guardarUI = () => { try { localStorage.setItem(CLAVE_UI, JSON.stringify(UI)); } catch (e) { /* sin almacenamiento */ } };
const HOJA_MIN = 70;

function aplicarUI() {
  const raiz = document.documentElement.style;
  const app = $("#vista-app");
  UI.ancho = Math.min(Math.max(UI.ancho, 280), Math.min(680, innerWidth - 200));
  UI.alto = Math.min(Math.max(UI.alto, HOJA_MIN + 60), innerHeight - 90);
  raiz.setProperty("--panel", UI.ancho + "px");
  raiz.setProperty("--panel-ancho", movil.matches ? "100%" : UI.ancho + "px");
  raiz.setProperty("--hoja", UI.alto + "px");
  app.classList.toggle("plegado", UI.plegado);
  if (!["capas", "utilidad", "ajustes"].includes(UI.modo)) UI.modo = "capas";
  const otro = UI.modo !== "capas";
  $("#pestanas").hidden = otro;
  $("#titulo-panel").hidden = !otro;
  $("#titulo-panel").textContent = UI.modo === "ajustes" ? "Ajustes" : "Capas de utilidad";
  document.querySelectorAll("[data-panel]").forEach((d) => (d.hidden = d.dataset.panel !== (otro ? UI.modo : S.tab)));
  document.querySelectorAll(".ctrl-paneles a").forEach((a) => {
    const on = !UI.plegado && a.dataset.modo === UI.modo;
    a.classList.toggle("activo", on);
    a.setAttribute("aria-pressed", on);
  });
  const b = $("#plegar-panel");
  b.textContent = "✕";
  b.setAttribute("aria-label", "Cerrar panel");
  b.title = b.getAttribute("aria-label");
  $("#abrir-panel").hidden = true;
  setTimeout(() => S.mapa && S.mapa.invalidateSize(), 220);
}

function plegar(v) { UI.plegado = v; guardarUI(); aplicarUI(); }

// Botones a la izquierda del mapa: abren y cierran el panel de Capas o el de Ajustes.
function abrirModo(modo) {
  if (!UI.plegado && UI.modo === modo) return plegar(true);
  UI.modo = modo;
  UI.plegado = false;
  guardarUI(); aplicarUI();
  if (modo === "ajustes") pintarAjustes(); else if (modo === "utilidad") pintarUtilidad(); else pintarPanel();
}
function agregarBotonesPaneles() {
  const ICONOS = {
    utilidad: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 21s-6-5.6-6-10.4a6 6 0 0 1 12 0C18 15.4 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9.2 10.6h5.6M12 7.8v5.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    capas: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 3.5 21 8l-9 4.5L3 8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m3 12 9 4.5 9-4.5M3 16l9 4.5 9-4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    ajustes: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M10.3 2.8h3.4l.5 2.6 1.6.9 2.5-.9 1.7 2.9-2 1.8v1.8l2 1.8-1.7 2.9-2.5-.9-1.6.9-.5 2.6h-3.4l-.5-2.6-1.6-.9-2.5.9-1.7-2.9 2-1.8v-1.8l-2-1.8 1.7-2.9 2.5.9 1.6-.9z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.8" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
  };
  const Ctrl = L.Control.extend({
    options: { position: "topleft" },
    onAdd() {
      const div = L.DomUtil.create("div", "leaflet-bar ctrl-paneles");
      for (const [modo, titulo] of [["capas", "Capas de obra: capas, filtros, lista y vencimientos"], ["utilidad", "Capas de utilidad: relevamiento y departamentos"], ["ajustes", "Ajustes: cuenta, mapa y datos guardados"]]) {
        const a = L.DomUtil.create("a", "", div);
        a.href = "#"; a.role = "button"; a.dataset.modo = modo; a.title = titulo; a.setAttribute("aria-label", titulo);
        a.innerHTML = ICONOS[modo];
        L.DomEvent.on(a, "click", (ev) => { L.DomEvent.preventDefault(ev); abrirModo(modo); });
      }
      L.DomEvent.disableClickPropagation(div);
      return div;
    },
  });
  new Ctrl().addTo(S.mapa);
}

function prepararPanel() {
  const asa = $("#asa"), panel = $("#panel");
  $("#plegar-panel").onclick = () => plegar(!UI.plegado);
  $("#abrir-panel").onclick = () => plegar(false);
  let inicio = null;
  asa.onpointerdown = (ev) => {
    inicio = { x: ev.clientX, y: ev.clientY, movio: false };
    asa.setPointerCapture(ev.pointerId);
    asa.classList.add("arrastrando"); panel.classList.add("arrastrando");
  };
  asa.onpointermove = (ev) => {
    if (!inicio) return;
    if (Math.abs(ev.clientX - inicio.x) + Math.abs(ev.clientY - inicio.y) > 4) inicio.movio = true;
    if (!inicio.movio) return;
    if (movil.matches) {
      const alto = innerHeight - ev.clientY;
      if (alto < HOJA_MIN + 30) { UI.plegado = true; } else { UI.plegado = false; UI.alto = alto; }
    } else {
      UI.ancho = ev.clientX;
      UI.plegado = false;
    }
    aplicarUI();
  };
  const soltar = () => {
    if (!inicio) return;
    if (!inicio.movio && movil.matches) UI.plegado = !UI.plegado;
    inicio = null;
    asa.classList.remove("arrastrando"); panel.classList.remove("arrastrando");
    guardarUI(); aplicarUI();
  };
  asa.onpointerup = soltar;
  asa.onpointercancel = soltar;
  asa.onkeydown = (ev) => {
    const paso = ev.shiftKey ? 60 : 20;
    if (movil.matches) {
      if (ev.key === "ArrowUp") UI.alto += paso; else if (ev.key === "ArrowDown") UI.alto -= paso; else return;
    } else {
      if (ev.key === "ArrowRight") UI.ancho += paso; else if (ev.key === "ArrowLeft") UI.ancho -= paso; else return;
    }
    ev.preventDefault(); UI.plegado = false; guardarUI(); aplicarUI();
  };
  movil.addEventListener("change", aplicarUI);
  addEventListener("resize", aplicarUI);
  aplicarUI();
}

// ------------------------------------------------------------ punto nuevo
// Listas del proyecto de QGIS (se suman los valores que ya existen en las capas).
const LISTA_ESTRUCTURA = ["MONOPOLO 25", "MONOPOLO 40", "MONOPOLO 50", "MÁSTIL 60", "MÁSTIL 75", "MÁSTIL 80", "MÁSTIL 100"];
const LISTA_DO = ["E.V.", "G.S.", "N.R.", "P.C.", "R.P."];

// Lee coordenadas WGS 84 escritas de muchas formas:
//   -32.28313, -54.85191            (grados decimales, como en QGIS)
//   32°16'59.3"S 54°51'06.9"W       (con símbolos)
//   31 27 55.41 sur 54 57 49.19 oeste  /  31, 27, 55.41 S, 54, 57, 49.19 O  (sin símbolos)
//   31 27 55.41 54 57 49.19         (grados, minutos, segundos; sin signo ni letra)
//   31 27.923 54 57.82              (grados y minutos con decimales)
function leerCoordenadas(texto) {
  let t = String(texto || "").trim().toLowerCase();
  if (!t) return null;
  // palabras y letras de hemisferio; los símbolos de grados, minutos y segundos pasan a ser separadores
  t = t.replace(/oeste/g, " o ").replace(/sur/g, " s ").replace(/norte/g, " n ").replace(/este/g, " e ")
    .replace(/[°º'’′"”″]/g, " ");
  // coma decimal ("55,41") solo si no hay puntos; si no, la coma separa
  if (!t.includes(".")) t = t.replace(/(\d),(\d)/g, "$1.$2");
  const piezas = t.match(/-?\d+(?:\.\d+)?|\b[nsewo]\b/g) || [];
  // se arman dos grupos: latitud y longitud, cada uno con sus números y su letra
  const nums = piezas.filter((x) => /\d/.test(x)).map(Number);
  const letras = piezas.filter((x) => !/\d/.test(x));
  let grupos;
  const conLetra = letras.length >= 1 && /\d/.test(piezas[0]);
  if (conLetra && letras.length >= 2) {
    // "31 27 55.41 s 54 57 49.19 o": cada letra cierra su grupo
    grupos = [[], []];
    let g = 0;
    for (const x of piezas) {
      if (/\d/.test(x)) { if (g < 2) grupos[g].push(Number(x)); }
      else g++;
    }
  } else if (nums.length === 2 || nums.length === 4 || nums.length === 6) {
    const n = nums.length / 2;
    grupos = [nums.slice(0, n), nums.slice(n)];
  } else return null;
  if (!grupos[0].length || !grupos[1].length || grupos.some((g) => g.length > 3)) return null;
  const decimal = (g) => {
    const [d, m = 0, sg = 0] = g;
    if (m < 0 || m >= 60 || sg < 0 || sg >= 60) return NaN;
    const v = Math.abs(d) + m / 60 + sg / 3600;
    return d < 0 || Object.is(d, -0) ? -v : v;
  };
  let lat = decimal(grupos[0]), lon = decimal(grupos[1]);
  if (isNaN(lat) || isNaN(lon)) return null;
  // letras explícitas: S y O/W negativas
  const [l1, l2] = letras;
  if (l1 === "s" || (!l1 && lat > 0 && lon > 0)) lat = -Math.abs(lat);
  if (l2 === "o" || l2 === "w" || (!l2 && lon > 0 && (l1 === "s" || !l1))) lon = -Math.abs(lon);
  // en Uruguay latitud y longitud son negativas: si faltan los signos, se agregan
  if (lat > 0 && lon > 0 && !letras.length) { lat = -lat; lon = -lon; }
  let invertidas = false;
  if (lat < -45 && lon > -45) { [lat, lon] = [lon, lat]; invertidas = true; }
  return { lat, lon, invertidas };
}
const dentroDeUruguay = (lat, lon) => lat >= -35.2 && lat <= -29.9 && lon >= -58.6 && lon <= -53;

function departamentoDe(lat, lon) {
  const dentro = (anillo) => {
    let c = false;
    for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
      const [xi, yi] = anillo[i], [xj, yj] = anillo[j];
      if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  for (const f of S.deptosGeo?.features || []) {
    const g = f.geometry, polis = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
    if (polis.some((p) => dentro(p[0]) && !p.slice(1).some(dentro))) return f.properties.nombre;
  }
  return "";
}

const NV = { capa: "estructura", marca: null, lat: null, lon: null, z: "" };

function iconoNuevo() {
  return L.divIcon({ className: "mk-nuevo", iconSize: [34, 34], iconAnchor: [17, 17],
    html: `<svg width="34" height="34" viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="12" fill="none" stroke="#fff" stroke-width="3"/><circle cx="17" cy="17" r="12" fill="none" stroke="#6CC4D1" stroke-width="1.5"/><path d="M17 1v9M17 24v9M1 17h9M24 17h9" stroke="#fff" stroke-width="2"/><circle cx="17" cy="17" r="2.5" fill="#6CC4D1"/></svg>` });
}

function ponerMarca(lat, lon, centrar) {
  NV.lat = lat; NV.lon = lon;
  if (!NV.marca) {
    NV.marca = L.marker([lat, lon], { draggable: true, icon: iconoNuevo(), zIndexOffset: 2000, autoPan: true })
      .addTo(S.mapa)
      .on("drag", (ev) => actualizarCoordenadas(ev.latlng.lat, ev.latlng.lng))
      .on("dragend", (ev) => actualizarCoordenadas(ev.target.getLatLng().lat, ev.target.getLatLng().lng));
  } else NV.marca.setLatLng([lat, lon]);
  if (centrar) centrarEnMarca();
  actualizarCoordenadas(lat, lon);
}

// En el celular el formulario tapa la mitad de abajo: la marca se centra en la parte visible.
function centrarEnMarca() {
  if (NV.lat == null) return;
  S.mapa.setView([NV.lat, NV.lon], Math.max(S.mapa.getZoom(), 17), { animate: false });
  if (movil.matches) S.mapa.panBy([0, $("#nuevo").offsetHeight / 2], { animate: false });
}

function actualizarCoordenadas(lat, lon) {
  NV.lat = lat; NV.lon = lon;
  const f = $("#form-nuevo");
  if (!f) return;
  f.lat.value = lat.toFixed(6);
  f.lon.value = lon.toFixed(6);
  $("#ubicacion-ok").hidden = false;
  $("#aviso-fuera").hidden = dentroDeUruguay(lat, lon);
  const dep = departamentoDe(lat, lon);
  $("#depto-detectado").textContent = dep ? "Departamento: " + dep.charAt(0) + dep.slice(1).toLowerCase() : "";
  if (f.Departamento && !f.Departamento.dataset.tocado) f.Departamento.value = valorExistente(S.datos.obra.map((o) => o.departamento), dep);
  $("#enlaces-previos").innerHTML = `Se van a cargar los enlaces para llegar:
    <a href="https://www.google.com/maps/dir/?api=1&destination=${lat}%2C${lon}&travelmode=driving" target="_blank" rel="noopener">Google Maps</a> ·
    <a href="https://waze.com/ul?ll=${lat},${lon}&navigate=yes" target="_blank" rel="noopener">Waze</a>`;
}

// Usa la forma en que ya está escrito un valor en la capa (mayúsculas, tildes), si existe.
function valorExistente(lista, v) {
  if (!v) return "";
  return lista.find((x) => x && normal(x) === normal(v)) || v;
}

function quitarMarca() {
  if (NV.marca) { NV.marca.remove(); NV.marca = null; }
  NV.lat = NV.lon = null;
}

function clickMapaNuevo(ev) {
  if ($("#nuevo").hidden || MED.activo) return;
  ponerMarca(ev.latlng.lat, ev.latlng.lng, false);
}

function cerrarNuevo() {
  $("#nuevo").hidden = true;
  quitarMarca();
  S.mapa.off("click", clickMapaNuevo);
  $("#mapa").classList.remove("modo-nuevo");
}

function abrirNuevo() {
  if (MED.activo) terminarMedida();
  $("#ficha").hidden = true; $("#admin").hidden = true;
  const capasOn = { estructura: CAPAS.some((c) => c.tipo === "estructura" && S.capaOn[c.id]), obra: S.capaOn.obras, relevamiento: S.capaOn.relev };
  if (!capasOn[NV.capa]) NV.capa = capasOn.estructura ? "estructura" : capasOn.obra ? "obra" : "estructura";
  pintarNuevo();
  $("#nuevo").hidden = false;
  S.mapa.off("click", clickMapaNuevo).on("click", clickMapaNuevo);
  $("#mapa").classList.add("modo-nuevo");
}

function pintarNuevo() {
  const caja = $("#nuevo");
  const vals = (tipo, k) => [...new Set((S.datos[tipo] || []).map((o) => o[k]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "es", { numeric: true }));
  const opts = (lista, sel) => lista.map((v) => `<option ${v === sel ? "selected" : ""}>${esc(v)}</option>`).join("");
  const dl = (id, lista) => `<datalist id="${id}">${lista.map((v) => `<option value="${esc(v)}">`).join("")}</datalist>`;
  const dos = [...new Set([...LISTA_DO, ...vals(NV.capa, "director_obra").flatMap(partesDO)])].sort();
  const miDO = S.perfil.iniciales_do || "";
  const est = NV.capa === "estructura";
  const relev = NV.capa === "relevamiento";
  const campos = relev ? `
      <label>Código<input name="CÓDIGO" autocomplete="off" placeholder="Ej. P1"></label>
      <label>Descripción<textarea name="DESCRIPCIÓN" rows="2" placeholder="Qué es el punto"></textarea></label>
      <label>Z (altura en metros)<input name="Z" inputmode="decimal" autocomplete="off" value="${esc(NV.z)}" placeholder="Se completa con el GPS"></label>
      <p class="nota" style="margin:0">Con "Usar mi ubicación (GPS)" se cargan la posición y la Z que da el celular, como en QField. Si el celular no da la altura, escribila a mano.</p>` : est ? `
      <label>Código *<input name="CÓDIGO" required autocomplete="off" placeholder="Ej. CPD"></label>
      <label>Estructura<select name="ESTRUCTURA">${opts([...new Set([...LISTA_ESTRUCTURA, ...vals("estructura", "estructura")])], "")}</select></label>
      <div class="dos">
        <label>Situación<select name="ESTADO"><option value="PROY" selected>Proyecto</option><option value="CONS">En obra</option></select></label>
        <label>Director de obra<select name="D.O."><option value=""></option>${opts(dos, miDO)}</select></label>
      </div>
      <div class="dos">
        <label>Licitación<input name="LICITACIÓN" list="dl-lic" autocomplete="off"></label>
        <label>Año<input name="AÑO" type="number" min="2000" max="2100" value="${new Date().getFullYear()}"></label>
      </div>
      <label>Fecha de inicio<input name="FECHA INICIO" type="date"></label>
      <label>Planos (enlace a la carpeta)<input name="PLANOS" type="url" placeholder="https://drive.google.com/…"></label>
      <label>Observaciones<textarea name="OBSERVACIONES" rows="2"></textarea></label>
      ${dl("dl-lic", vals("estructura", "licitacion"))}` : `
      <label>Código *<input name="CÓDIGO" required autocomplete="off"></label>
      <div class="dos">
        <label>Tipo<select name="Descripción">${opts([...new Set(["OBRA", "COSITIO", ...vals("obra", "descripcion")])], "OBRA")}</select></label>
        <label>Situación<select name="Estado"><option value="PROY" selected>Proyecto</option><option value="CONS">En obra</option></select></label>
      </div>
      <label>Sala<input name="Sala" list="dl-sala" autocomplete="off"></label>
      <div class="dos">
        <label>Localidad<input name="Localidad" list="dl-loc" autocomplete="off"></label>
        <label>Departamento<input name="Departamento" list="dl-dep" autocomplete="off"></label>
      </div>
      <div class="dos">
        <label>Licitación<input name="Licitación" list="dl-lic" autocomplete="off"></label>
        <label>Director de obra<select name="D.O."><option value=""></option>${opts(dos, miDO)}</select></label>
      </div>
      <label>Tarea<input name="Tarea" list="dl-tarea" autocomplete="off"></label>
      <label>Planos (enlace a la carpeta)<input name="Planos" type="url" placeholder="https://drive.google.com/…"></label>
      ${dl("dl-sala", vals("obra", "sala"))}${dl("dl-loc", vals("obra", "localidad"))}${dl("dl-dep", vals("obra", "departamento"))}
      ${dl("dl-lic", vals("obra", "licitacion"))}${dl("dl-tarea", vals("obra", "tarea"))}`;

  caja.innerHTML = `
    <div class="ficha-cabeza">${barraCerrar("Volver al mapa")}<h2 class="admin-titulo">Punto nuevo</h2>
      <p class="nota" style="margin:0">Buscá las coordenadas o tocá el mapa. Después podés arrastrar la marca para corregir la ubicación.</p></div>
    <form class="form" id="form-nuevo" novalidate>
      <div class="ficha-bloque">
        <h2>Capa</h2>
        <div class="segmentado" role="radiogroup">
          <label><input type="radio" name="capa" value="estructura" ${est ? "checked" : ""}> Estructuras OICI Obra</label>
          <label><input type="radio" name="capa" value="obra" ${NV.capa === "obra" ? "checked" : ""}> Obras</label>
          <label><input type="radio" name="capa" value="relevamiento" ${relev ? "checked" : ""}> Relevamiento</label>
        </div>
      </div>
      <div class="ficha-bloque">
        <h2>Ubicación (WGS 84)</h2>
        <button class="boton boton-gps" type="button" id="usar-gps">${ICONO_GPS}<span>Usar mi ubicación (GPS)</span></button>
        <p class="nota" id="gps-info" hidden style="margin:6px 0 0"></p>
        <p class="nota pista" style="margin:10px 0 6px">O buscá por coordenadas:</p>
        <div class="buscar-coord">
          <input name="coord" placeholder="-32.28313, -54.85191" aria-label="Coordenadas WGS 84" autocomplete="off" inputmode="text">
          <button class="boton" type="button" id="buscar-coord">Buscar</button>
        </div>
        <p class="nota pista">Grados decimales como en QGIS (-31.46539, -54.96366) o grados, minutos y segundos sin símbolos: 31 27 55.41 S 54 57 49.19 O.</p>
        <p class="error" id="error-coord" hidden></p>
        <div id="ubicacion-ok" hidden>
          <div class="dos">
            <label>Latitud<input name="lat" inputmode="decimal"></label>
            <label>Longitud<input name="lon" inputmode="decimal"></label>
          </div>
          <p class="nota" id="depto-detectado" style="margin:6px 0 0"></p>
          <p class="error" id="aviso-fuera" hidden>Esa ubicación queda fuera de Uruguay. Revisá las coordenadas.</p>
          <p class="nota" id="enlaces-previos" style="margin:6px 0 0"></p>
          <button class="boton" type="button" id="ir-marca">Centrar el mapa en la marca</button>
        </div>
      </div>
      <div class="ficha-bloque">
        <h2>Datos</h2>
        <div class="form">${campos}</div>
      </div>
      <div class="ficha-bloque acciones-nuevo">
        <p class="error" id="error-nuevo" hidden></p>
        <button class="boton boton-primario" type="submit">Agregar punto</button>
        <button class="boton" type="button" id="cancelar-nuevo">Cancelar</button>
      </div>
    </form>`;

  enlazarCerrar(caja, cerrarNuevo);
  const f = $("#form-nuevo");
  $("#cancelar-nuevo").onclick = cerrarNuevo;
  f.querySelectorAll("input[name=capa]").forEach((r) => (r.onchange = () => {
    NV.capa = r.value;
    const lat = NV.lat, lon = NV.lon;
    pintarNuevo();
    if (lat != null) actualizarCoordenadas(lat, lon);
  }));
  const buscar = () => {
    const c = leerCoordenadas(f.coord.value);
    $("#error-coord").hidden = !!c;
    if (!c) { $("#error-coord").textContent = "No entendí esas coordenadas. Escribí latitud y longitud, por ejemplo -32.28313, -54.85191."; return; }
    if (c.invertidas) aviso("Las coordenadas parecían invertidas: puse primero la latitud");
    ponerMarca(c.lat, c.lon, true);
  };
  $("#buscar-coord").onclick = buscar;
  f.coord.onkeydown = (ev) => { if (ev.key === "Enter") { ev.preventDefault(); buscar(); } };
  const aMano = () => {
    const lat = parseFloat(f.lat.value.replace(",", ".")), lon = parseFloat(f.lon.value.replace(",", "."));
    if (!isNaN(lat) && !isNaN(lon)) ponerMarca(lat, lon, false);
  };
  f.lat.onchange = aMano; f.lon.onchange = aMano;
  $("#ir-marca").onclick = centrarEnMarca;
  if (f.Departamento) f.Departamento.oninput = () => (f.Departamento.dataset.tocado = "1");
  if (f.Z) f.Z.oninput = () => (NV.z = f.Z.value);
  $("#usar-gps").onclick = usarGps;
  f.onsubmit = guardarNuevo;
  if (NV.lat != null) { $("#ubicacion-ok").hidden = false; }
}

const ICONO_GPS = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2.4" fill="currentColor"/><path d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

// Posición del celular para el punto nuevo; en Relevamiento también la altura (Z).
function usarGps() {
  if (!navigator.geolocation) return aviso("Este navegador no permite obtener la ubicación.", true);
  const b = $("#usar-gps"), txt = b.querySelector("span"), info = $("#gps-info");
  b.disabled = true; txt.textContent = "Buscando ubicación…";
  const listo = () => { b.disabled = false; txt.textContent = "Usar mi ubicación (GPS)"; };
  navigator.geolocation.getCurrentPosition((pos) => {
    listo();
    const c = pos.coords;
    ponerMarca(c.latitude, c.longitude, true);
    const f = $("#form-nuevo");
    let texto = `Ubicación del GPS, precisión ±${Math.round(c.accuracy)} m.`;
    if (f && f.Z) {
      if (c.altitude != null) {
        NV.z = f.Z.value = c.altitude.toFixed(2);
        texto += ` Z ${numero(c.altitude, 2)} m` + (c.altitudeAccuracy != null ? ` (±${Math.round(c.altitudeAccuracy)} m).` : ".");
      } else texto += " El celular no dio la altura: escribí la Z a mano.";
    }
    info.textContent = texto; info.hidden = false;
  }, (err) => {
    listo();
    aviso(err.code === 1 ? "No diste permiso para ver tu ubicación. Activalo en los permisos del navegador para este sitio."
      : "No se pudo obtener tu ubicación. Revisá que el GPS esté prendido.", true);
  }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
}

async function guardarNuevo(ev) {
  ev.preventDefault();
  const f = ev.target, err = $("#error-nuevo"), b = f.querySelector("button[type=submit]");
  const mal = (t) => { err.textContent = t; err.hidden = false; };
  err.hidden = true;
  if (NV.lat == null) return mal("Falta la ubicación: buscá las coordenadas o tocá el mapa.");
  if (!dentroDeUruguay(NV.lat, NV.lon)) return mal("La ubicación queda fuera de Uruguay. Revisá las coordenadas.");
  const relev = NV.capa === "relevamiento";
  const codigo = f["CÓDIGO"].value.trim();
  if (!codigo && !relev) { f["CÓDIGO"].focus(); return mal("Falta el código."); }
  if (relev && f.Z.value.trim() && isNaN(Number(f.Z.value.trim().replace(",", ".")))) { f.Z.focus(); return mal("La Z tiene que ser un número en metros, por ejemplo 34,5."); }
  const existentes = S.datos[relev ? "relev" : NV.capa];
  const repetido = codigo && existentes.find((o) => normal(o.codigo) === normal(codigo));
  const que = { estructura: "una estructura", obra: "una obra", relevamiento: "un punto de relevamiento" }[NV.capa];
  if (repetido && !confirm(`Ya hay ${que} con el código ${repetido.codigo}. ¿Lo agrego igual?`)) return;
  const datos = {};
  f.querySelectorAll(".form [name]").forEach((el) => {
    if (["capa", "coord", "lat", "lon"].includes(el.name)) return;
    const v = el.value.trim();
    if (v !== "") datos[el.name] = el.name === "Z" ? v.replace(",", ".") : v;
  });
  b.disabled = true; b.textContent = "Agregando…";
  try {
    const id = await S.api.crearPunto(NV.capa, NV.lat, NV.lon, datos);
    const tipo = NV.capa;
    aviso(`${codigo || "Punto"} agregado`);
    cerrarNuevo();
    NV.z = "";
    if (tipo === "relevamiento") {
      S.capaOn.relev = true;
      await cargar();
      if (id) abrirRelev(Number(id));
      return;
    }
    // que se vea aunque su capa o categoría estuvieran apagadas
    const capa = tipo === "estructura" ? "obra_e" : "obras";
    S.capaOn[capa] = true;
    S.catOn[`${capa}:proyecto`] = true;
    S.catOn[`${capa}:hormigonado`] = true;
    S.catOn[`${capa}:infra`] = true;
    await cargar();
    if (id) await abrirFicha(tipo, Number(id));
  } catch (e) {
    mal(NV.capa === "relevamiento" && /crear_punto|function|schema cache|desconocida|Relevamiento/i.test(e.message)
      ? "Falta preparar la base para el relevamiento: corré sql/parte5_relevamiento.sql en Neon y tocá Refresh schema cache en la Data API."
      : /crear_punto|function|schema cache/i.test(e.message)
      ? "Falta preparar la base para agregar puntos: corré sql/parte4_puntos_nuevos.sql en Neon y tocá Refresh schema cache en la Data API."
      : e.message);
    b.disabled = false; b.textContent = "Agregar punto";
  }
}

// ------------------------------------------------------------ relevamiento (como en QGIS: círculo blanco chico con el código)
const svgRelev = (px = 9) => svgForma("circulo", "#ffffff", "#000000", px, 1);
function relevFiltrados() {
  const t = normal(S.f.texto);
  return S.datos.relev.filter((r) => !t || [r.codigo, r.descripcion].some((v) => normal(v).includes(t)));
}
function iconoRelev(r) {
  const activo = S.abierta && S.abierta.tipo === "relev" && S.abierta.id === r.id;
  return L.divIcon({ className: `mk mk-relev${activo ? " activo" : ""}`,
    html: `${svgRelev()}<span style="left:12px">${esc(r.codigo || "")}</span>`, iconSize: [9, 9], iconAnchor: [4.5, 4.5] });
}
const numero = (v, dec) => (v == null || v === "" || isNaN(Number(v)) ? "—"
  : Number(v).toLocaleString("es-UY", { minimumFractionDigits: dec, maximumFractionDigits: dec }));

function abrirRelev(id) {
  const r = S.datos.relev.find((x) => x.id === id);
  if (!r) return;
  $("#admin").hidden = true;
  S.abierta = { tipo: "relev", id };
  const ficha = $("#ficha");
  ficha.hidden = false;
  const coord = `${Number(r.lat).toFixed(6)}, ${Number(r.lon).toFixed(6)}`;
  ficha.innerHTML = `
    <div class="ficha-cabeza">
      ${barraCerrar("Volver al mapa")}
      <p class="codigo">${esc(r.codigo || "Sin código")}</p>
      <p class="tipo-obra">Punto de relevamiento</p>
      <div class="atajos">
        ${atajo(`https://www.google.com/maps/dir/?api=1&destination=${r.lat}%2C${r.lon}&travelmode=driving`, "maps", "Maps")}
        ${atajo(`https://waze.com/ul?ll=${r.lat},${r.lon}&navigate=yes`, "waze", "Waze")}
        <button type="button" class="atajo" id="copiar-coord">${ICONO.copiar}<span>Copiar</span></button>
      </div>
    </div>
    <div class="ficha-bloque">
      <h2>Datos</h2>
      <dl class="datos">
        <dt>Descripción</dt><dd>${esc(r.descripcion) || "—"}</dd>
        <dt>Latitud</dt><dd>${Number(r.lat).toFixed(6)}</dd>
        <dt>Longitud</dt><dd>${Number(r.lon).toFixed(6)}</dd>
        <dt>Z</dt><dd>${r.z == null || r.z === "" ? "—" : numero(r.z, 2) + " m"}</dd>
      </dl>
    </div>`;
  enlazarCerrar(ficha, cerrarFicha);
  $("#copiar-coord", ficha).onclick = async () => {
    try { await navigator.clipboard.writeText(coord); aviso("Coordenadas copiadas: " + coord); }
    catch (e) { aviso("No se pudo copiar. Coordenadas: " + coord, true); }
  };
  pintar();
  const m = S.marcadores.get(`relev:${id}`);
  if (m && window.innerWidth > 760) S.mapa.panTo(m.getLatLng());
}

// ------------------------------------------------------------ mi ubicación
function agregarBotonUbicacion() {
  let punto = null, radio = null, buscando = false;
  const Ctrl = L.Control.extend({
    options: { position: "topright" },
    onAdd() {
      const div = L.DomUtil.create("div", "leaflet-bar ctrl-ubicacion");
      const a = L.DomUtil.create("a", "", div);
      a.href = "#"; a.role = "button"; a.title = "Ir a mi ubicación"; a.setAttribute("aria-label", "Ir a mi ubicación");
      a.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2.4" fill="currentColor"/><path d="M12 2v3.5M12 18.5V22M2 12h3.5M18.5 12H22" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.on(a, "click", (ev) => {
        L.DomEvent.preventDefault(ev);
        if (!navigator.geolocation) return aviso("Este navegador no permite obtener la ubicación.", true);
        if (buscando) return;
        buscando = true; div.classList.add("buscando");
        navigator.geolocation.getCurrentPosition((pos) => {
          buscando = false; div.classList.remove("buscando");
          const ll = [pos.coords.latitude, pos.coords.longitude], prec = pos.coords.accuracy;
          if (!punto) {
            radio = L.circle(ll, { radius: prec, color: "#4A90E2", weight: 1, fillColor: "#4A90E2", fillOpacity: 0.12, interactive: false }).addTo(S.mapa);
            punto = L.circleMarker(ll, { radius: 7, color: "#fff", weight: 2.5, fillColor: "#2F80ED", fillOpacity: 1 })
              .bindTooltip("Estás acá").addTo(S.mapa);
          } else { punto.setLatLng(ll); radio.setLatLng(ll).setRadius(prec); }
          S.mapa.setView(ll, Math.max(S.mapa.getZoom(), 17));
          if (movil.matches && !$("#nuevo").hidden) S.mapa.panBy([0, $("#nuevo").offsetHeight / 2], { animate: false });
        }, (err) => {
          buscando = false; div.classList.remove("buscando");
          aviso(err.code === 1 ? "No diste permiso para ver tu ubicación. Activalo en los permisos del navegador para este sitio."
            : "No se pudo obtener tu ubicación. Revisá que el GPS esté prendido.", true);
        }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 });
      });
      return div;
    },
  });
  new Ctrl().addTo(S.mapa);
}

// ------------------------------------------------------------ medir distancias (como la regla de QField)
const MED = { activo: false, puntos: [], grupo: null, guia: null, caja: null, boton: null, cursor: null };

// Distancia sobre el elipsoide WGS 84 (Vincenty), igual que mide QGIS.
function distancia(a, b) {
  const A = 6378137, F = 1 / 298.257223563, B = A * (1 - F), rad = Math.PI / 180;
  const L0 = (b.lng - a.lng) * rad;
  const U1 = Math.atan((1 - F) * Math.tan(a.lat * rad)), U2 = Math.atan((1 - F) * Math.tan(b.lat * rad));
  const sU1 = Math.sin(U1), cU1 = Math.cos(U1), sU2 = Math.sin(U2), cU2 = Math.cos(U2);
  let l = L0, lp, it = 0, sS, cS, sg, c2A, c2Sm;
  do {
    const sl = Math.sin(l), cl = Math.cos(l);
    sS = Math.sqrt((cU2 * sl) ** 2 + (cU1 * sU2 - sU1 * cU2 * cl) ** 2);
    if (sS === 0) return 0;
    cS = sU1 * sU2 + cU1 * cU2 * cl;
    sg = Math.atan2(sS, cS);
    const sA = (cU1 * cU2 * sl) / sS;
    c2A = 1 - sA * sA;
    c2Sm = c2A ? cS - (2 * sU1 * sU2) / c2A : 0;
    const C = (F / 16) * c2A * (4 + F * (4 - 3 * c2A));
    lp = l;
    l = L0 + (1 - C) * F * sA * (sg + C * sS * (c2Sm + C * cS * (-1 + 2 * c2Sm * c2Sm)));
  } while (Math.abs(l - lp) > 1e-12 && ++it < 200);
  if (it >= 200) return L.latLng(a).distanceTo(b);
  const u2 = (c2A * (A * A - B * B)) / (B * B);
  const kA = 1 + (u2 / 16384) * (4096 + u2 * (-768 + u2 * (320 - 175 * u2)));
  const kB = (u2 / 1024) * (256 + u2 * (-128 + u2 * (74 - 47 * u2)));
  const dS = kB * sS * (c2Sm + (kB / 4) * (cS * (-1 + 2 * c2Sm * c2Sm) - (kB / 6) * c2Sm * (-3 + 4 * sS * sS) * (-3 + 4 * c2Sm * c2Sm)));
  return B * kA * (sg - dS);
}
const metros = (m) => (m < 1000
  ? `${m.toLocaleString("es-UY", { maximumFractionDigits: m < 100 ? 2 : 1 })} m`
  : `${(m / 1000).toLocaleString("es-UY", { maximumFractionDigits: m < 10000 ? 3 : 2 })} km`);

const ICONO_REGLA = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M3.2 15.6 15.6 3.2l5.2 5.2L8.4 20.8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M7 11.8l1.8 1.8M9.6 9.2l2.6 2.6M12.2 6.6l1.8 1.8M14.8 4l2.6 2.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

function agregarBotonMedir() {
  const Ctrl = L.Control.extend({
    options: { position: "topright" },
    onAdd() {
      const div = L.DomUtil.create("div", "leaflet-bar ctrl-medir");
      const a = L.DomUtil.create("a", "", div);
      a.href = "#"; a.role = "button"; a.title = "Medir distancias"; a.setAttribute("aria-label", "Medir distancias");
      a.innerHTML = ICONO_REGLA;
      L.DomEvent.disableClickPropagation(div);
      L.DomEvent.on(a, "click", (ev) => { L.DomEvent.preventDefault(ev); MED.activo ? terminarMedida() : empezarMedida(); });
      MED.boton = div;
      return div;
    },
  });
  new Ctrl().addTo(S.mapa);
  MED.grupo = L.layerGroup().addTo(S.mapa);
}

function empezarMedida() {
  if (!$("#nuevo").hidden) cerrarNuevo();
  MED.activo = true; MED.puntos = []; MED.cursor = null;
  MED.boton.classList.add("activo");
  $("#mapa").classList.add("modo-medir");
  const caja = document.createElement("div");
  caja.className = "medida";
  caja.setAttribute("role", "status");
  caja.innerHTML = `<div class="medida-cifras"><b id="med-total">0 m</b><span id="med-detalle"></span></div>
    <div class="medida-botones">
      <button type="button" class="boton boton-chico" id="med-deshacer">Deshacer</button>
      <button type="button" class="boton boton-chico" id="med-borrar">Borrar</button>
      <button type="button" class="cerrar" id="med-cerrar" aria-label="Terminar de medir" title="Terminar de medir">✕</button>
    </div>`;
  $(".mapa-zona").appendChild(caja);
  MED.caja = caja;
  $("#med-deshacer").onclick = () => { MED.puntos.pop(); dibujarMedida(); };
  $("#med-borrar").onclick = () => { MED.puntos = []; dibujarMedida(); };
  $("#med-cerrar").onclick = terminarMedida;
  S.mapa.on("click", clickMedida).on("mousemove", moverMedida).on("mouseout", salirMedida);
  document.addEventListener("keydown", teclaMedida);
  dibujarMedida();
}

function terminarMedida() {
  MED.activo = false; MED.puntos = []; MED.cursor = null;
  MED.grupo.clearLayers();
  MED.caja?.remove(); MED.caja = null;
  MED.boton.classList.remove("activo");
  $("#mapa").classList.remove("modo-medir");
  S.mapa.off("click", clickMedida).off("mousemove", moverMedida).off("mouseout", salirMedida);
  document.removeEventListener("keydown", teclaMedida);
}

function clickMedida(ev) { agregarMedida(ev.latlng); }
function agregarMedida(ll) { MED.puntos.push(L.latLng(ll.lat, ll.lng)); dibujarMedida(); }
function moverMedida(ev) { if (MED.puntos.length) { MED.cursor = ev.latlng; dibujarMedida(); } }
function salirMedida() { if (MED.cursor) { MED.cursor = null; dibujarMedida(); } }
function teclaMedida(ev) {
  if (ev.target.closest("input, textarea, select")) return;
  if (ev.key === "Escape") terminarMedida();
  else if (ev.key === "Backspace" || (ev.key === "z" && (ev.ctrlKey || ev.metaKey))) { ev.preventDefault(); MED.puntos.pop(); dibujarMedida(); }
}

function dibujarMedida() {
  const g = MED.grupo, p = MED.puntos;
  g.clearLayers();
  const linea = (pts, extra = {}) => {
    L.polyline(pts, { color: "#1a1a1a", weight: 6, opacity: 0.55, interactive: false, ...extra }).addTo(g);
    L.polyline(pts, { color: "#FFC53D", weight: 3, interactive: false, ...extra }).addTo(g);
  };
  if (p.length > 1) linea(p);
  if (p.length && MED.cursor) linea([p[p.length - 1], MED.cursor], { dashArray: "6 6" });
  let total = 0;
  p.forEach((q, i) => {
    if (i) {
      const d = distancia(p[i - 1], q);
      total += d;
      const medio = L.latLng((p[i - 1].lat + q.lat) / 2, (p[i - 1].lng + q.lng) / 2);
      L.marker(medio, { interactive: false, keyboard: false,
        icon: L.divIcon({ className: "med-eti", html: `<span>${metros(d)}</span>`, iconSize: [0, 0] }) }).addTo(g);
    }
    L.circleMarker(q, { radius: i ? 4.5 : 5.5, color: "#1a1a1a", weight: 2, fillColor: i ? "#ffffff" : "#FFC53D", fillOpacity: 1, interactive: false }).addTo(g);
  });
  if (!MED.caja) return;
  const extra = p.length && MED.cursor ? distancia(p[p.length - 1], MED.cursor) : 0;
  $("#med-total").textContent = metros(total + extra);
  $("#med-detalle").textContent = !p.length ? "Tocá el mapa para marcar el primer punto"
    : p.length === 1 && !extra ? "Tocá el siguiente punto"
    : extra ? `hasta el cursor, ${metros(extra)} el último tramo`
    : `${p.length - 1} tramo${p.length > 2 ? "s" : ""}, el último ${metros(distancia(p[p.length - 2], p[p.length - 1]))}`;
  $("#med-deshacer").disabled = !p.length;
  $("#med-borrar").disabled = !p.length;
}

iniciar();
