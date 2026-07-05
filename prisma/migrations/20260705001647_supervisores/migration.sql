-- AlterEnum
ALTER TYPE "RolUsuario" ADD VALUE 'SUPERVISOR';

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "puede_gestionar_puntos" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "usuario_puntos" (
    "id" TEXT NOT NULL,
    "usuario_id" TEXT NOT NULL,
    "punto_fichaje_id" TEXT NOT NULL,

    CONSTRAINT "usuario_puntos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "usuario_puntos_usuario_id_idx" ON "usuario_puntos"("usuario_id");

-- CreateIndex
CREATE INDEX "usuario_puntos_punto_fichaje_id_idx" ON "usuario_puntos"("punto_fichaje_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_puntos_usuario_id_punto_fichaje_id_key" ON "usuario_puntos"("usuario_id", "punto_fichaje_id");

-- AddForeignKey
ALTER TABLE "usuario_puntos" ADD CONSTRAINT "usuario_puntos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_puntos" ADD CONSTRAINT "usuario_puntos_punto_fichaje_id_fkey" FOREIGN KEY ("punto_fichaje_id") REFERENCES "puntos_fichaje"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
