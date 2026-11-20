-- =====================================================================
-- PARTE 4 — Agregar puntos nuevos desde la web   (Neon > SQL Editor)
-- Requiere las partes 1 a 3. No cambia datos existentes ni contraseñas.
-- Después de correrlo: Neon > Data API > "Refresh schema cache".
--
-- La web manda latitud y longitud WGS 84; acá se transforma al sistema de
-- las capas (EPSG:31981) y se completan LAT, LONG, Maps y WAZE con las
-- mismas fórmulas que usa el proyecto de QGIS / QField.
-- =====================================================================
BEGIN;

CREATE OR REPLACE FUNCTION public.crear_punto(p_capa text, p_lat double precision, p_lon double precision, p_datos jsonb)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tabla  text;
  v_geom   geometry;
  v_wgs    geometry;
  v_lat    double precision;
  v_lon    double precision;
  v_datos  jsonb := coalesce(p_datos, '{}'::jsonb);
  v_cols   text;
  v_nuevo  integer;
BEGIN
  IF coalesce(public.rol_web(), '') <> 'EDITOR' THEN
    RAISE EXCEPTION 'Solo un usuario con permiso de editor puede agregar puntos';
  END IF;
  v_tabla := CASE p_capa WHEN 'estructura' THEN 'Estructuras OICI Obra' WHEN 'obra' THEN 'Obras' END;
  IF v_tabla IS NULL THEN RAISE EXCEPTION 'Capa desconocida: %', p_capa; END IF;
  IF p_lat IS NULL OR p_lon IS NULL OR p_lat NOT BETWEEN -36 AND -29 OR p_lon NOT BETWEEN -59.5 AND -52 THEN
    RAISE EXCEPTION 'Las coordenadas (%, %) quedan fuera de Uruguay. Revisá que la latitud vaya primero.', p_lat, p_lon;
  END IF;
  IF nullif(trim(v_datos->>'CÓDIGO'), '') IS NULL THEN
    RAISE EXCEPTION 'Falta el código';
  END IF;

  -- Geometría en el sistema de la capa (PointZ para estructuras, Point para obras)
  v_geom := ST_Transform(ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326), 31981);
  IF p_capa = 'estructura' THEN v_geom := ST_Force3DZ(v_geom); END IF;

  -- LAT / LONG / Maps / WAZE como en QGIS: se calculan desde la geometría guardada
  v_wgs := ST_Transform(ST_Force2D(v_geom), 4326);
  v_lat := ST_Y(v_wgs); v_lon := ST_X(v_wgs);
  v_datos := v_datos || jsonb_build_object(
    'LAT', v_lat, 'LONG', v_lon,
    'Maps', 'https://www.google.com/maps/dir/?api=1&destination=' || v_lat::text || '%2C' || v_lon::text || '&travelmode=driving',
    'WAZE', 'https://waze.com/ul?ll=' || v_lat::text || ',' || v_lon::text || '&navigate=yes',
    'Waze', 'https://waze.com/ul?ll=' || v_lat::text || ',' || v_lon::text || '&navigate=yes');

  -- Solo las columnas que existen en la capa (nunca fid, geom ni ETAPA: los pone la base)
  SELECT string_agg(quote_ident(k), ', ') INTO v_cols
  FROM jsonb_object_keys(v_datos) AS k
  WHERE k NOT IN ('fid', 'geom', 'ETAPA')
    AND EXISTS (SELECT 1 FROM information_schema.columns c
                WHERE c.table_schema = 'public' AND c.table_name = v_tabla AND c.column_name = k);

  EXECUTE format('INSERT INTO public.%I (%s, geom) SELECT %s, $2 FROM jsonb_populate_record(NULL::public.%I, $1) RETURNING fid',
                 v_tabla, v_cols, v_cols, v_tabla)
    USING v_datos, v_geom INTO v_nuevo;
  RETURN v_nuevo;
END $$;

REVOKE ALL ON FUNCTION public.crear_punto(text, double precision, double precision, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crear_punto(text, double precision, double precision, jsonb) TO authenticated;

COMMIT;
