-- 1. Estandarizar las categorías conocidas a nombres cerrados.
-- "Equipos de frio" o "EQUIPO DE FRIO" o "Freezer" -> 'Freezer' o 'Heladera Exhibidora' basado en el nombre actual.

UPDATE mantenimiento.activos
SET categoria = 'Heladera Exhibidora'
WHERE nombre ILIKE '%exhibidora%';

UPDATE mantenimiento.activos
SET categoria = 'Freezer'
WHERE nombre ILIKE '%freezer%';

UPDATE mantenimiento.activos
SET categoria = 'Cámara Frigorífica'
WHERE nombre ILIKE '%camara%' OR nombre ILIKE '%cámara%';

UPDATE mantenimiento.activos
SET categoria = 'Heladera'
WHERE nombre ILIKE '%heladera%' AND categoria NOT IN ('Heladera Exhibidora', 'Freezer');

UPDATE mantenimiento.activos
SET categoria = 'Vehículo Utilitario'
WHERE nombre ILIKE '%kangoo%' OR nombre ILIKE '%fiorino%' OR nombre ILIKE '%partner%';

UPDATE mantenimiento.activos
SET categoria = 'Horno'
WHERE nombre ILIKE '%horno%';

-- Limpiar cualquier "EQUIPO DE FRIO" sobrante a una categoría genérica.
UPDATE mantenimiento.activos
SET categoria = 'Refrigeración Genérica'
WHERE categoria ILIKE '%frio%';

-- 2. Estandarizar la Nomenclatura del Nombre.
-- Queremos "Categoría - Marca Modelo". Si no hay marca o modelo, solo Categoría.
-- No sobrescribimos si el nombre ya se ve prolijo, o lo forzamos.
-- Dado que "Freezer FAM" es mejor como "Freezer - FAM", o "EXHIBIDORA" como "Heladera Exhibidora - Bricket Master 5000"

UPDATE mantenimiento.activos
SET nombre = categoria || COALESCE(' - ' || NULLIF(TRIM(marca), ''), '') || COALESCE(' ' || NULLIF(TRIM(modelo), ''), '')
WHERE (marca IS NOT NULL AND marca != '') OR (modelo IS NOT NULL AND modelo != '');

-- Si no tenían marca o modelo, al menos ponemos el nombre en formato capitalizado lindo usando la categoria si el nombre actual es solo la categoria mal escrita.
UPDATE mantenimiento.activos
SET nombre = categoria
WHERE (marca IS NULL OR marca = '') AND (modelo IS NULL OR modelo = '') AND (nombre ILIKE categoria OR nombre ILIKE '%exhibidora%' OR nombre ILIKE '%freezer%');
