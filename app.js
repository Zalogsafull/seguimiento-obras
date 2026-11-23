import { crearApi } from "./api.js?v=2026-11-23-4";

// ------------------------------------------------------------ categorías
// Mismos colores que la simbología de QGIS.
const CAT = {
  // la etapa dice lo que se está haciendo (Hormigonando); el hito, lo que ya se terminó (Hormigonado)
  proyecto:    { nombre: "En proyecto",             color: "#f6f6f6", grupo: "proyecto" },
  aprobado_e:  { nombre: "P. ejecutivo aprobado",   color: "#7ec8f0", grupo: "proyecto" },
  aprobado_o:  { nombre: "Proyecto aprobado",       color: "#7ec8f0", grupo: "proyecto" },
  hormigonado: { nombre: "Hormigonando",            color: "#d7191c", grupo: "obra" },
  montaje:     { nombre: "Montando",                color: "#f2d024", grupo: "obra" },
  infra:       { nombre: "En infraestructura",      color: "#2e9e44", grupo: "obra" },
  r6:          { nombre: "Recepción en 3 a 6 meses", color: "#f2d024", grupo: "recepcion", recepcion: true },
  r3:          { nombre: "Recepción en menos de 3 meses", color: "#f08a24", grupo: "recepcion", recepcion: true },
  vencida:     { nombre: "Recepción vencida",       color: "#c1272d", grupo: "recepcion", recepcion: true },
  plazo:       { nombre: "Recepción en plazo",      color: "#8fcf98", grupo: "recepcion", recepcion: true },
  sinfecha:    { nombre: "Recepción sin fecha de fin", color: "#bdbdbd", grupo: "recepcion", recepcion: true },
  // capa terminadas: todas las que tienen fin de obra, según la recepción que tengan
  sinrecep:    { nombre: "Terminada, sin provisoria", color: "#c8c8c8", grupo: "cerrada", terminada: true },
  provisoria:  { nombre: "Terminada, con provisoria", color: "#a9a9a9", grupo: "cerrada", terminada: true },
  recibida:    { nombre: "Terminada, con definitiva", color: "#838383", grupo: "cerrada", terminada: true },
  terminada:   { nombre: "Terminada",               color: "#838383", grupo: "cerrada", terminada: true },
};
// Árbol de capas, igual que en QGIS / QField.
const CAPAS = [
  { id: "obra_e", grupo: "ESTRUCTURAS", nombre: "Estructuras OICI Obra", tipo: "estructura",
    cats: ["proyecto", "aprobado_e", "hormigonado", "montaje", "infra"], on: true },
  { id: "recep", grupo: "ESTRUCTURAS", nombre: "Estructuras OICI Recepciones", tipo: "estructura",
    cats: ["plazo", "r6", "r3", "vencida", "sinfecha"], on: true },
  { id: "term_e", grupo: "ESTRUCTURAS", nombre: "Estructuras OICI (terminadas)", tipo: "estructura",
    cats: ["sinrecep", "provisoria", "recibida"], on: false },
  { id: "obras", grupo: "OBRAS", nombre: "Obras", tipo: "obra",
    cats: ["proyecto", "aprobado_o", "infra", "terminada"], on: true, apagadas: ["terminada"] },
];
// Qué símbolo queda arriba cuando dos se tocan: primero lo que está en obra, después recepciones,
// proyectos y al fondo las terminadas.
const PRIORIDAD = { obra: 3000, recepcion: 2000, proyecto: 1000, cerrada: 0 };
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
  const grande = f === "asterisco";
  const px = Math.round((grande ? 18 : 13) * escala);
  const borde = c.recepcion ? "#e0c200" : c.terminada ? "#1a1a1a" : "#7a7a7a";
  return svgForma(f, c.color, borde, px, c.recepcion ? 1.6 : 1.2);
}

const ESCALERA = {
  estructura: ["proyecto", "aprobado_e", "hormigonado", "montaje", "infra", "recepcion", "recibida"],
  obra: ["proyecto", "aprobado_o", "infra", "terminada"],
};
const NOMBRE_TRAMO = { recepcion: "Esperando recepción" };
// Qué hito completa cada tramo de la barra (por su etapa), para pintar los hechos fuera de orden
const HITO_TRAMO = { aprobado_e: 2, aprobado_o: 2, hormigonado: 3, montaje: 4, infra: 5, recibida: 6 };

// Estructuras terminadas: pueden estar en dos capas a la vez, como en QGIS.
//  - Recepciones: todas las que no tienen la definitiva, según cuánto falta para el vencimiento.
//  - Terminadas: todas, según la recepción que tengan (con o sin fecha de fin).
// Códigos del campo RECEPCIÓN: RD definitiva; PD (rev. pre definitiva) y PR (para recepcionar)
// también se cuentan como definitiva; RP provisoria.
const codRecepcion = (o) => String(o.recepcion ?? "").trim().toUpperCase();
const conDefinitiva = (o) => ["RD", "PD", "PR"].includes(codRecepcion(o)) || (o.etapa || 1) >= 6;
const conProvisoria = (o) => codRecepcion(o) === "RP";
function categoriaRecepcion(o) {
  if (conDefinitiva(o)) return null;
  const d = o.dias_para_recepcion;
  if (d == null) return "sinfecha"; // sin fecha de fin no se puede calcular el vencimiento
  return d < 0 ? "vencida" : d < 90 ? "r3" : d < 180 ? "r6" : "plazo";
}
function categoriaTerminada(o) {
  if (conDefinitiva(o)) return "recibida";
  return conProvisoria(o) ? "provisoria" : "sinrecep";
}
const terminadaEst = (tipo, o) => tipo === "estructura" && (o.estado === "FIN" || (o.etapa || 1) >= 5);

function categoria(tipo, o) {
  const e = o.estado, et = o.etapa || 1;
  if (tipo === "obra") {
    if (e === "FIN") return "terminada";
    if (e === "CONS") return "infra";
    return et >= 2 ? "aprobado_o" : "proyecto";
  }
  if (e === "FIN" || et >= 5) return categoriaRecepcion(o) || categoriaTerminada(o);
  if (e === "CONS") return et <= 2 ? "hormigonado" : et === 3 ? "montaje" : "infra";
  return et >= 2 ? "aprobado_e" : "proyecto";
}

// ------------------------------------------------------------ utilidades
const $ = (s, r = document) => r.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// fecha de hoy en la hora del dispositivo (Uruguay); con toISOString después de las 21 h daba mañana
const hoy = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const hoyLocal = hoy;
// Fin previsto ya pasado y la obra sin terminar
const atrasada = (o) => !!o.fin_previsto && o.estado !== "FIN" && String(o.fin_previsto).slice(0, 10) < hoyLocal();
const diasAtraso = (o) => Math.round((new Date(hoyLocal()) - new Date(String(o.fin_previsto).slice(0, 10))) / 864e5);
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
// Tipo de usuario: "con obras" (es director de obra y ve primero las suyas) o "ve todas".
// Sin la parte 14 en la base no viene con_obras: tener iniciales equivale a "con obras".
// Todos los directores de obra que figuran en las estructuras y obras (aunque la capa esté apagada)
const todosLosDO = () => [...new Set([...LISTA_DO, ...[...S.datos.estructura, ...S.datos.obra].flatMap((o) => partesDO(o.director_obra))])]
  .sort((a, b) => a.localeCompare(b, "es"));
const conObras = () => !!S.perfil && (S.perfil.con_obras ?? !!S.perfil.iniciales_do);
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

// Una entrada por capa en la que está cada elemento (una estructura terminada sin
// recepción definitiva aparece en Recepciones y en Terminadas).
function todas() {
  const out = [];
  for (const tipo of ["estructura", "obra"]) for (const o of S.datos[tipo]) {
    if (terminadaEst(tipo, o)) {
      const r = categoriaRecepcion(o);
      if (r) out.push({ tipo, o, cat: r, capa: capaDe(tipo, r) });
      const t = categoriaTerminada(o);
      out.push({ tipo, o, cat: t, capa: capaDe(tipo, t) });
      continue;
    }
    const cat = categoria(tipo, o);
    out.push({ tipo, o, cat, capa: capaDe(tipo, cat) });
  }
  return out;
}
// Deja una sola entrada por elemento (la primera de la lista)
function unicos(xs) {
  const vistos = new Set();
  return xs.filter((x) => { const k = `${x.tipo}:${x.o.id}`; if (vistos.has(k)) return false; vistos.add(k); return true; });
}

function visibles() {
  const orden = ["obra", "recepcion", "proyecto", "cerrada"];
  // si está prendida en dos capas, se dibuja una vez, con el símbolo de la más importante
  return unicos(todas().filter((x) => x.capa && S.capaOn[x.capa.id] && S.catOn[`${x.capa.id}:${x.cat}`] && pasaFiltros(x.tipo, x.o))
    .sort((a, b) => orden.indexOf(CAT[a.cat].grupo) - orden.indexOf(CAT[b.cat].grupo)
      || String(a.o.codigo).localeCompare(String(b.o.codigo))));
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
  try {
    if (!S.api) S.api = await conTiempo(crearApi(), 20000);
    await conTiempo(S.api.salir(), 15000);
  } catch (e) {
    aviso("No se pudo cerrar la sesión porque no hay conexión con Neon. Probá de nuevo en un rato.", true);
    return;
  }
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
    S.api = await conTiempo(crearApi(), 20000);
    S.usuario = await conTiempo(S.api.usuario(), 20000);
  } catch (e) {
    mostrar("vista-ingreso");
    $("#error-ingreso").hidden = false;
    $("#error-ingreso").textContent = "No se pudo conectar con Neon desde esta red. Revisá la conexión y recargá la página; si estás en una red de empresa, puede estar bloqueando el acceso.";
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
    S.perfil = await conTiempo(S.api.perfil(), 20000);
  } catch (e) {
    S.perfil = null;
    if (sinRed(e)) {
      // no es que la cuenta no esté habilitada: no hay conexión con la base
      mostrar("vista-ingreso");
      $("#error-ingreso").hidden = false;
      $("#error-ingreso").textContent = "No se pudo conectar con Neon desde esta red. Probá de nuevo; si estás en una red de empresa, puede estar bloqueando el acceso.";
      return;
    }
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
  // quien tiene obras entra viendo las suyas (después puede apagar «Mis obras» en Filtros)
  if (conObras() && S.perfil.iniciales_do) S.f.mias = true;
  $("#mi-do").onclick = () => preguntarDO(true);
  $("#boton-nuevo").onclick = abrirNuevo;
  document.addEventListener("paste", alPegar);
  $("#recargar").onclick = () => {
    $("#recargar").classList.add("girando");
    if (navigator.onLine) { try { localStorage.removeItem(CLAVE_DATOS); } catch (e) { /* nada */ } }
    location.reload();
  };
  $("#boton-usuarios").onclick = abrirAdmin;
  $("#salir").onclick = salirCuenta;
  $("#estado-datos").onclick = () => { if (S.estadoRed === "sinred") actualizar(); };
  $("#actualizar-ahora").onclick = async () => { await actualizar(); pintarAjustes(); };
  $("#abrir-tabla").onclick = abrirTabla;
  prepararMapa();
  prepararPanel();
  const v = leerJSON(CLAVE_VISTA);
  pintar();
  // al volver la señal, o al volver a la app después de un rato, se actualiza sola
  addEventListener("online", () => actualizar());
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && Date.now() - (S.datosDe || 0) > 5 * 60e3) actualizar();
  });
}

// Si no se pudo actualizar, se vuelve a intentar sola: a los 10 s, 30 s, 1 min y 2 min.
function reintentarLuego() {
  const esperas = [10, 30, 60, 120];
  S.reintentos = (S.reintentos || 0);
  if (S.reintentos >= esperas.length || S.timerReintento) return;
  const s = esperas[S.reintentos++];
  S.timerReintento = setTimeout(() => { S.timerReintento = null; actualizar(); }, s * 1000);
}
function anotarError(e) {
  S.ultimoError = { texto: String(e?.message || e).slice(0, 200), hora: new Date().toLocaleTimeString("es-UY", { hour: "2-digit", minute: "2-digit", hour12: false }) };
}

