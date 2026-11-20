import { crearApi } from "./api.js?v=2026-11-20-1";

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
  const d = document.createElement("div");
  d.className = "aviso" + (mal ? " mal" : "");
  d.textContent = texto;
  $("#avisos").append(d);
  setTimeout(() => d.remove(), mal ? 6000 : 2500);
}

// ------------------------------------------------------------ estado
const S = {
  api: null, usuario: null, perfil: null,
  datos: { estructura: [], obra: [] },
  capaOn: Object.fromEntries(CAPAS.map((c) => [c.id, c.on])),
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

// ------------------------------------------------------------ vistas
function mostrar(vista) {
  for (const id of ["vista-ingreso", "vista-pendiente", "vista-app"]) $("#" + id).hidden = id !== vista;
}

async function iniciar() {
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
  const salir = async () => { await S.api.salir(); location.reload(); };
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
  mostrar("vista-app");
  $("#nombre-usuario").textContent = S.perfil.nombre + (editor() ? "" : " · solo lectura");
  $("#boton-usuarios").hidden = !S.perfil.admin;
  $("#boton-nuevo").hidden = !editor();
  $("#boton-nuevo").onclick = abrirNuevo;
  $("#boton-usuarios").onclick = abrirAdmin;
  $("#pestanas").onclick = (ev) => { const b = ev.target.closest("[data-tab]"); if (b) verTab(b.dataset.tab); };
  prepararMapa();
  prepararPanel();
  await cargar();
}

async function cargar() {
  try {
    const [e, o] = await Promise.all([S.api.estructuras(), S.api.obras()]);
    S.datos.estructura = e || [];
    S.datos.obra = o || [];
  } catch (e) {
    aviso("No se pudieron cargar las obras: " + e.message, true);
  }
  pintar();
}

// ------------------------------------------------------------ pestañas
function verTab(t) {
  S.tab = t;
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
  const formas = [["estructura", { estructura: "MÁSTIL" }, "Mástil"], ["estructura", { estructura: "MONOPOLO" }, "Monopolo"],
    ["obra", { descripcion: "OBRA" }, "Obra"], ["obra", { descripcion: "COSITIO" }, "Cositio"]]
    .map(([tp, o, nm]) => `<span>${svgForma(forma(tp, o), "#ffffff", "#52626D", forma(tp, o) === "asterisco" ? 15 : 12)}${nm}</span>`).join("");
  const p = $("#panel-capas");
  p.innerHTML = `${html}
    <div class="arbol-grupo"><p class="nodo nodo-grupo">Formas</p><div class="formas">${formas}</div></div>
    <div class="arbol-grupo"><p class="nodo nodo-grupo">Mapa base</p>
      <div class="bases">${Object.keys(S.base).map((b) => `<label class="nodo"><input type="radio" name="base" value="${b}" ${S.mapa.hasLayer(S.base[b]) ? "checked" : ""}> ${b}</label>`).join("")}</div>
      ${S.baseNombre.startsWith("Gris") ? `<label class="rango">Calles en el fondo gris <span id="valor-calles">${Math.round(S.callesGris * 100)}%</span>
        <input type="range" name="calles" min="0" max="80" step="5" value="${Math.round(S.callesGris * 100)}"></label>` : ""}
      <label class="nodo"><input type="checkbox" name="deptos" ${S.deptosOn ? "checked" : ""}> Departamentos</label></div>
    ${filtrosActivos() ? `<p class="nota aviso-filtro">Hay ${filtrosActivos()} filtro${filtrosActivos() > 1 ? "s" : ""} activo${filtrosActivos() > 1 ? "s" : ""}: las cantidades ya los tienen en cuenta.</p>` : ""}`;
  p.querySelectorAll('[data-medio="true"]').forEach((el) => (el.indeterminate = true));
  const r = p.querySelector("input[name=calles]");
  if (r) r.oninput = () => {
    S.callesGris = Number(r.value) / 100;
    S.base["Gris (como QGIS)"].setOpacity(S.callesGris);
    $("#valor-calles").textContent = r.value + "%";
  };
  p.onchange = (ev) => {
    const el = ev.target;
    if (el.name === "calles") { guardarEstado(); return; }
    if (el.dataset.grupo) CAPAS.filter((c) => c.grupo === el.dataset.grupo).forEach((c) => (S.capaOn[c.id] = el.checked));
    if (el.dataset.capa) S.capaOn[el.dataset.capa] = el.checked;
    if (el.dataset.cat) S.catOn[el.dataset.cat] = el.checked;
    if (el.name === "base") {
      S.baseNombre = el.value;
      for (const [k, l] of Object.entries(S.base)) k === el.value ? l.addTo(S.mapa) : l.remove();
      $("#mapa").classList.toggle("fondo-oscuro", el.value.startsWith("Gris"));
    }
    if (el.name === "deptos") { S.deptosOn = el.checked; el.checked ? S.deptos.addTo(S.mapa) : S.deptos.remove(); }
    pintar();
  };
  p.onclick = (ev) => {
    const b = ev.target.closest("[data-plegar]");
    if (b) { S.abiertoArbol[b.dataset.plegar] = !S.abiertoArbol[b.dataset.plegar]; guardarEstado(); pintarCapas(); }
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
  S.mapa = L.map("mapa", { zoomControl: true, attributionControl: true }).setView([-32.6, -56.0], 7);
  leerEstado();
  // Gris como QGIS: calles en escala de grises invertida, muy atenuadas sobre el gris #212121.
  S.base["Gris (como QGIS)"] = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: "© OpenStreetMap", className: "tiles-gris", opacity: S.callesGris });
  S.base["Calles"] = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: "© OpenStreetMap" });
  S.base["Satélite"] = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 19, attribution: "Imágenes © Esri" });
  if (!S.base[S.baseNombre]) S.baseNombre = "Gris (como QGIS)";
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
      .on("click", () => abrirFicha(x.tipo, x.o.id)).addTo(S.mapa);
    S.marcadores.set(`${x.tipo}:${x.o.id}`, m);
    puntos.push([x.o.lat, x.o.lon]);
  }
  if (S.primeraVez && puntos.length) {
    S.mapa.fitBounds(puntos, { padding: [30, 30], maxZoom: 11 });
    S.primeraVez = false;
  }
}

