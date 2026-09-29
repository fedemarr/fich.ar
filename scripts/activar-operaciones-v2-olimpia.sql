SET search_path TO public;

UPDATE empresas
SET operaciones_v2 = true
WHERE LOWER(slug) = 'olimpia';