// Revisa la sesión (si arrancó con lo guardado) y trae los datos nuevos.
async function actualizar() {
  if (S.actualizando) return;
  S.actualizando = true;
  try {
    estadoDatos("actualizando");
    if (!S.api) {
      try { S.api = await conTiempo(crearApi(), 30000); prepararIngreso(); }
      catch (e) { S.api = null; anotarError(e); reintentarLuego(); return estadoDatos("sinred"); }
    }
    if (!S.verificado) {
      let u;
      try { u = await conTiempo(S.api.usuario(), 30000); } catch (e) { anotarError(e); reintentarLuego(); return estadoDatos("sinred"); }
      if (!u) {
        if (!navigator.onLine) return estadoDatos("sinred");
        estadoDatos(null);
        return mostrar("vista-ingreso"); // la sesión venció: hay que volver a ingresar
      }
      if (u.email !== S.usuario.email) { borrarGuardado(); location.reload(); return; }
      S.usuario = u;
      let p;
      try { p = await conTiempo(S.api.perfil(), 30000); } catch (e) { anotarError(e); reintentarLuego(); return estadoDatos("sinred"); }
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
    anotarError(e);
    // sin señal: se siguen mostrando los datos guardados
    estadoDatos(sinRed(e) ? "sinred" : null);
    reintentarLuego();
    if (!(habia && sinRed(e))) {
      const d = document.createElement("div");
      d.className = "aviso mal";
      d.textContent = sinRed(e)
        ? "No llegan los datos desde Neon: esta red no responde o está bloqueando el acceso. Probá con otra conexión."
        : "No se pudieron cargar las obras: " + e.message;
      $("#avisos").append(d);
      setTimeout(() => d.remove(), 9000);
    }
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
  S.reintentos = 0;
  guardarDatos();
  estadoDatos(null);
  cargarSolicitudes();
  pintar();
  if (S.verificado && !S.preguntadoDO && conObras() && !S.perfil.iniciales_do) { S.preguntadoDO = true; preguntarDO(false); }
  if (UI.modo === "ajustes" && !UI.plegado) pintarAjustes();
  if (!$("#tabla").hidden && !document.querySelector("#tabla .editando")) pintarTabla();
}

// ------------------------------------------------------------ paneles
// Abre un panel (capas, filtros, lista…) aunque ya esté abierto otro
function verTab(t) {
  UI.modo = t;
  UI.plegado = false;
  guardarUI(); aplicarUI();
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
  p.innerHTML = `${html}

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
    ["FIN PREVISTO", "fin_previsto", "Fin previsto", "fecha"],
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
    ["FIN PREVISTO", "fin_previsto", "Fin previsto", "fecha"],
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
      err.textContent = /fetch|network|tiempo/i.test(e.message) ? "Sin conexión: no se guardó. Probá de nuevo cuando tengas señal." : e.message;
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

// ------------------------------------------------------------ borrar (el administrador borra; un editor lo pide)
const NOMBRE_TIPO = { estructura: "estructura", obra: "obra", relevamiento: "punto de relevamiento" };
const pedidoDe = (tipo, id) => (S.solicitudes || []).find((x) => x.tipo === tipo && x.objeto_id === id);
function bloqueBorrar(tipo, o) {
  if (!editor()) return "";
  const p = pedidoDe(tipo, o.id);
  const nombre = NOMBRE_TIPO[tipo];
  let cuerpo;
  if (p && S.perfil?.admin) {
    cuerpo = `<p class="nota" style="margin:0 0 10px">${esc(p.pedido_nombre || "Alguien")} pidió que se borre${p.motivo ? `: "${esc(p.motivo)}"` : "."}</p>
      <div class="acciones"><button class="boton boton-peligro" type="button" data-resolver="${p.id}" data-aprobar="1">Aprobar y borrar</button>
      <button class="boton" type="button" data-resolver="${p.id}" data-aprobar="0">Rechazar</button></div>`;
  } else if (p) {
    cuerpo = `<p class="nota" style="margin:0">Pediste que se borre. Queda así hasta que un administrador lo apruebe o lo rechace.</p>`;
  } else if (S.perfil?.admin) {
    cuerpo = `<button class="boton boton-peligro" type="button" id="borrar-elemento">Borrar ${nombre}</button>
      <p class="nota" style="margin:8px 0 0">Se borra también su historial de hitos y cuaderno. Queda una copia de respaldo en la base.</p>`;
  } else {
    cuerpo = `<button class="boton boton-peligro" type="button" id="pedir-borrado">Pedir que se borre</button>
      <form class="form" id="form-borrado" hidden style="margin-top:10px">
        <label>¿Por qué hay que borrarla?<textarea name="motivo" rows="2" placeholder="Ej. está duplicada con CPD-12"></textarea></label>
        <div class="acciones"><button class="boton boton-peligro" type="submit">Enviar pedido</button>
        <button class="boton" type="button" id="cancelar-borrado">Cancelar</button></div>
      </form>
      <p class="nota" style="margin:8px 0 0">Un administrador recibe el pedido y lo aprueba o lo rechaza.</p>`;
  }
  return `<div class="ficha-bloque zona-borrar"><h2>Borrar</h2>${cuerpo}</div>`;
}
function enlazarBorrar(ficha, tipo, o) {
  const nombre = NOMBRE_TIPO[tipo], cod = o.codigo || nombre;
  const despues = async (texto) => {
    aviso(texto);
    cerrarFicha();
    await cargar();
  };
  const b = $("#borrar-elemento", ficha);
  if (b) b.onclick = async () => {
    if (!confirm(`¿Borrar ${cod}? Se borra para todos (web, QGIS y QField), con sus hitos y su cuaderno. Queda una copia de respaldo en la base.`)) return;
    b.disabled = true;
    try { await S.api.pedirBorrado(tipo, o.id, null); await despues(`${cod} borrado`); }
    catch (e) { aviso(e.message, true); b.disabled = false; }
  };
  const pb = $("#pedir-borrado", ficha), fb = $("#form-borrado", ficha);
  if (pb) {
    pb.onclick = () => { pb.hidden = true; fb.hidden = false; fb.motivo.focus(); };
    $("#cancelar-borrado", ficha).onclick = () => { pb.hidden = false; fb.hidden = true; };
    fb.onsubmit = async (ev) => {
      ev.preventDefault();
      const enviar = fb.querySelector("button[type=submit]");
      enviar.disabled = true;
      try {
        const r = await S.api.pedirBorrado(tipo, o.id, fb.motivo.value.trim());
        aviso(r === "YA_PEDIDO" ? "Ya había un pedido para borrarla." : "Pedido enviado al administrador");
        await cargarSolicitudes();
        if (tipo === "relevamiento") abrirRelev(o.id); else pintarFicha(tipo, o, ...ultimaFicha(tipo, o.id));
      } catch (e) { aviso(e.message, true); enviar.disabled = false; }
    };
  }
  ficha.querySelectorAll("[data-resolver]").forEach((x) => {
    x.onclick = () => resolverPedido(Number(x.dataset.resolver), x.dataset.aprobar === "1", cod, true);
  });
}
async function resolverPedido(id, aprobar, cod, desdeFicha) {
  if (aprobar && !confirm(`¿Aprobar y borrar ${cod}? Se borra para todos, con sus hitos y su cuaderno.`)) return;
  try {
    await S.api.resolverBorrado(id, aprobar);
    aviso(aprobar ? `${cod} borrado` : "Pedido rechazado");
    if (desdeFicha && aprobar) cerrarFicha();
    await cargar();
    if (desdeFicha && !aprobar && S.abierta) {
      const { tipo, id: oid } = S.abierta;
      if (tipo === "relev") abrirRelev(oid); else abrirFicha(tipo, oid);
    }
  } catch (e) { aviso(e.message, true); }
}
// Pedidos pendientes: el administrador los ve en Ajustes y con un número en el botón
async function cargarSolicitudes() {
  try { S.solicitudes = (await conTiempo(S.api.solicitudes(), 20000)) || []; }
  catch (e) { S.solicitudes = S.solicitudes || []; return; }
  const n = S.perfil?.admin ? S.solicitudes.length : 0;
  insignia("ajustes", n);
  if (n && !S.avisoSolicitudes) {
    S.avisoSolicitudes = true;
    aviso(`Tenés ${n} pedido${n > 1 ? "s" : ""} para borrar algo. Miralo${n > 1 ? "s" : ""} en Ajustes.`);
  }
  if (UI.modo === "ajustes" && !UI.plegado) pintarAjustes();
}
function pintarSolicitudes() {
  const cont = $("#ajustes-solicitudes");
  if (!cont) return;
  const lista = S.perfil?.admin ? (S.solicitudes || []) : [];
  cont.hidden = !lista.length;
  if (!lista.length) return;
  const nombreDe = (x) => {
    const t = x.tipo === "relevamiento" ? "relev" : x.tipo;
    const o = S.datos[t]?.find((y) => y.id === x.objeto_id);
    return (o?.codigo || x.codigo || "Sin código") + " · " + NOMBRE_TIPO[x.tipo];
  };
  cont.innerHTML = `<h3>Pedidos para borrar <span class="cuenta">${lista.length}</span></h3>
    ${lista.map((x) => `<div class="pedido">
      <p><b>${esc(nombreDe(x))}</b><br><small>${esc(x.pedido_nombre || "")} · ${fecha(String(x.creado).slice(0, 10))}</small>
      ${x.motivo ? `<br><span>"${esc(x.motivo)}"</span>` : ""}</p>
      <div class="acciones">
        <button class="boton boton-chico" type="button" data-ver="${x.id}">Ver</button>
        <button class="boton boton-chico boton-peligro" type="button" data-ok="${x.id}">Aprobar y borrar</button>
        <button class="boton boton-chico" type="button" data-no="${x.id}">Rechazar</button>
      </div></div>`).join("")}`;
  const por = (id) => lista.find((x) => x.id === Number(id));
  cont.querySelectorAll("[data-ver]").forEach((b) => (b.onclick = () => {
    const x = por(b.dataset.ver);
    if (x.tipo === "relevamiento") abrirRelev(x.objeto_id); else abrirFicha(x.tipo, x.objeto_id);
  }));
  cont.querySelectorAll("[data-ok]").forEach((b) => (b.onclick = () => resolverPedido(Number(b.dataset.ok), true, nombreDe(por(b.dataset.ok)), false)));
  cont.querySelectorAll("[data-no]").forEach((b) => (b.onclick = () => resolverPedido(Number(b.dataset.no), false, nombreDe(por(b.dataset.no)), false)));
}

// ------------------------------------------------------------ capas para informes y tabla
// Cada "capa" de esta lista sale de las mismas categorías que el árbol de Capas.
const CAPAS_LISTA = [
  { id: "est_todas", nombre: "Estructuras OICI (todas)", tipo: "estructura" },
  { id: "obra_e", nombre: "Estructuras OICI Obra", tipo: "estructura" },
  { id: "recep", nombre: "Estructuras OICI Recepciones", tipo: "estructura" },
  { id: "term_e", nombre: "Estructuras OICI (terminadas)", tipo: "estructura" },
  { id: "obras", nombre: "Obras", tipo: "obra" },
  { id: "relev", nombre: "Relevamiento", tipo: "relevamiento" },
];
const ORDEN_CAT = ["infra", "montaje", "hormigonado", "aprobado_e", "aprobado_o", "proyecto", "vencida", "r3", "r6", "plazo", "sinfecha", "sinrecep", "provisoria", "recibida", "terminada"];
const porCodigo = (a, b) => String(a.o.codigo ?? "").localeCompare(String(b.o.codigo ?? ""), "es", { numeric: true });

// Elementos de una capa. Con "respetar", solo lo que dejan ver los filtros y las categorías tildadas.
function filasDeCapa(id, respetar) {
  if (id === "relev") {
    return (respetar ? relevFiltrados() : S.datos.relev).map((o) => ({ tipo: "relevamiento", o, cat: null }));
  }
  const lista = id === "est_todas" ? unicos(todas()) : todas();
  return lista.filter((x) => {
    if (id === "est_todas") { if (x.tipo !== "estructura") return false; }
    else if (!x.capa || x.capa.id !== id) return false;
    if (!respetar) return true;
    return pasaFiltros(x.tipo, x.o) && (!x.capa || S.catOn[`${x.capa.id}:${x.cat}`] !== false);
  });
}
const opcionesCapas = (sel) => CAPAS_LISTA.map((c) => `<option value="${c.id}" ${c.id === sel ? "selected" : ""}>${esc(c.nombre)}</option>`).join("");

// ------------------------------------------------------------ informes en PDF (A4 apaisado, las hojas que hagan falta)
const cargarScript = (src) => new Promise((ok, no) => {
  if (document.querySelector(`script[src="${src}"]`)) return ok();
  const el = document.createElement("script");
  el.src = src; el.onload = ok; el.onerror = () => no(new Error("No se pudo cargar el generador de PDF. Revisá la conexión."));
  document.head.append(el);
});
async function prepararPDF() {
  await cargarScript("vendor/jspdf/jspdf.umd.min.js");
  await cargarScript("vendor/jspdf/jspdf.plugin.autotable.min.js");
  return window.jspdf.jsPDF;
}
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const txt = (v) => (v == null || v === "" ? "—" : String(v));
// En los informes, la carpeta de planos va como la palabra «abrir» con el enlace detrás
const ENLACE = Symbol("enlace");
const enlace = (url) => ({ [ENLACE]: String(url || "").trim() });

// Símbolo de QGIS dibujado en el PDF (triángulo, círculo, cuadrado o asterisco con su color)
function simboloPDF(doc, f, x, y, r, color, borde) {
  doc.setFillColor(...rgb(color));
  doc.setDrawColor(...rgb(borde));
  doc.setLineWidth(borde === "#e0c200" ? 0.6 : 0.25);
  if (f === "triangulo") doc.triangle(x, y - r, x + r, y + r * 0.8, x - r, y + r * 0.8, "FD");
  else if (f === "cuadrado") doc.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7, "FD");
  else if (f === "asterisco") {
    doc.setDrawColor(...rgb(color)); doc.setLineWidth(0.7);
    for (let k = 0; k < 4; k++) { const a = (Math.PI / 4) * k; doc.line(x - r * Math.cos(a), y - r * Math.sin(a), x + r * Math.cos(a), y + r * Math.sin(a)); }
  } else doc.circle(x, y, r, "FD");
}

const hitosTxt = (o) => (o.hitos_total ? `${o.hitos_hechos ?? 0} de ${o.hitos_total}` : "—");
const situacionRecepcion = (o) => {
  const d = o.dias_para_recepcion;
  return d == null ? "—" : d < 0 ? `vencida hace ${-d} días` : d === 0 ? "vence hoy" : `faltan ${d} días`;
};
const grupoRecepcion = (x) => {
  if (x.cat === "recibida") return "Con recepción definitiva";
  if (x.cat === "provisoria") return "Con recepción provisoria (falta la definitiva)";
  const d = x.o.dias_para_recepcion;
  return d == null ? "Sin fecha de fin (no se puede calcular el vencimiento)" : d < 0 ? "Vencidas"
    : d < 90 ? "Vencen en menos de 3 meses" : d < 180 ? "Vencen en 3 a 6 meses" : "Vencen en más de 6 meses";
};
const diasOrden = (x) => (x.cat === "recibida" ? 2e9 : x.cat === "provisoria" ? 1e9 + (x.o.dias_para_recepcion ?? 0) : x.o.dias_para_recepcion == null ? 1e8 : x.o.dias_para_recepcion);

// Qué columnas, grupos y orden lleva el informe de cada capa
function armadoInforme(id) {
  const porEtapa = { grupo: (x) => CAT[x.cat].nombre, ordenar: (a, b) => ORDEN_CAT.indexOf(a.cat) - ORDEN_CAT.indexOf(b.cat) || porCodigo(a, b) };
  const porVencimiento = { grupo: grupoRecepcion, ordenar: (a, b) => diasOrden(a) - diasOrden(b) || porCodigo(a, b) };
  if (id === "relev") return { simbolo: false, grupo: () => null, ordenar: porCodigo,
    cols: ["Código", "Descripción", "Latitud", "Longitud", "Z (m)"],
    fila: (o) => [o.codigo, o.descripcion, Number(o.lat).toFixed(6), Number(o.lon).toFixed(6), o.z == null || o.z === "" ? "—" : numero(o.z, 2)],
    anchos: { 1: { cellWidth: 110 } } };
  if (id === "obras") return { ...porEtapa,
    cols: ["Código", "Sala", "Localidad", "Departamento", "Licitación", "Tarea", "D.O.", "Hitos hechos"],
    fila: (o) => [o.codigo, o.sala, o.localidad, o.departamento, o.licitacion, o.tarea, o.director_obra, hitosTxt(o)] };
  if (id === "recep" || id === "term_e") return { ...(id === "term_e"
      ? { grupo: (x) => CAT[x.cat].nombre, ordenar: (a, b) => ORDEN_CAT.indexOf(a.cat) - ORDEN_CAT.indexOf(b.cat) || diasOrden(a) - diasOrden(b) || porCodigo(a, b) }
      : porVencimiento),
    cols: ["Código", "Estructura", "Licitación", "D.O.", "Fin de obra", "Vence la recepción", "Situación", "Recepción hecha"],
    fila: (o) => [o.codigo, o.estructura, o.licitacion, o.director_obra, fecha(o.fecha_fin), fecha(o.vence_recepcion), situacionRecepcion(o),
      conDefinitiva(o) ? "Definitiva" : conProvisoria(o) ? "Provisoria" : "Ninguna"],
    anchos: { 7: { fontStyle: "bold" } } };
  if (id === "est_todas") return { ...porEtapa,
    cols: ["Código", "Estructura", "Licitación", "Año", "D.O.", "Inicio", "Fin", "Recepción", "Hitos hechos"],
    fila: (o) => [o.codigo, o.estructura, o.licitacion, o.anio, o.director_obra, fecha(o.fecha_inicio), fecha(o.fecha_fin), o.recepcion, hitosTxt(o)] };
  return { ...porEtapa,
    cols: ["Código", "Estructura", "Licitación", "Año", "D.O.", "Inicio", "Fin previsto", "Hitos hechos", "Observaciones"],
    fila: (o) => [o.codigo, o.estructura, o.licitacion, o.anio, o.director_obra, fecha(o.fecha_inicio),
      o.fin_previsto ? fecha(o.fin_previsto) + (atrasada(o) ? " (pasado)" : "") : "", hitosTxt(o), o.observaciones],
    anchos: { 9: { cellWidth: 62 } } };
}

// PDF de una capa con las filas dadas (las de la Tabla: capa, filtros y búsqueda)
async function hacerInforme(boton, id, filas, respetar) {
  const original = boton.textContent;
  boton.disabled = true; boton.textContent = "Armando el PDF…";
  try {
    const JsPDF = await prepararPDF();
    const capa = CAPAS_LISTA.find((c) => c.id === id);
    const a = armadoInforme(id);
    const xs = [...filas].sort(a.ordenar);
    const conSimbolo = a.simbolo !== false;
    const cols = conSimbolo ? ["", ...a.cols] : a.cols;
    const anchos = {};
    for (const [k, v] of Object.entries(a.anchos || {})) anchos[conSimbolo ? Number(k) : Number(k) - 1] = v;
    const doc = new JsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    const pie = `${respetar ? "Con los filtros y las categorías tildadas en la web" : "Todos los elementos de la capa"} · datos ${S.datosDe ? cuandoTexto(S.datosDe) : "de hoy"}`;
    const cabeza = () => {
      doc.setFont("helvetica", "bold"); doc.setFontSize(15); doc.setTextColor(30);
      doc.text(capa.nombre, 12, 14);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(90);
      doc.text(`Seguimiento de obras OICI · ${fecha(hoy())}`, W - 12, 14, { align: "right" });
      doc.text(pie, 12, 19.5);
    };
    cabeza();
    if (!xs.length) {
      doc.setFontSize(11); doc.setTextColor(60);
      doc.text("No hay nada para listar" + (respetar ? " con los filtros y categorías elegidos." : " en esta capa."), 12, 32);
    } else {
      const body = [], meta = [], enlaces = [];
      let actual;
      for (const x of xs) {
        const g = a.grupo(x);
        if (g && g !== actual) {
          actual = g;
          const n = xs.filter((z) => a.grupo(z) === g).length;
          body.push([{ content: `${g}  (${n})`, colSpan: cols.length, styles: { fillColor: [236, 238, 240], fontStyle: "bold", textColor: 30 } }]);
          meta.push(null); enlaces.push(null);
        }
        const vals = a.fila(x.o), links = {};
        vals.forEach((v, i) => { if (v && typeof v === "object" && ENLACE in v && v[ENLACE]) links[i + (conSimbolo ? 1 : 0)] = v[ENLACE]; });
        body.push([...(conSimbolo ? [""] : []), ...vals.map((v) => (v && typeof v === "object" && ENLACE in v ? (v[ENLACE] ? "abrir" : "") : txt(v)))]);
        enlaces.push(links);
        meta.push(conSimbolo ? { f: forma(x.tipo, x.o), color: CAT[x.cat].color, borde: CAT[x.cat].recepcion ? "#e0c200" : "#555555" } : null);
      }
      doc.autoTable({
        startY: 25,
        head: [cols],
        body,
        theme: "grid",
        margin: { top: 25, left: 12, right: 12, bottom: 14 },
        styles: { font: "helvetica", fontSize: 8.5, cellPadding: 1.6, lineColor: [210, 210, 210], lineWidth: 0.15, textColor: 40, overflow: "linebreak" },
        headStyles: { fillColor: [60, 60, 60], textColor: 255, fontStyle: "bold" },
        columnStyles: { ...(conSimbolo ? { 0: { cellWidth: 7 }, 1: { fontStyle: "bold" } } : { 0: { fontStyle: "bold" } }), ...anchos },
        rowPageBreak: "avoid",
        // «abrir» en azul; el enlace se agrega al dibujar la celda
        didParseCell: (d) => {
          if (d.section === "body" && enlaces[d.row.index]?.[d.column.index]) d.cell.styles.textColor = [26, 102, 190];
        },
        didDrawCell: (d) => {
          const url = d.section === "body" ? enlaces[d.row.index]?.[d.column.index] : null;
          if (url) {
            const p = d.cell.padding("left"), y = d.cell.y + d.cell.height / 2 + 1.2, ancho = doc.getTextWidth("abrir");
            doc.setDrawColor(26, 102, 190); doc.setLineWidth(0.2);
            doc.line(d.cell.x + p, y, d.cell.x + p + ancho, y);
            doc.link(d.cell.x, d.cell.y, d.cell.width, d.cell.height, { url });
          }
          const m = conSimbolo && d.section === "body" && d.column.index === 0 ? meta[d.row.index] : null;
          if (m) simboloPDF(doc, m.f, d.cell.x + d.cell.width / 2, d.cell.y + d.cell.height / 2, 1.7, m.color, m.borde);
        },
        didDrawPage: () => cabeza(),
      });
    }
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i); doc.setFontSize(8); doc.setTextColor(120);
      doc.text(`Hoja ${i} de ${n}`, W - 12, H - 7, { align: "right" });
      doc.text(`${xs.length} en total`, 12, H - 7);
    }
    const archivo = `${capa.nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${hoy()}.pdf`;
    doc.save(archivo);
    aviso("PDF listo: se descargó " + archivo);
  } catch (e) {
    aviso("No se pudo armar el PDF: " + e.message, true);
  } finally {
    boton.disabled = false; boton.textContent = original;
  }
}

// ------------------------------------------------------------ tabla de atributos (en la computadora, como en QGIS)
// [campo de la web, título, tipo] — "editable" dice qué columna de la capa cambia
const COLUMNAS_TABLA = {
  estructura: [["codigo", "Código"], ["etapa_nombre", "Etapa"], ["estado", "Situación", "estado"], ["estructura", "Estructura"],
    ["licitacion", "Licitación"], ["anio", "Año"], ["director_obra", "D.O."], ["fecha_inicio", "Inicio", "fecha"], ["fecha_fin", "Fin", "fecha"],
    ["fin_previsto", "Fin previsto", "fecha"], ["recepcion", "Recepción"], ["vence_recepcion", "Vence recepción", "fecha"],
    ["dias_para_recepcion", "Días a recepción", "num"], ["hitos", "Hitos hechos"], ["planos", "Planos"], ["observaciones", "Observaciones"]],
  obra: [["codigo", "Código"], ["etapa_nombre", "Etapa"], ["estado", "Situación", "estado"], ["sala", "Sala"], ["localidad", "Localidad"],
    ["departamento", "Departamento"], ["licitacion", "Licitación"], ["tarea", "Tarea"], ["descripcion", "Tipo"], ["director_obra", "D.O."],
    ["fin_previsto", "Fin previsto", "fecha"], ["hitos", "Hitos hechos"], ["planos", "Planos"]],
  relevamiento: [["codigo", "Código"], ["descripcion", "Descripción"], ["lat", "Latitud", "num"], ["lon", "Longitud", "num"], ["z", "Z (m)", "num"]],
};
const SITUACIONES = [["PROY", "Proyecto"], ["CONS", "En obra"], ["FIN", "Terminada"]];
// columna editable de la capa para cada campo de la web
function columnaEditable(tipo, k) {
  if (k === "estado") return tipo === "estructura" ? ["ESTADO", "estado"] : tipo === "obra" ? ["Estado", "estado"] : null;
  const c = (CAMPOS_EDITABLES[tipo] || []).find((x) => x[1] === k);
  return c ? [c[0], c[3]] : null;
}
const T = { capa: "est_todas", texto: "", respetar: false, orden: "codigo", desc: false, sel: new Set() };

function valorTabla(x, k) {
  const o = x.o;
  if (k === "etapa_nombre") return x.cat ? CAT[x.cat].nombre : "";
  if (k === "hitos") return o.hitos_total ? `${o.hitos_hechos ?? 0} de ${o.hitos_total}` : "";
  if (k === "estado") return (SITUACIONES.find((s) => s[0] === o.estado) || [, o.estado ?? ""])[1];
  return o[k] ?? "";
}
function mostrarTabla(x, k, tipoCol) {
  const v = valorTabla(x, k);
  if (v === "" || v == null) return "";
  if (tipoCol === "fecha") return fecha(String(v).slice(0, 10));
  if (k === "lat" || k === "lon") return Number(v).toFixed(6);
  if (k === "planos") return `<a href="${esc(v)}" target="_blank" rel="noopener">abrir</a>`;
  return esc(v);
}

function abrirTabla() {
  if (MED.activo) terminarMedida();
  $("#tabla").hidden = false;
  document.body.classList.add("con-tabla");
  pintarTabla();
}
function cerrarTabla() {
  $("#tabla").hidden = true;
  document.body.classList.remove("con-tabla");
}

function filasTabla() {
  const t = normal(T.texto);
  const tipo = CAPAS_LISTA.find((c) => c.id === T.capa).tipo;
  const cols = COLUMNAS_TABLA[tipo];
  let xs = filasDeCapa(T.capa, T.respetar);
  if (t) xs = xs.filter((x) => cols.some(([k]) => normal(valorTabla(x, k)).includes(t)));
  const num = (v) => (v === "" || v == null || isNaN(Number(v)) ? null : Number(v));
  xs.sort((a, b) => {
    const va = valorTabla(a, T.orden), vb = valorTabla(b, T.orden);
    const na = num(va), nb = num(vb);
    let r;
    if (va === "" && vb !== "") r = 1;
    else if (vb === "" && va !== "") r = -1;
    else if (na != null && nb != null) r = na - nb;
    else r = String(va).localeCompare(String(vb), "es", { numeric: true });
    return T.desc ? -r : r;
  });
  return { xs, tipo, cols };
}

function pintarTabla() {
  const caja = $("#tabla");
  if (caja.hidden) return;
  // se conserva dónde estabas (antes, cada cambio volvía la tabla al principio)
  const viejo = caja.querySelector(".tabla-scroll");
  const pos = viejo && T.capaPintada === T.capa ? [viejo.scrollTop, viejo.scrollLeft] : [0, 0];
  T.capaPintada = T.capa;
  const { xs, tipo, cols } = filasTabla();
  const ids = new Set(xs.map((x) => x.o.id));
  for (const id of [...T.sel]) if (!ids.has(id)) T.sel.delete(id);
  const puede = editor() && tipo !== "relevamiento";
  const editables = puede ? cols.filter(([k]) => columnaEditable(tipo, k)) : [];
  const todosSel = xs.length && xs.every((x) => T.sel.has(x.o.id));
  const flecha = (k) => (T.orden === k ? (T.desc ? " ▾" : " ▴") : "");
  caja.innerHTML = `
    <div class="tabla-barra">
      <h2>Tabla de atributos</h2>
      <select id="t-capa" aria-label="Capa">${opcionesCapas(T.capa)}</select>
      <input id="t-buscar" type="search" placeholder="Buscar en la tabla" value="${esc(T.texto)}" aria-label="Buscar">
      <label class="t-check"><input type="checkbox" id="t-respetar" ${T.respetar ? "checked" : ""}> Respetar filtros y categorías</label>
      <span class="t-cuenta">${xs.length} fila${xs.length === 1 ? "" : "s"}${T.sel.size ? ` · ${T.sel.size} elegida${T.sel.size === 1 ? "" : "s"}` : ""}</span>
      <button class="boton boton-chico" type="button" id="t-pdf" title="PDF A4 de las filas de la tabla, listo para imprimir">Exportar PDF</button>
      <button class="boton boton-chico" type="button" id="t-excel">Exportar Excel</button>
      ${puede ? `<button class="boton boton-chico" type="button" id="t-importar" title="Subir un Excel exportado desde acá, con datos cambiados">Importar Excel</button>
        <input type="file" id="t-archivo" accept=".xlsx,.xls" hidden>` : ""}
      <button class="cerrar" type="button" id="t-cerrar" aria-label="Cerrar la tabla" title="Cerrar la tabla">✕</button>
    </div>
    <div class="tabla-import" id="t-import" hidden></div>
    ${puede ? `<form class="tabla-masivo" id="t-masivo" ${T.sel.size ? "" : "hidden"}>
      <b>Cambiar en ${T.sel.size} elegida${T.sel.size === 1 ? "" : "s"}:</b>
      <select name="campo" aria-label="Campo">${editables.map(([k, n]) => `<option value="${k}">${n}</option>`).join("")}</select>
      <span id="t-valor"></span>
      <button class="boton boton-primario boton-chico" type="submit">Aplicar</button>
      <span class="t-progreso" id="t-progreso"></span>
    </form>` : ""}
    <div class="tabla-scroll">
      <table class="tabla-datos">
        <thead><tr>
          ${puede ? `<th class="t-sel"><input type="checkbox" id="t-todos" ${todosSel ? "checked" : ""} aria-label="Elegir todas"></th>` : ""}
          <th class="t-sim"></th>
          ${cols.map(([k, n]) => `<th data-orden="${k}" class="${columnaEditable(tipo, k) && puede ? "editable" : ""}">${n}${flecha(k)}</th>`).join("")}
        </tr></thead>
        <tbody>
          ${xs.map((x) => `<tr data-id="${x.o.id}" class="${T.sel.has(x.o.id) ? "elegida" : ""}">
            ${puede ? `<td class="t-sel"><input type="checkbox" ${T.sel.has(x.o.id) ? "checked" : ""} aria-label="Elegir ${esc(x.o.codigo)}"></td>` : ""}
            <td class="t-sim">${x.cat ? simbolo(x.tipo, x.o, x.cat, 0.8) : svgRelev(9)}</td>
            ${cols.map(([k, , tc]) => `<td data-k="${k}" class="${columnaEditable(tipo, k) && puede ? "editable" : ""}${tc === "num" ? " num" : ""}">${mostrarTabla(x, k, tc)}</td>`).join("")}
          </tr>`).join("")}
        </tbody>
      </table>
      ${xs.length ? "" : `<p class="nota" style="padding:16px">No hay filas${T.texto ? " con esa búsqueda" : ""}.</p>`}
    </div>
    <p class="tabla-ayuda nota">${puede ? "Doble clic en una celda con fondo claro para editarla. Doble clic en el código abre la ficha. Elegí filas para cambiar un campo en todas juntas." : "Doble clic en una fila abre la ficha."}</p>`;

  const sc = caja.querySelector(".tabla-scroll");
  sc.scrollTop = pos[0]; sc.scrollLeft = pos[1];
  $("#t-cerrar").onclick = cerrarTabla;
  $("#t-capa").onchange = (ev) => { T.capa = ev.target.value; T.sel.clear(); T.orden = "codigo"; T.desc = false; pintarTabla(); };
  const b = $("#t-buscar");
  b.oninput = () => { T.texto = b.value; clearTimeout(T.timer); T.timer = setTimeout(() => { pintarTabla(); const nb = $("#t-buscar"); nb.focus(); nb.setSelectionRange(nb.value.length, nb.value.length); }, 250); };
  $("#t-respetar").onchange = (ev) => {
    T.respetar = ev.target.checked;
    if (T.respetar) verTab("filtros"); // abre los filtros al costado para ajustarlos
    pintarTabla();
  };
  $("#t-excel").onclick = (ev) => exportarExcel(T.capa, xs, ev.currentTarget);
  $("#t-pdf").onclick = (ev) => hacerInforme(ev.currentTarget, T.capa, xs, T.respetar || !!T.texto);
  const imp = $("#t-importar");
  if (imp) {
    imp.onclick = () => $("#t-archivo").click();
    $("#t-archivo").onchange = (ev) => { const f = ev.target.files[0]; if (f) importarExcel(f); ev.target.value = ""; };
  }
  caja.querySelectorAll("th[data-orden]").forEach((th) => (th.onclick = () => {
    const k = th.dataset.orden;
    T.desc = T.orden === k ? !T.desc : false;
    T.orden = k;
    pintarTabla();
  }));
  const todos = $("#t-todos");
  if (todos) todos.onchange = () => { xs.forEach((x) => (todos.checked ? T.sel.add(x.o.id) : T.sel.delete(x.o.id))); pintarTabla(); };
  const tbody = caja.querySelector("tbody");
  tbody.onchange = (ev) => {
    const tr = ev.target.closest("tr");
    if (!ev.target.matches(".t-sel input")) return;
    const id = Number(tr.dataset.id);
    ev.target.checked ? T.sel.add(id) : T.sel.delete(id);
    pintarTabla();
  };
  tbody.ondblclick = (ev) => {
    const td = ev.target.closest("td"), tr = ev.target.closest("tr");
    if (!td || !tr || td.classList.contains("t-sel")) return;
    const id = Number(tr.dataset.id), k = td.dataset.k;
    const x = xs.find((z) => z.o.id === id);
    if (td.classList.contains("editable") && k !== "codigo") return editarCelda(td, x, k, tipo);
    if (tipo === "relevamiento") abrirRelev(id); else abrirFicha(tipo, id);
  };
  const m = $("#t-masivo");
  if (m) {
    const ponerValor = () => { $("#t-valor").innerHTML = controlValor(tipo, m.campo.value, ""); };
    m.campo.onchange = ponerValor;
    ponerValor();
    m.onsubmit = (ev) => { ev.preventDefault(); aplicarMasivo(tipo, m.campo.value, leerControl($("#t-valor")), [...T.sel]); };
  }
}

// Control para escribir un valor según el tipo de campo
function controlValor(tipo, k, v) {
  const [, clase] = columnaEditable(tipo, k) || [];
  const val = esc(v ?? "");
  if (clase === "estado") return `<select data-valor>${SITUACIONES.map(([c, n]) => `<option value="${c}" ${v === c ? "selected" : ""}>${n}</option>`).join("")}</select>`;
  if (clase === "fecha") return `<input data-valor type="date" value="${esc(String(v ?? "").slice(0, 10))}">`;
  if (clase === "anio") return `<input data-valor type="number" min="1990" max="2100" value="${val}" placeholder="Año">`;
  if (clase === "recepcion") return `<select data-valor>${["", "RP", "RD"].map((c) => `<option value="${c}" ${v === c ? "selected" : ""}>${c || "(vacío)"}</option>`).join("")}</select>`;
  if (clase === "estructura") return `<select data-valor>${["", ...LISTA_ESTRUCTURA].map((c) => `<option ${v === c ? "selected" : ""}>${c}</option>`).join("")}</select>`;
  if (clase === "descripcion") return `<select data-valor>${["", "OBRA", "COSITIO"].map((c) => `<option ${v === c ? "selected" : ""}>${c}</option>`).join("")}</select>`;
  return `<input data-valor value="${val}" placeholder="Vacío para borrar">`;
}
const leerControl = (cont) => {
  const el = cont.querySelector("[data-valor]");
  const v = el.value.trim();
  return v === "" ? null : el.type === "number" ? Number(v) : v;
};

function editarCelda(td, x, k, tipo) {
  if (td.querySelector("[data-valor]")) return;
  const antes = td.innerHTML;
  td.classList.add("editando");
  td.innerHTML = controlValor(tipo, k, x.o[k]);
  const el = td.querySelector("[data-valor]");
  el.focus();
  let listo = false;
  const terminar = async (guardar) => {
    if (listo) return;
    listo = true;
    if (!guardar) { td.classList.remove("editando"); td.innerHTML = antes; return; }
    const v = leerControl(td);
    const viejo = x.o[k] == null || x.o[k] === "" ? null : String(x.o[k]).slice(0, el.type === "date" ? 10 : undefined);
    if (String(v ?? "") === String(viejo ?? "")) { td.classList.remove("editando"); td.innerHTML = antes; return; }
    const [col] = columnaEditable(tipo, k);
    td.innerHTML = '<span class="nota">Guardando…</span>';
    try {
      await S.api.guardarDatos(tipo, x.o.id, { [col]: v });
      x.o[k] = v;
      aviso("Guardado");
      await cargar();
    } catch (e) { aviso(e.message, true); }
    pintarTabla();
  };
  el.onkeydown = (ev) => { if (ev.key === "Enter") terminar(true); if (ev.key === "Escape") terminar(false); };
  el.onblur = () => terminar(true);
  if (el.tagName === "SELECT") el.onchange = () => terminar(true);
}

async function aplicarMasivo(tipo, k, v, ids) {
  const [col] = columnaEditable(tipo, k);
  const nombre = COLUMNAS_TABLA[tipo].find((c) => c[0] === k)[1];
  if (!ids.length) return;
  if (!confirm(`¿Poner ${nombre} = ${v ?? "(vacío)"} en ${ids.length} elemento${ids.length === 1 ? "" : "s"}?`)) return;
  const prog = $("#t-progreso"), boton = $("#t-masivo button[type=submit]");
  boton.disabled = true;
  let hechos = 0, errores = 0, ultimo = "";
  const cola = [...ids];
  const trabajar = async () => {
    while (cola.length) {
      const id = cola.shift();
      try { await S.api.guardarDatos(tipo, id, { [col]: v }); hechos++; }
      catch (e) { errores++; ultimo = e.message; }
      prog.textContent = `${hechos + errores} de ${ids.length}…`;
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, ids.length) }, trabajar));
  aviso(errores ? `Se cambiaron ${hechos}; fallaron ${errores}: ${ultimo}` : `${nombre} cambiado en ${hechos} elemento${hechos === 1 ? "" : "s"}`, errores > 0);
  await cargar();
  pintarTabla();
}


// ------------------------------------------------------------ Excel: exportar y volver a subir con cambios
async function prepararExcel() {
  // xlsx-js-style: SheetJS 0.18.5 que además escribe colores, bordes y letra
  await cargarScript("vendor/xlsx/xlsx-estilos.min.js");
  return window.XLSX;
}
const TITULO_CORTO = { "Planos (enlace a la carpeta)": "Planos" };
// Columnas de la hoja: [título, cómo leer el valor, columna de la capa si se puede cambiar, tipo]
function columnasExcel(tipo) {
  if (tipo === "relevamiento") return [
    ["ID", (x) => x.o.id], ["Código", (x) => x.o.codigo], ["Descripción", (x) => x.o.descripcion],
    ["Latitud", (x) => Number(x.o.lat)], ["Longitud", (x) => Number(x.o.lon)], ["Z (m)", (x) => (x.o.z == null || x.o.z === "" ? null : Number(x.o.z))]];
  const comoFecha = (v) => (v ? new Date(String(v).slice(0, 10) + "T12:00:00") : null);
  const cols = [["ID", (x) => x.o.id], ["Código", (x) => x.o.codigo], ["Etapa", (x) => CAT[x.cat].nombre],
    ["Situación", (x) => x.o.estado, tipo === "estructura" ? "ESTADO" : "Estado", "estado"]];
  for (const [col, k, etq, clase] of CAMPOS_EDITABLES[tipo]) {
    cols.push([TITULO_CORTO[etq] || etq, (x) => (clase === "fecha" ? comoFecha(x.o[k]) : clase === "anio" && x.o[k] != null && x.o[k] !== "" ? Number(x.o[k]) : x.o[k] ?? null), col, clase, k]);
  }
  if (tipo === "estructura") cols.push(["Vence recepción", (x) => comoFecha(x.o.vence_recepcion)], ["Días a recepción", (x) => x.o.dias_para_recepcion ?? null]);
  cols.push(["Hitos hechos", (x) => (x.o.hitos_total ? `${x.o.hitos_hechos ?? 0} de ${x.o.hitos_total}` : null)]);
  // mismo orden que la Tabla: Fin previsto al lado de Fin
  const iFin = cols.findIndex((c) => c[0] === "Fin"), iPrev = cols.findIndex((c) => c[0] === "Fin previsto");
  if (iFin >= 0 && iPrev > iFin + 1) cols.splice(iFin + 1, 0, ...cols.splice(iPrev, 1));
  return cols;
}

// Estilos del Excel, parecidos al PDF
const XL_BORDE = { style: "thin", color: { rgb: "D2D2D2" } };
const XL = {
  titulo: { font: { bold: true, sz: 15, color: { rgb: "1E1E1E" } } },
  sub: { font: { sz: 9, color: { rgb: "5A5A5A" } } },
  cabeza: { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "3C3C3C" } },
    alignment: { vertical: "center", wrapText: true }, border: { top: XL_BORDE, bottom: XL_BORDE, left: XL_BORDE, right: XL_BORDE } },
  celda: { font: { sz: 10, color: { rgb: "282828" } }, alignment: { vertical: "center" },
    border: { top: XL_BORDE, bottom: XL_BORDE, left: XL_BORDE, right: XL_BORDE } },
};
const hexXL = (c) => String(c || "").replace("#", "").toUpperCase().padStart(6, "0").slice(-6);
// letra blanca o negra según lo oscuro del color de fondo
function letraSobre(hex) {
  const n = parseInt(hexXL(hex), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? "1E1E1E" : "FFFFFF";
}

async function exportarExcel(id, filasTabla, boton) {
  let xs = filasTabla;
  const original = boton?.textContent;
  if (boton) { boton.disabled = true; boton.textContent = "Armando el Excel…"; }
  try {
    const XLSX = await prepararExcel();
    const capa = CAPAS_LISTA.find((c) => c.id === id);
    const cols = columnasExcel(capa.tipo);
    // mismo orden que el PDF (por etapa o por vencimiento)
    xs = [...xs].sort(armadoInforme(id).ordenar);
    const C = 3; // fila de los títulos de columna (0 = título de la hoja)
    const filas = [
      [capa.nombre], [`Seguimiento de obras OICI · exportado el ${fecha(hoy())} · ${xs.length} en total`], [],
      cols.map((c) => c[0]), ...xs.map((x) => cols.map((c) => c[1](x) ?? null))];
    const hoja = XLSX.utils.aoa_to_sheet(filas, { cellDates: true, dateNF: "dd/mm/yyyy" });
    const ref = (r, c) => XLSX.utils.encode_cell({ r, c });
    hoja.A1.s = XL.titulo;
    hoja.A2.s = XL.sub;
    cols.forEach(([titulo, , , clase], c) => {
      hoja[ref(C, c)].s = XL.cabeza;
      xs.forEach((x, i) => {
        const r = C + 1 + i, k = ref(r, c);
        if (!hoja[k]) hoja[k] = { t: "s", v: "" }; // vacía pero con bordes
        const cel = hoja[k];
        const st = { ...XL.celda, font: { ...XL.celda.font } };
        if (titulo === "Código") st.font.bold = true;
        if (titulo === "Etapa" && x.cat) {
          // el color de la etapa, como en el mapa y las referencias
          st.fill = { fgColor: { rgb: hexXL(CAT[x.cat].color) } };
          st.font.color = { rgb: letraSobre(CAT[x.cat].color) };
          st.font.bold = true;
        }
        if (titulo === "Fin previsto" && atrasada(x.o)) st.font = { ...st.font, bold: true, color: { rgb: "C0392B" } };
        if (titulo === "Días a recepción" && typeof cel.v === "number" && cel.v < 0) st.font = { ...st.font, bold: true, color: { rgb: "C0392B" } };
        if (clase === "url" && cel.v) {
          // Planos: la celda dice «abrir» y el enlace queda detrás (como en la Tabla de la web)
          const url = String(cel.v);
          hoja[k] = { t: "s", v: "abrir", l: { Target: url, Tooltip: url } };
          st.font = { ...st.font, underline: true, color: { rgb: "1A66BE" } };
        }
        if (cel.t === "d") hoja[k].z = "dd/mm/yyyy";
        hoja[k].s = st;
      });
    });
    hoja["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: filas.length - 1, c: cols.length - 1 } });
    hoja["!cols"] = cols.map(([t]) => ({ wch: t === "Observaciones" ? 40 : t === "Etapa" ? 30 : t === "Código" ? 12 : Math.max(10, t.length + 2) }));
    hoja["!rows"] = [{ hpt: 22 }, {}, { hpt: 6 }, { hpt: 20 }];
    hoja["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: C, c: 0 }, e: { r: filas.length - 1, c: cols.length - 1 } }) };
    const editables = cols.filter((c) => c[2]).map((c) => c[0]);
    const leeme = XLSX.utils.aoa_to_sheet([
      ["Seguimiento de obras OICI", ""],
      ["Capa", capa.nombre],
      ["Tipo", capa.tipo],
      ["Exportado", new Date().toLocaleString("es-UY")],
      [""],
      ["Cómo usar este archivo"],
      ["1. Podés cambiar los valores de estas columnas:", editables.join(", ") || "(ninguna: esta capa no se edita desde la web)"],
      ["2. No cambies la columna ID: es la que identifica cada fila en la base."],
      ["   En Planos la celda dice «abrir» y el enlace está detrás (Ctrl+clic para abrir la carpeta). Para cambiarlo, editá el hipervínculo o escribí el enlace nuevo en la celda."],
      ["3. Las demás columnas (Código, Etapa, vencimientos, hitos) son informativas: si las cambiás, no pasa nada."],
      ["4. Situación: PROY (proyecto), CONS (en obra) o FIN (terminada). Recepción: RP, RD, PD o PR."],
      ["5. Guardá el archivo y en la web andá a Tabla > Importar Excel. Antes de guardar te muestra la lista de cambios."],
    ]);
    leeme["!cols"] = [{ wch: 48 }, { wch: 90 }];
    leeme.A1.s = XL.titulo; leeme.A6.s = { font: { bold: true } };
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, capa.tipo === "obra" ? "Obras" : capa.tipo === "relevamiento" ? "Relevamiento" : "Estructuras");
    XLSX.utils.book_append_sheet(libro, leeme, "Leeme");
    const archivo = `${capa.nombre.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${hoy()}.xlsx`;
    XLSX.writeFile(libro, archivo, { cellDates: true });
    aviso("Excel listo: se descargó " + archivo);
  } catch (e) {
    aviso("No se pudo armar el Excel: " + e.message, true);
  } finally {
    if (boton) { boton.disabled = false; boton.textContent = original; }
  }
}

// Valor de una celda del Excel llevado al formato de la base
function normalizarExcel(v, clase) {
  if (v == null || (typeof v === "string" && v.trim() === "")) return null;
  if (clase === "fecha") {
    if (v instanceof Date) {
      // fecha local; si cae a última hora (redondeo de Excel), es el día siguiente
      const d = v.getHours() >= 18 ? new Date(v.getTime() + 6 * 3600e3) : v;
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    const s = String(v).trim();
    let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
    if (m) { const a = m[3].length === 2 ? "20" + m[3] : m[3]; return `${a}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; }
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    throw new Error(`"${s}" no es una fecha (usá dd/mm/aaaa)`);
  }
  if (clase === "anio") {
    const n = Number(String(v).trim());
    if (!Number.isInteger(n) || n < 1990 || n > 2100) throw new Error(`"${v}" no es un año`);
    return n;
  }
  if (clase === "estado") {
    const s = String(v).trim().toUpperCase();
    const m = { PROY: "PROY", PROYECTO: "PROY", CONS: "CONS", "EN OBRA": "CONS", FIN: "FIN", TERMINADA: "FIN" }[s];
    if (!m) throw new Error(`"${v}" no es una situación (PROY, CONS o FIN)`);
    return m;
  }
  if (clase === "recepcion") return String(v).trim().toUpperCase();
  return String(v).trim();
}
const igualBase = (antes, ahora, clase) => {
  const a = antes == null || antes === "" ? null : clase === "fecha" ? String(antes).slice(0, 10) : String(antes);
  return a === (ahora == null ? null : String(ahora));
};

async function importarExcel(archivo) {
  try {
    const XLSX = await prepararExcel();
    const libro = XLSX.read(await archivo.arrayBuffer(), { cellDates: true });
    const nombre = libro.SheetNames.find((n) => n !== "Leeme");
    const tipo = nombre === "Obras" ? "obra" : nombre === "Estructuras" ? "estructura" : null;
    if (!tipo) throw new Error("Este archivo no es un Excel exportado desde la web (o es de Relevamiento, que no se puede importar).");
    const ws = libro.Sheets[nombre];
    const filas = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: true });
    const r0 = XLSX.utils.decode_range(ws["!ref"] || "A1").s.r;
    // la fila de títulos es la que tiene «ID» (en los archivos nuevos hay un título arriba)
    const iCab = Math.max(0, filas.findIndex((f, i) => i < 15 && (f || []).some((t) => String(t ?? "").trim() === "ID")));
    const titulos = (filas[iCab] || []).map((t) => String(t ?? "").trim());
    const iId = titulos.indexOf("ID");
    if (iId < 0) throw new Error("Falta la columna ID.");
    const cols = columnasExcel(tipo).filter((c) => c[2]).map((c) => ({ titulo: c[0], col: c[2], clase: c[3], k: c[4] || "estado", i: titulos.indexOf(c[0]) }))
      .filter((c) => c.i >= 0);
    const porId = new Map(S.datos[tipo].map((o) => [o.id, o]));
    const cambios = [], problemas = [];
    let sinId = 0;
    for (const [n, f] of filas.entries()) {
      if (n <= iCab) continue;
      if (!f || f.every((v) => v == null || v === "")) continue;
      const id = Number(f[iId]), o = porId.get(id);
      if (!o) { sinId++; continue; }
      const c = {}, detalle = [];
      for (const col of cols) {
        let v;
        let bruto = f[col.i];
        if (col.clase === "url") {
          const celda = ws[XLSX.utils.encode_cell({ r: r0 + n, c: col.i })];
          if (celda?.l?.Target) bruto = celda.l.Target;            // «abrir» con su enlace detrás
          else if (/^abrir$/i.test(String(bruto ?? "").trim())) continue; // perdió el enlace: no se toca
        }
        try { v = normalizarExcel(bruto, col.clase); }
        catch (e) { problemas.push(`${o.codigo} · ${col.titulo}: ${e.message}`); continue; }
        if (!igualBase(o[col.k], v, col.clase)) {
          c[col.col] = v;
          const ver = (x) => (x == null || x === "" ? "vacío" : col.clase === "fecha" ? fecha(String(x).slice(0, 10)) : String(x));
          detalle.push(`${col.titulo}: ${ver(o[col.k])} → ${ver(v)}`);
        }
      }
      if (detalle.length) cambios.push({ id, codigo: o.codigo, c, detalle });
    }
    mostrarImportacion(tipo, archivo.name, cambios, problemas, sinId);
  } catch (e) {
    aviso("No se pudo leer el Excel: " + e.message, true);
  }
}

