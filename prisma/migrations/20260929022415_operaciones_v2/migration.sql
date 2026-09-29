-- CreateTable
CREATE TABLE "fichas_sector" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "puntos_revision" JSONB NOT NULL,
    "instruccion_foto" TEXT,
    "foto_ok_url" TEXT,
    "foto_mal_url" TEXT,
    "fallas_graves" JSONB,
    "fallas_leves" JSONB,
    "controles_presenciales" JSONB NOT NULL,
    "umbral_aprobacion" INTEGER NOT NULL DEFAULT 80,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fichas_sector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sectores" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "sede_id" TEXT NOT NULL,
    "ficha_id" TEXT,
    "nombre" TEXT NOT NULL,
    "qr_sector_token" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sectores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rutinas_diarias" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "sector_id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "turno_id" TEXT,
    "fecha" DATE NOT NULL,
    "hora_escaneo" TIMESTAMP(3) NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rutinas_diarias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rondas_muestreo" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "sede_id" TEXT NOT NULL,
    "supervisor_id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "semilla" TEXT NOT NULL,
    "cantidad_sectores" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'EN_CURSO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rondas_muestreo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verificaciones_sector" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "ronda_id" TEXT NOT NULL,
    "sector_id" TEXT NOT NULL,
    "supervisor_id" TEXT NOT NULL,
    "foto_url" TEXT,
    "foto_hash" TEXT,
    "foto_timestamp" TIMESTAMP(3),
    "foto_latitud" DOUBLE PRECISION,
    "foto_longitud" DOUBLE PRECISION,
    "puntaje_ia" INTEGER,
    "observacion_ia" TEXT,
    "falla_grave_ia" BOOLEAN NOT NULL DEFAULT false,
    "controles_presenciales" JSONB,
    "resultado_final" TEXT,
    "contradijo_ia" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verificaciones_sector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reclamos" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "sector_id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descripcion" TEXT,
    "hora_aviso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "colaborador_id" TEXT,
    "foto_antes_url" TEXT,
    "foto_antes_hash" TEXT,
    "foto_despues_url" TEXT,
    "foto_despues_hash" TEXT,
    "puntaje_ia_despues" INTEGER,
    "hora_cierre" TIMESTAMP(3),
    "tiempo_resolucion_min" INTEGER,
    "estado" TEXT NOT NULL DEFAULT 'ABIERTO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reclamos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fichas_sector_empresa_id_idx" ON "fichas_sector"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "sectores_qr_sector_token_key" ON "sectores"("qr_sector_token");

-- CreateIndex
CREATE INDEX "sectores_empresa_id_idx" ON "sectores"("empresa_id");

-- CreateIndex
CREATE INDEX "sectores_sede_id_idx" ON "sectores"("sede_id");

-- CreateIndex
CREATE INDEX "sectores_qr_sector_token_idx" ON "sectores"("qr_sector_token");

-- CreateIndex
CREATE INDEX "rutinas_diarias_empresa_id_idx" ON "rutinas_diarias"("empresa_id");

-- CreateIndex
CREATE INDEX "rutinas_diarias_empresa_id_fecha_idx" ON "rutinas_diarias"("empresa_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "rutinas_diarias_sector_id_colaborador_id_fecha_key" ON "rutinas_diarias"("sector_id", "colaborador_id", "fecha");

-- CreateIndex
CREATE INDEX "rondas_muestreo_empresa_id_idx" ON "rondas_muestreo"("empresa_id");

-- CreateIndex
CREATE INDEX "rondas_muestreo_empresa_id_fecha_idx" ON "rondas_muestreo"("empresa_id", "fecha");

-- CreateIndex
CREATE INDEX "verificaciones_sector_empresa_id_idx" ON "verificaciones_sector"("empresa_id");

-- CreateIndex
CREATE INDEX "verificaciones_sector_ronda_id_idx" ON "verificaciones_sector"("ronda_id");

-- CreateIndex
CREATE INDEX "verificaciones_sector_sector_id_idx" ON "verificaciones_sector"("sector_id");

-- CreateIndex
CREATE INDEX "reclamos_empresa_id_idx" ON "reclamos"("empresa_id");

-- CreateIndex
CREATE INDEX "reclamos_sector_id_idx" ON "reclamos"("sector_id");

-- CreateIndex
CREATE INDEX "reclamos_empresa_id_estado_idx" ON "reclamos"("empresa_id", "estado");

-- AddForeignKey
ALTER TABLE "fichas_sector" ADD CONSTRAINT "fichas_sector_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sectores" ADD CONSTRAINT "sectores_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sectores" ADD CONSTRAINT "sectores_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sectores" ADD CONSTRAINT "sectores_ficha_id_fkey" FOREIGN KEY ("ficha_id") REFERENCES "fichas_sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rutinas_diarias" ADD CONSTRAINT "rutinas_diarias_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rutinas_diarias" ADD CONSTRAINT "rutinas_diarias_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rutinas_diarias" ADD CONSTRAINT "rutinas_diarias_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rutinas_diarias" ADD CONSTRAINT "rutinas_diarias_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turnos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rondas_muestreo" ADD CONSTRAINT "rondas_muestreo_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rondas_muestreo" ADD CONSTRAINT "rondas_muestreo_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rondas_muestreo" ADD CONSTRAINT "rondas_muestreo_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verificaciones_sector" ADD CONSTRAINT "verificaciones_sector_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verificaciones_sector" ADD CONSTRAINT "verificaciones_sector_ronda_id_fkey" FOREIGN KEY ("ronda_id") REFERENCES "rondas_muestreo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verificaciones_sector" ADD CONSTRAINT "verificaciones_sector_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verificaciones_sector" ADD CONSTRAINT "verificaciones_sector_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclamos" ADD CONSTRAINT "reclamos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclamos" ADD CONSTRAINT "reclamos_sector_id_fkey" FOREIGN KEY ("sector_id") REFERENCES "sectores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reclamos" ADD CONSTRAINT "reclamos_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
