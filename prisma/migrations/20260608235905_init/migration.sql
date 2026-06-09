-- CreateEnum
CREATE TYPE "RolUsuario" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'MANAGER');

-- CreateEnum
CREATE TYPE "EstadoColaborador" AS ENUM ('ACTIVO', 'INACTIVO', 'DESACTIVADO');

-- CreateEnum
CREATE TYPE "TipoNovedad" AS ENUM ('P', 'PT', 'AU', 'VAC', 'EN', 'FR', 'FE', 'HDO', 'C', 'DES', 'VIR');

-- CreateEnum
CREATE TYPE "TipoFichada" AS ENUM ('ENTRADA', 'SALIDA');

-- CreateEnum
CREATE TYPE "MetodoFichada" AS ENUM ('QR_WHATSAPP', 'MANUAL');

-- CreateEnum
CREATE TYPE "AnalisisFichada" AS ENUM ('LLEGADA_EN_TIEMPO', 'LLEGADA_TARDE', 'SALIDA_ANTICIPADA', 'SALIDA_EN_TIEMPO', 'SIN_SALIDA', 'FUERA_DE_RANGO');

-- CreateEnum
CREATE TYPE "EstadoNotificacion" AS ENUM ('NO_LEIDA', 'LEIDA');

-- CreateEnum
CREATE TYPE "TipoNotificacion" AS ENUM ('FALLA_FICHADA', 'INASISTENCIA', 'SISTEMA', 'COMUNICACION_NUEVA');

-- CreateTable
CREATE TABLE "empresas" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo_url" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "rol" "RolUsuario" NOT NULL DEFAULT 'ADMIN',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colaboradores" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "celular" TEXT NOT NULL,
    "identificacion" TEXT,
    "legajo" TEXT,
    "email" TEXT,
    "avatar_url" TEXT,
    "sector" TEXT,
    "estado" "EstadoColaborador" NOT NULL DEFAULT 'ACTIVO',
    "fecha_ingreso" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "colaboradores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "puntos_fichaje" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "latitud" DOUBLE PRECISION NOT NULL,
    "longitud" DOUBLE PRECISION NOT NULL,
    "radio_metros" INTEGER NOT NULL DEFAULT 200,
    "qr_token" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "puntos_fichaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jornadas" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "punto_fichaje_id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "hora_inicio" TEXT NOT NULL,
    "hora_fin" TEXT NOT NULL,
    "tolerancia_min" INTEGER NOT NULL DEFAULT 15,
    "lunes_presencial" BOOLEAN NOT NULL DEFAULT false,
    "martes_presencial" BOOLEAN NOT NULL DEFAULT false,
    "miercoles_presencial" BOOLEAN NOT NULL DEFAULT false,
    "jueves_presencial" BOOLEAN NOT NULL DEFAULT false,
    "viernes_presencial" BOOLEAN NOT NULL DEFAULT false,
    "sabado_presencial" BOOLEAN NOT NULL DEFAULT false,
    "domingo_presencial" BOOLEAN NOT NULL DEFAULT false,
    "lunes_virtual" BOOLEAN NOT NULL DEFAULT false,
    "martes_virtual" BOOLEAN NOT NULL DEFAULT false,
    "miercoles_virtual" BOOLEAN NOT NULL DEFAULT false,
    "jueves_virtual" BOOLEAN NOT NULL DEFAULT false,
    "viernes_virtual" BOOLEAN NOT NULL DEFAULT false,
    "sabado_virtual" BOOLEAN NOT NULL DEFAULT false,
    "domingo_virtual" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jornadas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colaborador_jornadas" (
    "id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "jornada_id" TEXT NOT NULL,
    "fecha_desde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_hasta" TIMESTAMP(3),

    CONSTRAINT "colaborador_jornadas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fichadas" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "punto_fichaje_id" TEXT,
    "tipo" "TipoFichada" NOT NULL,
    "metodo" "MetodoFichada" NOT NULL DEFAULT 'QR_WHATSAPP',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitud_real" DOUBLE PRECISION,
    "longitud_real" DOUBLE PRECISION,
    "distancia_metros" INTEGER,
    "analisis" "AnalisisFichada",
    "es_valida" BOOLEAN NOT NULL DEFAULT true,
    "nota_manual" TEXT,
    "usuario_manual_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fichadas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "novedades" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "colaborador_id" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "tipo" "TipoNovedad" NOT NULL,
    "observacion" TEXT,
    "aprobada" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "novedades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comunicaciones" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "fecha_inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_fin" TIMESTAMP(3) NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "comunicaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notificaciones" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "colaborador_id" TEXT,
    "tipo" "TipoNotificacion" NOT NULL,
    "titulo" TEXT NOT NULL,
    "descripcion" TEXT,
    "estado" "EstadoNotificacion" NOT NULL DEFAULT 'NO_LEIDA',
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhooks_wa" (
    "id" TEXT NOT NULL,
    "from_number" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "latitud" DOUBLE PRECISION,
    "longitud" DOUBLE PRECISION,
    "wa_message_id" TEXT NOT NULL,
    "procesado" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhooks_wa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "empresas_slug_key" ON "empresas"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "usuarios_empresa_id_idx" ON "usuarios"("empresa_id");

