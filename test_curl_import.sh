#!/bin/bash
# Test curl pour valider le contrat backend /api/import/bulk

XLSX_FILE="data/atlas_import_example.xlsx"

echo "=== Test Import XLSX avec curl ==="
echo "Fichier: $XLSX_FILE"
echo ""

curl -v -X POST http://127.0.0.1:8080/api/import/bulk \
  -F "format=xlsx" \
  -F "file=@${XLSX_FILE};type=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" \
  -F 'config={"structure":{"sheets":{"sondages":"sondages","echantillons":"echantillons","atterberg":"atterberg","vbs":"vbs","proctor":"proctor","granulo_tamisage_large":"granulo_tamisage_large","granulo_sedimento_large":"granulo_sedimento_large"},"mapping":{"sondages":{"code":"code_site","localite":"localite","date":"date","lat":"lat","lon":"lon","source":"source"},"echantillons":{"code":"code_site","depth_m":"depth_m","date":"date","laboratory":"laboratory","rho_s_gcm3":"rho_s_gcm3","water_content_w":"water_content_w","is_index":"is_index"},"atterberg":{"code":"code_site","depth_m":"depth_m","wl":"wl","wp":"wp"},"vbs":{"code":"code_site","depth_m":"depth_m","vbs":"vbs","commentaire":"commentaire"},"proctor":{"code":"code_site","depth_m":"depth_m","rho_d_max":"rho_d_max","w_opt":"w_opt"},"granulo_tamisage_large":{"sieve_key":"sieve_mm","series_pattern":"@","value_semantics":"passant_%"},"granulo_sedimento_large":{"sieve_key":"sieve_mm","series_pattern":"@","value_semantics":"passant_%"}}},"options":{"refresh_mv":true}}'

echo ""
echo "=== Fin du test ==="
