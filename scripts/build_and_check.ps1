docker compose build api-geo 2>&1 | Select-String -Pattern "error" -Context 3,3
