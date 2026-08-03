-- AlterTable
ALTER TABLE "puntos_fichaje" ADD COLUMN     "sede_id" TEXT;

-- CreateTable
CREATE TABLE "sedes" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sedes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turnos" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fin" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "turnos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procedimientos" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "turno_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "lunes" BOOLEAN NOT NULL DEFAULT false,
    "martes" BOOLEAN NOT NULL DEFAULT false,
    "miercoles" BOOLEAN NOT NULL DEFAULT false,
    "jueves" BOOLEAN NOT NULL DEFAULT false,
    "viernes" BOOLEAN NOT NULL DEFAULT false,
    "sabado" BOOLEAN NOT NULL DEFAULT false,
    "domingo" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procedimientos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tareas" (
    "id" TEXT NOT NULL,
    "procedimiento_id" TEXT NOT NULL,
    "punto_fichaje_id" TEXT,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL,
    "es_critica" BOOLEAN NOT NULL DEFAULT false,
    "es_omitible" BOOLEAN NOT NULL DEFAULT true,
    "tiempo_estimado_min" INTEGER,
    "foto_min" INTEGER NOT NULL DEFAULT 0,
    "foto_max" INTEGER NOT NULL DEFAULT 0,
    "foto_instruccion" TEXT,
    "requiere_comentario" BOOLEAN NOT NULL DEFAULT false,
    "checklist_items" JSONB,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tareas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ejecuciones_procedimiento" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "procedimiento_id" TEXT NOT NULL,
    "turno_id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ejecuciones_procedimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ejecuciones_tarea" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "ejecucion_procedimiento_id" TEXT NOT NULL,
    "tarea_id" TEXT NOT NULL,
    "colaborador_id" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "hora_inicio" TIMESTAMP(3),
    "hora_fin" TIMESTAMP(3),
    "latitud_completado" DOUBLE PRECISION,
    "longitud_completado" DOUBLE PRECISION,
    "comentario" TEXT,
    "checklist_completado" JSONB,
    "se_salteo_orden" BOOLEAN NOT NULL DEFAULT false,
    "motivo_salteo" TEXT,
    "validacion_estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "validado_por_id" TEXT,
    "motivo_rechazo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ejecuciones_tarea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fotos_operaciones" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "ejecucion_tarea_id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "key" TEXT,
    "thumbnail_key" TEXT,
    "bytes" INTEGER,
    "ancho" INTEGER,
    "alto" INTEGER,
    "timestamp_captura" TIMESTAMP(3),
    "latitud_captura" DOUBLE PRECISION,
    "longitud_captura" DOUBLE PRECISION,
    "estado_subida" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fotos_operaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sedes_empresa_id_idx" ON "sedes"("empresa_id");

-- CreateIndex
CREATE INDEX "turnos_empresa_id_idx" ON "turnos"("empresa_id");

-- CreateIndex
CREATE INDEX "procedimientos_empresa_id_idx" ON "procedimientos"("empresa_id");

-- CreateIndex
CREATE INDEX "procedimientos_turno_id_idx" ON "procedimientos"("turno_id");

-- CreateIndex
CREATE INDEX "tareas_procedimiento_id_idx" ON "tareas"("procedimiento_id");

-- CreateIndex
CREATE INDEX "ejecuciones_procedimiento_empresa_id_idx" ON "ejecuciones_procedimiento"("empresa_id");

-- CreateIndex
CREATE INDEX "ejecuciones_procedimiento_empresa_id_fecha_idx" ON "ejecuciones_procedimiento"("empresa_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "ejecuciones_procedimiento_procedimiento_id_fecha_key" ON "ejecuciones_procedimiento"("procedimiento_id", "fecha");

-- CreateIndex
CREATE INDEX "ejecuciones_tarea_empresa_id_idx" ON "ejecuciones_tarea"("empresa_id");

-- CreateIndex
CREATE INDEX "ejecuciones_tarea_ejecucion_procedimiento_id_idx" ON "ejecuciones_tarea"("ejecucion_procedimiento_id");

-- CreateIndex
CREATE INDEX "ejecuciones_tarea_tarea_id_idx" ON "ejecuciones_tarea"("tarea_id");

-- CreateIndex
CREATE INDEX "fotos_operaciones_empresa_id_idx" ON "fotos_operaciones"("empresa_id");

-- CreateIndex
CREATE INDEX "fotos_operaciones_ejecucion_tarea_id_idx" ON "fotos_operaciones"("ejecucion_tarea_id");

-- AddForeignKey
ALTER TABLE "puntos_fichaje" ADD CONSTRAINT "puntos_fichaje_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sedes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sedes" ADD CONSTRAINT "sedes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turnos" ADD CONSTRAINT "turnos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedimientos" ADD CONSTRAINT "procedimientos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "procedimientos" ADD CONSTRAINT "procedimientos_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turnos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_procedimiento_id_fkey" FOREIGN KEY ("procedimiento_id") REFERENCES "procedimientos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tareas" ADD CONSTRAINT "tareas_punto_fichaje_id_fkey" FOREIGN KEY ("punto_fichaje_id") REFERENCES "puntos_fichaje"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ejecuciones_procedimiento" ADD CONSTRAINT "ejecuciones_procedimiento_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ejecuciones_procedimiento" ADD CONSTRAINT "ejecuciones_procedimiento_procedimiento_id_fkey" FOREIGN KEY ("procedimiento_id") REFERENCES "procedimientos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ejecuciones_procedimiento" ADD CONSTRAINT "ejecuciones_procedimiento_turno_id_fkey" FOREIGN KEY ("turno_id") REFERENCES "turnos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ejecuciones_tarea" ADD CONSTRAINT "ejecuciones_tarea_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ejecuciones_tarea" ADD CONSTRAINT "ejecuciones_tarea_ejecucion_procedimiento_id_fkey" FOREIGN KEY ("ejecucion_procedimiento_id") REFERENCES "ejecuciones_procedimiento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ejecuciones_tarea" ADD CONSTRAINT "ejecuciones_tarea_tarea_id_fkey" FOREIGN KEY ("tarea_id") REFERENCES "tareas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ejecuciones_tarea" ADD CONSTRAINT "ejecuciones_tarea_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos_operaciones" ADD CONSTRAINT "fotos_operaciones_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos_operaciones" ADD CONSTRAINT "fotos_operaciones_ejecucion_tarea_id_fkey" FOREIGN KEY ("ejecucion_tarea_id") REFERENCES "ejecuciones_tarea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fotos_operaciones" ADD CONSTRAINT "fotos_operaciones_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
