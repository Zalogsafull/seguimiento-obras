import { crearApi } from "./api.js";

// ------------------------------------------------------------ categorías
// Mismos colores que la simbología de QGIS.
const CAT = {
  proyecto:    { nombre: "Proyecto",                color: "#f6f6f6", grupo: "proyecto" },
  aprobado_e:  { nombre: "P. ejecutivo aprobado",   color: "#7ec8f0", grupo: "proyecto" },
  aprobado_o:  { nombre: "Proyecto aprobado",       color: "#7ec8f0", grupo: "proyecto" },
  hormigonado: { nombre: "Hormigonado",             color: "#d7191c", grupo: "obra" },
  montaje:     { nombre: "Montaje",                 color: "#f2d024", grupo: "obra" },
  infra:       { nombre: "Obra de infraestructura", color: "#2e9e44", grupo: "obra" },
  plazo:       { nombre: "Recepción en plazo",      color: "#2e9e44", grupo: "recepcion", cuadrado: true },
  r6:          { nombre: "Recepción en 3 a 6 meses", color: "#f2d024", grupo: "recepcion", cuadrado: true },
  r3:          { nombre: "Recepción en menos de 3 meses", color: "#f08a24", grupo: "recepcion", cuadrado: true },
  vencida:     { nombre: "Recepción vencida",       color: "#c1272d", grupo: "recepcion", cuadrado: true },
  sinfecha:    { nombre: "Terminada sin fecha de fin", color: "#9b59b6", grupo: "recepcion", cuadrado: true },
  recibida:    { nombre: "Recibida",                color: "#9e9e9e", grupo: "cerrada", cuadrado: true },
  terminada:   { nombre: "Terminada",               color: "#9e9e9e", grupo: "cerrada", cuadrado: true },
};
const GRUPOS = [
  ["proyecto", "En proyecto", true],
  ["obra", "En obra", true],
  ["recepcion", "Recepción pendiente", true],
  ["cerrada", "Recibidas y terminadas", false],
];
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
  capas: { estructura: true, obra: true },
  grupos: Object.fromEntries(GRUPOS.map(([k, , on]) => [k, on])),
  mias: false, texto: "", abierta: null,
  mapa: null, marcadores: new Map(), primeraVez: true,
};
const editor = () => S.perfil?.rol === "EDITOR";

function esMia(o) {
  const ini = normal(S.perfil?.iniciales_do);
  if (!ini) return false;
  return String(o.director_obra || "").split(/[\/,;y\-]+/).some((p) => normal(p) === ini);
}

