-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "identificacion" TEXT;

-- CreateTable
CREATE TABLE "supervisiones" (
    "id" TEXT NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "punto_fichaje_id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" TEXT NOT NULL,
    "checklist_json" JSONB NOT NULL,
    "observaciones" TEXT,

    CONSTRAINT "supervisiones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supervisiones_empresa_id_idx" ON "supervisiones"("empresa_id");

-- CreateIndex
CREATE INDEX "supervisiones_punto_fichaje_id_idx" ON "supervisiones"("punto_fichaje_id");

-- CreateIndex
CREATE INDEX "supervisiones_empresa_id_timestamp_idx" ON "supervisiones"("empresa_id", "timestamp");

-- AddForeignKey
ALTER TABLE "supervisiones" ADD CONSTRAINT "supervisiones_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supervisiones" ADD CONSTRAINT "supervisiones_punto_fichaje_id_fkey" FOREIGN KEY ("punto_fichaje_id") REFERENCES "puntos_fichaje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supervisiones" ADD CONSTRAINT "supervisiones_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
