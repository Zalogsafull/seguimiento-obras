-- =====================================================================
-- PARTE 13 — Revisar y cerrar la seguridad de todas las capas   (Neon > SQL Editor)
-- No cambia datos ni contraseñas. QGIS y QField (usuario neondb_owner, dueño de
-- las tablas) siguen viendo y editando todo igual que siempre.
--
-- Qué hace:
--  1. Activa la seguridad por filas en TODAS las tablas de public. Las que no tienen
--     una regla para la web (por ejemplo Amojonamiento, Padrones, Triangulos)
--     quedan cerradas para la web: nadie las ve desde la Data API.
--  2. Saca cualquier permiso del usuario anónimo (quien entra sin cuenta).
--  3. Las tablas nuevas que crees desde QGIS dejan de quedar abiertas a la web por defecto.
-- Al final muestra un informe: cada tabla, si tiene la seguridad activa y qué puede la web.
-- =====================================================================
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
             AND pg_get_userbyid(c.relowner) = current_user LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anonymous') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anonymous';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anonymous';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    -- las tablas que se creen de ahora en más no quedan abiertas a la web
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated';
  END IF;
END $$;

-- Informe
SELECT c.relname AS tabla,
       CASE WHEN c.relrowsecurity THEN 'sí' ELSE 'NO' END AS seguridad_por_filas,
       (SELECT count(*) FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS reglas_para_la_web,
       CASE WHEN has_table_privilege('anonymous', c.oid, 'SELECT') THEN 'PUEDE LEER' ELSE 'no' END AS anonimo,
       CASE WHEN NOT c.relrowsecurity AND has_table_privilege('authenticated', c.oid, 'SELECT') THEN 'PUEDE LEER TODO'
            WHEN (SELECT count(*) FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = c.relname) = 0 THEN 'nada'
            ELSE 'solo usuarios habilitados' END AS usuario_con_cuenta
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relname <> 'spatial_ref_sys'
ORDER BY 1;