function visibles() {
  const t = normal(S.texto);
  const out = [];
  for (const tipo of ["estructura", "obra"]) {
    if (!S.capas[tipo]) continue;
    for (const o of S.datos[tipo]) {
      const cat = categoria(tipo, o);
      if (!S.grupos[CAT[cat].grupo]) continue;
      if (S.mias && !esMia(o)) continue;
      if (t && ![o.codigo, o.localidad, o.licitacion, o.estructura, o.sala].some((v) => normal(v).includes(t))) continue;
      out.push({ tipo, o, cat });
    }
  }
  const orden = ["obra", "recepcion", "proyecto", "cerrada"];
  return out.sort((a, b) => orden.indexOf(CAT[a.cat].grupo) - orden.indexOf(CAT[b.cat].grupo)
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
  if (!S.usuario) return mostrar("vista-ingreso");
  await entrarApp();
}

function prepararIngreso() {
  let modo = "entrar";
  const poner = (m) => {
    modo = m;
    $("#tab-entrar").setAttribute("aria-selected", m === "entrar");
    $("#tab-crear").setAttribute("aria-selected", m === "crear");
    $("#campo-nombre").hidden = m !== "crear";
    $("#boton-ingreso").textContent = m === "crear" ? "Crear cuenta" : "Ingresar";
    $("#form-ingreso").password.autocomplete = m === "crear" ? "new-password" : "current-password";
    $("#error-ingreso").hidden = true;
  };
  $("#tab-entrar").onclick = () => poner("entrar");
  $("#tab-crear").onclick = () => poner("crear");
  $("#form-ingreso").onsubmit = async (ev) => {
    ev.preventDefault();
    const f = ev.target, b = $("#boton-ingreso");
    b.disabled = true;
    $("#error-ingreso").hidden = true;
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
  $("#mis-obras").parentElement.hidden = !S.perfil.iniciales_do;
  prepararMapa();
  prepararFiltros();
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

// ------------------------------------------------------------ filtros y lista
function prepararFiltros() {
  const capa = $("#chips-capa"), sit = $("#chips-situacion");
  capa.innerHTML = [["estructura", "Estructuras"], ["obra", "Obras"]].map(([k, n]) =>
    `<label class="chip"><input type="checkbox" data-capa="${k}" ${S.capas[k] ? "checked" : ""}>${n} <span class="n" data-n="${k}"></span></label>`).join("");
  sit.innerHTML = GRUPOS.map(([k, n]) =>
    `<label class="chip"><input type="checkbox" data-grupo="${k}" ${S.grupos[k] ? "checked" : ""}>${n}</label>`).join("");
  capa.onchange = (ev) => { S.capas[ev.target.dataset.capa] = ev.target.checked; pintar(); };
  sit.onchange = (ev) => { S.grupos[ev.target.dataset.grupo] = ev.target.checked; pintar(); };
  $("#buscar").oninput = (ev) => { S.texto = ev.target.value; pintar(); };
  $("#mis-obras").onchange = (ev) => { S.mias = ev.target.checked; S.primeraVez = true; pintar(); };
  $("#tab-lista").onclick = () => verTab("lista");
  $("#tab-venc").onclick = () => verTab("venc");
}

function verTab(t) {
  $("#tab-lista").setAttribute("aria-selected", t === "lista");
  $("#tab-venc").setAttribute("aria-selected", t === "venc");
  $("#lista").hidden = t !== "lista";
  $("#filtros").hidden = t !== "lista";
  $("#vencimientos").hidden = t !== "venc";
  if (t === "venc") pintarVencimientos();
}

function filaHtml({ tipo, o, cat }, eti = "") {
  const c = CAT[cat];
  const sub = tipo === "estructura"
    ? [o.estructura, o.licitacion, o.director_obra].filter(Boolean).join(", ")
    : [o.sala, o.localidad, o.director_obra].filter(Boolean).join(", ");
  const actual = S.abierta && S.abierta.tipo === tipo && S.abierta.id === o.id;
  return `<li class="fila" tabindex="0" data-tipo="${tipo}" data-id="${o.id}" aria-current="${actual}">
    <span class="punto${c.cuadrado ? " cuadrado" : ""}" style="background:${c.color}"></span>
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

function pintar() {
  const v = visibles();
  for (const tipo of ["estructura", "obra"]) {
    const n = v.filter((x) => x.tipo === tipo).length;
    const span = document.querySelector(`[data-n="${tipo}"]`);
    if (span) span.textContent = S.capas[tipo] ? n : "";
  }
  const lista = $("#lista");
  lista.innerHTML = v.length ? v.map((x) => filaHtml(x)).join("")
    : `<li class="vacio">${S.mias ? "No hay obras con tus iniciales con estos filtros." : "Ninguna obra coincide con los filtros."}</li>`;
  enlazarFilas(lista);
  pintarMapa(v);
  if (!$("#vencimientos").hidden) pintarVencimientos();
}

function pintarVencimientos() {
  const base = [];
  for (const tipo of ["estructura", "obra"]) for (const o of S.datos[tipo]) {
    if (S.mias && !esMia(o)) continue;
    base.push({ tipo, o, cat: categoria(tipo, o) });
  }
  const rec = base.filter((x) => x.tipo === "estructura" && CAT[x.cat].grupo === "recepcion" && x.o.dias_para_recepcion != null && x.o.dias_para_recepcion < 180)
    .sort((a, b) => a.o.dias_para_recepcion - b.o.dias_para_recepcion);
  const hit = base.filter((x) => x.o.proximo_vencimiento).sort((a, b) => a.o.proximo_vencimiento.localeCompare(b.o.proximo_vencimiento));
  const dias = (d) => (d < 0 ? `vencida hace ${-d} d` : d === 0 ? "vence hoy" : `faltan ${d} d`);
  const cont = $("#vencimientos");
  cont.className = "venc";
  cont.innerHTML = `
    <h3>Recepciones de los próximos 6 meses</h3>
    <ol class="lista">${rec.length ? rec.map((x) => filaHtml(x, `<span class="${x.o.dias_para_recepcion < 0 ? "mal" : ""}">${dias(x.o.dias_para_recepcion)}</span>`)).join("")
      : `<li class="vacio">Ninguna recepción vence en los próximos 6 meses.</li>`}</ol>
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
  const calles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(S.mapa);
  const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
    maxZoom: 19, attribution: "Imágenes © Esri" });
  L.control.layers({ "Calles": calles, "Satélite": sat }, null, { position: "topright" }).addTo(S.mapa);
  const lejos = () => $("#mapa").classList.toggle("lejos", S.mapa.getZoom() < 9);
  S.mapa.on("zoomend", lejos); lejos();
  $("#leyenda").innerHTML = `<b>Estructuras y obras en curso</b>` +
    ["proyecto", "aprobado_e", "hormigonado", "montaje", "infra"].map(leyendaFila).join("") +
    `<b>Terminadas: recepción a 2 años</b>` + ["plazo", "r6", "r3", "vencida", "recibida"].map(leyendaFila).join("") +
    `<div style="margin-top:4px;color:var(--tinta-suave)">Rombo: capa Obras</div>`;
}
const leyendaFila = (k) => `<div><span class="punto${CAT[k].cuadrado ? " cuadrado" : ""}" style="background:${CAT[k].color}"></span>${CAT[k].nombre}</div>`;

function icono(tipo, o, cat) {
  const c = CAT[cat];
  const activo = S.abierta && S.abierta.tipo === tipo && S.abierta.id === o.id;
  return L.divIcon({
    className: `mk${c.cuadrado ? " cuadrado" : ""}${tipo === "obra" ? " obra" : ""}${activo ? " activo" : ""}`,
    html: `<i style="background:${c.color}"></i><span>${esc(o.codigo)}</span>`,
    iconSize: [14, 14], iconAnchor: [7, 7],
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
async function abrirFicha(tipo, id) {
  S.abierta = { tipo, id };
  const ficha = $("#ficha");
  ficha.hidden = false;
  ficha.innerHTML = `<div class="ficha-cabeza"><button class="volver">Volver a la lista</button><p class="tipo-obra">Cargando…</p></div>`;
  $(".volver", ficha).onclick = cerrarFicha;
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
  const clave = CAT[cat].grupo === "recepcion" ? "recepcion" : cat;
  const pos = Math.max(0, pasos.indexOf(clave));
  const tramos = pasos.map((p, i) => {
    const col = CAT[p]?.color || c.color;
    const cls = i < pos ? "tramo hecho" : i === pos ? "tramo actual" : "tramo";
    return `<span class="${cls}" style="--c:${i === pos ? c.color : col}" title="${esc(CAT[p]?.nombre || NOMBRE_TRAMO[p])}"></span>`;
  }).join("");
  const detalle = tipo === "estructura" && CAT[cat].grupo === "recepcion" && o.dias_para_recepcion != null
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
      <button class="volver">Volver a la lista</button>
      <p class="codigo">${esc(o.codigo)}</p>
      <p class="tipo-obra">${tipo === "estructura" ? "Estructura" : "Obra"}${o.localidad ? ", " + esc(o.localidad) : ""}</p>
      <div class="escalera" aria-hidden="true">${tramos}</div>
      <p class="etapa-actual"><span class="punto${c.cuadrado ? " cuadrado" : ""}" style="background:${c.color}"></span>${esc(c.nombre)} <small>${esc(detalle)}</small></p>
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

  $(".volver", ficha).onclick = cerrarFicha;
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

iniciar();
