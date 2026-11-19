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
    async cambiarEstado(tipo, id, valor) {
      chequear(await neon.from(TABLA[tipo]).update({ [CAMPO_ESTADO[tipo]]: valor }).eq("fid", id), "Cambiar estado");
    },
    async adminUsuarios() { return chequear(await neon.rpc("admin_usuarios"), "Usuarios"); },
    async adminHabilitar(user_id, nombre, rol, iniciales) {
      chequear(await neon.rpc("admin_habilitar", { p_user_id: user_id, p_nombre: nombre, p_rol: rol, p_iniciales: iniciales }), "Habilitar");
    },
    async adminQuitar(user_id) { chequear(await neon.rpc("admin_quitar", { p_user_id: user_id }), "Quitar acceso"); },
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
  const plant = { estructura: ["Proyecto ejecutivo realizado y aprobado", "Hormigonado", "Estructura montada",
    "Infraestructura terminada (fin de obra)", "Recepción provisoria", "Recepción definitiva"],
    obra: ["Proyecto aprobado", "Infraestructura terminada (fin de obra)"] };
  const etapaDe = { estructura: [2, 3, 4, 5, null, 6], obra: [2, 5] };
  let hid = 1, cid = 1;
  const hitos = [], cuaderno = [];
  for (const [tipo, lista] of [["estructura", est], ["obra", obr]]) {
    for (const o of lista) {
      plant[tipo].forEach((nombre, i) => {
        const et = etapaDe[tipo][i];
        const hecho = et != null && et <= o.etapa && !(et === 2 && o.etapa === 1);
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
    o.etapa = Math.max(1, ...hs.filter((h) => h.estado === "HECHO" && h.etapa).map((h) => h.etapa));
    o.hitos_hechos = hs.filter((h) => h.estado === "HECHO").length;
    if (o.etapa >= 5) { o.estado = "FIN"; if (!o.fecha_fin) Object.assign(o, fin(0)); }
    else if (o.etapa >= 3) o.estado = "CONS";
    if (o.etapa >= 6) { o.recepcion = "RD"; o.dias_para_recepcion = null; }
  };
  const cuentas = [
    { user_id: "u-juan", email: "juan.perez@ejemplo.com", nombre_cuenta: "Juan Pérez", registrado: dia(-1), nombre: null, rol: null, iniciales_do: null, admin: false, habilitado: false },
    { user_id: "demo", email: "dtdoici@gmail.com", nombre_cuenta: "G.S.", registrado: dia(-10), nombre: "Gonza", rol: "EDITOR", iniciales_do: "G.S.", admin: true, habilitado: true },
    { user_id: "u-ana", email: "ana@ejemplo.com", nombre_cuenta: "Ana", registrado: dia(-6), nombre: "Ana", rol: "LECTOR", iniciales_do: "A.R.", admin: false, habilitado: true },
  ];
  let sesion = null;
  const espera = () => new Promise((r) => setTimeout(r, 120));
  return {
    demo: true,
    async usuario() { return sesion; },
    async entrar(email) { await espera(); sesion = { id: "demo", email, name: "Gonza" }; return sesion; },
    async crearCuenta(email, p, name) { return this.entrar(email, p, name); },
    async salir() { sesion = null; },
    async pedirReseteo() { await espera(); },
    async nuevaContrasena() { await espera(); },
    async perfil() { return { user_id: "demo", nombre: "Gonza", rol: "EDITOR", iniciales_do: "G.S.", admin: true }; },
    async adminUsuarios() { await espera(); return structuredClone(cuentas); },
    async adminHabilitar(id, nombre, rol, ini) {
      Object.assign(cuentas.find((c) => c.user_id === id), { nombre, rol, iniciales_do: ini, habilitado: true });
    },
    async adminQuitar(id) {
      if (id === "demo") throw new Error("No podés quitarte el acceso a vos mismo");
      Object.assign(cuentas.find((c) => c.user_id === id), { nombre: null, rol: null, iniciales_do: null, habilitado: false });
    },
    async estructuras() { await espera(); return structuredClone(est); },
    async obras() { await espera(); return structuredClone(obr); },
    async una(t, id) { return structuredClone(lista(t).find((x) => x.id === id)); },
    async hitos(t, id) { return structuredClone(hitos.filter((h) => h[clave(t)] === id)); },
    async cuaderno(t, id) { return structuredClone(cuaderno.filter((c) => c[clave(t)] === id).reverse()); },
    async marcarHito(id, cambios) {
      const h = hitos.find((x) => x.id === id); Object.assign(h, cambios);
      recalcular(h.estructura_id ? "estructura" : "obra", h.estructura_id || h.obra_id);
    },
    async agregarNota(t, id, nota) { cuaderno.push({ id: cid++, [clave(t)]: id, ...nota }); },
    async cambiarEstado(t, id, v) { lista(t).find((x) => x.id === id).estado = v; },
  };
}

export async function crearApi() {
  return new URLSearchParams(location.search).has("demo") ? crearDemo() : crearNeon();
}
