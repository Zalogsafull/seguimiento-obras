-- =====================================================================
-- PARTE 8 — Hito "Implantación" y fechas automáticas   (Neon > SQL Editor)
-- Requiere las partes 1 a 2. No cambia contraseñas.
-- Después de correrlo: Neon > Data API > "Refresh schema cache".
--
-- Estructuras OICI Obra:
--  * Nuevo hito "Implantación (inicio de obra)", entre el proyecto aprobado y el hormigonado.
--    - Al marcarlo: la situación pasa a En obra (se ve como "Hormigonado", la tarea en curso)
--      y FECHA INICIO toma la fecha del hito. Al desmarcarlo: FECHA INICIO se borra y,
--      si no hay ningún hito de obra hecho, vuelve a Proyecto.
--  * "Infraestructura terminada" cierra la obra (FIN) solo si hormigonado y montaje están
--    hechos (o marcados "No aplica"). Se puede marcar antes que el montaje: la obra sigue
--    abierta y se cierra sola cuando se marca el montaje.
--  * Al cerrarse, FECHA FIN toma la fecha del último de esos tres hitos; si se desmarca
--    alguno y la obra se reabre, FECHA FIN se borra.
--  * Las estructuras que hoy están En obra o Terminadas quedan con Implantación hecha
--    (con su FECHA INICIO, si la tienen), así no cambia nada de lo que ya está cargado.
-- =====================================================================
BEGIN;

-- 1) Plantilla: el hito nuevo para las estructuras que se creen de ahora en más
INSERT INTO public.plantilla_hitos (capa, orden, nombre, etapa)
VALUES ('ESTRUCTURAS', 15, 'Implantación (inicio de obra)', NULL)
ON CONFLICT (capa, orden) DO UPDATE SET nombre = EXCLUDED.nombre, etapa = EXCLUDED.etapa;

-- 2) Cálculo de etapa, situación y fechas al marcar o desmarcar un hito
CREATE OR REPLACE FUNCTION public.actualizar_etapa() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_est       integer := COALESCE(NEW.estructura_id, OLD.estructura_id);
  v_obra      integer := COALESCE(NEW.obra_id, OLD.obra_id);
  -- el hito que cambió
  v_nombre    text    := COALESCE(NEW.nombre, OLD.nombre);
  v_hito_et   smallint := COALESCE(NEW.etapa, OLD.etapa);
  v_hecho     boolean := TG_OP <> 'DELETE' AND NEW.estado = 'HECHO';
  v_es_impl   boolean := COALESCE(NEW.nombre, OLD.nombre) ILIKE 'Implantaci%';
  -- estado de todos los hitos de la estructura
  v_impl      boolean;
  v_base      smallint;
  v_ok_horm   boolean;
  v_ok_mont   boolean;
  v_infra     boolean;
  v_rd        boolean;
  v_rprov     boolean;
  v_iniciada  boolean;
  v_fecha_fin date;
  v_etapa     smallint;
  v_cerrada   boolean;
  v_antes     smallint;
  v_estado    text;