// ------------------------------------------------------------ ficha
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
  ficha.innerHTML = `<div class="ficha-cabeza">${barraCerrar("Volver a la lista")}<p class="tipo-obra">Cargando…</p></div>`;
  enlazarCerrar(ficha, cerrarFicha);
  pintar();
  try {
    const [o, hitos, notas] = await Promise.all([S.api.una(tipo, id), S.api.hitos(tipo, id), S.api.cuaderno(tipo, id)]);
    const lista = S.datos[tipo];
    const i = lista.findIndex((x) => x.id === id);
    if (i >= 0) lista[i] = o;
    pintarFicha(tipo, o, hitos || [], notas || []);
    const m = S.marcadores.get(`${tipo}:${id}`);
    if (m && window.innerWidth > 760) S.mapa.panTo(m.getLatLng());
  } catch (e) {
    aviso("No se pudo abrir la obra: " + e.message, true);
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
       ["Inicio", fecha(o.fecha_inicio)], ["Fin", fecha(o.fecha_fin)], ["Recepción", o.recepcion || "—"]]
    : [["Sala", o.sala], ["Localidad", o.localidad], ["Departamento", o.departamento], ["Licitación", o.licitacion],
       ["Tarea", o.tarea], ["Descripción", o.descripcion], ["Director de obra", o.director_obra]];
  const enlaces = [
    o.planos ? `<a href="${esc(o.planos)}" target="_blank" rel="noopener">Planos</a>` : "",
    o.lat != null ? `<a href="https://www.google.com/maps/dir/?api=1&destination=${o.lat},${o.lon}" target="_blank" rel="noopener">Cómo llegar</a>` : "",
  ].filter(Boolean).join(" · ");

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
    </div>

    <div class="ficha-bloque">
      <h2>Hitos</h2>
      ${hitos.length ? hitos.map((h) => hitoHtml(h)).join("") : `<p class="nota">Esta obra no tiene hitos cargados.</p>`}
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
      ${notas.length ? notas.map((n) => `<div class="entrada"><div class="meta"><b>${fecha(n.fecha)}</b><span>${esc(n.tipo[0] + n.tipo.slice(1).toLowerCase())}</span><span>${esc(n.autor || "")}</span></div><p>${esc(n.texto)}</p></div>`).join("")
        : `<p class="nota">Todavía no hay entradas. ${editor() ? "Escribí la primera arriba." : ""}</p>`}
    </div>

    <div class="ficha-bloque">
      <h2>Datos</h2>
      <dl class="datos">${datos.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v ?? "—") || "—"}</dd>`).join("")}</dl>
      ${enlaces ? `<p>${enlaces}</p>` : ""}
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
const UI = { ancho: 380, alto: Math.round(innerHeight * 0.45), plegado: false };
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
  const b = $("#plegar-panel");
  b.textContent = movil.matches ? (UI.plegado ? "▴" : "▾") : "‹";
  b.setAttribute("aria-label", UI.plegado ? "Mostrar panel" : "Minimizar panel");
  b.title = b.getAttribute("aria-label");
  $("#abrir-panel").hidden = !(UI.plegado && !movil.matches);
  setTimeout(() => S.mapa && S.mapa.invalidateSize(), 220);
}

function plegar(v) { UI.plegado = v; guardarUI(); aplicarUI(); }

function prepararPanel() {
  const asa = $("#asa"), panel = $("#panel");
  $("#plegar-panel").onclick = () => plegar(!UI.plegado);
  $("#abrir-panel").onclick = () => plegar(false);
  // en el celular, tocar una pestaña con el panel minimizado lo vuelve a abrir
  $("#pestanas").addEventListener("click", () => { if (UI.plegado && movil.matches) plegar(false); });
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

// Lee coordenadas WGS 84: "-32.28313, -54.85191", "-32.28313 -54.85191" o en grados, minutos y segundos.
function leerCoordenadas(texto) {
  const t = String(texto || "").trim();
  if (!t) return null;
  let nums;
  // grados, minutos y segundos: 32°16'59.3"S 54°51'06.9"W (también con O de oeste)
  const dms = [...t.matchAll(/(-?\d+(?:[.,]\d+)?)\s*[°º]\s*(?:(\d+(?:[.,]\d+)?)\s*['’′]\s*)?(?:(\d+(?:[.,]\d+)?)\s*(?:"|”|″|''))?\s*([NSEOW])?/gi)];
  if (dms.length >= 2) {
    const num = (x) => parseFloat(String(x || "0").replace(",", "."));
    nums = dms.slice(0, 2).map((m) => {
      let v = Math.abs(num(m[1])) + num(m[2]) / 60 + num(m[3]) / 3600;
      if (num(m[1]) < 0 || /[SOW]/i.test(m[4] || "")) v = -v;
      return v;
    });
  } else {
    // decimales: "-32.28313, -54.85191" o "-32.28313 -54.85191"; con coma decimal: "-32,28313 -54,85191"
    const comaDecimal = !t.includes(".") && /-?\d+,\d+\s+-?\d+,\d+/.test(t);
    const limpio = comaDecimal ? t.replace(/(\d),(\d)/g, "$1.$2") : t;
    nums = (limpio.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
    if (nums.length < 2) return null;
    nums = nums.slice(0, 2);
  }
  let [lat, lon] = nums;
  // En Uruguay latitud y longitud son negativas: si faltan los signos, se agregan.
  if (lat > 0 && lon > 0) { lat = -lat; lon = -lon; }
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

const NV = { capa: "estructura", marca: null, lat: null, lon: null };

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
  S.mapa.setView([NV.lat, NV.lon], Math.max(S.mapa.getZoom(), 15), { animate: false });
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
  if ($("#nuevo").hidden) return;
  ponerMarca(ev.latlng.lat, ev.latlng.lng, false);
}

function cerrarNuevo() {
  $("#nuevo").hidden = true;
  quitarMarca();
  S.mapa.off("click", clickMapaNuevo);
  $("#mapa").classList.remove("modo-nuevo");
}

function abrirNuevo() {
  $("#ficha").hidden = true; $("#admin").hidden = true;
  const capasOn = { estructura: CAPAS.some((c) => c.tipo === "estructura" && S.capaOn[c.id]), obra: S.capaOn.obras };
  if (!capasOn[NV.capa]) NV.capa = capasOn.estructura ? "estructura" : capasOn.obra ? "obra" : "estructura";
  pintarNuevo();
  $("#nuevo").hidden = false;
  S.mapa.off("click", clickMapaNuevo).on("click", clickMapaNuevo);
  $("#mapa").classList.add("modo-nuevo");
}

function pintarNuevo() {
  const caja = $("#nuevo");
  const vals = (tipo, k) => [...new Set(S.datos[tipo].map((o) => o[k]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), "es", { numeric: true }));
  const opts = (lista, sel) => lista.map((v) => `<option ${v === sel ? "selected" : ""}>${esc(v)}</option>`).join("");
  const dl = (id, lista) => `<datalist id="${id}">${lista.map((v) => `<option value="${esc(v)}">`).join("")}</datalist>`;
  const dos = [...new Set([...LISTA_DO, ...vals(NV.capa, "director_obra").flatMap(partesDO)])].sort();
  const miDO = S.perfil.iniciales_do || "";
  const est = NV.capa === "estructura";
  const campos = est ? `
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
          <label><input type="radio" name="capa" value="obra" ${est ? "" : "checked"}> Obras</label>
        </div>
      </div>
      <div class="ficha-bloque">
        <h2>Ubicación (WGS 84)</h2>
        <div class="buscar-coord">
          <input name="coord" placeholder="-32.28313, -54.85191" aria-label="Coordenadas WGS 84" autocomplete="off" inputmode="text">
          <button class="boton" type="button" id="buscar-coord">Buscar</button>
        </div>
        <p class="nota pista">Latitud y longitud en grados decimales (como en QGIS) o en grados, minutos y segundos: 32°16'59"S 54°51'07"W.</p>
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
  f.onsubmit = guardarNuevo;
  if (NV.lat != null) { $("#ubicacion-ok").hidden = false; }
}

