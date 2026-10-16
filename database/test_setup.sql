-- Recrea SOLO la base de pruebas. Despues cargar el esquema con:
--   cmd /c "mysql -u root -p avaluos_test < database\schema.sql"
DROP DATABASE IF EXISTS avaluos_test;
CREATE DATABASE avaluos_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
GRANT SELECT, INSERT, UPDATE, DELETE ON avaluos_test.* TO 'avaluos_app'@'localhost';
