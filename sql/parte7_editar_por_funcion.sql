-- =====================================================================
-- PARTE 7 — Guardar cambios de la web con una función   (Neon > SQL Editor)
-- Requiere la parte 2. No cambia datos existentes ni contraseñas.
-- Después de correrlo: Neon > Data API > "Refresh schema cache".
--
-- Por qué: la Data API de Neon no encuentra la tabla "Estructuras OICI Obra"
-- porque el nombre tiene espacios ("Could not find the table
-- 'public.Estructuras%20OICI%20Obra'"). Así la web no podía cambiar la
-- situación ni los datos de las estructuras. Esta función recibe el cambio
-- y lo guarda en la tabla, solo para editores y solo en los campos permitidos.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.editar_capa(p_tipo text, p_id integer, p_cambios jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
                         'RECEPCIÓN', 'PLANOS', 'OBSERVACIONES'];
  ELSIF p_tipo = 'obra' THEN
    v_tabla := 'Obras';
    v_permitido := ARRAY['Estado', 'Sala', 'Localidad', 'Departamento', 'Licitación', 'Tarea', 'Descripción',
                         'D.O.', 'Planos'];
  ELSE
    RAISE EXCEPTION 'Capa desconocida: %', p_tipo;
  END IF;

  -- campos pedidos que se pueden cambiar y que existen en la capa
  SELECT string_agg(quote_ident(k), ', ') INTO v_cols
  FROM jsonb_object_keys(coalesce(p_cambios, '{}'::jsonb)) AS k
  WHERE k = ANY (v_permitido)
    AND EXISTS (SELECT 1 FROM information_schema.columns c
                WHERE c.table_schema = 'public' AND c.table_name = v_tabla AND c.column_name = k);
  IF v_cols IS NULL THEN RAISE EXCEPTION 'No hay campos para cambiar'; END IF;

  -- jsonb_populate_record convierte cada valor al tipo de su columna (texto, número, fecha)
  EXECUTE format('UPDATE public.%I SET (%s) = (SELECT %s FROM jsonb_populate_record(NULL::public.%I, $1)) WHERE fid = $2',
                 v_tabla, v_cols, v_cols, v_tabla)
    USING p_cambios, p_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN RAISE EXCEPTION 'No se encontró el elemento % en %', p_id, v_tabla; END IF;
END $$;

REVOKE ALL ON FUNCTION public.editar_capa(text, integer, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.editar_capa(text, integer, jsonb) TO authenticated;
