#!/bin/bash
set -euo pipefail

DUMP_FILE="${1:-}"

if [ -z "${DUMP_FILE}" ]; then
  echo "Usage: $0 <dump_file>" >&2
  exit 1
fi

if [ ! -f "${DUMP_FILE}" ]; then
  echo "ERREUR: dump introuvable: ${DUMP_FILE}" >&2
  exit 1
fi

MANIFEST_FILE="${DUMP_FILE}.json"
if [ ! -f "${MANIFEST_FILE}" ]; then
  echo "ERREUR: manifest introuvable: ${MANIFEST_FILE}" >&2
  exit 1
fi

python3 - <<'PY'
import hashlib, json, os, sys

dump_file = sys.argv[1]
manifest_file = sys.argv[2]

with open(manifest_file, 'r', encoding='utf-8') as f:
    m = json.load(f)

size = os.path.getsize(dump_file)
if int(m.get('size_bytes', -1)) != int(size):
    raise SystemExit(f"SIZE_MISMATCH: expected={m.get('size_bytes')} actual={size}")

h = hashlib.sha256()
with open(dump_file, 'rb') as f:
    for chunk in iter(lambda: f.read(1024*1024), b''):
        h.update(chunk)
sha = h.hexdigest()

if sha != m.get('sha256'):
    raise SystemExit(f"SHA256_MISMATCH: expected={m.get('sha256')} actual={sha}")

print('OK: sha256/size')
PY
"${DUMP_FILE}" "${MANIFEST_FILE}"

pg_restore -l "${DUMP_FILE}" >/dev/null

echo "OK: pg_restore -l"