BEGIN
  IF v_est IS NOT NULL THEN
    SELECT bool_or(estado = 'HECHO' AND nombre ILIKE 'Implantaci%'),
           COALESCE(max(etapa) FILTER (WHERE estado = 'HECHO' AND etapa BETWEEN 2 AND 4), 1),
           COALESCE(bool_or(estado IN ('HECHO', 'NO APLICA') AND etapa = 3), false),
           COALESCE(bool_or(estado IN ('HECHO', 'NO APLICA') AND etapa = 4), false),
           COALESCE(bool_or(estado = 'HECHO' AND etapa = 5), false),
           COALESCE(bool_or(estado = 'HECHO' AND etapa = 6), false),
           COALESCE(bool_or(estado = 'HECHO' AND nombre ILIKE 'Recepción provisoria%'), false),
           COALESCE(bool_or(estado = 'HECHO' AND etapa BETWEEN 3 AND 5), false),
           max(fecha_real) FILTER (WHERE estado = 'HECHO' AND etapa BETWEEN 3 AND 5)
      INTO v_impl, v_base, v_ok_horm, v_ok_mont, v_infra, v_rd, v_rprov, v_iniciada, v_fecha_fin
    FROM public.hitos WHERE estructura_id = v_est;
    v_impl := COALESCE(v_impl, false);

    -- la obra se cierra solo con infraestructura + hormigonado + montaje
    v_cerrada := v_infra AND v_ok_horm AND v_ok_mont;
    v_etapa := CASE WHEN v_cerrada AND v_rd THEN 6 WHEN v_cerrada THEN 5 ELSE v_base END;

    SELECT "ETAPA", "ESTADO" INTO v_antes, v_estado FROM public."Estructuras OICI Obra" WHERE fid = v_est;

    -- situación: al crear la estructura (INSERT) no se toca la que trae
    IF TG_OP <> 'INSERT' THEN
      v_estado := CASE
        WHEN v_cerrada THEN 'FIN'
        WHEN v_impl OR v_iniciada THEN 'CONS'
        WHEN v_es_impl OR v_hito_et BETWEEN 3 AND 5 THEN 'PROY'
        ELSE v_estado END;
    END IF;

    UPDATE public."Estructuras OICI Obra" o SET
      "ETAPA"  = v_etapa,
      "ESTADO" = v_estado,
      "RECEPCIÓN" = CASE WHEN v_etapa >= 6 THEN 'RD'
                         WHEN v_rprov AND COALESCE(o."RECEPCIÓN", '') = '' THEN 'RP'
                         ELSE o."RECEPCIÓN" END
    WHERE o.fid = v_est;

    IF TG_OP <> 'INSERT' THEN
      -- FECHA INICIO sigue al hito de implantación
      IF v_es_impl THEN
        UPDATE public."Estructuras OICI Obra"
           SET "FECHA INICIO" = CASE WHEN v_hecho THEN COALESCE(NEW.fecha_real, current_date) END
         WHERE fid = v_est;
      END IF;
      -- FECHA FIN: se pone al cerrarse y se borra si se reabre
      IF v_cerrada AND (COALESCE(v_antes, 0) < 5 OR v_hito_et BETWEEN 3 AND 5) THEN
        UPDATE public."Estructuras OICI Obra" SET "FECHA FIN" = COALESCE(v_fecha_fin, current_date) WHERE fid = v_est;
      ELSIF NOT v_cerrada AND COALESCE(v_antes, 0) >= 5 THEN
        UPDATE public."Estructuras OICI Obra" SET "FECHA FIN" = NULL WHERE fid = v_est;
      END IF;
    END IF;

  ELSIF v_obra IS NOT NULL THEN
    -- Obras: igual que antes
    SELECT COALESCE(max(etapa) FILTER (WHERE estado = 'HECHO'), 1) INTO v_etapa
    FROM public.hitos WHERE obra_id = v_obra;
    UPDATE public."Obras" o SET
      "ETAPA"  = v_etapa,
      "Estado" = CASE WHEN v_etapa >= 5 THEN 'FIN'
                      WHEN v_etapa >= 3 THEN 'CONS'
                      WHEN o."Estado" = 'FIN' AND TG_OP <> 'INSERT' THEN 'CONS'
                      ELSE o."Estado" END
    WHERE o.fid = v_obra;
  END IF;
  RETURN NULL;
END $$;

-- 3) Hito de implantación para las estructuras que ya existen
--    (hecho si hoy están En obra o Terminadas, con su FECHA INICIO como fecha)
INSERT INTO public.hitos (estructura_id, orden, nombre, etapa, estado, fecha_real)
SELECT e.fid, 15, 'Implantación (inicio de obra)', NULL,
       CASE WHEN e."ESTADO" IN ('CONS', 'FIN') THEN 'HECHO' ELSE 'PENDIENTE' END,
       CASE WHEN e."ESTADO" IN ('CONS', 'FIN') THEN (CASE WHEN e."FECHA INICIO"::text ~ '^\d{4}-\d{2}-\d{2}' THEN substr(e."FECHA INICIO"::text, 1, 10)::date END) END
FROM public."Estructuras OICI Obra" e
WHERE NOT EXISTS (SELECT 1 FROM public.hitos h WHERE h.estructura_id = e.fid AND h.nombre ILIKE 'Implantaci%');

COMMIT;
