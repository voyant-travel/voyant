#!/bin/sh
set -eu

wait_for_database() {
  if [ -z "${DATABASE_URL:-}" ]; then
    return 0
  fi

  timeout_seconds="${VOYANT_DATABASE_WAIT_SECONDS:-30}"
  deadline=$(( $(date +%s) + timeout_seconds ))

  until pg_isready -d "$DATABASE_URL" >/dev/null 2>&1; do
    if [ "$(date +%s)" -ge "$deadline" ]; then
      echo "voyant workflows selfhost: database did not become ready within ${timeout_seconds}s" >&2
      return 1
    fi
    sleep 1
  done
}

run_migrations() {
  if [ -z "${DATABASE_URL:-}" ]; then
    return 0
  fi
  if [ "${VOYANT_SKIP_MIGRATIONS:-0}" = "1" ]; then
    return 0
  fi

  echo "voyant workflows selfhost: applying orchestrator migrations" >&2
  node ./dist/migrate.js
}

validate_entry_file() {
  if [ -z "${VOYANT_ENTRY_FILE:-}" ]; then
    echo "voyant workflows selfhost: VOYANT_ENTRY_FILE is required for the default server command" >&2
    return 1
  fi
  if [ ! -f "${VOYANT_ENTRY_FILE}" ]; then
    echo "voyant workflows selfhost: workflow entry not found at ${VOYANT_ENTRY_FILE}" >&2
    return 1
  fi
}

wait_for_database
run_migrations

if [ "$#" -eq 0 ]; then
  validate_entry_file
  set -- node ./dist/server.js
elif [ "$1" = "node" ] && [ "${2:-}" = "./dist/server.js" ]; then
  validate_entry_file
fi

exec "$@"
