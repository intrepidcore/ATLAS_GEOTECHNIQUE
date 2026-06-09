#!/bin/bash
# ============================================================
# Atlas Géotechnique Togo — WSL2 CUDA MTGP Setup Script
# ============================================================
# À exécuter DEPUIS WSL2 Ubuntu 22.04 après installation :
#   wsl --install Ubuntu-22.04   (Windows PowerShell en admin)
#   wsl -d Ubuntu-22.04
#   bash /mnt/c/PROJET_ATLAS_MASTER/atlas_reclone/scripts/setup_wsl2_cuda_mtgp.sh
# ============================================================

set -euo pipefail
LOG="/tmp/setup_cuda_atlas.log"
exec > >(tee -a "$LOG") 2>&1

echo "=== Atlas WSL2 CUDA MTGP Setup ==="
echo "Début: $(date)"
echo "Ubuntu: $(lsb_release -d -s)"

# 1. System update
echo "[1/8] System update..."
sudo apt-get update -qq
sudo apt-get install -y wget curl python3.11 python3.11-venv python3-pip build-essential 2>/dev/null

# 2. NVIDIA CUDA Toolkit (WSL2 — ne pas installer le driver, WSL utilise celui de Windows)
echo "[2/8] CUDA Toolkit for WSL2..."
# CUDA 12.x pour RTX 2060 (Turing architecture, CUDA 7.5)
wget -q https://developer.download.nvidia.com/compute/cuda/repos/wsl-ubuntu/x86_64/cuda-keyring_1.1-1_all.deb -O /tmp/cuda-keyring.deb
sudo dpkg -i /tmp/cuda-keyring.deb
sudo apt-get update -qq
sudo apt-get install -y cuda-toolkit-12-3 2>/dev/null || {
    echo "CUDA install failed, trying minimal version..."
    sudo apt-get install -y cuda-minimal-build-12-3 libcudnn8 libcudnn8-dev 2>/dev/null || true
}

# 3. Verify GPU access
echo "[3/8] Verify NVIDIA GPU..."
nvidia-smi || echo "WARNING: nvidia-smi not available — check Windows NVIDIA driver >= 526"

# 4. Python virtualenv
echo "[4/8] Python virtualenv for Atlas MTGP..."
VENV="/opt/atlas_mtgp"
sudo python3.11 -m venv "$VENV"
sudo "$VENV/bin/pip" install --upgrade pip wheel setuptools

# 5. TensorFlow GPU + GPflow
echo "[5/8] TensorFlow GPU + GPflow..."
# TF 2.13 = last version supporting CUDA on Linux properly
sudo "$VENV/bin/pip" install tensorflow[and-cuda]==2.13.0 gpflow==2.9.1 psycopg2-binary numpy scipy scikit-learn pandas

# 6. Verify TF GPU
echo "[6/8] Verify TensorFlow GPU..."
"$VENV/bin/python" -c "
import tensorflow as tf
print('TF version:', tf.__version__)
gpus = tf.config.list_physical_devices('GPU')
print('GPUs:', gpus)
if gpus:
    print('SUCCESS: GPU available for MTGP!')
    # Enable memory growth
    for gpu in gpus:
        tf.config.experimental.set_memory_growth(gpu, True)
else:
    print('WARNING: No GPU detected. Will run on CPU.')
    print('Check: nvidia-smi in WSL2, Windows driver >= 526')
"

# 7. Test GPflow
echo "[7/8] Test GPflow..."
"$VENV/bin/python" -c "
import gpflow
print('GPflow version:', gpflow.__version__)
import numpy as np
X = np.random.randn(10, 2)
Y = np.random.randn(10, 1)
k = gpflow.kernels.SquaredExponential()
m = gpflow.models.GPR((X, Y), kernel=k)
print('GPflow model OK:', m)
print('MTGP environment ready!')
"

# 8. Create WSL2 MTGP worker script
echo "[8/8] Creating WSL2 MTGP worker..."
cat > /tmp/run_mtgp_wsl2.sh << 'WORKER_EOF'
#!/bin/bash
VENV="/opt/atlas_mtgp"
DB="postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean"
SCRIPTS="/mnt/c/PROJET_ATLAS_MASTER/atlas_reclone/scripts"
export PYTHONUTF8=1
export TF_ENABLE_ONEDNN_OPTS=0
export TF_CPP_MIN_LOG_LEVEL=2

cd /mnt/c/PROJET_ATLAS_MASTER/atlas_reclone

echo "=== WSL2 MTGP Worker (GPU) ==="
echo "Python: $("$VENV/bin/python" --version)"
echo "TF GPUs: $("$VENV/bin/python" -c "import tensorflow as tf; print(tf.config.list_physical_devices('GPU'))")"

# Process MTGP jobs from queue
"$VENV/bin/python" "$SCRIPTS/pipeline_worker.py" \
    --database-url "$DB" \
    --interval 15 \
    --once
WORKER_EOF

sudo cp /tmp/run_mtgp_wsl2.sh /usr/local/bin/atlas_mtgp_worker.sh
sudo chmod +x /usr/local/bin/atlas_mtgp_worker.sh
echo "WSL2 worker installed at /usr/local/bin/atlas_mtgp_worker.sh"

echo ""
echo "=== SETUP COMPLETE ==="
echo "Fin: $(date)"
echo ""
echo "Pour lancer les jobs MTGP depuis WSL2:"
echo "  /usr/local/bin/atlas_mtgp_worker.sh"
echo ""
echo "NOTE: Assurez-vous que le pipeline_worker.py sur Windows"
echo "est arrêté AVANT de lancer le worker WSL2 pour les jobs MTGP."
echo "Log: $LOG"
