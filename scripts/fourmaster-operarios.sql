-- Operarios FourMaster — 38 colaboradores
-- Fuente: OPERARIOS ACTUALIZADO 2026 SEPTIEMBRE.xlsx
-- Correcciones aplicadas:
--   • PAOLA/PAVON (leg 99): apellido↔nombre invertidos → PAVON / PAOLA
--   • FERNANDEZ (leg 108): "FERNADA" → "FERNANDA"
--   • HERRERA (leg X): legajo inválido → guardado sin legajo, dedup por DNI
--   • MEDRANO (sin legajo): fecha "05/09/2'26" → 2026-09-05
--   • Sin celular: placeholder SIN_CEL_[legajo] — completar manualmente para bot WA

DO $$
DECLARE v_empresa_id TEXT;
BEGIN
  SELECT id INTO v_empresa_id FROM empresas WHERE LOWER(slug) = 'four-master' LIMIT 1;
  IF v_empresa_id IS NULL THEN RAISE EXCEPTION 'Empresa FourMaster no encontrada'; END IF;

  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'ISABEL ADRIANA','ADROVER','SIN_CEL_125','24868755','125','adrover683@gmail.com','Presidente Alexandri 1843, Moron','ACTIVO','2026-08-01',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND legajo='125' AND deleted_at IS NULL);

  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'LUCAS DANIEL','BENITEZ','SIN_CEL_97','35393633','97','lb0408038@gmail.com','Pasaje 2 53, Ituzaingo','ACTIVO','2025-01-01',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND legajo='97' AND deleted_at IS NULL);

  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'GUSTAVO DANIEL','BRITTES','SIN_CEL_109','50096471','109','gustavobrittes1@gmail.com','Calle 1436 n°1493, Florencio Varela','ACTIVO','2026-02-03',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND legajo='109' AND deleted_at IS NULL);

  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'KARINA BEATRIZ','CARRIZO','SIN_CEL_115','24139782','115','beatrizcarrizo1974@gmail.com','Rio Gallardo 1607, Moron','ACTIVO','2026-06-04',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND legajo='115' AND deleted_at IS NULL);

  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'ALEJANDRA PATRICIA','CABRERA','SIN_CEL_5','27257057','5','alejandra_lapetisa@hotmail.es','Balbastro 3961, San Justo','ACTIVO','2023-07-01',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND legajo='5' AND deleted_at IS NULL);

  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'PATRICIA NOEMI','CASTILLO','SIN_CEL_45','24067478','45','patricianoemi2020@gmail.com','Santo Tome 2465, Gregorio de Laferrere','ACTIVO','2024-03-21',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND legajo='45' AND deleted_at IS NULL);

  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'RUBY','COLLORANA','SIN_CEL_118','96141516','118','colloranaruby@gmail.com','Pergamino 1670, Flores','ACTIVO','2026-07-28',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND legajo='118' AND deleted_at IS NULL);

  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'RAMONA ROSA','CRUZ','SIN_CEL_6','17632714','6','rosa.ramona.cruz.06@gmail.com','Bermudez 5526, Villa Luzuriaga','ACTIVO','2023-07-01',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND legajo='6' AND deleted_at IS NULL);

  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'AYELEN','DORSCH','SIN_CEL_110','41214436','110','Dorschaye@gmail.com','San Juan 265, Pacheco','ACTIVO','2026-02-04',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND legajo='110' AND deleted_at IS NULL);

  -- leg 108: corregido "FERNADA" → "FERNANDA"
  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'DANIELA FERNANDA','FERNANDEZ','SIN_CEL_108','36826461','108','dafefe28298@gmail.com','Centenario 524, Ezeiza','ACTIVO','2026-01-01',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND legajo='108' AND deleted_at IS NULL);

  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'NATALIA NOEMI','FERNANDEZ','SIN_CEL_10','35997638','10','dalilera14@gmail.com','Calle 117 n° 486, Berazategui','ACTIVO','2023-07-01',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND legajo='10' AND deleted_at IS NULL);

  -- sin legajo — dedup por DNI
  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'JONATAN','FONTEINA','SIN_CEL_DNI31723050','31723050',NULL,'jfonteina@gmail.com','Cerro Tupungato 3725, Caseros','ACTIVO','2026-09-11',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND identificacion='31723050' AND deleted_at IS NULL);

  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'GUSTAVO ADRIAN','GARCIA','SIN_CEL_37','24004867','37','gustavogarcia06@gmail.com','Jose Marti 1160, Paso del Rey','ACTIVO','2024-01-02',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND legajo='37' AND deleted_at IS NULL);

  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'ALBERTO ALEX','GOMEZ VARGAS','SIN_CEL_83','93900791','83','alberto6820gomez@gmail.com','Juan B. Justo 853, Beccar','ACTIVO','2023-07-01',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND legajo='83' AND deleted_at IS NULL);

  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'ROSALBA INES','GONZALEZ','SIN_CEL_84','26095996','84','grosalba318@gmail.com','Larrazabal 5239, Villa Luzuriaga','ACTIVO','2023-07-01',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND legajo='84' AND deleted_at IS NULL);

  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'ROMINA CINTIA','GONZALEZ','SIN_CEL_16','28732680','16','romina.ggonzalez81@gmail.com','Carlos Casares 895, Rafael Castillo','ACTIVO','2023-07-01',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND legajo='16' AND deleted_at IS NULL);

  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'SILVANA MORALES GRACIELA','GONZALEZ','SIN_CEL_126','26733756','126','vam12gonzalez@gmail.com','Berna 785, Villa Luzuriaga','ACTIVO','2026-08-04',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND legajo='126' AND deleted_at IS NULL);

  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'JESSICA NOEMI','GUZMAN','SIN_CEL_104','36845690','104','jessimateo0304@gmail.com','Suarez 60, La Boca','ACTIVO','2025-12-09',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND legajo='104' AND deleted_at IS NULL);

  -- leg X inválido → sin legajo, dedup por DNI
  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'SONIA ELIZABETH','HERRERA','SIN_CEL_DNI21632559','21632559',NULL,'soniaherreraeli12@gmail.com','Vinara 1610, Moron','ACTIVO','2024-10-19',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND identificacion='21632559' AND deleted_at IS NULL);

  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'ALEJANDRA MAGALI','LAURINO','SIN_CEL_75','35582558','75','laurinoalejandra2@gmail.com','Alvear 3400, Ciudadela','ACTIVO','2025-02-11',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND legajo='75' AND deleted_at IS NULL);

  -- sin legajo — dedup por DNI
  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'JERONIMO','LIMA','SIN_CEL_DNI28478287','28478287',NULL,'lucasyjeronimo1@gmail.com','Sardou 909, Quilmes','ACTIVO','2026-09-01',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND identificacion='28478287' AND deleted_at IS NULL);

  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'MARGARITA DE LOS ANGELES','MEDINA','SIN_CEL_3','34424015','3','ariesmagui12@gmail.com','Av. Eva Peron 6378, Villa Lugano','ACTIVO','2023-07-01',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND legajo='3' AND deleted_at IS NULL);

  -- sin legajo, fecha corregida "05/09/2'26" → 2026-09-05, dedup por DNI
  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'MARIA JOSE','MEDRANO','SIN_CEL_DNI36159619','36159619',NULL,'maruypipo33@gmail.com','Suipacha 670, Buenos Aires','ACTIVO','2026-09-05',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND identificacion='36159619' AND deleted_at IS NULL);

  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'BLANCA NOELIA','NOGUERA','SIN_CEL_124','18852835','124','navarronavarrodbp@gmail.com','Juan Diaz de Solis 2866, Moreno','ACTIVO','2026-08-01',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND legajo='124' AND deleted_at IS NULL);

  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'ANABELA GISELA','ROBLEDO','SIN_CEL_116','30942257','116','anabruma1728@gmail.com','Velez Sarfield 3025, Moreno','ACTIVO','2026-06-01',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND legajo='116' AND deleted_at IS NULL);

  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'GABRIELA GISELLE','OBREGON','SIN_CEL_95','35341896','95','gabrielaobregon128@gmail.com','Colastine 12890, Virrey del Pino','ACTIVO','2025-10-01',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND legajo='95' AND deleted_at IS NULL);

  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'CELESTE ANTONIA','OJEDA','SIN_CEL_82','41292284','82','celesteantoniaojeda@gmail.com','Anatole France 2032, La Tablada','ACTIVO','2025-06-02',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND legajo='82' AND deleted_at IS NULL);

  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'LUCAS GABRIEL','ORFANO DUARTE','SIN_CEL_71','40490638','71','lorfano057@gmail.com','Cobo 7500, Gonzalez Catan','ACTIVO','2025-02-03',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND legajo='71' AND deleted_at IS NULL);

  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'NICOLAS','ORTIZ','SIN_CEL_106','25227950','106','nicolasadrianortiz76@gmail.com','Brown 5423, Parque San Martin','ACTIVO','2026-08-01',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND legajo='106' AND deleted_at IS NULL);

  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'CRISTINA','PEREYRA','SIN_CEL_123','30563790','123','Mcristinapereyra1985@gmail.com','Alvear 5683, La Tablada','ACTIVO','2026-08-13',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND legajo='123' AND deleted_at IS NULL);

  -- leg 99: apellido↔nombre invertidos en el CSV → corregido a PAVON / PAOLA
  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'PAOLA','PAVON','SIN_CEL_99','30559229','99','pereziara824@gmail.com','Aguado 1955, Merlo','ACTIVO','2025-11-01',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND legajo='99' AND deleted_at IS NULL);

  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'JOSE ARMANDO','QUIROGA','SIN_CEL_26','21741777','26','joquiroga50@gmail.com','Av. Alberdi 483, Caballito','ACTIVO','2023-10-02',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND legajo='26' AND deleted_at IS NULL);

  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'ROMINA','SOSA','SIN_CEL_112','31261811','112','rominamarielsosa@gmail.com','Giachino 3036, Pontevedra','ACTIVO','2026-04-01',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND legajo='112' AND deleted_at IS NULL);

  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'JUAN RAMON','SOTELO','SIN_CEL_31','35535197','31','jjramons@yahoo.com.ar','Ruta 24 km 10, General Rodriguez','ACTIVO','2023-11-28',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND legajo='31' AND deleted_at IS NULL);

  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'RUBEN RAUL','VARRIENTOS','SIN_CEL_8','10063303','8',NULL,'Padre Ustarroz 836, San Miguel','ACTIVO','2023-07-01',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND legajo='8' AND deleted_at IS NULL);

  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'PRISCILA SOLANGE','VEGA','SIN_CEL_70','35339368','70','vegapriscilasolange@gmail.com','Basualdo 1159, Villa Luzuriaga','ACTIVO','2024-10-08',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND legajo='70' AND deleted_at IS NULL);

  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'MARIA RITA','VAZQUEZ LOPEZ','SIN_CEL_114','93083141','114',NULL,'Hualefin 5296, Rafael Castillo','ACTIVO','2026-06-01',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND legajo='114' AND deleted_at IS NULL);

  INSERT INTO colaboradores (id,empresa_id,nombre,apellido,celular,identificacion,legajo,email,domicilio,estado,fecha_ingreso,created_at,updated_at)
  SELECT gen_random_uuid()::text,v_empresa_id,'NATALIA','ZIMMERMANN','SIN_CEL_128','30105045','128','nataliazimmermann686@gmail.com','Urquiza 4955, Caseros','ACTIVO','2026-08-01',NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM colaboradores WHERE empresa_id=v_empresa_id AND legajo='128' AND deleted_at IS NULL);

END $$;
