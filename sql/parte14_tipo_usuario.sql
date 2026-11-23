-- =====================================================================
-- PARTE 14 — Tipo de usuario: "con obras" (director de obra) o "ve todas"
-- (Neon > SQL Editor). Requiere la parte 3. No cambia contraseñas ni datos de las capas.
-- Después de correrlo: Neon > Data API > "Refresh schema cache".
--
-- - Con obras: el usuario es director de obra. La web le muestra primero sus obras
--   ("Mis obras" prendido al entrar). Si el administrador no le eligió el D.O.,
--   la web se lo pregunta la primera vez que entra.
-- - Ve todas: no tiene obras propias; ve todas y no se le pregunta nada.
-- Las cuentas que ya tenían iniciales de D.O. quedan como "con obras".
-- =====================================================================
BEGIN;

ALTER TABLE public.usuarios_web ADD COLUMN IF NOT EXISTS con_obras boolean;
UPDATE public.usuarios_web SET con_obras = (iniciales_do IS NOT NULL) WHERE con_obras IS NULL;
ALTER TABLE public.usuarios_web ALTER COLUMN con_obras SET DEFAULT false;
ALTER TABLE public.usuarios_web ALTER COLUMN con_obras SET NOT NULL;

-- Lista de cuentas (ahora con el tipo)
DROP FUNCTION IF EXISTS public.admin_usuarios();
CREATE FUNCTION public.admin_usuarios()
RETURNS TABLE (user_id text, email text, nombre_cuenta text, registrado text,
               nombre text, rol text, iniciales_do text, admin boolean, habilitado boolean, con_obras boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $fn$
#variable_conflict use_column
BEGIN
  IF NOT public.es_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede ver los usuarios';
  END IF;
  RETURN QUERY
  SELECT x.j->>'id', x.j->>'email', x.j->>'name',
         coalesce(x.j->>'createdAt', x.j->>'created_at'),
         w.nombre, w.rol, w.iniciales_do, coalesce(w.admin, false), (w.user_id IS NOT NULL), coalesce(w.con_obras, false)
  FROM (SELECT to_jsonb(u) AS j FROM neon_auth."user" u) x
  LEFT JOIN public.usuarios_web w ON w.user_id = x.j->>'id'
  ORDER BY (w.user_id IS NOT NULL), coalesce(x.j->>'createdAt', x.j->>'created_at') DESC NULLS LAST;
END $fn$;

-- Habilitar o actualizar una cuenta, con su tipo.
-- Si no llega el tipo (web vieja todavía en caché): con obras si tiene iniciales.
-- (Escrita sin ON CONFLICT: el editor de Neon cortaba la función en esa parte.)
DROP FUNCTION IF EXISTS public.admin_habilitar(text, text, text, text);
DROP FUNCTION IF EXISTS public.admin_habilitar(text, text, text, text, boolean);
CREATE FUNCTION public.admin_habilitar(p_user_id text, p_nombre text, p_rol text, p_iniciales text,
                                       p_con_obras boolean DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_ini    text;
  v_con    boolean;
  v_nombre text;
BEGIN
  IF NOT public.es_admin() THEN
    RAISE EXCEPTION 'Solo un administrador puede habilitar usuarios';
  END IF;
  IF p_rol NOT IN ('LECTOR', 'EDITOR') THEN
    RAISE EXCEPTION 'Rol no válido: %', p_rol;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM neon_auth."user" u WHERE to_jsonb(u)->>'id' = p_user_id) THEN
    RAISE EXCEPTION 'Esa cuenta no existe';
  END IF;
  v_ini := nullif(trim(p_iniciales), '');
  v_con := coalesce(p_con_obras, v_ini IS NOT NULL);
  IF NOT v_con THEN
    v_ini := NULL;
  END IF;
  v_nombre := coalesce(nullif(trim(p_nombre), ''), 'Sin nombre');
  UPDATE public.usuarios_web SET nombre = v_nombre, rol = p_rol, iniciales_do = v_ini, con_obras = v_con
  WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    INSERT INTO public.usuarios_web (user_id, nombre, rol, iniciales_do, con_obras)
    VALUES (p_user_id, v_nombre, p_rol, v_ini, v_con);
  END IF;
END $fn$;

-- El propio usuario "con obras" elige qué director de obra es
CREATE OR REPLACE FUNCTION public.elegir_mi_do(p_iniciales text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_ini text;
BEGIN
  v_ini := nullif(trim(p_iniciales), '');
  IF v_ini IS NULL THEN
    RAISE EXCEPTION 'Elegí qué director de obra sos';
  END IF;
  IF length(v_ini) > 20 THEN
    RAISE EXCEPTION 'Las iniciales son demasiado largas';
  END IF;
  UPDATE public.usuarios_web SET iniciales_do = v_ini
  WHERE user_id = auth.user_id() AND con_obras;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tu usuario no es de tipo "con obras": pedile al administrador que lo cambie';
  END IF;
END $fn$;

REVOKE ALL ON FUNCTION public.admin_usuarios(), public.admin_habilitar(text, text, text, text, boolean),
  public.elegir_mi_do(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_usuarios(), public.admin_habilitar(text, text, text, text, boolean),
  public.elegir_mi_do(text) TO authenticated;

COMMIT;

-- Control: cada usuario con su tipo
SELECT nombre, rol, CASE WHEN con_obras THEN 'con obras' ELSE 've todas' END AS tipo, iniciales_do, admin
FROM public.usuarios_web ORDER BY nombre;
