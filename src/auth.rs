/*!
 * auth.rs
 * -------
 * RSA-2048 PKCS#1 v1.5 request signing for the Kalshi trading API.
 * Exposed to Node.js via napi-rs.
 */

use std::time::{SystemTime, UNIX_EPOCH};

use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use rsa::{
    pkcs1::DecodeRsaPrivateKey,
    pkcs1v15::SigningKey,
    sha2::Sha256,
    signature::{RandomizedSigner, SignatureEncoding},
    RsaPrivateKey,
};

/// Build the Authorization header value for a Kalshi REST request.
///
/// # Arguments
/// * `pem`    – RSA private key in PKCS#1 PEM format
/// * `key_id` – Kalshi API key ID (UUID)
/// * `method` – HTTP method, uppercase (e.g. "GET")
/// * `path`   – Request path including query string (e.g. "/trade-api/v2/events")
///
/// # Returns
/// String like: `"timestamp=…, keyId=…, signature=…"`
pub fn build_auth_header(pem: &str, key_id: &str, method: &str, path: &str) -> Result<String, String> {
    let ts_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis()
        .to_string();

    let msg = format!("{}{}{}", ts_ms, method.to_uppercase(), path);

    let priv_key = RsaPrivateKey::from_pkcs1_pem(pem)
        .map_err(|e| format!("PEM parse error: {e}"))?;

    let signing_key = SigningKey::<Sha256>::new(priv_key);
    let mut rng = rand::thread_rng();
    let sig = signing_key
        .sign_with_rng(&mut rng, msg.as_bytes())
        .to_bytes();

    let sig_b64 = B64.encode(&sig);

    Ok(format!(
        "timestamp={ts_ms}, keyId={key_id}, signature={sig_b64}"
    ))
}

/// Return current Unix timestamp in milliseconds (useful for TS layer).
pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

// ── napi-rs bindings ─────────────────────────────────────────────────────────
#[cfg(feature = "napi")]
mod napi_bindings {
    use napi_derive::napi;
    use super::*;

    #[napi]
    pub fn sign_request(pem: String, key_id: String, method: String, path: String) -> String {
        build_auth_header(&pem, &key_id, &method, &path)
            .unwrap_or_else(|e| format!("ERROR:{e}"))
    }

    #[napi]
    pub fn timestamp_ms() -> u32 {
        (now_ms() % u32::MAX as u64) as u32
    }
}
