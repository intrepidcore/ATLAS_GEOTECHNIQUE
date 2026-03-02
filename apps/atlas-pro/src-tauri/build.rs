fn main() {
    // Fail-fast in build/bundle if the embedded Postgres runtime is missing.
    // Option C: runtime is provided as an artifact (zip/copy) before building.
    let skip = std::env::var("ATLAS_SKIP_PG_RUNTIME_CHECK")
        .map(|v| v.trim() == "1" || v.trim().eq_ignore_ascii_case("true"))
        .unwrap_or(false);

    if !skip {
        let pg_ctl = std::path::Path::new("pg").join("bin").join("pg_ctl.exe");
        if !pg_ctl.exists() {
            panic!(
                "Embedded PostgreSQL runtime missing: {}\n\
                Provide it under apps/atlas-pro/src-tauri/pg/ before building (see scripts/fetch-pg-runtime.ps1),\n\
                or set ATLAS_SKIP_PG_RUNTIME_CHECK=1 to bypass (dev only).",
                pg_ctl.display()
            );
        }

        let api_geo = std::path::Path::new("bin").join("api-geo-x86_64-pc-windows-msvc.exe");
        if !api_geo.exists() {
            panic!(
                "api-geo sidecar missing: {}\n\
                Provide it under apps/atlas-pro/src-tauri/bin/ before building (see scripts/fetch-api-geo-artifact.ps1),\n\
                or set ATLAS_SKIP_PG_RUNTIME_CHECK=1 to bypass (dev only).",
                api_geo.display()
            );
        }
    }

    tauri_build::build()
}
