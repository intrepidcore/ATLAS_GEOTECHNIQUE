# Trouver tous les fichiers MD dans xlsx_convert
Get-ChildItem -Path "data\xlsx_convert" -Recurse -Filter "*.md" | Select-Object FullName
