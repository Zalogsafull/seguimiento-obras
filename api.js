// Capa de datos: Neon (Data API + Neon Auth) o modo demostración (?demo=1).
import { NEON_AUTH_URL, NEON_DATA_API_URL } from "./config.js";

const TABLA = { estructura: "Estructuras OICI Obra", obra: "Obras" };
const CAMPO_ESTADO = { estructura: "ESTADO", obra: "Estado" };
const CLAVE = { estructura: "estructura_id", obra: "obra_id" };

function chequear({ data, error }, que) {
  if (error) throw new Error(`${que}: ${error.message || error}`);
  return data;
}

async function crearNeon() {
  const { createClient } = await import("./vendor/neon.js");
  const neon = createClient({ auth: { url: NEON_AUTH_URL }, dataApi: { url: NEON_DATA_API_URL } });
  const editarCapa = async (tipo, id, cambios, que) => {
    const { error } = await neon.rpc("editar_capa", { p_tipo: tipo, p_id: id, p_cambios: cambios });
    if (!error) return;
    const m = error.message || String(error);
    if (/editar_capa|schema cache|function/i.test(m))
      throw new Error(`${que}: falta preparar la base. Corré sql/parte7_editar_por_funcion.sql en Neon y tocá Refresh schema cache en la Data API.`);
    throw new Error(`${que}: ${m}`);
  };

  return {
    async usuario() {
      const r = await neon.auth.getSession();
      return r?.data?.user || null;
    },
    async entrar(email, password) {
      const r = await neon.auth.signIn.email({ email, password });
      if (r?.error) throw new Error(r.error.message || "No se pudo iniciar sesión");
      return this.usuario();
    },
    async crearCuenta(email, password, name) {
      const r = await neon.auth.signUp.email({ email, password, name });
      if (r?.error) throw new Error(r.error.message || "No se pudo crear la cuenta");
      return this.usuario();
    },
    async salir() { await neon.auth.signOut(); },
    async pedirReseteo(email, redirectTo) {
      const r = await neon.auth.requestPasswordReset({ email, redirectTo });
      if (r?.error) throw new Error(r.error.message || "No se pudo enviar el correo");
    },
    async nuevaContrasena(token, newPassword) {
      const r = await neon.auth.resetPassword({ newPassword, token });
      if (r?.error) throw new Error(r.error.message || "No se pudo cambiar la contraseña");
    },
    async perfil() {
      return chequear(await neon.from("usuarios_web").select("*").maybeSingle(), "Perfil");
    },
    async estructuras() { return chequear(await neon.from("v_estructuras").select("*"), "Estructuras"); },
    async obras() { return chequear(await neon.from("v_obras").select("*"), "Obras"); },
    async relevamiento() { return chequear(await neon.from("v_relevamiento").select("*"), "Relevamiento"); },
    async una(tipo, id) {
      const vista = tipo === "estructura" ? "v_estructuras" : "v_obras";
      return chequear(await neon.from(vista).select("*").eq("id", id).single(), "Obra");
    },
    async hitos(tipo, id) {
      return chequear(await neon.from("hitos").select("*").eq(CLAVE[tipo], id).order("orden"), "Hitos");
    },
    async cuaderno(tipo, id) {
      return chequear(await neon.from("cuaderno").select("*").eq(CLAVE[tipo], id)
        .order("fecha", { ascending: false }).order("id", { ascending: false }), "Cuaderno");
    },
    async marcarHito(id, cambios) {
      chequear(await neon.from("hitos").update(cambios).eq("id", id), "Guardar hito");
    },
    async agregarNota(tipo, id, nota) {
      chequear(await neon.from("cuaderno").insert({ ...nota, [CLAVE[tipo]]: id }), "Guardar en el cuaderno");
    },
    // Los cambios en las capas van por la función editar_capa: la Data API no encuentra
    // "Estructuras OICI Obra" por los espacios del nombre (sql/parte7_editar_por_funcion.sql).
    async cambiarEstado(tipo, id, valor) {
      await editarCapa(tipo, id, { [CAMPO_ESTADO[tipo]]: valor }, "Cambiar estado");
    },
    async guardarDatos(tipo, id, cambios) {
      await editarCapa(tipo, id, cambios, "Guardar datos");
    },
    async adminUsuarios() { return chequear(await neon.rpc("admin_usuarios"), "Usuarios"); },
    async crearPunto(capa, lat, lon, datos) {
      return chequear(await neon.rpc("crear_punto", { p_capa: capa, p_lat: lat, p_lon: lon, p_datos: datos }), "Agregar punto");
    },
    async adminHabilitar(user_id, nombre, rol, iniciales) {
      chequear(await neon.rpc("admin_habilitar", { p_user_id: user_id, p_nombre: nombre, p_rol: rol, p_iniciales: iniciales }), "Habilitar");
    },
    async adminQuitar(user_id) { chequear(await neon.rpc("admin_quitar", { p_user_id: user_id }), "Quitar acceso"); },
    async pedirBorrado(tipo, id, motivo) {
      const { data, error } = await neon.rpc("pedir_borrado", { p_tipo: tipo, p_id: id, p_motivo: motivo });
      if (error) throw new Error(/pedir_borrado|schema cache/i.test(error.message)
        ? "Falta preparar la base para borrar: corré sql/parte9_borrar.sql en Neon y tocá Refresh schema cache."
        : "Borrar: " + error.message);
      return data;
    },
    async solicitudes() {
      const { data, error } = await neon.rpc("solicitudes_pendientes");
      if (error) return []; // sin la parte 9 todavía no hay pedidos
      return data || [];
    },
    async resolverBorrado(id, aprobar) {
      chequear(await neon.rpc("resolver_borrado", { p_solicitud: id, p_aprobar: aprobar }), "Resolver pedido");
    },
  };
}

