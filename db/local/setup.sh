#!/bin/sh
#
# Author : Rajveer Sharma
# Date : 17 Nov 2026
# @ Nxtwave
#
# Local development only (docker-compose's db-setup step). Safe to run on every start:
#   1. applies each db/core migration that hasn't run yet (the "-- migrate:up" part),
#      recorded in public.schema_migrations, the same table dbmate uses
#   2. creates or updates the service roles and grants (db/setup/service_roles.sql)
# Connection comes from PGHOST / PGUSER / PGPASSWORD / PGDATABASE.

set -eu

psql -v ON_ERROR_STOP=1 -qc "CREATE TABLE IF NOT EXISTS public.schema_migrations (version varchar(128) PRIMARY KEY)"

for file in /db/core/migrations/*.sql; do
  version=$(basename "$file" | cut -d_ -f1)
  if [ -n "$(psql -tAc "SELECT 1 FROM public.schema_migrations WHERE version = '$version'")" ]; then
    continue
  fi
  echo "applying core migration $version"
  {
    sed -n '/^-- migrate:up/,/^-- migrate:down/p' "$file"
    echo "INSERT INTO public.schema_migrations (version) VALUES ('$version');"
  } | psql -v ON_ERROR_STOP=1 -q --single-transaction
done

psql -v ON_ERROR_STOP=1 -q \
  -v web_pw="$WEB_PW" -v attendance_pw="$ATTENDANCE_PW" -v contest_pw="$CONTEST_PW" \
  -v interactions_pw="$INTERACTIONS_PW" \
  -f /db/setup/service_roles.sql
echo "database ready"
