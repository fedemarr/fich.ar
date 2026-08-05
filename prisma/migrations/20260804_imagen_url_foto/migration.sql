-- AddColumn imagen_url to fotos_operaciones
ALTER TABLE "fotos_operaciones" ADD COLUMN IF NOT EXISTS "imagen_url" TEXT;
