#!/bin/sh
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
SELECT 'CREATE DATABASE koho_volim_test'
WHERE NOT EXISTS (
  SELECT FROM pg_database WHERE datname = 'koho_volim_test'
)\gexec
SQL
