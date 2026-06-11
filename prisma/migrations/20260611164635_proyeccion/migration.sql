-- CreateTable
CREATE TABLE "proyecciones_mensuales" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "archivo" TEXT,
    "subido_por" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proyecciones_mensuales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asignaciones_mensuales" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "proyeccion_id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "punto_fichaje_id" TEXT,
    "servicio_nombre" TEXT NOT NULL,
    "nro_socio" TEXT,
    "categoria" TEXT,
    "valor_hora" DOUBLE PRECISION,
    "hora_inicio" TEXT,
    "hora_fin" TEXT,
    "dia_01" DOUBLE PRECISION,
    "dia_02" DOUBLE PRECISION,
    "dia_03" DOUBLE PRECISION,
    "dia_04" DOUBLE PRECISION,
    "dia_05" DOUBLE PRECISION,
    "dia_06" DOUBLE PRECISION,
    "dia_07" DOUBLE PRECISION,
    "dia_08" DOUBLE PRECISION,
    "dia_09" DOUBLE PRECISION,
    "dia_10" DOUBLE PRECISION,
    "dia_11" DOUBLE PRECISION,
    "dia_12" DOUBLE PRECISION,
    "dia_13" DOUBLE PRECISION,
    "dia_14" DOUBLE PRECISION,
    "dia_15" DOUBLE PRECISION,
    "dia_16" DOUBLE PRECISION,
    "dia_17" DOUBLE PRECISION,
    "dia_18" DOUBLE PRECISION,
    "dia_19" DOUBLE PRECISION,
    "dia_20" DOUBLE PRECISION,
    "dia_21" DOUBLE PRECISION,
    "dia_22" DOUBLE PRECISION,
    "dia_23" DOUBLE PRECISION,
    "dia_24" DOUBLE PRECISION,
    "dia_25" DOUBLE PRECISION,
    "dia_26" DOUBLE PRECISION,
    "dia_27" DOUBLE PRECISION,
    "dia_28" DOUBLE PRECISION,
    "dia_29" DOUBLE PRECISION,
    "dia_30" DOUBLE PRECISION,
    "dia_31" DOUBLE PRECISION,
    "total_horas" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asignaciones_mensuales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proyecciones_mensuales_empresa_id_idx" ON "proyecciones_mensuales"("empresa_id");

-- CreateIndex
CREATE UNIQUE INDEX "proyecciones_mensuales_empresa_id_mes_anio_key" ON "proyecciones_mensuales"("empresa_id", "mes", "anio");

-- CreateIndex
CREATE INDEX "asignaciones_mensuales_empresa_id_idx" ON "asignaciones_mensuales"("empresa_id");

-- CreateIndex
CREATE INDEX "asignaciones_mensuales_proyeccion_id_idx" ON "asignaciones_mensuales"("proyeccion_id");

-- CreateIndex
CREATE INDEX "asignaciones_mensuales_colaborador_id_idx" ON "asignaciones_mensuales"("colaborador_id");

-- AddForeignKey
ALTER TABLE "proyecciones_mensuales" ADD CONSTRAINT "proyecciones_mensuales_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_mensuales" ADD CONSTRAINT "asignaciones_mensuales_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_mensuales" ADD CONSTRAINT "asignaciones_mensuales_proyeccion_id_fkey" FOREIGN KEY ("proyeccion_id") REFERENCES "proyecciones_mensuales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_mensuales" ADD CONSTRAINT "asignaciones_mensuales_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asignaciones_mensuales" ADD CONSTRAINT "asignaciones_mensuales_punto_fichaje_id_fkey" FOREIGN KEY ("punto_fichaje_id") REFERENCES "puntos_fichaje"("id") ON DELETE SET NULL ON UPDATE CASCADE;
