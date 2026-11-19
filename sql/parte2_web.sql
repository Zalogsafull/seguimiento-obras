-- =====================================================================
-- PARTE 2 — Acceso web (sin tocar usuarios ni contraseñas)   (Neon > SQL Editor)
-- Correr DESPUÉS de activar la Data API con Neon Auth (instructivo, paso 5)
-- y ANTES de crear usuarios web. Requiere la parte 1 ya corrida.
-- NO cambia la contraseña de neondb_owner ni crea usuarios de base.
-- QGIS y QField (que entran con neondb_owner, dueño de las tablas) siguen
-- viendo y editando todo igual que hoy: estas reglas solo aplican a la web.
-- =====================================================================

BEGIN;

-- 0) Controles: las tablas deben ser del usuario que corre esto (así QGIS
--    con ese usuario no queda afectado por las reglas) y la Data API activa.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public'
             AND tablename IN ('Estructuras OICI Obra','Obras','hitos','cuaderno','plantilla_hitos')
             AND tableowner <> current_user) THEN
    RAISE EXCEPTION 'Alguna tabla no es de %; no aplico la seguridad', current_user;
  END IF;
  IF to_regprocedure('auth.user_id()') IS NULL OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE EXCEPTION 'La Data API con Neon Auth no está activa todavía';
  END IF;
END $$;

-- B) USUARIOS WEB AUTORIZADOS ------------------------------------------
--    Solo quien esté en esta tabla ve algo en la web, aunque tenga cuenta.
CREATE TABLE IF NOT EXISTS public.usuarios_web (
  user_id text PRIMARY KEY,               -- id del usuario en Neon Auth
  nombre  text NOT NULL,
  rol     text NOT NULL DEFAULT 'LECTOR' CHECK (rol IN ('LECTOR','EDITOR')),
  iniciales_do text          -- como figuran en el campo D.O. (ej. 'G.S.'): filtro "Mis obras"
);

-- Rol del usuario que hace el pedido (NULL = no autorizado)
CREATE OR REPLACE FUNCTION public.rol_web() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT rol FROM public.usuarios_web WHERE user_id = auth.user_id()
$$;
REVOKE ALL ON FUNCTION public.rol_web() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rol_web() TO authenticated;

-- C) PERMISOS DE LA WEB (rol "authenticated" de la Data API) -------------
--    Nada para "anonymous": sin iniciar sesión no se ve nada.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anonymous') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anonymous';
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public."Estructuras OICI Obra", public."Obras", public.hitos,
  public.cuaderno, public.plantilla_hitos, public.v_estructuras, public.v_obras,
  public.usuarios_web TO authenticated;
-- Desde la web solo se editan datos de seguimiento, nunca la ubicación ni el fid
GRANT UPDATE ("ESTADO","RECEPCIÓN","OBSERVACIONES","FECHA INICIO","FECHA FIN","PLANOS","D.O.")
  ON public."Estructuras OICI Obra" TO authenticated;
GRANT UPDATE ("Estado","Tarea","Descripción","Planos","D.O.")
  ON public."Obras" TO authenticated;
GRANT INSERT, UPDATE ON public.hitos TO authenticated;
GRANT INSERT ON public.cuaderno TO authenticated;

-- D) SEGURIDAD POR FILA (RLS) -------------------------------------------
ALTER TABLE public."Estructuras OICI Obra" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Obras"                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hitos                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cuaderno                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plantilla_hitos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios_web            ENABLE ROW LEVEL SECURITY;

-- Web: LECTOR y EDITOR ven; solo EDITOR modifica
DROP POLICY IF EXISTS web_ver ON public."Estructuras OICI Obra";
CREATE POLICY web_ver ON public."Estructuras OICI Obra" FOR SELECT TO authenticated USING (public.rol_web() IS NOT NULL);
DROP POLICY IF EXISTS web_ver ON public."Obras";
CREATE POLICY web_ver ON public."Obras"                 FOR SELECT TO authenticated USING (public.rol_web() IS NOT NULL);
DROP POLICY IF EXISTS web_ver ON public.hitos;
CREATE POLICY web_ver ON public.hitos                   FOR SELECT TO authenticated USING (public.rol_web() IS NOT NULL);
DROP POLICY IF EXISTS web_ver ON public.cuaderno;
CREATE POLICY web_ver ON public.cuaderno                FOR SELECT TO authenticated USING (public.rol_web() IS NOT NULL);
DROP POLICY IF EXISTS web_ver ON public.plantilla_hitos;
CREATE POLICY web_ver ON public.plantilla_hitos         FOR SELECT TO authenticated USING (public.rol_web() IS NOT NULL);
DROP POLICY IF EXISTS web_ver ON public.usuarios_web;
CREATE POLICY web_ver ON public.usuarios_web            FOR SELECT TO authenticated USING (user_id = auth.user_id());

DROP POLICY IF EXISTS web_editar ON public."Estructuras OICI Obra";
CREATE POLICY web_editar ON public."Estructuras OICI Obra" FOR UPDATE TO authenticated
  USING (public.rol_web() = 'EDITOR') WITH CHECK (public.rol_web() = 'EDITOR');
DROP POLICY IF EXISTS web_editar ON public."Obras";
CREATE POLICY web_editar ON public."Obras" FOR UPDATE TO authenticated
  USING (public.rol_web() = 'EDITOR') WITH CHECK (public.rol_web() = 'EDITOR');
DROP POLICY IF EXISTS web_editar ON public.hitos;
CREATE POLICY web_editar ON public.hitos FOR UPDATE TO authenticated
  USING (public.rol_web() = 'EDITOR') WITH CHECK (public.rol_web() = 'EDITOR');
DROP POLICY IF EXISTS web_agregar ON public.hitos;
CREATE POLICY web_agregar ON public.hitos FOR INSERT TO authenticated
  WITH CHECK (public.rol_web() = 'EDITOR');
DROP POLICY IF EXISTS web_agregar ON public.cuaderno;
CREATE POLICY web_agregar ON public.cuaderno FOR INSERT TO authenticated
  WITH CHECK (public.rol_web() = 'EDITOR');

COMMIT;

-- E) DAR DE ALTA A UNA PERSONA EN LA WEB (repetir por cada una) -----------
--    1. Creá su cuenta en Neon > Auth > Users (o que se registre una vez).
--    2. Buscá su id:  en Tables, esquema neon_auth, tabla de usuarios
--       (columna id, junto a su email).
--    3. Autorizala:
-- INSERT INTO public.usuarios_web (user_id, nombre, rol, iniciales_do)
-- VALUES ('ID_COPIADO', 'Gonza', 'EDITOR', 'G.S.');
--    Para quitarle el acceso:  DELETE FROM public.usuarios_web WHERE nombre = '...';