function mostrarImportacion(tipo, nombre, cambios, problemas, sinId) {
  const caja = $("#t-import");
  const n = cambios.reduce((s, x) => s + x.detalle.length, 0);
  caja.hidden = false;
  caja.innerHTML = `<div class="imp-cabeza"><b>${esc(nombre)}</b>
      <span>${cambios.length ? `${n} cambio${n === 1 ? "" : "s"} en ${cambios.length} ${tipo === "obra" ? "obra" : "estructura"}${cambios.length === 1 ? "" : "s"}` : "No hay cambios: el archivo tiene los mismos datos que la base."}</span>
      ${cambios.length ? `<button class="boton boton-primario boton-chico" type="button" id="imp-aplicar">Guardar estos cambios</button>` : ""}
      <button class="boton boton-chico" type="button" id="imp-cancelar">${cambios.length ? "Cancelar" : "Cerrar"}</button></div>
    ${problemas.length ? `<p class="imp-mal">No se toman ${problemas.length} valor${problemas.length === 1 ? "" : "es"} con problemas: ${problemas.slice(0, 6).map(esc).join(" · ")}${problemas.length > 6 ? " …" : ""}</p>` : ""}
    ${sinId ? `<p class="nota">${sinId} fila${sinId === 1 ? "" : "s"} sin un ID que exista en la base: se ignoran.</p>` : ""}
    ${cambios.length ? `<ul class="imp-lista">${cambios.map((x) => `<li><b>${esc(x.codigo)}</b> ${x.detalle.map(esc).join(" · ")}</li>`).join("")}</ul>` : ""}`;
  $("#imp-cancelar").onclick = () => { caja.hidden = true; caja.innerHTML = ""; };
  const ap = $("#imp-aplicar");
  if (ap) ap.onclick = async () => {
    ap.disabled = true;
    let hechos = 0, errores = 0, ultimo = "";
    const cola = [...cambios];
    const trabajar = async () => {
      while (cola.length) {
        const x = cola.shift();
        try { await S.api.guardarDatos(tipo, x.id, x.c); hechos++; }
        catch (e) { errores++; ultimo = `${x.codigo}: ${e.message}`; }
        ap.textContent = `Guardando ${hechos + errores} de ${cambios.length}…`;
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, cambios.length) }, trabajar));
    aviso(errores ? `Se actualizaron ${hechos}; fallaron ${errores}. ${ultimo}` : `Listo: ${hechos} actualizada${hechos === 1 ? "" : "s"} desde el Excel`, errores > 0);
    caja.hidden = true; caja.innerHTML = "";
    await cargar();
    pintarTabla();
  };
}

