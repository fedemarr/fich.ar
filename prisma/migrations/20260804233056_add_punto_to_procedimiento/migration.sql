-- AlterTable
ALTER TABLE "procedimientos" ADD COLUMN     "punto_fichaje_id" TEXT;

-- CreateIndex
CREATE INDEX "procedimientos_punto_fichaje_id_idx" ON "procedimientos"("punto_fichaje_id");

-- AddForeignKey
ALTER TABLE "procedimientos" ADD CONSTRAINT "procedimientos_punto_fichaje_id_fkey" FOREIGN KEY ("punto_fichaje_id") REFERENCES "puntos_fichaje"("id") ON DELETE SET NULL ON UPDATE CASCADE;