-- CreateIndex
CREATE INDEX "colaboradores_empresa_id_idx" ON "colaboradores"("empresa_id");

-- CreateIndex
CREATE INDEX "colaboradores_celular_idx" ON "colaboradores"("celular");

-- CreateIndex
CREATE UNIQUE INDEX "puntos_fichaje_qr_token_key" ON "puntos_fichaje"("qr_token");

-- CreateIndex
CREATE INDEX "puntos_fichaje_empresa_id_idx" ON "puntos_fichaje"("empresa_id");

-- CreateIndex
CREATE INDEX "puntos_fichaje_qr_token_idx" ON "puntos_fichaje"("qr_token");

-- CreateIndex
CREATE INDEX "jornadas_empresa_id_idx" ON "jornadas"("empresa_id");

-- CreateIndex
CREATE INDEX "jornadas_punto_fichaje_id_idx" ON "jornadas"("punto_fichaje_id");

-- CreateIndex
CREATE INDEX "colaborador_jornadas_colaborador_id_idx" ON "colaborador_jornadas"("colaborador_id");

-- CreateIndex
CREATE INDEX "colaborador_jornadas_jornada_id_idx" ON "colaborador_jornadas"("jornada_id");

-- CreateIndex
CREATE INDEX "fichadas_empresa_id_idx" ON "fichadas"("empresa_id");

-- CreateIndex
CREATE INDEX "fichadas_colaborador_id_idx" ON "fichadas"("colaborador_id");

-- CreateIndex
CREATE INDEX "fichadas_empresa_id_timestamp_idx" ON "fichadas"("empresa_id", "timestamp");

-- CreateIndex
CREATE INDEX "fichadas_colaborador_id_timestamp_idx" ON "fichadas"("colaborador_id", "timestamp");

-- CreateIndex
CREATE INDEX "novedades_empresa_id_idx" ON "novedades"("empresa_id");

-- CreateIndex
CREATE INDEX "novedades_empresa_id_fecha_idx" ON "novedades"("empresa_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "novedades_colaborador_id_fecha_key" ON "novedades"("colaborador_id", "fecha");

-- CreateIndex
CREATE INDEX "comunicaciones_empresa_id_idx" ON "comunicaciones"("empresa_id");

-- CreateIndex
CREATE INDEX "notificaciones_empresa_id_idx" ON "notificaciones"("empresa_id");

-- CreateIndex
CREATE INDEX "notificaciones_empresa_id_estado_idx" ON "notificaciones"("empresa_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "webhooks_wa_wa_message_id_key" ON "webhooks_wa"("wa_message_id");

-- CreateIndex
CREATE INDEX "webhooks_wa_from_number_idx" ON "webhooks_wa"("from_number");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaboradores" ADD CONSTRAINT "colaboradores_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "puntos_fichaje" ADD CONSTRAINT "puntos_fichaje_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jornadas" ADD CONSTRAINT "jornadas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jornadas" ADD CONSTRAINT "jornadas_punto_fichaje_id_fkey" FOREIGN KEY ("punto_fichaje_id") REFERENCES "puntos_fichaje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaborador_jornadas" ADD CONSTRAINT "colaborador_jornadas_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "colaborador_jornadas" ADD CONSTRAINT "colaborador_jornadas_jornada_id_fkey" FOREIGN KEY ("jornada_id") REFERENCES "jornadas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichadas" ADD CONSTRAINT "fichadas_usuario_manual_id_fkey" FOREIGN KEY ("usuario_manual_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichadas" ADD CONSTRAINT "fichadas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichadas" ADD CONSTRAINT "fichadas_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fichadas" ADD CONSTRAINT "fichadas_punto_fichaje_id_fkey" FOREIGN KEY ("punto_fichaje_id") REFERENCES "puntos_fichaje"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novedades" ADD CONSTRAINT "novedades_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novedades" ADD CONSTRAINT "novedades_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comunicaciones" ADD CONSTRAINT "comunicaciones_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificaciones" ADD CONSTRAINT "notificaciones_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaboradores"("id") ON DELETE SET NULL ON UPDATE CASCADE;
