-- Jornadas y asignaciones FourMaster
-- Parseo de HORARIOS Y LUGARES.xlsx - PERSONAL.csv
-- Ejecutar en Supabase SQL Editor
--
-- OMITIDOS (no están en DB / sin horario claro):
--   GIMÉNEZ MARIA JOSE — no figura en ALTAS
--   ORTIZ MONICA       — no figura en ALTAS
--   CABRERA POSADAS 226 — punto no cargado
--   VARRIENTOS NECOCHEA 725 — punto no cargado
--   COLLORANA SÁBADO (blank location)
--   VEGA SÁBADO (blank location)
--   OJEDA CONSTITUCION 2626 — vencido 22/09
--   GONZALEZ ROSALBA ALFREDO PALACIOS 80 — horario relativo no parseble

-- Función auxiliar temporal
CREATE OR REPLACE FUNCTION _tmp_fm_jornada(
  emp  TEXT, apell TEXT, nom_hint TEXT,
  punto TEXT, hi TEXT, hf TEXT,
  l BOOL, m BOOL, mi BOOL, j BOOL, v BOOL, s BOOL
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  pid TEXT; jid TEXT; cid TEXT; jname TEXT;
BEGIN
  SELECT id INTO pid FROM puntos_fichaje
  WHERE empresa_id = emp AND nombre = punto AND activo = true LIMIT 1;
  IF pid IS NULL THEN
    RAISE WARNING '[jornadas] Punto no encontrado: "%"', punto; RETURN;
  END IF;

  SELECT id INTO jid FROM jornadas
  WHERE empresa_id = emp AND punto_fichaje_id = pid
    AND hora_inicio = hi AND hora_fin = hf
    AND lunes_presencial = l AND martes_presencial = m AND miercoles_presencial = mi
    AND jueves_presencial = j AND viernes_presencial = v AND sabado_presencial = s
    AND activo = true LIMIT 1;

  IF jid IS NULL THEN
    jname := CONCAT_WS('-',
      CASE WHEN l  THEN 'L'  END, CASE WHEN m  THEN 'M'  END,
      CASE WHEN mi THEN 'Mi' END, CASE WHEN j  THEN 'J'  END,
      CASE WHEN v  THEN 'V'  END, CASE WHEN s  THEN 'S'  END
    ) || ' ' || hi || '-' || hf;
    INSERT INTO jornadas(id, empresa_id, punto_fichaje_id, nombre,
      hora_inicio, hora_fin, tolerancia_min,
      lunes_presencial, martes_presencial, miercoles_presencial,
      jueves_presencial, viernes_presencial, sabado_presencial, domingo_presencial,
      lunes_virtual, martes_virtual, miercoles_virtual,
      jueves_virtual, viernes_virtual, sabado_virtual, domingo_virtual,
      activo, created_at, updated_at)
    VALUES(gen_random_uuid()::text, emp, pid, jname, hi, hf, 15,
      l, m, mi, j, v, s, false,
      false, false, false, false, false, false, false,
      true, NOW(), NOW())
    RETURNING id INTO jid;
  END IF;

  IF nom_hint IS NULL THEN
    SELECT id INTO cid FROM colaboradores
    WHERE empresa_id = emp AND apellido ILIKE apell AND deleted_at IS NULL LIMIT 1;
  ELSE
    SELECT id INTO cid FROM colaboradores
    WHERE empresa_id = emp AND apellido ILIKE apell
      AND nombre ILIKE '%' || nom_hint || '%' AND deleted_at IS NULL LIMIT 1;
  END IF;

  IF cid IS NULL THEN
    RAISE WARNING '[jornadas] Colaborador no encontrado: "%" "%"', apell, COALESCE(nom_hint, '');
    RETURN;
  END IF;

  INSERT INTO colaborador_jornadas(id, colaborador_id, jornada_id, fecha_desde)
  SELECT gen_random_uuid()::text, cid, jid, NOW()
  WHERE NOT EXISTS(
    SELECT 1 FROM colaborador_jornadas
    WHERE colaborador_id = cid AND jornada_id = jid AND fecha_hasta IS NULL
  );
END;
$$;


DO $$ DECLARE emp TEXT;
BEGIN
  SELECT id INTO emp FROM empresas WHERE LOWER(slug) = 'four-master' LIMIT 1;
  IF emp IS NULL THEN RAISE EXCEPTION 'Empresa FourMaster no encontrada'; END IF;

  -- ── ADROVER, ADRIANA ──────────────────────────────────────────────────────
  PERFORM _tmp_fm_jornada(emp,'ADROVER',NULL,'CONSORCIO - M. DE ANDREA 77','09:00','13:00',true,false,true,false,true,false);
  PERFORM _tmp_fm_jornada(emp,'ADROVER',NULL,'CONSORCIO - BELGRANO 384','08:00','12:00',false,true,false,false,false,false);
  PERFORM _tmp_fm_jornada(emp,'ADROVER',NULL,'EXACTKABEL - SOURINGES 1408','08:00','14:00',false,false,false,true,false,false);
  PERFORM _tmp_fm_jornada(emp,'ADROVER',NULL,'CONSORCIO - SANTA FE 980','09:00','12:00',false,false,false,false,false,true);

  -- ── BENÍTEZ, LUCAS ────────────────────────────────────────────────────────
  PERFORM _tmp_fm_jornada(emp,'BENÍTEZ',NULL,'CONSORCIO - NUNEZ 1567','08:00','11:00',true,true,true,false,true,false);
  PERFORM _tmp_fm_jornada(emp,'BENÍTEZ',NULL,'OFICINAS MARAZZI - PEREDO 433','13:00','16:00',true,true,true,false,true,false);

  -- ── BRITTES, GUSTAVO ─────────────────────────────────────────────────────
  PERFORM _tmp_fm_jornada(emp,'BRITTES',NULL,'CONSORCIO - BILLINGHURST 1034','08:00','12:00',true,true,true,true,true,false);

  -- ── CABRERA, ALEJANDRA ────────────────────────────────────────────────────
  PERFORM _tmp_fm_jornada(emp,'CABRERA',NULL,'EXPRESO EL DORADO - SARAZA 5653','07:00','10:00',true,false,false,true,false,false);
  -- POSADAS 226: punto no cargado en DB — se omite
  PERFORM _tmp_fm_jornada(emp,'CABRERA',NULL,'ALCAP - CAAGUAZU 421','08:15','12:15',false,false,true,false,false,false);
  PERFORM _tmp_fm_jornada(emp,'CABRERA',NULL,'CONSORCIO - PERON 1044','11:15','14:15',false,false,false,true,false,false);
  PERFORM _tmp_fm_jornada(emp,'CABRERA',NULL,'CONSORCIO - JUJUY 958','08:00','12:00',false,false,false,false,false,true);

  -- ── CARRIZO, KARINA ───────────────────────────────────────────────────────
  PERFORM _tmp_fm_jornada(emp,'CARRIZO',NULL,'CONSORCIO - AV. SAN MARTIN 2665','09:00','13:00',true,true,true,true,true,false);

  -- ── CASTILLO, PATRICIA ───────────────────────────────────────────────────
  PERFORM _tmp_fm_jornada(emp,'CASTILLO',NULL,'TIENDA VEGGIE - VALENTIN GOMEZ 577','09:00','13:00',true,true,true,true,true,false);

  -- ── COLLORANA, RUBY ──────────────────────────────────────────────────────
  PERFORM _tmp_fm_jornada(emp,'COLLORANA',NULL,'SPORT CLUB - RIVADAVIA 10652','14:00','22:00',true,true,true,true,true,false);

  -- ── CRUZ, ROSA ───────────────────────────────────────────────────────────
  PERFORM _tmp_fm_jornada(emp,'CRUZ',NULL,'CONALIA - MONTENEGRO 1198','08:00','12:00',false,true,false,false,true,false);
  PERFORM _tmp_fm_jornada(emp,'CRUZ',NULL,'CONSORCIO - BELGRANO 269','07:00','11:00',true,false,false,true,false,false);
  PERFORM _tmp_fm_jornada(emp,'CRUZ',NULL,'CONSORCIO - MEDRANO 34','08:00','12:00',false,false,true,false,false,false);
  PERFORM _tmp_fm_jornada(emp,'CRUZ',NULL,'CONSORCIO - CASTELLI 65','11:30','15:30',true,false,false,false,false,false);

  -- ── DORSCH, AYELEN ───────────────────────────────────────────────────────
  PERFORM _tmp_fm_jornada(emp,'DORSCH',NULL,'ANIXTER - MARCOS SASTRE 1712','08:30','12:30',true,true,true,true,true,false);

  -- ── FERNÁNDEZ, DANIELA ───────────────────────────────────────────────────
  PERFORM _tmp_fm_jornada(emp,'FERNÁNDEZ',NULL,'CONSORCIO - CARLOS CALVO 3233','08:00','16:00',true,false,true,false,true,false);
  PERFORM _tmp_fm_jornada(emp,'FERNÁNDEZ',NULL,'CONSORCIO - CONDE 1526','08:00','12:00',false,true,false,true,false,true);

  -- ── FONTEINA, JONATAN ────────────────────────────────────────────────────
  PERFORM _tmp_fm_jornada(emp,'FONTEINA',NULL,'CONSORCIO - CARLOS CALVO 3233','08:00','12:00',true,true,true,true,true,true);

  -- ── GARCÍA, GUSTAVO ──────────────────────────────────────────────────────
  PERFORM _tmp_fm_jornada(emp,'GARCÍA',NULL,'CONSORCIO - SAAVEDRA 233','15:30','19:30',true,true,true,true,true,false);
  PERFORM _tmp_fm_jornada(emp,'GARCÍA',NULL,'CONSORCIO - AV. RIVADAVIA 15760','10:00','14:00',true,false,true,false,true,false);

  -- ── GÓMEZ VARGAS, ALBERTO ────────────────────────────────────────────────
  PERFORM _tmp_fm_jornada(emp,'GÓMEZ VARGAS',NULL,'CONSORCIO - HUMAHUACA 4676','08:00','12:00',true,true,true,true,true,true);
  PERFORM _tmp_fm_jornada(emp,'GÓMEZ VARGAS',NULL,'CONSORCIO - CULLEN 5140','05:00','07:00',false,true,false,false,true,false);

  -- ── GONZÁLEZ, ROMINA ─────────────────────────────────────────────────────
  PERFORM _tmp_fm_jornada(emp,'GONZÁLEZ','ROMINA','CONSORCIO - ENTRE RIOS 2942','06:00','10:00',true,true,true,true,true,false);

  -- ── GONZÁLEZ, ROSALBA ────────────────────────────────────────────────────
  PERFORM _tmp_fm_jornada(emp,'GONZÁLEZ','ROSALBA','CONSORCIO - GARIBALDI 2055','08:00','12:00',true,false,false,true,false,false);
  PERFORM _tmp_fm_jornada(emp,'GONZÁLEZ','ROSALBA','CONSORCIO - ESPORA 33','09:00','13:00',false,true,false,false,true,false);
  PERFORM _tmp_fm_jornada(emp,'GONZÁLEZ','ROSALBA','CONSORCIO - CHILE 1709','08:00','12:00',false,false,true,false,false,false);
  -- ALFREDO PALACIOS 80: "después de ESPORA (2 horas)" — horario relativo, no asignable

  -- ── GONZÁLEZ, SILVANA ────────────────────────────────────────────────────
  -- BARCALA 465 en CSV → único Barcala en DB es CONSORCIO - BARCALA 564 (puede ser typo)
  PERFORM _tmp_fm_jornada(emp,'GONZÁLEZ','SILVANA','CONSORCIO - BARCALA 564','08:00','12:00',false,true,false,false,true,false);
  PERFORM _tmp_fm_jornada(emp,'GONZÁLEZ','SILVANA','EMPRESA NORNEST - MENDEZ DE ANDES 1759','07:30','13:30',true,false,true,true,false,false);

  -- ── GUZMÁN, JESSICA ──────────────────────────────────────────────────────
  PERFORM _tmp_fm_jornada(emp,'GUZMÁN',NULL,'ASCENSORES SERVAS - ALSINA 901','07:00','16:00',true,true,true,true,true,false);

  -- ── HERRERA, SONIA ───────────────────────────────────────────────────────
  PERFORM _tmp_fm_jornada(emp,'HERRERA',NULL,'OUT SOURCE - AV. GAONA 4379','08:00','12:00',true,false,true,false,true,false);
  PERFORM _tmp_fm_jornada(emp,'HERRERA',NULL,'CONSORCIO - BOATTI 264','07:00','10:00',false,true,false,true,false,true);
  PERFORM _tmp_fm_jornada(emp,'HERRERA',NULL,'CONSORCIO - SAN LORENZO 1149','10:30','14:30',false,true,false,false,false,true);

  -- ── LAURINO, ALEJANDRA ───────────────────────────────────────────────────
  PERFORM _tmp_fm_jornada(emp,'LAURINO',NULL,'NEW PET - SANTIAGO DE LINIERS 3836','08:00','12:00',true,false,false,true,false,false);
  PERFORM _tmp_fm_jornada(emp,'LAURINO',NULL,'CONSORCIO - PERDRIEL 5358','13:00','16:00',true,false,false,true,false,false);
  PERFORM _tmp_fm_jornada(emp,'LAURINO',NULL,'SADEMEC - DR. REBIZZO 4728','10:00','14:00',false,true,false,false,false,false);
  PERFORM _tmp_fm_jornada(emp,'LAURINO',NULL,'CONSORCIO - SAN MARTIN 2823','09:00','12:00',false,false,true,false,false,true);
  PERFORM _tmp_fm_jornada(emp,'LAURINO',NULL,'PADILUM - PRESIDENTE PERON 3045','12:00','16:00',false,false,false,false,true,false);

  -- ── LIMA, JERÓNIMO ───────────────────────────────────────────────────────
  PERFORM _tmp_fm_jornada(emp,'LIMA',NULL,'SPORT CLUB - RIVADAVIA 10652','14:00','22:00',true,true,true,true,true,false);

  -- ── MEDINA, MARGARITA ────────────────────────────────────────────────────
  PERFORM _tmp_fm_jornada(emp,'MEDINA',NULL,'SPORT CLUB - RIVADAVIA 10652','10:00','18:00',true,true,true,true,true,false);

  -- ── MEDRANO, MARIA JOSE ──────────────────────────────────────────────────
  PERFORM _tmp_fm_jornada(emp,'MEDRANO',NULL,'CONSORCIO - CHACABUCO 1028','09:00','12:00',false,true,false,false,true,false);
  PERFORM _tmp_fm_jornada(emp,'MEDRANO',NULL,'EMPRESA WCS - FLORIDA 981','17:00','19:00',true,true,true,true,true,false);

  -- ── NOGUERA, NOELIA ──────────────────────────────────────────────────────
  PERFORM _tmp_fm_jornada(emp,'NOGUERA',NULL,'EMPRESA KIDSCORP - ARCOS 2215','09:00','17:00',true,true,true,true,false,false);

  -- ── OBREGÓN, GABRIELA ────────────────────────────────────────────────────
  PERFORM _tmp_fm_jornada(emp,'OBREGÓN',NULL,'CONSORCIO - CARLOS CALVO 3233','12:00','20:00',true,false,true,false,true,false);
  PERFORM _tmp_fm_jornada(emp,'OBREGÓN',NULL,'CONSORCIO - INDEPENDENCIA 3982','08:00','12:00',true,false,true,false,true,false);

  -- ── OJEDA, CELESTE ───────────────────────────────────────────────────────
  PERFORM _tmp_fm_jornada(emp,'OJEDA',NULL,'SMART SEGUROS - ALVEAR 1563','13:00','17:00',true,false,false,true,false,false);
  PERFORM _tmp_fm_jornada(emp,'OJEDA',NULL,'DISTRIBUIDORA NINO - BOLIVAR 781','14:00','17:00',false,true,false,false,true,false);
  -- CONSTITUCION 2626: vence 22/09 — omitido

  -- ── ORFANO DUARTE, LUCAS ─────────────────────────────────────────────────
  PERFORM _tmp_fm_jornada(emp,'ORFANO DUARTE',NULL,'RAME PRODUCTOS QUIMICOS - AV. BUFANO 1089','07:00','11:00',true,false,true,false,true,false);
  PERFORM _tmp_fm_jornada(emp,'ORFANO DUARTE',NULL,'CONSORCIO - VIAMONTE 333','12:15','16:15',true,false,true,false,true,false);
  PERFORM _tmp_fm_jornada(emp,'ORFANO DUARTE',NULL,'CONSORCIO - ZUBIAUR 4302','13:00','17:00',false,true,false,true,false,false);

  -- ── ORTIZ, NICOLAS ───────────────────────────────────────────────────────
  PERFORM _tmp_fm_jornada(emp,'ORTIZ','NICOLAS','CONSORCIO - SARMIENTO 2274','08:00','12:00',true,true,true,true,true,false);

  -- ── PAVÓN, PAOLA ─────────────────────────────────────────────────────────
  PERFORM _tmp_fm_jornada(emp,'PAVÓN',NULL,'SUELAS LEAL - SAN PEDRO 1949','09:00','13:00',true,false,true,false,true,false);
  PERFORM _tmp_fm_jornada(emp,'PAVÓN',NULL,'CONDOMINIO - LA PIALADA 3618','09:00','13:00',false,true,false,true,false,true);

  -- ── PEREYRA, CRISTINA ────────────────────────────────────────────────────
  PERFORM _tmp_fm_jornada(emp,'PEREYRA',NULL,'EMPRESA NORNEST - MENDEZ DE ANDES 1759','07:30','13:30',true,false,true,true,false,false);
  PERFORM _tmp_fm_jornada(emp,'PEREYRA',NULL,'CONSORCIO - PRES. PERON 1370','09:00','12:00',false,true,false,false,true,false);
  PERFORM _tmp_fm_jornada(emp,'PEREYRA',NULL,'CONSORCIO - MARIANO MORENO 215','12:30','16:30',false,true,false,false,true,false);

  -- ── QUIROGA, JOSÉ ────────────────────────────────────────────────────────
  PERFORM _tmp_fm_jornada(emp,'QUIROGA',NULL,'CONSORCIO - COLPAYO 368','08:00','12:00',true,true,true,true,true,true);
  PERFORM _tmp_fm_jornada(emp,'QUIROGA',NULL,'CONSORCIO - COLPAYO 378/380','12:00','16:00',true,false,true,false,true,false);

  -- ── ROBLEDO, ANABELA ─────────────────────────────────────────────────────
  PERFORM _tmp_fm_jornada(emp,'ROBLEDO',NULL,'KYC - TUPAC AMARU 550','09:00','13:00',true,false,true,false,true,false);
  PERFORM _tmp_fm_jornada(emp,'ROBLEDO',NULL,'KYC - AV. ZAPIOLA 1148','09:00','13:00',false,true,false,true,false,false);

  -- ── SOSA, ROMINA ─────────────────────────────────────────────────────────
  PERFORM _tmp_fm_jornada(emp,'SOSA',NULL,'GIM GLADIADOR - RIVADAVIA 16482','08:00','12:00',true,false,true,false,true,false);
  PERFORM _tmp_fm_jornada(emp,'SOSA',NULL,'CONSORCIO - CARLOS TEJEDOR 1275','09:00','13:00',false,true,false,true,false,false);

  -- ── SOTELO, JUAN ─────────────────────────────────────────────────────────
  PERFORM _tmp_fm_jornada(emp,'SOTELO',NULL,'CREATIV - PARQUE IND. SIPLA','08:00','17:00',true,true,true,true,true,false);

  -- ── VARRIENTOS, RUBÉN ────────────────────────────────────────────────────
  -- CASTELLI 674 en CSV → único Castelli en DB es CONSORCIO - CASTELLI 65
  PERFORM _tmp_fm_jornada(emp,'VARRIENTOS',NULL,'CONSORCIO - CASTELLI 65','09:00','13:00',true,false,false,true,false,false);
  -- NECOCHEA 725: punto no cargado en DB — se omite
  PERFORM _tmp_fm_jornada(emp,'VARRIENTOS',NULL,'CONSORCIO - TACUARI 305','08:30','11:30',false,false,true,false,false,false);

  -- ── VÁZQUEZ, RITA ────────────────────────────────────────────────────────
  PERFORM _tmp_fm_jornada(emp,'VÁZQUEZ',NULL,'CONSORCIO - BENITEZ JULIO OMAR 4243','07:00','11:00',true,true,true,true,true,true);

  -- ── VEGA, PRISCILA ───────────────────────────────────────────────────────
  PERFORM _tmp_fm_jornada(emp,'VEGA',NULL,'SPORT CLUB - RIVADAVIA 10652','07:00','11:00',true,true,true,true,true,false);
  PERFORM _tmp_fm_jornada(emp,'VEGA',NULL,'CONSORCIO - ALVAREZ JONTE 362','11:30','14:30',false,true,false,false,false,true);
  PERFORM _tmp_fm_jornada(emp,'VEGA',NULL,'VTV CAISA - LARRAZABAL 1861','11:30','16:30',true,false,true,false,true,false);

  -- ── ZIMMERMANN, NATALIA ──────────────────────────────────────────────────
  PERFORM _tmp_fm_jornada(emp,'ZIMMERMANN',NULL,'CONSORCIO - WENCESLAO DE TATA 4664','08:00','12:00',true,true,true,true,true,true);

END $$;

-- Limpiar función temporal
DROP FUNCTION IF EXISTS _tmp_fm_jornada(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,BOOL,BOOL,BOOL,BOOL,BOOL,BOOL);