// ------------------------------------------------------------ ajustes (cuenta, mapa y datos guardados)
function pintarAjustes() {
  pintarSolicitudes();
  const rol = editor() ? "Editor" : "Solo lectura";
  $("#cuenta-detalle").textContent = [S.usuario?.email, rol,
    conObras() ? (S.perfil.iniciales_do ? "Director de obra " + S.perfil.iniciales_do : "Director de obra (sin elegir)") : "Ve todas las obras"].filter(Boolean).join(" · ");
  $("#mi-do").hidden = !conObras();
  $("#mi-do").textContent = S.perfil?.iniciales_do ? "Cambiar mi director de obra" : "Elegir mi director de obra";
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
  $("#ajustes-error").hidden = !S.ultimoError;
  if (S.ultimoError) $("#ajustes-error").textContent = `Último problema de conexión (${S.ultimoError.hora}): ${S.ultimoError.texto}`;
}

// ------------------------------------------------------------ referencias (la leyenda, como en QGIS)
function pintarReferencias() {
  const f = (tp, o, nm) => `<li>${svgForma(forma(tp, o), "#ffffff", "#7a7a7a", forma(tp, o) === "asterisco" ? 17 : 14)}<span>${nm}</span></li>`;
  const c = (cat, tp = "estructura", o = { estructura: "MONOPOLO" }) => `<li>${simbolo(tp, o, cat, 0.95)}<span>${esc(CAT[cat].nombre)}</span></li>`;
  const linea = '<svg width="18" height="12" viewBox="0 0 18 12" aria-hidden="true"><path d="M1 9 6 3l5 5 6-6" fill="none" stroke="#9a9a9a" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  $("#panel-referencias").innerHTML = `
    <section class="ajustes-bloque"><h3>Formas</h3><ul class="leyenda">
      ${f("estructura", { estructura: "MÁSTIL" }, "Mástil")}${f("estructura", { estructura: "MONOPOLO" }, "Monopolo")}
      ${f("obra", { descripcion: "OBRA" }, "Obra")}${f("obra", { descripcion: "COSITIO" }, "Cositio")}</ul></section>
    <section class="ajustes-bloque"><h3>Etapa de la obra (color)</h3><ul class="leyenda">
      ${c("proyecto")}${c("aprobado_e")}${c("hormigonado")}${c("montaje")}${c("infra")}</ul>
      <p class="nota" style="margin:8px 0 0">La etapa dice lo que se está haciendo; los hitos, lo que ya se terminó. En la capa Obras solo hay En proyecto, Proyecto aprobado y En infraestructura.</p></section>
    <section class="ajustes-bloque"><h3>Recepciones: terminadas sin recepción definitiva (borde amarillo)</h3><ul class="leyenda">
      ${c("plazo")}${c("r6")}${c("r3")}${c("vencida")}${c("sinfecha")}</ul></section>
    <section class="ajustes-bloque"><h3>Terminadas: todas con fin de obra (borde oscuro)</h3><ul class="leyenda">
      ${c("sinrecep")}${c("provisoria")}${c("recibida")}</ul>
      <p class="nota" style="margin:8px 0 0">Una terminada sin recepción definitiva está en las dos capas; si las dos están prendidas, se ve con el símbolo de Recepciones.</p></section>
    <section class="ajustes-bloque"><h3>Atraso</h3><ul class="leyenda">
      <li><span class="mk-demo">${simbolo("estructura", { estructura: "MONOPOLO" }, "montaje", 0.95)}<i class="atraso"></i></span><span>Punto rojo: pasó la fecha prevista de finalización y no está terminada</span></li></ul></section>
    <section class="ajustes-bloque"><h3>Capas de utilidad</h3><ul class="leyenda">
      <li>${svgRelev(11)}<span>Relevamiento</span></li><li>${linea}<span>Límites de departamentos</span></li></ul></section>`;
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
        : `<p class="nota" style="margin:0 0 6px 26px">Puntos tomados con el GPS, con su Z. Como en QGIS, se ven solo de cerca (1:20.000).${S.capaOn.relev && !relevDeCerca() ? ` <button type="button" class="enlace" id="acercar-relev">Acercar para verlos</button>` : ""}</p>`}
      <div class="nodo-capa">
        <span class="sim">${linea}</span>
        <label><input type="checkbox" name="deptos" ${S.deptosOn ? "checked" : ""}> Límites de departamentos</label>
        <span class="n">19</span>
      </div>
    </div>`;
  const ac = $("#acercar-relev", u);
  if (ac) ac.onclick = () => S.mapa.setZoom(ZOOM_RELEV);
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
  insignia("filtros", filtrosActivos(), "suave");
  if (UI.modo === "capas") pintarCapas();
  if (UI.modo === "filtros" && rehacerFiltros) pintarFiltros();
  if (UI.modo === "lista") pintarLista(v);
  if (UI.modo === "ajustes") pintarAjustes();
  if (UI.modo === "utilidad") pintarUtilidad();
  if (UI.modo === "referencias") pintarReferencias();
  return v;
}

