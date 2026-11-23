-- =====================================================================
-- PARTE 20 — FECHA FIN también en Obras   (Neon > SQL Editor > Run)
-- No cambia datos existentes ni contraseñas.
-- Después de correrlo: Neon > Data API > "Refresh schema cache".
--
-- - Agrega la columna "FECHA FIN" (fecha) a "Obras". En QGIS / QField aparece
--   como un campo más (recargá la capa para verla).
-- - La web la usa para mandar a la papelera de Drive la carpeta de planos
--   un mes después de la fecha de fin (igual que en las estructuras).
-- =====================================================================
BEGIN;

ALTER TABLE public."Obras" ADD COLUMN IF NOT EXISTS "FECHA FIN" date;

DO $do$
DECLARE
  v_def text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'v_obras' AND column_name = 'fecha_fin') THEN
    v_def := rtrim(pg_get_viewdef('public.v_obras'::regclass, true), E'; \n');
    EXECUTE format('CREATE OR REPLACE VIEW public.v_obras WITH (security_invoker = true) AS
                    SELECT v.*, x."FECHA FIN" AS fecha_fin
                    FROM (%s) v LEFT JOIN public."Obras" x ON x.fid = v.id', v_def);
  END IF;
END $do$;

CREATE OR REPLACE FUNCTION public.editar_capa(p_tipo text, p_id integer, p_cambios jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_tabla     text;
  v_permitido text[];
  v_cols      text;
  v_n         integer;
BEGIN
  IF coalesce(public.rol_web(), '') <> 'EDITOR' THEN
    RAISE EXCEPTION 'Solo un usuario con permiso de editor puede cambiar datos';
  END IF;
  IF p_tipo = 'estructura' THEN
    v_tabla := 'Estructuras OICI Obra';
    v_permitido := ARRAY['ESTADO', 'ESTRUCTURA', 'LICITACIÓN', 'AÑO', 'D.O.', 'FECHA INICIO', 'FECHA FIN',
                         'RECEPCIÓN', 'PLANOS', 'OBSERVACIONES', 'FIN PREVISTO'];
  ELSIF p_tipo = 'obra' THEN
    v_tabla := 'Obras';
    v_permitido := ARRAY['Estado', 'Sala', 'Localidad', 'Departamento', 'Licitación', 'Tarea', 'Descripción',
                         'D.O.', 'Planos', 'FIN PREVISTO', 'FECHA FIN'];
  ELSE
    RAISE EXCEPTION 'Capa desconocida: %', p_tipo;
  END IF;

  SELECT string_agg(quote_ident(k), ', ') INTO v_cols
  FROM jsonb_object_keys(coalesce(p_cambios, '{}'::jsonb)) AS k
  WHERE k = ANY (v_permitido)
    AND EXISTS (SELECT 1 FROM information_schema.columns c
                WHERE c.table_schema = 'public' AND c.table_name = v_tabla AND c.column_name = k);
  IF v_cols IS NULL THEN RAISE EXCEPTION 'No hay campos para cambiar'; END IF;

  EXECUTE format('UPDATE public.%I SET (%s) = (SELECT %s FROM jsonb_populate_record(NULL::public.%I, $1)) WHERE fid = $2',
                 v_tabla, v_cols, v_cols, v_tabla)
    USING p_cambios, p_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN RAISE EXCEPTION 'No se encontró el elemento % en %', p_id, v_tabla; END IF;
END $fn$;

REVOKE ALL ON FUNCTION public.editar_capa(text, integer, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.editar_capa(text, integer, jsonb) TO authenticated;

COMMIT;
