-- =====================================================================
-- PARTE 6 — Editar los datos de estructuras y obras desde la web   (Neon > SQL Editor)
-- Requiere la parte 2. No cambia datos existentes ni contraseñas.
-- Después de correrlo: Neon > Data API > "Refresh schema cache".
--
-- Los editores ya podían cambiar situación, recepción, fechas, planos, observaciones
-- y D.O.; ahora también estructura, licitación, año, sala, localidad, departamento
-- y licitación de las obras. La ubicación, el código y el fid siguen sin poder
-- cambiarse desde la web.
-- =====================================================================
DO $$
DECLARE
  v_tabla text;
  v_col   text;
BEGIN
  FOR v_tabla, v_col IN
    SELECT * FROM (VALUES
      ('Estructuras OICI Obra', 'ESTRUCTURA'), ('Estructuras OICI Obra', 'LICITACIÓN'), ('Estructuras OICI Obra', 'AÑO'),
      ('Estructuras OICI Obra', 'D.O.'), ('Estructuras OICI Obra', 'FECHA INICIO'), ('Estructuras OICI Obra', 'FECHA FIN'),
      ('Estructuras OICI Obra', 'RECEPCIÓN'), ('Estructuras OICI Obra', 'PLANOS'), ('Estructuras OICI Obra', 'OBSERVACIONES'),
      ('Obras', 'Sala'), ('Obras', 'Localidad'), ('Obras', 'Departamento'), ('Obras', 'Licitación'),
      ('Obras', 'Tarea'), ('Obras', 'Descripción'), ('Obras', 'D.O.'), ('Obras', 'Planos')
    ) AS t(tabla, col)
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = v_tabla AND column_name = v_col) THEN
      EXECUTE format('GRANT UPDATE (%I) ON public.%I TO authenticated', v_col, v_tabla);
    ELSE
      RAISE NOTICE 'La capa % no tiene la columna %: se saltea', v_tabla, v_col;
    END IF;
  END LOOP;
END $$;
