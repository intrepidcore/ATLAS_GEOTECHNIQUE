#!/usr/bin/env bash
# install_ml_deps_docker.sh — Installe les dépendances ML dans le container api-geo
# Usage : bash scripts/install_ml_deps_docker.sh
# Prerequis : Docker Desktop + container atlas-api-geo en cours d'exécution
# Contexte  : ARCH-GPU-01 — GPU RTX 2050 accessible via --gpus all (docker-compose.yml)
#
# Ces packages ne sont PAS dans le Dockerfile pour éviter 2GB de téléchargement
# à chaque rebuild. Exécuter ce script une fois après chaque re-création du container.

set -e
CONTAINER=atlas-api-geo

echo "=== Installation des dépendances ML dans $CONTAINER ==="

docker exec $CONTAINER pip3 install --no-cache-dir --break-system-packages \
  pandas==2.0.3 \
  scikit-learn==1.3.2 \
  "tensorflow[and-cuda]>=2.15,<2.16" \
  gpflow==2.10.1

echo ""
echo "=== Vérification ==="
docker exec $CONTAINER python3 -c "
import pandas as pd, sklearn, tensorflow as tf, gpflow
gpus = tf.config.list_physical_devices('GPU')
print('pandas :', pd.__version__)
print('sklearn:', sklearn.__version__)
print('tf     :', tf.__version__, '—', len(gpus), 'GPU(s)')
print('gpflow :', gpflow.__version__)
"

echo ""
echo "=== OK — Dépendances ML installées dans $CONTAINER ==="
echo "Note : ces packages seront perdus au prochain docker compose up (recreation)."
echo "Relancer ce script après chaque recreation du container."
