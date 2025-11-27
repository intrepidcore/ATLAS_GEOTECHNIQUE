use argon2::{
    password_hash::{rand_core::OsRng, PasswordHasher, SaltString},
    Argon2, Algorithm, Params, Version,
};

fn main() {
    let password = "Atlas2024!";
    
    let params = Params::new(65536, 3, 4, None).expect("Invalid Argon2 params");
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let salt = SaltString::generate(&mut OsRng);
    
    let hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .expect("Failed to hash password");
    
    println!("Password: {}", password);
    println!("Hash: {}", hash.to_string());
}
