#!/usr/bin/env python3
"""
Télécharge les exports GEE depuis Google Drive vers data/raw/
Utilise l'API Google Drive via les credentials déjà configurés pour GEE.
"""
import os
import io
import json

# Chemins de destination
DEST = {
    "copernicus_dem_togo_10m.tif":          "data/raw/copernicus_dem/copernicus_dem_togo_30m.tif",
    "jrc_gsw_max_extent_togo_30m.tif":      "data/raw/jrc_gsw/jrc_gsw_max_extent_togo_30m.tif",
    "jrc_gsw_occurrence_togo_30m.tif":      "data/raw/jrc_gsw/jrc_gsw_occurrence_togo_30m.tif",
    "sentinel2_clay_index_togo_20m.tif":    "data/raw/sentinel2/sentinel2_clay_index_togo_20m.tif",
    "wdpa_togo_all.geojson":               "data/raw/wdpa/wdpa_togo_all.geojson",
}

for d in ["data/raw/copernicus_dem", "data/raw/jrc_gsw",
          "data/raw/sentinel2", "data/raw/wdpa"]:
    os.makedirs(d, exist_ok=True)

try:
    from google.oauth2 import service_account
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaIoBaseDownload
    import google.auth

    # Utiliser les credentials par défaut (ADC — mêmes que GEE)
    creds, project = google.auth.default(
        scopes=['https://www.googleapis.com/auth/drive.readonly']
    )
    service = build('drive', 'v3', credentials=creds)
    print("Drive API connectée (projet:", project, ")")

    # Lister les fichiers dans le dossier atlas_togo_data
    results = service.files().list(
        q="name in ('{}') or '{}' in parents".format(
            "', '".join(DEST.keys()),
            "atlas_togo_data"
        ),
        fields="files(id, name, size, mimeType)",
        pageSize=50,
    ).execute()

    files = results.get('files', [])
    # Recherche par nom dans tout Drive
    if not files:
        all_files = []
        for fname in DEST.keys():
            r = service.files().list(
                q=f"name='{fname}' and trashed=false",
                fields="files(id, name, size)",
            ).execute()
            all_files.extend(r.get('files', []))
        files = all_files

    print(f"Fichiers trouvés sur Drive : {len(files)}")
    for f in files:
        size_mb = int(f.get('size', 0)) / 1e6
        print(f"  - {f['name']} ({size_mb:.1f} MB) id={f['id']}")

    # Télécharger chaque fichier
    for f in files:
        fname = f['name']
        dest = DEST.get(fname)
        if not dest:
            print(f"  Skip (non dans liste) : {fname}")
            continue

        if os.path.exists(dest):
            print(f"  Déjà présent : {dest}")
            continue

        size_mb = int(f.get('size', 0)) / 1e6
        print(f"  Téléchargement : {fname} ({size_mb:.1f} MB) -> {dest}")

        request = service.files().get_media(fileId=f['id'])
        fh = io.BytesIO()
        downloader = MediaIoBaseDownload(fh, request, chunksize=10*1024*1024)

        done = False
        while not done:
            status, done = downloader.next_chunk()
            if status:
                print(f"    {int(status.progress() * 100)}%", end="\r")

        with open(dest, 'wb') as out:
            out.write(fh.getvalue())
        print(f"    -> Sauvegardé : {dest} ({os.path.getsize(dest)/1e6:.1f} MB)")

    print("\nTéléchargements terminés.")

except ImportError:
    print("google-api-python-client non installé.")
    print("Installer : pip install google-api-python-client google-auth")
    print("\nAlternative manuelle :")
    print("  1. Ouvrir Google Drive")
    print("  2. Aller dans 'atlas_togo_data'")
    print("  3. Télécharger :")
    for fname, dest in DEST.items():
        print(f"     {fname} -> {dest}")

except Exception as e:
    print(f"Erreur Drive API : {e}")
    print("\nTélécharger manuellement depuis Google Drive -> dossier atlas_togo_data :")
    for fname, dest in DEST.items():
        print(f"  {fname} -> {dest}")
