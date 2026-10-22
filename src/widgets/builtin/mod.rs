//! Built-in widget implementations, grouped by data source. Shared readers live
//! here so each group can reach them through `super`.

mod elite;
mod session;
mod system;

pub use elite::*;
pub use session::*;
pub use system::*;

use crate::types::StatusInput;
use std::process::Command;

/// `~/.claude/data`, where the Claude Elite hooks write the state these widgets read.
fn claude_data_dir() -> Option<std::path::PathBuf> {
    Some(dirs::home_dir()?.join(".claude").join("data"))
}

/// Format token count (e.g., 150000 -> "150K")
#[allow(dead_code)]
fn format_tokens(tokens: u64) -> String {
    if tokens >= 1_000_000 {
        format!("{:.1}M", tokens as f64 / 1_000_000.0)
    } else if tokens >= 1_000 {
        format!("{}K", tokens / 1_000)
    } else {
        tokens.to_string()
    }
}

/// Helper: read elite_telemetry_cache.json (shared by several widgets).
fn read_telemetry() -> Option<serde_json::Value> {
    let path = claude_data_dir()?.join("elite_telemetry_cache.json");
    let content = std::fs::read_to_string(&path).ok()?;
    serde_json::from_str(&content).ok()
}

/// Code quality section of the telemetry cache, but only when it was measured.
///
/// eis_daemon refreshes the cache every 60s while ruff/mypy/bandit/pytest run far
/// less often, so the section can be all zeros because nothing ran — which reads
/// as a perfectly clean repo. `measured_at` is the difference between "clean" and
/// "unknown"; without it these cells report a green they cannot support.
fn measured_code_quality(json: &serde_json::Value) -> Option<&serde_json::Value> {
    let cq = json.get("code_quality")?;
    cq.get("measured_at").and_then(|v| v.as_str())?;
    Some(cq)
}

/// Helper: read usage_cache.json once (both quota widgets share it).
fn read_usage_cache() -> Option<serde_json::Value> {
    let path = claude_data_dir()?.join("usage_cache.json");
    let content = std::fs::read_to_string(&path).ok()?;
    serde_json::from_str(&content).ok()
}

/// Format reset countdown adaptively based on remaining time:
///   >24h  → "6d 21h"
///   >1h   → "2h 9m"
///   >10m  → "42m"
///   ≤10m  → "8m 30s"
fn format_reset_ttl(ttr: &serde_json::Value) -> Option<String> {
    let days = ttr.get("days").and_then(|d| d.as_u64()).unwrap_or(0);
    let hours = ttr.get("hours").and_then(|h| h.as_u64()).unwrap_or(0);
    let minutes = ttr.get("minutes").and_then(|m| m.as_u64()).unwrap_or(0);
    let seconds = ttr.get("seconds").and_then(|s| s.as_u64()).unwrap_or(0);

    let total_minutes = days * 24 * 60 + hours * 60 + minutes;

    if total_minutes == 0 && seconds == 0 {
        return None;
    }

    Some(if days > 0 {
        // >24h: days + hours
        format!("{}d {}h", days, hours)
    } else if total_minutes > 60 {
        // >1h: hours + minutes
        format!("{}h {}m", hours, minutes)
    } else if total_minutes > 10 {
        // >10m: just minutes
        format!("{}m", total_minutes)
    } else {
        // ≤10m: minutes + seconds (urgency)
        format!("{}m {}s", minutes, seconds)
    })
}

/// Extract TTL from a quota section in usage_cache.json.
fn quota_ttl(cache: &Option<serde_json::Value>, section: &str) -> Option<String> {
    cache
        .as_ref()
        .and_then(|j| j.get(section))
        .and_then(|f| f.get("time_to_reset"))
        .and_then(format_reset_ttl)
}
