/*!
 * kalshi-claw-core
 * ================
 * High-performance Kalshi market engine compiled to a native Node.js addon
 * via napi-rs.  Handles RSA auth, orderbook parsing, hedge scoring, and
 * Kelly-criterion position sizing — all at Rust speed.
 *
 * Exposed to TypeScript as:
 *   import { sign, parseOrderbook, findHedges, kellySize } from './kalshi_claw_core'
 */

mod auth;
mod orderbook;
mod hedge;
mod sizing;

pub use auth::*;
pub use orderbook::*;
pub use hedge::*;
pub use sizing::*;
