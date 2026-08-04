-- Criterio de verificación IA en Tarea
ALTER TABLE "tareas" ADD COLUMN "criterio_verificacion" TEXT;

-- Resultado verificación IA en FotoOperacion
ALTER TABLE "fotos_operaciones" ADD COLUMN "verificacion_ia" JSONB;
