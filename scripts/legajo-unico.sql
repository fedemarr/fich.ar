-- N° de asociado (legajo) único por empresa entre colaboradores NO borrados.
-- Parcial porque hay legajos repetidos en colaboradores con soft delete (deleted_at).
-- Prisma no soporta índices parciales: si un `prisma db push` lo elimina, volver a correr este script.

-- 1) Verificar que no haya duplicados activos (debe devolver 0 filas antes del paso 2)
SELECT empresa_id, legajo, COUNT(*)
FROM colaboradores
WHERE legajo IS NOT NULL AND legajo <> '' AND deleted_at IS NULL
GROUP BY empresa_id, legajo
HAVING COUNT(*) > 1;

-- 2) Normalizar vacíos y crear el índice
UPDATE colaboradores SET legajo = NULL WHERE legajo IS NOT NULL AND btrim(legajo) = '';

CREATE UNIQUE INDEX IF NOT EXISTS colaboradores_empresa_legajo_activo_key
  ON colaboradores (empresa_id, legajo)
  WHERE deleted_at IS NULL AND legajo IS NOT NULL;
