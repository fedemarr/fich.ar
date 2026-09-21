// node scripts/geocode-fourmaster.mjs
// Genera scripts/fourmaster-puntos.sql con INSERT statements listos para ejecutar

import { writeFileSync } from "fs"

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function geocode(addr, ciudad) {
  const q = encodeURIComponent(`${addr}, ${ciudad}, Buenos Aires, Argentina`)
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1&countrycodes=ar`
  try {
    const res = await fetch(url, { headers: { "User-Agent": "FicharApp/1.0 seed-script" } })
    const data = await res.json()
    if (!data.length) return null
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
  } catch {
    return null
  }
}

const PUNTOS = [
  // ── CABA ────────────────────────────────────────────────────────────────
  { nombre: "ASCENSORES SERVAS - ALSINA 901",              geoAddr: "Alsina 901",               ciudad: "Buenos Aires" },
  { nombre: "CONSORCIO - COLPAYO 368",                     geoAddr: "Colpayo 368",              ciudad: "Almagro Buenos Aires" },
  { nombre: "CONSORCIO - COLPAYO 378/380",                 geoAddr: "Colpayo 378",              ciudad: "Almagro Buenos Aires" },
  { nombre: "CONSORCIO - HUMAHUACA 4676",                  geoAddr: "Humahuaca 4676",           ciudad: "Almagro Buenos Aires" },
  { nombre: "CONSORCIO - CULLEN 5140",                     geoAddr: "Cullen 5140",              ciudad: "Villa Urquiza Buenos Aires" },
  { nombre: "CONSORCIO - CONDE 1526",                      geoAddr: "Conde 1526",               ciudad: "Belgrano Buenos Aires" },
  { nombre: "EXPRESO EL DORADO - SARAZA 5653",             geoAddr: "Saraza 5653",              ciudad: "Villa Lugano Buenos Aires" },
  { nombre: "CONSORCIO - ZUBIAUR 4302",                    geoAddr: "Zubiaur 4302",             ciudad: "Villa Lugano Buenos Aires" },
  { nombre: "CONSORCIO - BENITEZ JULIO OMAR 4243",         geoAddr: "Benitez Julio Omar 4243",  ciudad: "Villa Lugano Buenos Aires" },
  { nombre: "VTV CAISA - LARRAZABAL 1861",                 geoAddr: "Larrazabal 1861",          ciudad: "Mataderos Buenos Aires" },
  { nombre: "SPORT CLUB - RIVADAVIA 10652",                geoAddr: "Rivadavia 10652",          ciudad: "Villa Luro Buenos Aires" },
  { nombre: "CONSORCIO - SARMIENTO 2274",                  geoAddr: "Sarmiento 2274",           ciudad: "Balvanera Buenos Aires" },
  { nombre: "CONSORCIO - NUNEZ 1567",                      geoAddr: "Nunez 1567",               ciudad: "Nunez Buenos Aires" },
  { nombre: "CONSORCIO - CARLOS CALVO 3233",               geoAddr: "Carlos Calvo 3233",        ciudad: "Boedo Buenos Aires" },
  { nombre: "CONSORCIO - INDEPENDENCIA 3982",              geoAddr: "Independencia 3982",       ciudad: "Boedo Buenos Aires" },
  { nombre: "CONSORCIO - BILLINGHURST 1034",               geoAddr: "Billinghurst 1034",        ciudad: "Palermo Buenos Aires" },
  { nombre: "CONSORCIO - CHACABUCO 1028",                  geoAddr: "Chacabuco 1028",           ciudad: "San Telmo Buenos Aires" },
  { nombre: "EMPRESA WCS - FLORIDA 981",                   geoAddr: "Florida 981",              ciudad: "Buenos Aires" },
  { nombre: "EMPRESA KIDSCORP - ARCOS 2215",               geoAddr: "Arcos 2215",               ciudad: "Belgrano Buenos Aires" },
  // ── ZONA OESTE ──────────────────────────────────────────────────────────
  { nombre: "SMART SEGUROS - ALVEAR 1563",                 geoAddr: "Alvear 1563",              ciudad: "Ramos Mejia Buenos Aires" },
  { nombre: "ESTUDIO VALLI - AV. DE MAYO 432",             geoAddr: "Avenida de Mayo 432",      ciudad: "Ramos Mejia Buenos Aires" },
  { nombre: "CONSORCIO - TACUARI 305",                     geoAddr: "Tacuari 305",              ciudad: "Ramos Mejia Buenos Aires" },
  { nombre: "CONSORCIO - SAAVEDRA 233",                    geoAddr: "Saavedra 233",             ciudad: "Ramos Mejia Buenos Aires" },
  { nombre: "CONSORCIO - MARIANO MORENO 215",              geoAddr: "Mariano Moreno 215",       ciudad: "Ramos Mejia Buenos Aires" },
  { nombre: "CONSORCIO - MEDRANO 34",                      geoAddr: "Medrano 34",               ciudad: "Ramos Mejia Buenos Aires" },
  { nombre: "CONSORCIO - BARCALA 564",                     geoAddr: "Barcala 564",              ciudad: "Ramos Mejia Buenos Aires" },
  { nombre: "CONSORCIO - VIAMONTE 333",                    geoAddr: "Viamonte 333",             ciudad: "Ramos Mejia Buenos Aires" },
  { nombre: "CONSORCIO - ALFREDO PALACIOS 80",             geoAddr: "Alfredo Palacios 80",      ciudad: "Ramos Mejia Buenos Aires" },
  { nombre: "CONSORCIO - SARMIENTO 53",                    geoAddr: "Sarmiento 53",             ciudad: "Ramos Mejia Buenos Aires" },
  { nombre: "CONSORCIO - ALVAREZ JONTE 362",               geoAddr: "Alvarez Jonte 362",        ciudad: "Ramos Mejia Buenos Aires" },
  { nombre: "CONSORCIO - BELGRANO 269",                    geoAddr: "Belgrano 269",             ciudad: "Ramos Mejia Buenos Aires" },
  { nombre: "CONSORCIO - ESPORA 33",                       geoAddr: "Espora 33",                ciudad: "Ramos Mejia Buenos Aires" },
  { nombre: "DISTRIBUIDORA NINO - BOLIVAR 781",            geoAddr: "Bolivar 781",              ciudad: "Ramos Mejia Buenos Aires" },
  { nombre: "CONSORCIO - CASTELLI 65",                     geoAddr: "Castelli 65",              ciudad: "Ramos Mejia Buenos Aires" },
  { nombre: "CONSORCIO - SAN MARTIN 2823",                 geoAddr: "San Martin 2823",          ciudad: "Lomas del Mirador Buenos Aires" },
  { nombre: "SADEMEC - DR. REBIZZO 4728",                  geoAddr: "Doctor Rebizzo 4728",      ciudad: "Caseros Buenos Aires" },
  { nombre: "CONSORCIO - CHILE 1709",                      geoAddr: "Chile 1709",               ciudad: "Luzuriaga Buenos Aires" },
  { nombre: "CONSORCIO - GARIBALDI 2055",                  geoAddr: "Garibaldi 2055",           ciudad: "Villa Luzuriaga Buenos Aires" },
  { nombre: "RAME PRODUCTOS QUIMICOS - AV. BUFANO 1089",   geoAddr: "Monsenor Bufano 1089",     ciudad: "Villa Luzuriaga Buenos Aires" },
  { nombre: "CONSORCIO - PERON 1044",                      geoAddr: "Peron 1044",               ciudad: "Villa Luzuriaga Buenos Aires" },
  { nombre: "CONSORCIO - AV. RIVADAVIA 15760",             geoAddr: "Rivadavia 15760",          ciudad: "Haedo Buenos Aires" },
  { nombre: "CONSORCIO - PRES. PERON 1370",                geoAddr: "Presidente Peron 1370",    ciudad: "Haedo Buenos Aires" },
  { nombre: "CONSORCIO - SAN LORENZO 1149",                geoAddr: "San Lorenzo 1149",         ciudad: "Haedo Buenos Aires" },
  { nombre: "TIENDA VEGGIE - VALENTIN GOMEZ 577",          geoAddr: "Valentin Gomez 577",       ciudad: "Haedo Buenos Aires" },
  { nombre: "CONSORCIO - CARLOS TEJEDOR 1275",             geoAddr: "Carlos Tejedor 1275",      ciudad: "Haedo Buenos Aires" },
  { nombre: "GIM GLADIADOR - RIVADAVIA 16482",             geoAddr: "Rivadavia 16482",          ciudad: "Haedo Buenos Aires" },
  { nombre: "CONSORCIO - M. DE ANDREA 77",                 geoAddr: "De Andrea 77",             ciudad: "Haedo Buenos Aires" },
  { nombre: "CONSORCIO - RODRIGUEZ PENA 2060",             geoAddr: "Rodriguez Pena 2060",      ciudad: "Santos Lugares Buenos Aires" },
  { nombre: "OFICINAS MARAZZI - PEREDO 433",               geoAddr: "Peredo 433",               ciudad: "Ituzaingo Buenos Aires" },
  { nombre: "CONDOMINIO - LA PIALADA 3618",                geoAddr: "La Pialada 3618",          ciudad: "Ituzaingo Buenos Aires" },
  { nombre: "EMPRESA NORNEST - MENDEZ DE ANDES 1759",      geoAddr: "Mendez de Andes 1759",     ciudad: "Rafael Castillo Buenos Aires" },
  { nombre: "CONSORCIO - JUJUY 958",                       geoAddr: "Jujuy 958",                ciudad: "San Justo Buenos Aires" },
  { nombre: "CONSORCIO - ENTRE RIOS 3443",                 geoAddr: "Entre Rios 3443",          ciudad: "San Justo Buenos Aires" },
  { nombre: "CONSORCIO - ENTRE RIOS 2942",                 geoAddr: "Entre Rios 2942",          ciudad: "San Justo Buenos Aires" },
  { nombre: "CONSORCIO - AV. SAN MARTIN 2665",             geoAddr: "San Martin 2665",          ciudad: "Caseros Buenos Aires" },
  { nombre: "CONSORCIO - WENCESLAO DE TATA 4664",          geoAddr: "Wenceslao de Tata 4664",   ciudad: "Caseros Buenos Aires" },
  { nombre: "OUT SOURCE - AV. GAONA 4379",                 geoAddr: "Gaona 4379",               ciudad: "Ciudadela Buenos Aires" },
  { nombre: "NEW PET - SANTIAGO DE LINIERS 3836",          geoAddr: "Santiago de Liniers 3836", ciudad: "Ciudadela Buenos Aires" },
  { nombre: "DISTRIBUIDORA GROW - RICHIERI 4543",          geoAddr: "Richieri 4543",            ciudad: "Ciudadela Buenos Aires" },
  { nombre: "SUELAS LEAL - SAN PEDRO 1949",                geoAddr: "San Pedro 1949",           ciudad: "La Tablada Buenos Aires" },
  { nombre: "CONALIA - MONTENEGRO 1198",                   geoAddr: "Montenegro 1198",          ciudad: "La Tablada Buenos Aires" },
  { nombre: "EXACTKABEL - SOURINGES 1408",                 geoAddr: "Souringes 1408",           ciudad: "El Palomar Buenos Aires" },
  { nombre: "PADILUM - PRESIDENTE PERON 3045",             geoAddr: "Presidente Peron 3045",    ciudad: "El Palomar Buenos Aires" },
  { nombre: "CONSORCIO - BELGRANO 384",                    geoAddr: "Belgrano 384",             ciudad: "Moron Buenos Aires" },
  { nombre: "CONSORCIO - SANTA FE 980",                    geoAddr: "Santa Fe 980",             ciudad: "Moron Buenos Aires" },
  { nombre: "CONSORCIO - BOATTI 264",                      geoAddr: "Boatti 264",               ciudad: "Moron Buenos Aires" },
  { nombre: "ALCAP - CAAGUAZU 421",                        geoAddr: "Caaguazu 421",             ciudad: "Villa Madero Buenos Aires" },
  { nombre: "CREATIV - PARQUE IND. SIPLA",                 geoAddr: "Juan Lumbreras 1800",      ciudad: "General Rodriguez Buenos Aires" },
  { nombre: "KYC - TUPAC AMARU 550",                       geoAddr: "Tupac Amaru 550",          ciudad: "La Reja Buenos Aires" },
  { nombre: "KYC - AV. ZAPIOLA 1148",                     geoAddr: "Zapiola 1148",             ciudad: "Paso del Rey Buenos Aires" },
  { nombre: "CONSORCIO - PERDRIEL 5358",                   geoAddr: "Perdriel 5358",            ciudad: "Villa Lynch Buenos Aires" },
  // ── ZONA NORTE ──────────────────────────────────────────────────────────
  { nombre: "ANIXTER - MARCOS SASTRE 1712",                geoAddr: "Marcos Sastre 1712",       ciudad: "Pacheco Buenos Aires" },
]

function esc(s) {
  return s.replace(/'/g, "''")
}

async function main() {
  console.log(`Geocodificando ${PUNTOS.length} direcciones (1.1s entre requests)...\n`)

  const rows = []
  const fallidos = []

  for (let i = 0; i < PUNTOS.length; i++) {
    const p = PUNTOS[i]
    process.stdout.write(`[${String(i + 1).padStart(2, "0")}/${PUNTOS.length}] ${p.nombre}... `)

    const coords = await geocode(p.geoAddr, p.ciudad)

    if (!coords) {
      console.log("⚠️  NO ENCONTRADO")
      fallidos.push(p)
      await sleep(1100)
      continue
    }

    console.log(`✅  ${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}`)
    rows.push({ ...p, lat: coords.lat, lon: coords.lon })
    await sleep(1100)
  }

  // Generar SQL — empresa_id se reemplaza por una subquery que busca FourMaster
  const lines = [
    "-- Puntos FourMaster generados automáticamente con geocodificación Nominatim",
    "-- Ejecutar en Supabase SQL Editor o via: npx prisma db execute --stdin < scripts/fourmaster-puntos.sql",
    "",
    "DO $$",
    "DECLARE empresa_id UUID;",
    "BEGIN",
    "  SELECT id INTO empresa_id FROM empresas WHERE LOWER(nombre) LIKE '%fourmaster%' LIMIT 1;",
    "  IF empresa_id IS NULL THEN RAISE EXCEPTION 'Empresa FourMaster no encontrada'; END IF;",
    "",
  ]

  for (const r of rows) {
    lines.push(
      `  INSERT INTO puntos_fichaje (id, empresa_id, nombre, latitud, longitud, radio_metros, qr_token, operaciones_token, activo, descanso_activo, created_at, updated_at)` +
      ` SELECT gen_random_uuid(), empresa_id, '${esc(r.nombre)}', ${r.lat}, ${r.lon}, 100, gen_random_uuid(), gen_random_uuid(), true, false, NOW(), NOW()` +
      ` WHERE NOT EXISTS (SELECT 1 FROM puntos_fichaje WHERE empresa_id = empresa_id AND nombre = '${esc(r.nombre)}');`
    )
  }

  lines.push("END $$;")
  lines.push("")

  if (fallidos.length > 0) {
    lines.push("-- ⚠️ Puntos NO geocodificados (coordenadas en 0,0 — corregir manualmente):")
    for (const f of fallidos) {
      lines.push(
        `  -- INSERT INTO puntos_fichaje (id, empresa_id, nombre, latitud, longitud, radio_metros, qr_token, operaciones_token, activo, descanso_activo, created_at, updated_at)` +
        ` VALUES (gen_random_uuid(), (SELECT id FROM empresas WHERE LOWER(nombre) LIKE '%fourmaster%' LIMIT 1), '${esc(f.nombre)}', 0, 0, 100, gen_random_uuid(), gen_random_uuid(), true, false, NOW(), NOW());`
      )
    }
  }

  const sql = lines.join("\n")
  writeFileSync("scripts/fourmaster-puntos.sql", sql, "utf8")

  console.log(`\n─────────────────────────────────────`)
  console.log(`✅ ${rows.length} puntos geocodificados`)
  if (fallidos.length) console.log(`⚠️  ${fallidos.length} fallidos (comentados en el SQL)`)
  console.log(`\nSQL generado en: scripts/fourmaster-puntos.sql`)
  console.log(`\nEjecutar con:`)
  console.log(`  npx prisma db execute --stdin < scripts/fourmaster-puntos.sql`)
}

main().catch(console.error)
