#!/bin/bash
# Test de l'endpoint thematic/data

echo "🧪 Test de l'API Thématique"
echo "=============================="

# Test 1: IP moyen
echo -e "\n1️⃣  Test IP moyen..."
docker compose exec -T api-geo curl -s "http://localhost:8000/thematic/data?parameter=ip_avg&min_sondages=3" | head -c 200
echo ""

# Test 2: Passant 80um (avec alias)
echo -e "\n2️⃣  Test Passant 80µm (alias)..."
docker compose exec -T api-geo curl -s "http://localhost:8000/thematic/data?parameter=passant_80um_avg&min_sondages=3" | head -c 200
echo ""

# Test 3: VBS
echo -e "\n3️⃣  Test VBS..."
docker compose exec -T api-geo curl -s "http://localhost:8000/thematic/data?parameter=vbs_avg&min_sondages=3" | head -c 200
echo ""

echo -e "\n✅ Tests terminés"
