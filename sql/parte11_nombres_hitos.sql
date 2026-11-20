-- =====================================================================
-- PARTE 11 — Nombres de hitos parejos   (Neon > SQL Editor)
-- Requiere las partes 8 y 10. No cambia fechas, estados ni contraseñas.
-- Después de correrlo: Neon > Data API > "Refresh schema cache".
--
-- Estructuras: Implantado · Hormigonado · Montado · Infraestructura finalizada
-- Obras:       Infraestructura finalizada
-- Se cambian en la plantilla (para las nuevas) y en los hitos ya cargados.
-- =====================================================================
BEGIN;

UPDATE public.plantilla_hitos SET nombre = 'Implantado'                 WHERE capa = 'ESTRUCTURAS' AND nombre ILIKE 'Implanta%';
UPDATE public.plantilla_hitos SET nombre = 'Montado'                    WHERE capa = 'ESTRUCTURAS' AND etapa = 4;
UPDATE public.plantilla_hitos SET nombre = 'Infraestructura finalizada' WHERE etapa = 5;

-- La función que calcula la etapa reconoce el hito por "Implanta…" (Implantación o Implantado)
CREATE OR REPLACE FUNCTION public.actualizar_etapa() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_est       integer := COALESCE(NEW.estructura_id, OLD.estructura_id);
  v_obra      integer := COALESCE(NEW.obra_id, OLD.obra_id);
  -- el hito que cambió
  v_nombre    text    := COALESCE(NEW.nombre, OLD.nombre);
  v_hito_et   smallint := COALESCE(NEW.etapa, OLD.etapa);
  v_hecho     boolean := TG_OP <> 'DELETE' AND NEW.estado = 'HECHO';
  v_es_impl   boolean := COALESCE(NEW.nombre, OLD.nombre) ILIKE 'Implanta%';
  -- estado de todos los hitos de la estructura
  v_impl      boolean;
  v_base      smallint;
  v_ok_horm   boolean;
  v_ok_mont   boolean;
  v_infra     boolean;
  v_infra_cur boolean;
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
    SELECT bool_or(estado = 'HECHO' AND nombre ILIKE 'Implanta%'),
           COALESCE(max(etapa) FILTER (WHERE estado = 'HECHO' AND etapa BETWEEN 2 AND 4), 1),
           COALESCE(bool_or(estado IN ('HECHO', 'NO APLICA') AND etapa = 3), false),
           COALESCE(bool_or(estado IN ('HECHO', 'NO APLICA') AND etapa = 4), false),
           COALESCE(bool_or(estado = 'HECHO' AND etapa = 5), false),
           COALESCE(bool_or(estado = 'EN CURSO' AND etapa = 5), false),
           COALESCE(bool_or(estado = 'HECHO' AND etapa = 6), false),
           COALESCE(bool_or(estado = 'HECHO' AND nombre ILIKE 'Recepción provisoria%'), false),
           COALESCE(bool_or(estado IN ('HECHO', 'EN CURSO') AND etapa BETWEEN 3 AND 5), false),
           max(fecha_real) FILTER (WHERE estado = 'HECHO' AND etapa BETWEEN 3 AND 5)
      INTO v_impl, v_base, v_ok_horm, v_ok_mont, v_infra, v_infra_cur, v_rd, v_rprov, v_iniciada, v_fecha_fin
    FROM public.hitos WHERE estructura_id = v_est;
    v_impl := COALESCE(v_impl, false);

    -- la obra se cierra solo con infraestructura + hormigonado + montaje
    v_cerrada := v_infra AND v_ok_horm AND v_ok_mont;
    -- infraestructura "en curso" antes del montaje: se ve como Obra de infraestructura (4)
    v_etapa := CASE WHEN v_cerrada AND v_rd THEN 6 WHEN v_cerrada THEN 5
                    WHEN v_infra_cur THEN greatest(v_base, 4) ELSE v_base END;

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

-- Hitos ya cargados (el cambio de nombre no recalcula nada)
UPDATE public.hitos SET nombre = 'Implantado'                 WHERE estructura_id IS NOT NULL AND nombre ILIKE 'Implanta%';
UPDATE public.hitos SET nombre = 'Montado'                    WHERE estructura_id IS NOT NULL AND etapa = 4;
UPDATE public.hitos SET nombre = 'Infraestructura finalizada' WHERE etapa = 5;

COMMIT;
