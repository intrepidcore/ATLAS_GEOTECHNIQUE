FROM postgis/postgis:16-3.4

# Install PostGIS raster tools and GDAL utilities
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    postgis \
    postgresql-16-postgis-3 \
    postgresql-16-postgis-3-scripts \
    gdal-bin \
    && rm -rf /var/lib/apt/lists/*

# Verify raster2pgsql is available
RUN which raster2pgsql || echo "Warning: raster2pgsql not found"
