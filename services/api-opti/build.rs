fn main() {
    println!(
        "cargo:rustc-env=GIT_HASH={}",
        option_env!("GITHUB_SHA").unwrap_or("dev")
    );
    println!(
        "cargo:rustc-env=BUILD_TIME={}",
        chrono::Utc::now().to_rfc3339()
    );
}