async function guardarNuevo(ev) {
  ev.preventDefault();
  const f = ev.target, err = $("#error-nuevo"), b = f.querySelector("button[type=submit]");
  const mal = (t) => { err.textContent = t; err.hidden = false; };
  err.hidden = true;
  if (NV.lat == null) return mal("Falta la ubicación: buscá las coordenadas o tocá el mapa.");
  if (!dentroDeUruguay(NV.lat, NV.lon)) return mal("La ubicación queda fuera de Uruguay. Revisá las coordenadas.");
  const codigo = f["CÓDIGO"].value.trim();
  if (!codigo) { f["CÓDIGO"].focus(); return mal("Falta el código."); }
  const repetido = S.datos[NV.capa].find((o) => normal(o.codigo) === normal(codigo));
  if (repetido && !confirm(`Ya hay ${NV.capa === "estructura" ? "una estructura" : "una obra"} con el código ${repetido.codigo}. ¿La agrego igual?`)) return;
  const datos = {};
  f.querySelectorAll(".form [name]").forEach((el) => {
    if (["capa", "coord", "lat", "lon"].includes(el.name)) return;
    const v = el.value.trim();
    if (v !== "") datos[el.name] = v;
  });
  b.disabled = true; b.textContent = "Agregando…";
  try {
    const id = await S.api.crearPunto(NV.capa, NV.lat, NV.lon, datos);
    const tipo = NV.capa;
    aviso(`${codigo} agregado`);
    cerrarNuevo();
    // que se vea aunque su capa o categoría estuvieran apagadas
    const capa = tipo === "estructura" ? "obra_e" : "obras";
    S.capaOn[capa] = true;
    S.catOn[`${capa}:proyecto`] = true;
    S.catOn[`${capa}:hormigonado`] = true;
    S.catOn[`${capa}:infra`] = true;
    await cargar();
    if (id) await abrirFicha(tipo, Number(id));
  } catch (e) {
    mal(/crear_punto|function|schema cache/i.test(e.message)
      ? "Falta preparar la base para agregar puntos: corré sql/parte4_puntos_nuevos.sql en Neon y tocá Refresh schema cache en la Data API."
      : e.message);
    b.disabled = false; b.textContent = "Agregar punto";
  }
}

iniciar();