// ---------------------------------------------------------------- demostración
function crearDemo() {
  const hoy = new Date();
  const dia = (n) => new Date(hoy.getTime() + n * 864e5).toISOString().slice(0, 10);
  const E = (id, codigo, estado, etapa, lat, lon, extra = {}) => ({
    id, codigo, estado, etapa, lat, lon, estructura: id % 2 ? "MÁSTIL 100" : "MONOPOLO 40",
    licitacion: "P103456", anio: 2025, director_obra: id % 3 ? "G.S." : "J.P.", recepcion: null,
    fecha_inicio: dia(-120), fecha_fin: null, vence_recepcion: null, dias_para_recepcion: null,
    planos: "https://drive.google.com/", observaciones: null, hitos_hechos: 0, hitos_total: 6,
    proximo_vencimiento: null, ...extra,
  });
  const fin = (d) => ({ fecha_fin: dia(-d), vence_recepcion: dia(730 - d), dias_para_recepcion: 730 - d });
  const est = [
    E(1, "CPD", "CONS", 2, -34.79, -55.85, { proximo_vencimiento: dia(5) }),
    E(2, "LR2", "CONS", 3, -34.88, -56.18),
    E(3, "GDA", "CONS", 4, -30.95, -55.55),
    E(4, "R4E", "PROY", 1, -32.3, -57.6),
    E(5, "CIP", "PROY", 2, -32.0, -56.6),
    E(6, "PBS", "FIN", 5, -32.4, -54.4, fin(700)),
    E(7, "R6E", "FIN", 5, -33.2, -54.9, fin(600)),
    E(8, "CO1", "FIN", 5, -34.4, -57.8, fin(200)),
    E(9, "ATT", "FIN", 5, -34.9, -56.05, fin(800)),
    E(10, "MRJ", "FIN", 6, -34.7, -55.95, { ...fin(900), recepcion: "RD" }),
  ];
  const obr = [
    { id: 1, codigo: "SALA-12", estado: "PROY", etapa: 1, sala: "Sala Norte", localidad: "Rivera", departamento: "Rivera",
      licitacion: "L-22", tarea: "Ampliación", descripcion: "COSITIO", director_obra: "G.S.", planos: null,
      lat: -30.9, lon: -55.5, hitos_hechos: 0, hitos_total: 2, proximo_vencimiento: null },
    { id: 2, codigo: "SALA-07", estado: "CONS", etapa: 2, sala: "Sala Este", localidad: "Rocha", departamento: "Rocha",
      licitacion: "L-19", tarea: "Energía", descripcion: "OBRA", director_obra: "J.P.", planos: null,
      lat: -34.48, lon: -54.33, hitos_hechos: 1, hitos_total: 2, proximo_vencimiento: null },
  ];
  const plant = { estructura: ["Proyecto ejecutivo realizado y aprobado", "Implantado", "Hormigonado", "Montado",
    "Infraestructura finalizada", "Recepción provisoria", "Recepción definitiva"],
    obra: ["Proyecto aprobado", "Infraestructura finalizada"] };
  const etapaDe = { estructura: [2, null, 3, 4, 5, null, 6], obra: [2, 5] };
  const relev = [
    { id: 1, codigo: "P1", descripcion: "Poste de UTE frente al predio", z: "38.42", lat: -34.8812, lon: -56.1765 },
    { id: 2, codigo: "P2", descripcion: "Esquina del cerco", z: "37.95", lat: -34.8806, lon: -56.1781 },
    { id: 3, codigo: "BM", descripcion: "Mojón de referencia", z: null, lat: -34.7905, lon: -55.8512 },
  ];
  let hid = 1, cid = 1;
  const hitos = [], cuaderno = [];
  for (const [tipo, lista] of [["estructura", est], ["obra", obr]]) {
    for (const o of lista) {
      plant[tipo].forEach((nombre, i) => {
        const et = etapaDe[tipo][i];
        const hecho = /^Implanta/.test(nombre) ? o.estado !== "PROY"
          : et != null && et <= o.etapa && !(et === 2 && o.etapa === 1);
        hitos.push({ id: hid++, [tipo === "estructura" ? "estructura_id" : "obra_id"]: o.id, orden: (i + 1) * 10, nombre,
          etapa: et, estado: hecho ? "HECHO" : "PENDIENTE", fecha_real: hecho ? dia(-30 * (6 - i)) : null,
          fecha_prevista: null, recordatorio: null, notas: null });
      });
    }
  }
  cuaderno.push({ id: cid++, estructura_id: 1, fecha: dia(-3), tipo: "VISITA", texto: "Excavación terminada, se coordina hormigonado para la semana próxima.", autor: "Gonza" });
  const clave = (t) => (t === "estructura" ? "estructura_id" : "obra_id");
  const lista = (t) => (t === "estructura" ? est : obr);
  const recalcular = (t, id) => {
    const o = lista(t).find((x) => x.id === id);
    const hs = hitos.filter((h) => h[clave(t)] === id);
    o.hitos_hechos = hs.filter((h) => h.estado === "HECHO").length;
    if (t === "estructura") {
      // mismas reglas que la base (sql/parte8 y parte10)
      const est = (e) => hs.find((h) => h.etapa === e)?.estado;
      const ok = (e) => ["HECHO", "NO APLICA"].includes(est(e));
      const impl = hs.find((h) => /^Implanta/.test(h.nombre))?.estado === "HECHO";
      const base = Math.max(1, ...hs.filter((h) => h.estado === "HECHO" && h.etapa >= 2 && h.etapa <= 4).map((h) => h.etapa));
      const cerrada = est(5) === "HECHO" && ok(3) && ok(4);
      o.etapa = cerrada ? (est(6) === "HECHO" ? 6 : 5) : est(5) === "EN CURSO" ? Math.max(base, 4) : base;
      const iniciada = impl || hs.some((h) => h.etapa >= 3 && h.etapa <= 5 && ["HECHO", "EN CURSO"].includes(h.estado));
      o.estado = cerrada ? "FIN" : iniciada ? "CONS" : "PROY";
      if (cerrada && !o.fecha_fin) Object.assign(o, fin(0));
      if (!cerrada) o.fecha_fin = null;
    } else {
      o.etapa = Math.max(1, ...hs.filter((h) => h.estado === "HECHO" && h.etapa).map((h) => h.etapa));
      if (o.etapa >= 5) { o.estado = "FIN"; if (!o.fecha_fin) Object.assign(o, fin(0)); }
      else if (o.etapa >= 3) o.estado = "CONS";
    }
    if (o.etapa >= 6) { o.recepcion = "RD"; o.dias_para_recepcion = null; }
  };
  const cuentas = [
    { user_id: "u-juan", email: "juan.perez@ejemplo.com", nombre_cuenta: "Juan Pérez", registrado: dia(-1), nombre: null, rol: null, iniciales_do: null, admin: false, habilitado: false },
    { user_id: "demo", email: "dtdoici@gmail.com", nombre_cuenta: "G.S.", registrado: dia(-10), nombre: "Gonza", rol: "EDITOR", iniciales_do: "G.S.", admin: true, habilitado: true },
    { user_id: "u-ana", email: "ana@ejemplo.com", nombre_cuenta: "Ana", registrado: dia(-6), nombre: "Ana", rol: "LECTOR", iniciales_do: "A.R.", admin: false, habilitado: true },
  ];
  // en la demostración la sesión queda guardada en el navegador, como en la versión real
  let sesion = null;
  try { sesion = JSON.parse(localStorage.getItem("obras-oici-demo-sesion") || "null"); } catch (e) { /* sin almacenamiento */ }
  const recordar = (v) => { try { v ? localStorage.setItem("obras-oici-demo-sesion", JSON.stringify(v)) : localStorage.removeItem("obras-oici-demo-sesion"); } catch (e) { /* nada */ } };
  // sin conexión la demostración falla igual que la versión real
  const espera = () => new Promise((r, no) => setTimeout(() => (navigator.onLine ? r() : no(new Error("Failed to fetch"))), 120));
  return {
    demo: true,
    async usuario() { await espera(); return sesion; },
    async entrar(email) { await espera(); sesion = { id: "demo", email, name: "Gonza" }; recordar(sesion); return sesion; },
    async crearCuenta(email, p, name) { return this.entrar(email, p, name); },
    async salir() { sesion = null; recordar(null); },
    async pedirReseteo() { await espera(); },
    async nuevaContrasena() { await espera(); },
    async perfil() { await espera(); return { user_id: "demo", nombre: "Gonza", rol: "EDITOR", iniciales_do: "G.S.", admin: true }; },
    async adminUsuarios() { await espera(); return structuredClone(cuentas); },
    async crearPunto(capa, lat, lon, d) {
      await espera();
      if (capa === "relevamiento") {
        const id = Math.max(0, ...relev.map((x) => x.id)) + 1;
        relev.push({ id, codigo: d["CÓDIGO"] || null, descripcion: d["DESCRIPCIÓN"] || null, z: d["Z"] ?? null, lat, lon });
        return id;
      }
      const lista = capa === "estructura" ? est : obr;
      const id = Math.max(0, ...lista.map((x) => x.id)) + 1;
      if (capa === "estructura") {
        est.push(E(id, d["CÓDIGO"], d["ESTADO"] || "PROY", 1, lat, lon, { estructura: d["ESTRUCTURA"], licitacion: d["LICITACIÓN"],
          anio: d["AÑO"], director_obra: d["D.O."], fecha_inicio: d["FECHA INICIO"] || null, planos: d["PLANOS"] || null, hitos_total: 6 }));
      } else {
        obr.push({ id, codigo: d["CÓDIGO"], estado: d["Estado"] || "PROY", etapa: 1, sala: d["Sala"], localidad: d["Localidad"],
          departamento: d["Departamento"], licitacion: d["Licitación"], tarea: d["Tarea"], descripcion: d["Descripción"],
          director_obra: d["D.O."], planos: d["Planos"] || null, lat, lon, hitos_hechos: 0, hitos_total: 2, proximo_vencimiento: null });
      }
      return id;
    },
    async adminHabilitar(id, nombre, rol, ini) {
      Object.assign(cuentas.find((c) => c.user_id === id), { nombre, rol, iniciales_do: ini, habilitado: true });
    },
    async pedirBorrado(tipo, id, motivo) {
      await espera();
      const t = tipo === "relevamiento" ? relev : lista(tipo);
      const o = t.find((x) => x.id === id);
      if (!o) throw new Error("Borrar: ya no existe");
      // en la demostración el usuario es administrador: borra directo
      t.splice(t.indexOf(o), 1);
      return "BORRADO";
    },
    async solicitudes() { await espera(); return []; },
    async resolverBorrado() { await espera(); },
    async adminQuitar(id) {
      if (id === "demo") throw new Error("No podés quitarte el acceso a vos mismo");
      Object.assign(cuentas.find((c) => c.user_id === id), { nombre: null, rol: null, iniciales_do: null, habilitado: false });
    },
    async estructuras() { await espera(); return structuredClone(est); },
    async obras() { await espera(); return structuredClone(obr); },
    async relevamiento() { await espera(); return structuredClone(relev); },
    async una(t, id) { await espera(); return structuredClone(lista(t).find((x) => x.id === id)); },
    async hitos(t, id) { await espera(); return structuredClone(hitos.filter((h) => h[clave(t)] === id)); },
    async cuaderno(t, id) { await espera(); return structuredClone(cuaderno.filter((c) => c[clave(t)] === id).reverse()); },
    async marcarHito(id, cambios) {
      const h = hitos.find((x) => x.id === id); Object.assign(h, cambios);
      recalcular(h.estructura_id ? "estructura" : "obra", h.estructura_id || h.obra_id);
    },
    async agregarNota(t, id, nota) { cuaderno.push({ id: cid++, [clave(t)]: id, ...nota }); },
    async cambiarEstado(t, id, v) { lista(t).find((x) => x.id === id).estado = v; },
    async guardarDatos(t, id, cambios) {
      await espera();
      const campo = { ESTRUCTURA: "estructura", "LICITACIÓN": "licitacion", "AÑO": "anio", "D.O.": "director_obra",
        "FECHA INICIO": "fecha_inicio", "FECHA FIN": "fecha_fin", "RECEPCIÓN": "recepcion", PLANOS: "planos",
        OBSERVACIONES: "observaciones", Sala: "sala", Localidad: "localidad", Departamento: "departamento",
        "Licitación": "licitacion", Tarea: "tarea", "Descripción": "descripcion", Planos: "planos", ESTADO: "estado", Estado: "estado" };
      const o = lista(t).find((x) => x.id === id);
      for (const [k, v] of Object.entries(cambios)) o[campo[k]] = v;
    },
  };
}

export async function crearApi() {
  return new URLSearchParams(location.search).has("demo") ? crearDemo() : crearNeon();
}