function pintar(rehacerFiltros = true) {
  guardarEstado();
  pintarMapa(pintarPanel(rehacerFiltros));
  // la Tabla que respeta filtros se actualiza sola al cambiar filtros o categorías
  if (T.respetar && !$("#tabla").hidden && !document.querySelector("#tabla .editando")) pintarTabla();
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
    <span class="eti">${eti || esc(c.nombre)}${atrasada(o) ? ` <span class="atraso-txt">atrasada</span>` : ""}</span>
    <span class="sub">${esc(sub) || (tipo === "obra" ? "Obra" : "Estructura")}</span></li>`;
}

function enlazarFilas(cont) {
  cont.querySelectorAll(".fila").forEach((li) => {
    const abrir = () => abrirFicha(li.dataset.tipo, Number(li.dataset.id));
    li.onclick = abrir;
    li.onkeydown = (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); abrir(); } };
  });
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
  // al cruzar el zoom en que aparece Relevamiento, se vuelven a dibujar los puntos
  let cercaAntes = relevDeCerca();
  S.mapa.on("zoomend", () => {
    if (relevDeCerca() !== cercaAntes) {
      cercaAntes = relevDeCerca();
      if (S.capaOn.relev && S.datos.relev.length) pintar(false);
      if (UI.modo === "utilidad" && !UI.plegado) pintarUtilidad();
    }
  });
  const lejos = () => $("#mapa").classList.toggle("lejos", S.mapa.getZoom() < 8);
  S.mapa.on("zoomend", lejos); lejos();
}

function icono(tipo, o, cat) {
  const c = CAT[cat];
  const activo = S.abierta && S.abierta.tipo === tipo && S.abierta.id === o.id;
  const grande = forma(tipo, o) === "asterisco";
  const px = grande ? 18 : 13;
  return L.divIcon({
    className: `mk${activo ? " activo" : ""}`,
    html: `${simbolo(tipo, o, cat)}${atrasada(o) ? `<i class="atraso" title="Fin previsto pasado"></i>` : ""}<span style="left:${px + 3}px">${esc(o.codigo)}</span>`,
    iconSize: [px, px], iconAnchor: [px / 2, px / 2],
  });
}

function pintarMapa(v) {
  for (const m of S.marcadores.values()) m.remove();
  S.marcadores.clear();
  const puntos = [];
  for (const x of v) {
    if (x.o.lat == null || x.o.lon == null) continue;
    const m = L.marker([x.o.lat, x.o.lon], { icon: icono(x.tipo, x.o, x.cat), title: `${x.o.codigo}: ${CAT[x.cat].nombre}`, keyboard: false,
      zIndexOffset: PRIORIDAD[CAT[x.cat].grupo] || 0 })
      .on("click", (ev) => (MED.activo ? agregarMedida(ev.target.getLatLng()) : abrirFicha(x.tipo, x.o.id))).addTo(S.mapa);
    S.marcadores.set(`${x.tipo}:${x.o.id}`, m);
    puntos.push([x.o.lat, x.o.lon]);
  }
  for (const r of relevFiltrados()) {
    if (!S.capaOn.relev || !relevDeCerca() || r.lat == null || r.lon == null) continue;
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
    if (i >= 0) {
      const cambio = JSON.stringify(lista[i]) !== JSON.stringify(o);
      lista[i] = o;
      guardarDatos();
      if (cambio) pintar(false);
    }
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
  const clave = ["r6", "r3", "vencida", "plazo", "sinfecha", "sinrecep", "provisoria"].includes(cat) ? "recepcion" : cat === "terminada" ? "terminada" : cat;
  const pos = Math.max(0, pasos.indexOf(clave));
  const hechas = new Set((hitos || []).filter((h) => h.estado === "HECHO" && h.etapa).map((h) => h.etapa));
  const tramos = pasos.map((p, i) => {
    const col = CAT[p]?.color || c.color;
    // ej.: infraestructura terminada antes del montaje: el tramo verde queda lleno aunque la obra esté en montaje
    // los tramos de obra (hormigonado, montaje, infraestructura) siguen a su hito, no al orden
    const deObra = hitos && [3, 4, 5].includes(HITO_TRAMO[p]);
    const cls = i === pos ? "tramo actual"
      : deObra ? (hechas.has(HITO_TRAMO[p]) ? "tramo hecho" : "tramo")
      : i < pos || hechas.has(HITO_TRAMO[p]) ? "tramo hecho" : "tramo";
    return `<span class="${cls}" style="--c:${i === pos ? c.color : col}" title="${esc(CAT[p]?.nombre || NOMBRE_TRAMO[p])}"></span>`;
  }).join("");
  const detalle = tipo === "estructura" && (c.recepcion || cat === "plazo") && o.dias_para_recepcion != null
    ? (o.dias_para_recepcion < 0 ? `vencida hace ${-o.dias_para_recepcion} días` : `vence el ${fecha(o.vence_recepcion)}`) : "";

  const datos = tipo === "estructura"
    ? [["Estructura", o.estructura], ["Licitación", o.licitacion], ["Año", o.anio], ["Director de obra", o.director_obra],
       ["Inicio", fecha(o.fecha_inicio)], ["Fin", fecha(o.fecha_fin)], ["Recepción", o.recepcion || "—"],
       ["Fin previsto", fecha(o.fin_previsto)], ["Observaciones", o.observaciones]]
    : [["Sala", o.sala], ["Localidad", o.localidad], ["Departamento", o.departamento], ["Licitación", o.licitacion],
       ["Tarea", o.tarea], ["Descripción", o.descripcion], ["Director de obra", o.director_obra], ["Fin previsto", fecha(o.fin_previsto)]];
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
        : hitos.length ? hitos.map((h) => hitoHtml(h) + (h.etapa === 2 && h.estado === "HECHO" ? finPrevistoHtml(o) : "")).join("")
        : `<p class="nota">Esta obra no tiene hitos cargados.</p>`}
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
        <p class="nota" style="margin-top:6px">${tipo === "estructura" ? 'Pasa sola a "En obra" al marcar Implantado, y a "Terminada" con Hormigonado, Montado e Infraestructura finalizada.' : 'Pasá a "En obra" cuando arranca. El fin se marca con su hito.'}</p>` : ""}
    </div>
    ${bloqueBorrar(tipo, o)}`;

  enlazarCerrar(ficha, cerrarFicha);
  enlazarBorrar(ficha, tipo, o);
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
  const fp = $("#fin-previsto", ficha);
  if (fp) fp.onchange = async () => {
    try {
      await S.api.guardarDatos(tipo, o.id, { "FIN PREVISTO": fp.value || null });
      aviso(fp.value ? `Fin previsto: ${fecha(fp.value)}` : "Fin previsto borrado");
      await abrirFicha(tipo, o.id);
    } catch (e) { aviso(e.message, true); }
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

// Debajo del hito de proyecto aprobado: fecha prevista de finalización (se puede cambiar cuando sea)
function finPrevistoHtml(o) {
  const tarde = atrasada(o);
  const estado = !o.fin_previsto ? "Sin fecha prevista"
    : o.estado === "FIN" ? "Obra terminada"
    : tarde ? `Pasada hace ${diasAtraso(o)} día${diasAtraso(o) === 1 ? "" : "s"}`
    : `Faltan ${-diasAtraso(o)} días`;
  return `<div class="fin-previsto${tarde ? " tarde" : ""}">
    <label for="fin-previsto">Fin previsto</label>
    ${editor() ? `<input type="date" id="fin-previsto" value="${esc(String(o.fin_previsto || "").slice(0, 10))}">` : `<b>${fecha(o.fin_previsto)}</b>`}
    <span>${estado}</span></div>`;
}

function hitoHtml(h) {
  const hecho = h.estado === "HECHO";
  const dis = editor() ? "" : "disabled";
  return `<div class="hito${hecho ? " hecho" : ""}" data-id="${h.id}">
    <input type="checkbox" ${hecho ? "checked" : ""} ${dis} aria-label="${esc(h.nombre)} hecho">
    <span class="nom">${esc(h.nombre)}</span>
    ${hecho ? `<input type="date" value="${h.fecha_real || ""}" ${dis} aria-label="Fecha de ${esc(h.nombre)}">`
      // infraestructura: se puede marcar "en curso" (se está haciendo antes del montaje)
      : h.etapa === 5 && h.estructura_id && editor()
      ? `<button type="button" class="en-curso" aria-pressed="${h.estado === "EN CURSO"}" title="Marcá si se está haciendo la infraestructura">${h.estado === "EN CURSO" ? "En curso" : "¿En curso?"}</button>`
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
  const ec = row.querySelector(".en-curso");
  if (ec) ec.onclick = () => {
    ec.disabled = true;
    ec.getAttribute("aria-pressed") === "true"
      ? guardar({ estado: "PENDIENTE" }, "Infraestructura vuelta a pendiente")
      : guardar({ estado: "EN CURSO" }, "Infraestructura en curso: la estructura pasa a En infraestructura");
  };
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
  const dirs = todosLosDO();
  const pend = cuentas.filter((c) => !c.habilitado), con = cuentas.filter((c) => c.habilitado);
  const tipoSel = (con) => `<select name="tipo"><option value="obras" ${con ? "selected" : ""}>Con obras (director de obra)</option>
      <option value="todas" ${con ? "" : "selected"}>Ve todas las obras</option></select>`;
  const doSel = (actual, con) => {
    const lista = [...new Set([...dirs, ...(actual ? [actual] : [])])].sort((a, b) => a.localeCompare(b, "es"));
    return `<div class="campo-do" ${con ? "" : "hidden"}><label>Director de obra<select name="ini">
        <option value="">Que lo elija el usuario al entrar</option>
        ${lista.map((d) => `<option ${d === actual ? "selected" : ""}>${esc(d)}</option>`).join("")}
        <option value="__otro">Otro (escribir)…</option></select></label>
      <input name="ini_otro" placeholder="Iniciales como figuran en D.O., ej. G.S." autocomplete="off" hidden></div>`;
  };
  const tipoTexto = (c) => (c.con_obras ?? !!c.iniciales_do) ? `con obras${c.iniciales_do ? " · " + esc(c.iniciales_do) : " · D.O. sin elegir"}` : "ve todas";
  const rolSel = (r) => `<select name="rol"><option value="EDITOR" ${r === "EDITOR" ? "selected" : ""}>Editor</option><option value="LECTOR" ${r === "LECTOR" ? "selected" : ""}>Solo lectura</option></select>`;
  const reg = (c) => (c.registrado ? "se registró el " + fecha(String(c.registrado).slice(0, 10)) : "");
  caja.innerHTML = `<div class="ficha-cabeza">${barraCerrar("Volver al mapa")}<h2 class="admin-titulo">Usuarios</h2>
      <p class="nota">Quien se registra en la web aparece acá. Habilitalo para que vea las obras.</p></div>
    <div class="ficha-bloque">
      <h2>Esperando habilitación <span class="cuenta">${pend.length || ""}</span></h2>
      ${pend.length ? pend.map((c) => `<form class="form cuenta-form" data-id="${esc(c.user_id)}">
          <p class="cuenta-mail"><b>${esc(c.email)}</b><br><small>${esc(c.nombre_cuenta || "")} ${reg(c)}</small></p>
          <label>Nombre<input name="nombre" value="${esc(c.nombre_cuenta || "")}" required></label>
          <div class="dos"><label>Permiso${rolSel("EDITOR")}</label>
          <label>Tipo de usuario${tipoSel(false)}</label></div>
          ${doSel("", false)}
          <button class="boton boton-primario" type="submit">Habilitar</button>
        </form>`).join("") : `<p class="nota">No hay cuentas nuevas. Cuando alguien use "Crear cuenta" en la web, va a aparecer acá.</p>`}
    </div>
    <div class="ficha-bloque">
      <h2>Con acceso <span class="cuenta">${con.length}</span></h2>
      ${con.map((c) => `<form class="form cuenta-form" data-id="${esc(c.user_id)}">
          <p class="cuenta-mail"><b>${esc(c.nombre)}</b>${c.admin ? ' <span class="etiqueta">administrador</span>' : ""}<br><small>${esc(c.email)} · ${tipoTexto(c)}</small></p>
          <input type="hidden" name="nombre" value="${esc(c.nombre)}">
          <div class="dos"><label>Permiso${rolSel(c.rol)}</label>
          <label>Tipo de usuario${tipoSel(c.con_obras ?? !!c.iniciales_do)}</label></div>
          ${doSel(c.iniciales_do || "", c.con_obras ?? !!c.iniciales_do)}
          <div class="acciones"><button class="boton" type="submit">Guardar cambios</button>
          ${c.user_id === S.perfil.user_id ? "" : `<button class="boton boton-peligro" type="button" data-quitar>Quitar acceso</button>`}</div>
        </form>`).join("")}
    </div>`;
  enlazarCerrar(caja, () => { caja.hidden = true; });
  caja.querySelectorAll(".cuenta-form").forEach((f) => {
    const campoDO = f.querySelector(".campo-do");
    f.tipo.onchange = () => (campoDO.hidden = f.tipo.value !== "obras");
    f.ini.onchange = () => { f.ini_otro.hidden = f.ini.value !== "__otro"; if (!f.ini_otro.hidden) f.ini_otro.focus(); };
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      const con = f.tipo.value === "obras";
      const ini = !con ? "" : f.ini.value === "__otro" ? f.ini_otro.value.trim() : f.ini.value;
      if (con && f.ini.value === "__otro" && !ini) { f.ini_otro.focus(); return aviso("Escribí las iniciales del director de obra.", true); }
      f.querySelectorAll("button").forEach((b) => (b.disabled = true));
      try {
        const r = await S.api.adminHabilitar(f.dataset.id, f.nombre.value.trim(), f.rol.value, ini, con);
        aviso(f.closest(".ficha-bloque").querySelector("h2").textContent.startsWith("Esperando") ? `${f.nombre.value} habilitado` : "Cambios guardados");
        if (r?.sinTipo) aviso("Se guardó el permiso, pero para el tipo de usuario falta correr sql/parte14_tipo_usuario.sql en Neon.", true);
        if (f.dataset.id === S.perfil.user_id) {
          S.perfil = await S.api.perfil();
          if (!conObras() || !S.perfil.iniciales_do) S.f.mias = false;
          guardarDatos(); pintar(); pintarAjustes();
        }
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

// ------------------------------------------------------------ mi director de obra (usuarios "con obras")
// Se pregunta la primera vez que entra un usuario con obras que todavía no tiene D.O.;
// también se puede cambiar desde Ajustes > Mi cuenta.
function preguntarDO(desdeAjustes) {
  document.querySelector(".modal-fondo")?.remove();
  const actual = S.perfil?.iniciales_do || "";
  const dirs = [...new Set([...todosLosDO(), ...(actual ? [actual] : [])])].sort((a, b) => a.localeCompare(b, "es"));
  const fondo = document.createElement("div");
  fondo.className = "modal-fondo";
  fondo.innerHTML = `<form class="modal form" novalidate role="dialog" aria-modal="true" aria-labelledby="titulo-do">
      <h2 id="titulo-do">¿Qué director de obra sos?</h2>
      <p class="nota">Elegí cómo figurás en el campo D.O. de las obras. Al entrar vas a ver primero las tuyas (filtro «Mis obras»), y podés ver todas cuando quieras.</p>
      <label>Director de obra<select name="ini">
        <option value="">Elegí…</option>
        ${dirs.map((d) => `<option ${d === actual ? "selected" : ""}>${esc(d)}</option>`).join("")}
        <option value="__otro">No estoy en la lista (escribir)…</option></select></label>
      <input name="otro" placeholder="Tus iniciales como van en D.O., ej. G.S." autocomplete="off" hidden>
      <p class="error" hidden></p>
      <div class="dos">
        <button class="boton" type="button" data-luego>${desdeAjustes ? "Cancelar" : "Ahora no"}</button>
        <button class="boton boton-primario" type="submit">Guardar</button>
      </div>
    </form>`;
  document.body.append(fondo);
  const f = fondo.querySelector("form"), err = f.querySelector(".error");
  const cerrar = () => fondo.remove();
  f.querySelector("[data-luego]").onclick = cerrar;
  fondo.addEventListener("keydown", (ev) => { if (ev.key === "Escape") cerrar(); });
  f.ini.onchange = () => { f.otro.hidden = f.ini.value !== "__otro"; if (!f.otro.hidden) f.otro.focus(); };
  f.ini.focus();
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    const ini = f.ini.value === "__otro" ? f.otro.value.trim() : f.ini.value;
    if (!ini) { err.textContent = "Elegí tu nombre de la lista o escribí tus iniciales."; err.hidden = false; return; }
    const b = f.querySelector("[type=submit]");
    b.disabled = true; b.textContent = "Guardando…";
    try {
      await S.api.elegirMiDO(ini);
      S.perfil = { ...S.perfil, iniciales_do: ini };
      S.f.mias = true;
      guardarDatos();
      cerrar();
      aviso(`Guardado (${ini}). Ahora ves tus obras`);
      pintar();
      if (UI.modo === "ajustes" && !UI.plegado) pintarAjustes();
    } catch (e) {
      err.textContent = e.message; err.hidden = false;
      b.disabled = false; b.textContent = "Guardar";
    }
  };
}

// ------------------------------------------------------------ sugerencias propias (en lugar de <datalist>)
// En Android la lista de un <datalist> sale como una tira arriba del teclado y casi no se ve.
// Cada campo con lista muestra sus opciones en un desplegable propio debajo (o arriba) del campo.
// En el campo D.O. se pueden poner varios directores separados con "/": se completa el último.
const SG = { caja: null, campo: null, items: [], activa: -1 };
function convertirListas(raiz) {
  raiz.querySelectorAll?.("input[list]").forEach((i) => {
    i.dataset.lista = i.getAttribute("list");
    i.removeAttribute("list");
    i.setAttribute("autocomplete", "off");
  });
}
convertirListas(document);
new MutationObserver((cambios) => {
  for (const c of cambios) for (const n of c.addedNodes) if (n.nodeType === 1) convertirListas(n.matches("input[list]") ? n.parentNode : n);
}).observe(document.body, { childList: true, subtree: true });

const variosDO = (input) => input.name === "D.O.";
function parteActual(input) {
  const v = input.value;
  if (!variosDO(input)) return { antes: "", texto: v };
  const i = v.lastIndexOf("/");
  return { antes: v.slice(0, i + 1), texto: v.slice(i + 1) };
}
function cerrarSugerencias() {
  SG.caja?.remove();
  SG.caja = null; SG.campo = null; SG.items = []; SG.activa = -1;
}
function mostrarSugerencias(input) {
  const dl = document.getElementById(input.dataset.lista);
  const todasOp = dl ? [...new Set([...dl.options].map((o) => o.value).filter(Boolean))] : [];
  const t = clave(parteActual(input).texto);
  const items = (t ? todasOp.filter((o) => clave(o).includes(t)) : todasOp).slice(0, 80);
  // si lo escrito ya es exactamente la única opción, no hace falta mostrar nada
  if (!items.length || (items.length === 1 && clave(items[0]) === t)) return cerrarSugerencias();
  if (!SG.caja) {
    SG.caja = document.createElement("ul");
    SG.caja.className = "sugerencias";
    SG.caja.setAttribute("role", "listbox");
    // pointerdown: elige sin sacarle el foco al campo
    SG.caja.addEventListener("pointerdown", (ev) => {
      const li = ev.target.closest("li");
      if (!li) return;
      ev.preventDefault();
      elegirSugerencia(Number(li.dataset.i));
    });
    document.body.append(SG.caja);
  }
  SG.campo = input; SG.items = items; SG.activa = -1;
  SG.caja.innerHTML = items.map((o, i) => `<li role="option" data-i="${i}">${esc(o)}</li>`).join("");
  ubicarSugerencias();
}
function ubicarSugerencias() {
  if (!SG.caja || !SG.campo) return;
  const r = SG.campo.getBoundingClientRect();
  if (r.bottom < 0 || r.top > innerHeight) return cerrarSugerencias();
  const vv = window.visualViewport;
  const alto = vv ? vv.height + vv.offsetTop : innerHeight; // el teclado del celular achica la parte visible
  const abajo = alto - r.bottom - 8, arriba = r.top - 8;
  const haciaArriba = abajo < 150 && arriba > abajo;
  Object.assign(SG.caja.style, {
    left: `${r.left}px`, width: `${r.width}px`,
    top: haciaArriba ? "" : `${r.bottom + 2}px`,
    bottom: haciaArriba ? `${innerHeight - r.top + 2}px` : "",
    maxHeight: `${Math.max(110, Math.min(260, haciaArriba ? arriba : abajo))}px`,
  });
}
function elegirSugerencia(i) {
  const input = SG.campo, v = SG.items[i];
  if (!input || v == null) return;
  input.value = parteActual(input).antes + v;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
  cerrarSugerencias();
}
document.addEventListener("focusin", (ev) => {
  if (ev.target.matches?.("input[data-lista]")) mostrarSugerencias(ev.target);
});
document.addEventListener("input", (ev) => {
  if (ev.target.matches?.("input[data-lista]") && ev.isTrusted) mostrarSugerencias(ev.target);
});
document.addEventListener("focusout", (ev) => {
  if (ev.target === SG.campo) setTimeout(() => { if (document.activeElement !== SG.campo) cerrarSugerencias(); }, 120);
});
document.addEventListener("keydown", (ev) => {
  if (!SG.caja || ev.target !== SG.campo) return;
  if (ev.key === "Escape") { ev.stopPropagation(); return cerrarSugerencias(); }
  if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
    ev.preventDefault();
    SG.activa = (SG.activa + (ev.key === "ArrowDown" ? 1 : -1) + SG.items.length) % SG.items.length;
    SG.caja.querySelectorAll("li").forEach((li, i) => li.classList.toggle("activa", i === SG.activa));
    SG.caja.children[SG.activa]?.scrollIntoView({ block: "nearest" });
  } else if (ev.key === "Enter" && SG.activa >= 0) { ev.preventDefault(); elegirSugerencia(SG.activa); }
}, true);
document.addEventListener("scroll", (ev) => { if (SG.caja && ev.target !== SG.caja) ubicarSugerencias(); }, true);
window.visualViewport?.addEventListener("resize", ubicarSugerencias);
window.addEventListener("resize", ubicarSugerencias);

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
  if (!TITULOS_PANEL[UI.modo]) UI.modo = "capas";
  $("#titulo-panel").textContent = TITULOS_PANEL[UI.modo];
  document.querySelectorAll("[data-panel]").forEach((d) => (d.hidden = d.dataset.panel !== UI.modo));
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
const TITULOS_PANEL = { capas: "Capas de obra", filtros: "Filtros", lista: "Lista de lo visible",
  utilidad: "Capas de utilidad", referencias: "Referencias", ajustes: "Ajustes" };
// Número chico sobre un botón de la izquierda (filtros activos, pedidos de borrado)
function insignia(modo, n, clase = "") {
  const a = document.querySelector(`.ctrl-paneles a[data-modo="${modo}"]`);
  if (!a) return;
  let ins = a.querySelector(".insignia");
  if (n && !ins) { ins = document.createElement("span"); a.append(ins); }
  if (ins) { ins.className = `insignia ${clase}`; ins.textContent = n || ""; ins.hidden = !n; }
}

// Botones a la izquierda del mapa: abren y cierran el panel de Capas o el de Ajustes.
function abrirModo(modo) {
  if (!UI.plegado && UI.modo === modo) return plegar(true);
  UI.modo = modo;
  UI.plegado = false;
  guardarUI(); aplicarUI();
  pintarPanel();
}
function agregarBotonesPaneles() {
  const ICONOS = {
    utilidad: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 21s-6-5.6-6-10.4a6 6 0 0 1 12 0C18 15.4 12 21 12 21z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9.2 10.6h5.6M12 7.8v5.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    referencias: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 4.5 8 9.5H2zM20.5 6.8h-9.5M20.5 12.3h-9.5M20.5 17.8h-9.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/><circle cx="5" cy="12.3" r="2.2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="3" y="15.8" width="4" height="4" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>',
    filtros: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M3.5 5h17l-6.6 7.8v5.6l-3.8 1.8v-7.4z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    lista: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 6.5h11.5M9 12h11.5M9 17.5h11.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="4.8" cy="6.5" r="1.4" fill="currentColor"/><circle cx="4.8" cy="12" r="1.4" fill="currentColor"/><circle cx="4.8" cy="17.5" r="1.4" fill="currentColor"/></svg>',
    capas: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 3.5 21 8l-9 4.5L3 8z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="m3 12 9 4.5 9-4.5M3 16l9 4.5 9-4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    ajustes: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M10.3 2.8h3.4l.5 2.6 1.6.9 2.5-.9 1.7 2.9-2 1.8v1.8l2 1.8-1.7 2.9-2.5-.9-1.6.9-.5 2.6h-3.4l-.5-2.6-1.6-.9-2.5.9-1.7-2.9 2-1.8v-1.8l-2-1.8 1.7-2.9 2.5.9 1.6-.9z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.8" fill="none" stroke="currentColor" stroke-width="1.7"/></svg>',
  };
  const Ctrl = L.Control.extend({
    options: { position: "topleft" },
    onAdd() {
      const div = L.DomUtil.create("div", "leaflet-bar ctrl-paneles");
      for (const [modo, titulo] of [["capas", "Capas de obra"], ["filtros", "Filtros"], ["lista", "Lista de lo que se ve en el mapa"], ["utilidad", "Capas de utilidad: relevamiento y departamentos"], ["referencias", "Referencias: qué quiere decir cada símbolo"], ["ajustes", "Ajustes: cuenta, mapa y datos guardados"]]) {
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
  if (PG.marcas) { PG.marcas.remove(); PG.marcas = null; }
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
      <p class="nota" style="margin:0">Buscá las coordenadas o tocá el mapa. Después podés arrastrar la marca para corregir la ubicación.</p>
      <button class="boton boton-chico boton-pegar" type="button" id="abrir-pegar">Pegar varios desde QGIS</button></div>
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
  $("#abrir-pegar").onclick = async () => {
    let lote = null;
    try { lote = leerPegado(await navigator.clipboard.readText()); } catch (e) { /* sin permiso: se pega a mano */ }
    abrirPegar(lote);
  };
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

// ------------------------------------------------------------ pegar elementos copiados en QGIS (Ctrl+C en QGIS, Ctrl+V acá)
// QGIS copia las entidades seleccionadas como texto: una fila de títulos y una fila por entidad,
// separadas por tabulaciones, con la geometría en WKT (columna wkt_geom). También puede copiar GeoJSON.
// Las coordenadas vienen en el sistema de la capa de QGIS (en este proyecto, UTM 21 S) o en grados.
const PG = { lote: null, capa: "estructura", sistema: "auto", saltearRepetidos: true, marcas: null, corriendo: false, cancelar: false };
const clave = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, "");
// columnas que no se copian: las pone o las calcula la base
const NO_SE_COPIAN = new Set(["WKTGEOM", "FID", "ID", "GEOM", "ETAPA", "LAT", "LONG", "LON", "MAPS", "WAZE"].map(clave));
const SISTEMAS = {
  utm21: "UTM 21 S (EPSG 31981 / 32721, el de la capa en QGIS)",
  utm22: "UTM 22 S (EPSG 31982 / 32722)",
  grados: "Grados, WGS 84 (EPSG 4326)",
};

// UTM (hemisferio sur) a latitud y longitud; elipsoide GRS 80 (SIRGAS 2000, igual a WGS 84 para esto)
function utmAGrados(x, y, zona) {
  const a = 6378137, f = 1 / 298.257222101, k0 = 0.9996, e2 = f * (2 - f), ep2 = e2 / (1 - e2);
  const X = x - 500000, M = (y - 10000000) / k0;
  const mu = M / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const p1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + (151 * e1 ** 3 / 96) * Math.sin(6 * mu) + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
  const s = Math.sin(p1), c = Math.cos(p1), t = Math.tan(p1);
  const N1 = a / Math.sqrt(1 - e2 * s * s), T1 = t * t, C1 = ep2 * c * c, R1 = a * (1 - e2) / (1 - e2 * s * s) ** 1.5, D = X / (N1 * k0);
  const lat = p1 - (N1 * t / R1) * (D ** 2 / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * ep2) * D ** 4 / 24
    + (61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * ep2 - 3 * C1 ** 2) * D ** 6 / 720);
  const lon = (zona * 6 - 183) * Math.PI / 180 + (D - (1 + 2 * T1 + C1) * D ** 3 / 6
    + (5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * ep2 + 24 * T1 ** 2) * D ** 5 / 120) / c;
  return { lat: lat * 180 / Math.PI, lon: lon * 180 / Math.PI };
}

// Geometría WKT -> { x, y, z } del punto, o { tipo } si no es un punto
function leerWkt(w) {
  const s = String(w || "").trim();
  if (!s) return { tipo: "sin geometría" };
  // QGIS escribe "PointZ", "MultiPointZ", "Point Z"…: se saca la Z o M del final
  const tipo = (s.match(/^[A-Za-z]+/) || [""])[0].toUpperCase().replace(/(Z|M|ZM)$/, "").replace(/^(MULTI)?(POINT|POLYGON|LINESTRING|CURVE).*/, "$1$2");
  if (tipo !== "POINT" && tipo !== "MULTIPOINT") {
    const nombres = { POLYGON: "un polígono", MULTIPOLYGON: "un polígono", LINESTRING: "una línea", MULTILINESTRING: "una línea" };
    return { tipo: nombres[tipo] || "otra geometría" };
  }
  const n = s.match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi);
  if (!n || n.length < 2) return { tipo: "punto vacío" };
  const tieneZ = /^\s*(multi)?point\s*z/i.test(s);
  // en un multipunto se toma el primero
  const primero = s.replace(/^[^(]*\(+/, "").split(/[,)]/)[0].trim().split(/\s+/).map(Number);
  return { x: primero[0], y: primero[1], z: tieneZ && primero.length > 2 ? primero[2] : null, varios: tipo === "MULTIPOINT" && /,/.test(s) };
}

// Texto del portapapeles -> { titulos, filas: [{ datos, geo }] } o null si no parece copiado de QGIS
function leerPegado(texto) {
  const t = String(texto || "").replace(/^﻿/, "").trim();
  if (!t) return null;
  if (t[0] === "{") {
    let j;
    try { j = JSON.parse(t); } catch (e) { return null; }
    const fs = j.type === "FeatureCollection" ? j.features : j.type === "Feature" ? [j] : null;
    if (!fs || !fs.length) return null;
    const titulos = [...new Set(fs.flatMap((f) => Object.keys(f.properties || {})))];
    return {
      origen: "GeoJSON", titulos,
      filas: fs.map((f) => {
        const g = f.geometry || {};
        let geo;
        if (g.type === "Point" && Array.isArray(g.coordinates)) geo = { x: g.coordinates[0], y: g.coordinates[1], z: g.coordinates[2] ?? null };
        else if (g.type === "MultiPoint" && g.coordinates?.length) geo = { x: g.coordinates[0][0], y: g.coordinates[0][1], z: g.coordinates[0][2] ?? null, varios: g.coordinates.length > 1 };
        else geo = { tipo: !g.type ? "sin geometría" : /polygon/i.test(g.type) ? "un polígono" : /line/i.test(g.type) ? "una línea" : "otra geometría" };
        return { datos: f.properties || {}, geo };
      }),
    };
  }
  const lineas = t.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lineas.length < 2 || !lineas[0].includes("\t")) {
    // una sola columna de WKT (QGIS sin atributos) también sirve
    if (lineas.length >= 2 && /^wkt_geom$/i.test(lineas[0].trim())) {
      return { origen: "QGIS", titulos: [], filas: lineas.slice(1).map((l) => ({ datos: {}, geo: leerWkt(l) })) };
    }
    return null;
  }
  const titulos = lineas[0].split("\t").map((x) => x.trim());
  const iGeo = titulos.findIndex((x) => /^wkt_geom$/i.test(x));
  const filas = [];
  for (const l of lineas.slice(1)) {
    const celdas = l.split("\t");
    // un valor con salto de línea parte la fila: se pega a la anterior
    if (celdas.length < titulos.length && filas.length && celdas.length === 1) continue;
    const datos = {};
    titulos.forEach((tt, i) => { if (i !== iGeo) datos[tt] = celdas[i]; });
    filas.push({ datos, geo: iGeo >= 0 ? leerWkt(celdas[iGeo]) : { tipo: "sin geometría" } });
  }
  if (!filas.length) return null;
  return { origen: "QGIS", titulos: titulos.filter((_, i) => i !== iGeo), sinGeometria: iGeo < 0, filas };
}

// Qué sistema de coordenadas usan los puntos pegados
function sistemaDe(lote) {
  const pts = lote.filas.map((f) => f.geo).filter((g) => g.x != null);
  if (!pts.length) return "utm21";
  if (pts.every((g) => Math.abs(g.x) <= 180 && Math.abs(g.y) <= 90)) return "grados";
  const enUy = (z) => pts.filter((g) => { const p = utmAGrados(g.x, g.y, z); return dentroDeUruguay(p.lat, p.lon); }).length;
  return enUy(22) > enUy(21) ? "utm22" : "utm21";
}
function aGrados(g, sistema) {
  if (g.x == null || !isFinite(g.x) || !isFinite(g.y)) return null;
  if (sistema === "grados") return { lat: g.y, lon: g.x };
  return utmAGrados(g.x, g.y, sistema === "utm22" ? 22 : 21);
}

// Columnas de la capa de destino que la web conoce, para emparejar títulos sin importar mayúsculas ni tildes
function columnasDestino(capa) {
  if (capa === "relevamiento") return ["CÓDIGO", "DESCRIPCIÓN", "Z"];
  return ["CÓDIGO", capa === "estructura" ? "ESTADO" : "Estado", ...CAMPOS_EDITABLES[capa].map((c) => c[0])];
}
function emparejar(titulos, capa) {
  const conocidas = new Map(columnasDestino(capa).map((c) => [clave(c), c]));
  // en Obras "Descripción" es el tipo (OBRA / COSITIO); en Relevamiento es el texto del punto
  return titulos.map((t) => {
    const k = clave(t);
    if (NO_SE_COPIAN.has(k)) return { titulo: t, col: null, motivo: "la calcula la base" };
    return { titulo: t, col: conocidas.get(k) || t, conocida: conocidas.has(k) };
  });
}
function valorPegado(v, col) {
  if (v == null) return null;
  let s = String(v).trim();
  if (s === "" || /^null$/i.test(s)) return null;
  if (col === "ESTADO" || col === "Estado" || col === "RECEPCIÓN") s = s.toUpperCase();
  if (/^FECHA|FIN PREVISTO/i.test(col)) {
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/) || s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
    if (m) s = m[1].length === 4 ? `${m[1]}-${m[2]}-${m[3]}` : `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  if (col === "Z") s = s.replace(",", ".");
  return s;
}

// Lo que se va a pegar, con el motivo de cada uno que se saltea
function prepararPegado() {
  const { lote, capa, sistema } = PG;
  const cols = emparejar(lote.titulos, capa);
  const existentes = new Set(S.datos[capa === "relevamiento" ? "relev" : capa].map((o) => normal(o.codigo)).filter(Boolean));
  const vistos = new Set();
  return lote.filas.map((f) => {
    const datos = {};
    for (const c of cols) {
      if (!c.col) continue;
      const v = valorPegado(f.datos[c.titulo], c.col);
      if (v != null && datos[c.col] == null) datos[c.col] = v;
    }
    if (capa === "relevamiento" && datos.Z == null && f.geo.z != null && f.geo.z !== 0) datos.Z = String(f.geo.z);
    if (capa === "estructura" && datos.ESTADO && !["PROY", "CONS", "FIN"].includes(datos.ESTADO)) delete datos.ESTADO;
    if (capa === "obra" && datos.Estado && !["PROY", "CONS", "FIN"].includes(datos.Estado)) delete datos.Estado;
    const codigo = datos["CÓDIGO"] || "";
    const p = aGrados(f.geo, sistema);
    let salta = null;
    if (!p) salta = f.geo.tipo === "sin geometría" ? "no tiene ubicación" : `es ${f.geo.tipo}; en la web solo hay capas de puntos`;
    else if (!dentroDeUruguay(p.lat, p.lon)) salta = "queda fuera de Uruguay";
    else if (!codigo && capa !== "relevamiento") salta = "no tiene código";
    else if (codigo && vistos.has(normal(codigo)) && capa !== "relevamiento") salta = "código repetido en lo copiado";
    else if (codigo && existentes.has(normal(codigo)) && PG.saltearRepetidos) salta = "ya existe en la capa";
    if (codigo) vistos.add(normal(codigo));
    return { datos, codigo, p, salta, varios: f.geo.varios };
  });
}

function abrirPegar(lote) {
  if (!editor()) return aviso("Solo un usuario con permiso de editor puede pegar elementos.", true);
  if (MED.activo) terminarMedida();
  if (!$("#nuevo").hidden) cerrarNuevo();
  $("#ficha").hidden = true; $("#admin").hidden = true;
  PG.lote = lote;
  PG.corriendo = false;
  if (lote) {
    PG.sistema = sistemaDe(lote);
    PG.capa = capaSugerida(lote.titulos);
    PG.vistoUnaVez = false;
  }
  $("#nuevo").hidden = false; // antes de dibujar, para encuadrar el mapa sabiendo cuánto tapa el panel
  pintarPegar();
}

// La capa de destino: la que se parece a las columnas copiadas
function capaSugerida(titulos) {
  const k = new Set(titulos.map(clave));
  const puntaje = (capa) => columnasDestino(capa).filter((c) => k.has(clave(c))).length
    + (capa === "estructura" && k.has("ESTRUCTURA") ? 3 : 0) + (capa === "obra" && (k.has("SALA") || k.has("LOCALIDAD")) ? 3 : 0)
    + (capa === "relevamiento" && k.size <= 4 ? 1 : 0);
  const orden = ["estructura", "obra", "relevamiento"].map((c) => [c, puntaje(c)]).sort((a, b) => b[1] - a[1]);
  return orden[0][1] > 0 ? orden[0][0] : NV.capa;
}

function cerrarPegar() {
  if (PG.corriendo) { PG.cancelar = true; return; }
  if (PG.marcas) { PG.marcas.remove(); PG.marcas = null; }
  PG.lote = null;
  $("#nuevo").hidden = true;
}

const NOMBRE_DESTINO = { estructura: "Estructuras OICI Obra", obra: "Obras", relevamiento: "Relevamiento" };

function pintarPegar() {
  const caja = $("#nuevo");
  const cabeza = `<div class="ficha-cabeza">${barraCerrar("Volver al mapa")}<h2 class="admin-titulo">Pegar elementos</h2>
      <p class="nota" style="margin:0">Copiá en QGIS las entidades seleccionadas (Ctrl+C) y pegalas acá (Ctrl+V), como al pegar en una capa en edición.</p></div>`;
  if (!PG.lote) {
    caja.innerHTML = `${cabeza}
      <div class="ficha-bloque">
        <h2>Pegá lo copiado</h2>
        <textarea id="pegar-texto" class="pegar-texto" rows="6" placeholder="Pegá acá (Ctrl+V o mantené apretado y Pegar)"></textarea>
        <p class="error" id="pegar-error" hidden></p>
        <p class="nota pista">En QGIS: seleccioná los puntos, Editar > Copiar objetos espaciales (Ctrl+C). Si lo pegado no trae coordenadas, en QGIS andá a Configuración > Opciones > Fuentes de datos y en «Copiar objetos como» elegí «Texto sin formato, geometría WKT» o «GeoJSON».</p>
      </div>`;
    enlazarCerrar(caja, cerrarPegar);
    const ta = $("#pegar-texto");
    const probar = () => {
      const lote = leerPegado(ta.value);
      if (lote) return abrirPegar(lote);
      $("#pegar-error").hidden = !ta.value.trim();
      $("#pegar-error").textContent = "Eso no parece copiado de QGIS: tiene que tener una fila de títulos y la geometría (wkt_geom), o ser GeoJSON.";
    };
    ta.oninput = probar;
    ta.focus();
    return;
  }
  quitarMarcasPegar();
  const items = prepararPegado();
  const van = items.filter((x) => !x.salta);
  const motivos = {};
  for (const x of items) if (x.salta) motivos[x.salta] = (motivos[x.salta] || 0) + 1;
  const repetidosEnCapa = items.filter((x) => x.salta === "ya existe en la capa" || (!PG.saltearRepetidos && x.codigo
    && S.datos[PG.capa === "relevamiento" ? "relev" : PG.capa].some((o) => normal(o.codigo) === normal(x.codigo)))).length;
  const cols = emparejar(PG.lote.titulos, PG.capa);
  const copian = cols.filter((c) => c.col && c.conocida).map((c) => c.col);
  const otras = cols.filter((c) => c.col && !c.conocida).map((c) => c.col);
  const calculadas = cols.filter((c) => !c.col).map((c) => c.titulo);
  const lista = van.slice(0, 40).map((x) => `<li><b>${esc(x.codigo || "(sin código)")}</b> <span class="nota">${esc(
    PG.capa === "estructura" ? [x.datos.ESTRUCTURA, x.datos.ESTADO].filter(Boolean).join(" · ")
      : PG.capa === "obra" ? [x.datos.Localidad, x.datos.Estado].filter(Boolean).join(" · ")
      : [x.datos["DESCRIPCIÓN"], x.datos.Z != null ? `Z ${x.datos.Z}` : ""].filter(Boolean).join(" · "))}</span></li>`).join("");
  caja.innerHTML = `${cabeza}
    <form class="form" id="form-pegar" novalidate>
      <div class="ficha-bloque">
        <h2>${PG.lote.filas.length} ${PG.lote.filas.length === 1 ? "elemento copiado" : "elementos copiados"}${PG.lote.origen === "GeoJSON" ? " (GeoJSON)" : " de QGIS"}</h2>
        <p class="nota" style="margin:0 0 8px">Pegar en la capa:</p>
        <div class="segmentado" role="radiogroup">
          ${Object.entries(NOMBRE_DESTINO).map(([k, n]) => `<label><input type="radio" name="destino" value="${k}" ${PG.capa === k ? "checked" : ""}> ${n}</label>`).join("")}
        </div>
        <label style="margin-top:10px">Coordenadas de lo copiado
          <select name="sistema">${Object.entries(SISTEMAS).map(([k, n]) => `<option value="${k}" ${PG.sistema === k ? "selected" : ""}>${n}</option>`).join("")}</select>
        </label>
        <p class="nota pista">Se detectó solo. Los puntos que se van a pegar se ven en el mapa: si aparecen corridos, cambiá el sistema.</p>
      </div>
      <div class="ficha-bloque">
        <h2>Columnas</h2>
        <p class="nota" style="margin:0">${copian.length ? `Se copian: ${copian.map(esc).join(", ")}.` : "Ninguna columna coincide con las de la capa."}</p>
        ${otras.length ? `<p class="nota" style="margin:6px 0 0">También se intentan: ${otras.map(esc).join(", ")} (se guardan si la capa tiene esa columna; si no, se ignoran).</p>` : ""}
        ${calculadas.length ? `<p class="nota" style="margin:6px 0 0">No se copian, las pone la base: ${calculadas.map(esc).join(", ")}. La etapa empieza en Proyecto; los hitos se marcan después en la ficha.</p>` : ""}
      </div>
      <div class="ficha-bloque">
        <h2>Se van a pegar ${van.length}</h2>
        ${repetidosEnCapa ? `<label class="check"><input type="checkbox" name="saltear" ${PG.saltearRepetidos ? "checked" : ""}> No pegar los ${repetidosEnCapa} que ya existen en la capa (mismo código)</label>` : ""}
        ${Object.keys(motivos).length ? `<ul class="pegar-saltea">${Object.entries(motivos).map(([m, n]) => `<li>${n} ${n === 1 ? "se saltea" : "se saltean"}: ${esc(m)}</li>`).join("")}</ul>` : ""}
        ${items.some((x) => x.varios) ? `<p class="nota">Hay multipuntos con más de un punto: se usa el primero.</p>` : ""}
        <ul class="pegar-lista">${lista}${van.length > 40 ? `<li class="nota">y ${van.length - 40} más…</li>` : ""}</ul>
      </div>
      <div class="ficha-bloque acciones-nuevo">
        <p class="nota" id="pegar-progreso" hidden></p>
        <p class="error" id="pegar-error" hidden></p>
        <button class="boton boton-primario" type="submit" ${van.length ? "" : "disabled"}>Pegar ${van.length} en ${NOMBRE_DESTINO[PG.capa]}</button>
        <button class="boton" type="button" id="cancelar-pegar">Cancelar</button>
      </div>
    </form>`;
  enlazarCerrar(caja, cerrarPegar);
  const f = $("#form-pegar");
  $("#cancelar-pegar").onclick = cerrarPegar;
  f.querySelectorAll("input[name=destino]").forEach((r) => (r.onchange = () => { PG.capa = r.value; pintarPegar(); }));
  f.sistema.onchange = () => { PG.sistema = f.sistema.value; PG.vistoUnaVez = false; pintarPegar(); };
  if (f.saltear) f.saltear.onchange = () => { PG.saltearRepetidos = f.saltear.checked; pintarPegar(); };
  f.onsubmit = (ev) => { ev.preventDefault(); pegarTodo(van); };
  ponerMarcasPegar(items);
}

function quitarMarcasPegar() { if (PG.marcas) { PG.marcas.remove(); PG.marcas = null; } }
function ponerMarcasPegar(items) {
  quitarMarcasPegar();
  PG.marcas = L.featureGroup(items.filter((x) => x.p).map((x) => L.circleMarker([x.p.lat, x.p.lon], {
    radius: 7, weight: 2, color: x.salta ? "#8a8a8a" : "#ffffff", fillColor: x.salta ? "#bdbdbd" : "#6CC4D1", fillOpacity: 0.95,
  }).bindTooltip(`${esc(x.codigo || "(sin código)")}${x.salta ? " · " + esc(x.salta) : ""}`)))
    .addTo(S.mapa);
  if (!PG.vistoUnaVez) { PG.vistoUnaVez = true; verMarcasPegar(); }
}
function verMarcasPegar() {
  // solo los que quedan en Uruguay (uno con coordenadas mal no tiene que llevar el mapa al otro lado del mundo)
  const pts = (PG.marcas?.getLayers() || []).map((m) => m.getLatLng()).filter((l) => dentroDeUruguay(l.lat, l.lng));
  if (!pts.length) return;
  const b = L.latLngBounds(pts);
  // en el celular el panel tapa la parte de abajo del mapa
  const tapa = movil.matches ? Math.min($("#nuevo").offsetHeight, S.mapa.getSize().y * 0.55) : 0;
  S.mapa.invalidateSize();
  S.mapa.fitBounds(b, { maxZoom: 16, paddingTopLeft: [60, 60], paddingBottomRight: [60, tapa + 30] });
}

async function pegarTodo(van) {
  const f = $("#form-pegar"), b = f.querySelector("button[type=submit]"), prog = $("#pegar-progreso"), err = $("#pegar-error");
  PG.corriendo = true; PG.cancelar = false;
  b.disabled = true;
  f.querySelectorAll("input, select").forEach((x) => (x.disabled = true));
  $("#cancelar-pegar").textContent = "Detener";
  prog.hidden = false;
  const capa = PG.capa, fallas = [];
  let ok = 0;
  for (const [i, x] of van.entries()) {
    if (PG.cancelar) break;
    prog.textContent = `Pegando ${i + 1} de ${van.length}… (${x.codigo || "punto"})`;
    try { await S.api.crearPunto(capa, x.p.lat, x.p.lon, x.datos); ok++; }
    catch (e) {
      fallas.push(`${x.codigo || "punto " + (i + 1)}: ${e.message}`);
      if (/crear_punto|function|schema cache|permiso|editor|failed to fetch|networkerror/i.test(e.message)) break; // no tiene sentido seguir
    }
  }
  PG.corriendo = false;
  const detenido = PG.cancelar && ok + fallas.length < van.length;
  prog.textContent = `Se ${ok === 1 ? "pegó 1 elemento" : `pegaron ${ok} elementos`} en ${NOMBRE_DESTINO[capa]}${detenido ? " (detenido antes de terminar)" : ""}.`;
  if (fallas.length) { err.hidden = false; err.innerHTML = `No se pudieron pegar ${fallas.length}:<br>${fallas.slice(0, 8).map(esc).join("<br>")}${fallas.length > 8 ? "<br>…" : ""}`; }
  b.hidden = true;
  $("#cancelar-pegar").textContent = "Listo";
  $("#cancelar-pegar").onclick = cerrarPegar;
  if (ok) {
    aviso(`${ok} ${ok === 1 ? "elemento pegado" : "elementos pegados"}`);
    if (capa === "relevamiento") S.capaOn.relev = true;
    else {
      const id = capa === "estructura" ? "obra_e" : "obras";
      S.capaOn[id] = true;
      CAPAS.filter((c) => c.tipo === capa).forEach((c) => (S.capaOn[c.id] = true));
    }
    quitarMarcasPegar();
    await cargar();
  }
}

// Ctrl+V en cualquier parte de la web (menos dentro de un campo de texto)
function alPegar(ev) {
  const t = ev.target;
  if (t && (t.closest?.("input, textarea, select, [contenteditable]"))) return;
  if (!S.perfil || $("#vista-app")?.hidden) return;
  const lote = leerPegado(ev.clipboardData?.getData("text/plain"));
  if (!lote) return;
  ev.preventDefault();
  if (PG.corriendo) return aviso("Esperá a que termine de pegar lo anterior.", true);
  abrirPegar(lote);
}

// ------------------------------------------------------------ relevamiento (como en QGIS: círculo blanco chico con el código)
const svgRelev = (px = 9) => svgForma("circulo", "#ffffff", "#000000", px, 1);
// Como en QGIS, la capa solo se dibuja de cerca (escala 1:20.000 o más cerca, que en el mapa es el zoom 15).
const ZOOM_RELEV = 15;
const relevDeCerca = () => S.mapa && S.mapa.getZoom() >= ZOOM_RELEV;
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
    </div>
    ${bloqueBorrar("relevamiento", r)}`;
  enlazarCerrar(ficha, cerrarFicha);
  enlazarBorrar(ficha, "relevamiento", r);
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
