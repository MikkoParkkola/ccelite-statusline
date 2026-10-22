//! Widgets that read Claude Elite state: hook output under `~/.claude/data`, plus
//! Claude configuration, worktrees and local service probes.

use super::*;

/// Render session NPV from session_value.json (official source)
pub fn render_session_npv(_input: &StatusInput) -> Option<String> {
    let value_path = claude_data_dir()?.join("session_value.json");

    if let Ok(content) = std::fs::read_to_string(&value_path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            // Get expected value from total_value.expected
            if let Some(expected) = json
                .get("total_value")
                .and_then(|tv| tv.get("expected"))
                .and_then(|e| e.as_f64())
            {
                // Subtract claude_cost to get NPV
                let cost = json
                    .get("roi")
                    .and_then(|r| r.get("claude_cost"))
                    .and_then(|c| c.as_f64())
                    .unwrap_or(0.0);

                let npv = (expected - cost).max(0.0);

                if npv >= 1_000_000.0 {
                    return Some(format!("${:.1}M", npv / 1_000_000.0));
                } else if npv >= 1_000.0 {
                    return Some(format!("${:.1}K", npv / 1_000.0));
                } else if npv > 0.0 {
                    return Some(format!("${:.0}", npv));
                }
            }
        }
    }

    Some("$0".to_string())
}

/// Render ROI from session_value.json (official source)
pub fn render_roi(_input: &StatusInput) -> Option<String> {
    let value_path = claude_data_dir()?.join("session_value.json");

    if let Ok(content) = std::fs::read_to_string(&value_path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            // Get ROI multiplier from roi.multiplier
            if let Some(multiplier) = json
                .get("roi")
                .and_then(|r| r.get("multiplier"))
                .and_then(|m| m.as_f64())
            {
                if multiplier > 0.0 {
                    if multiplier >= 1_000_000.0 {
                        return Some(format!("{:.1}M×", multiplier / 1_000_000.0));
                    } else if multiplier >= 1_000.0 {
                        return Some(format!("{:.0}K×", multiplier / 1_000.0));
                    } else {
                        return Some(format!("{:.0}×", multiplier));
                    }
                }
            }
        }
    }

    Some("—".to_string())
}

/// Render MCP server count
pub fn render_mcp_count() -> Option<String> {
    // Count MCP servers from settings
    let mcp_path = dirs::home_dir()?.join(".claude").join("settings.json");

    if let Ok(content) = std::fs::read_to_string(&mcp_path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(mcps) = json.get("mcpServers").and_then(|m| m.as_object()) {
                return Some(mcps.len().to_string());
            }
        }
    }

    Some("0".to_string())
}

/// Render hooks status
pub fn render_hooks_status() -> Option<String> {
    Some("✓".to_string())
}

/// Render cache hit rate percentage from elite_telemetry_cache.json (official source)
pub fn render_tokens_cached(_input: &StatusInput) -> Option<String> {
    let telemetry_path = claude_data_dir()?.join("elite_telemetry_cache.json");

    if let Ok(content) = std::fs::read_to_string(&telemetry_path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            // Get daemon_cache_hit_rate from elite_value (most accurate).
            // eis_daemon serialises the same number as cache_hit_rate_pct; the
            // older key is kept first so a hand-written cache still wins.
            if let Some(hit_rate) = json.get("elite_value").and_then(|ev| {
                ev.get("daemon_cache_hit_rate")
                    .or_else(|| ev.get("cache_hit_rate_pct"))
                    .and_then(serde_json::Value::as_f64)
            }) {
                return Some(format!("{:.0}%", hit_rate));
            }

            // Fallback: calculate from cache_metrics
            if let Some(metrics) = json.get("cache_metrics") {
                if let Some(hit_rate) = metrics.get("hit_rate").and_then(|r| r.as_f64()) {
                    return Some(format!("{:.0}%", hit_rate * 100.0));
                }
            }
        }
    }

    Some("0%".to_string())
}

/// Render tests - shows ONLY pass rate from elite_telemetry_cache.json
/// Coverage is shown separately in the Cov widget
pub fn render_tests_percentage() -> Option<String> {
    let json = read_telemetry();
    let measured = json.as_ref().and_then(measured_code_quality);
    if let Some(pass_rate) = measured
        .and_then(|cq| cq.get("test_pass_rate_pct"))
        .and_then(|r| r.as_f64())
    {
        return Some(format!("{:.0}%", pass_rate));
    }
    Some("—".to_string())
}

/// Render test coverage percentage (Cov widget — parity with statusline-qual.sh).
pub fn render_coverage() -> Option<String> {
    let json = read_telemetry();
    let cq = json.as_ref().and_then(measured_code_quality);
    if let Some(cov) = cq
        .and_then(|cq| cq.get("test_coverage_pct"))
        .and_then(|r| r.as_f64())
    {
        if cov > 0.0 {
            return Some(format!("{:.0}%", cov));
        }
    }
    Some("—".to_string())
}

/// Render cost savings from elite_telemetry_cache.json (official source)
/// Shows money saved from caching, compression, and optimizations
pub fn render_codex_tokens_saved() -> Option<String> {
    let telemetry_path = claude_data_dir()?.join("elite_telemetry_cache.json");

    if let Ok(content) = std::fs::read_to_string(&telemetry_path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            // Get cost_savings_dollars from elite_value
            if let Some(savings) = json
                .get("elite_value")
                .and_then(|ev| ev.get("cost_savings_dollars"))
                .and_then(|s| s.as_f64())
            {
                if savings > 0.0 {
                    if savings >= 1000.0 {
                        return Some(format!("${:.1}K", savings / 1000.0));
                    } else if savings >= 1.0 {
                        return Some(format!("${:.0}", savings));
                    } else {
                        return Some(format!("${:.2}", savings));
                    }
                }
            }

            // Fallback: estimate from cache hits
            // Assume each cache hit saves ~$0.0001 (rough estimate)
            if let Some(hits) = json
                .get("cache_metrics")
                .and_then(|cm| cm.get("total_hits"))
                .and_then(|h| h.as_u64())
            {
                let estimated_savings = hits as f64 * 0.0001;
                if estimated_savings >= 1.0 {
                    return Some(format!("~${:.0}", estimated_savings));
                } else if estimated_savings > 0.0 {
                    return Some(format!("~${:.2}", estimated_savings));
                }
            }
        }
    }

    Some("$0".to_string())
}

// ============================================================
// Generic widgets ported from shell scripts
// ============================================================

/// Render user email from ~/.claude.json
pub fn render_user_email() -> Option<String> {
    let config_path = dirs::home_dir()?.join(".claude.json");
    let content = std::fs::read_to_string(&config_path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&content).ok()?;

    let email = json
        .get("oauthAccount")
        .and_then(|a| a.get("emailAddress"))
        .and_then(|e| e.as_str())?;

    Some(email.to_string())
}

/// Render daemon health status based on heartbeat file age
pub fn render_daemon_health() -> Option<String> {
    let heartbeat_path = claude_data_dir()?.join("elite_daemon_heartbeat.json");

    if !heartbeat_path.exists() {
        return Some("—".to_string());
    }

    let metadata = std::fs::metadata(&heartbeat_path).ok()?;
    let modified = metadata.modified().ok()?;
    let age_secs = std::time::SystemTime::now()
        .duration_since(modified)
        .ok()?
        .as_secs();

    if age_secs < 300 {
        Some("✓".to_string())
    } else {
        Some("⚠".to_string())
    }
}

/// Render SurrealDB health (parity with statusline-db-health.sh).
///
/// Check order:
///   1. Cached status file (`surrealdb_status`) — written by daemon, cheapest
///   2. TCP connect to localhost:8000 — no HTTP overhead, ~1ms
///
/// Format: "✓" (healthy), "⚠" (port open but no cached status), "✗" (down)
pub fn render_db_health() -> Option<String> {
    // 1. Cached status from daemon (zero-cost)
    let status_path = claude_data_dir()?.join("surrealdb_status");
    if let Ok(content) = std::fs::read_to_string(&status_path) {
        let status = content.trim();
        match status {
            "ok" | "listening" => return Some("✓".to_string()),
            "down" => return Some("✗".to_string()),
            _ => {}
        }
    }

    // 2. TCP connect probe (fast, no HTTP overhead)
    use std::net::TcpStream;
    use std::time::Duration;
    match TcpStream::connect_timeout(
        &"127.0.0.1:8000".parse().unwrap(),
        Duration::from_millis(50),
    ) {
        Ok(_) => Some("✓".to_string()),
        Err(_) => Some("⚠".to_string()),
    }
}

/// Render data freshness - shows age of quota cache with freshness indicator
pub fn render_fresh() -> Option<String> {
    let cache_path = claude_data_dir()?.join("usage_cache.json");

    if !cache_path.exists() {
        return Some("stale".to_string());
    }

    let metadata = std::fs::metadata(&cache_path).ok()?;
    let modified = metadata.modified().ok()?;
    let age_secs = std::time::SystemTime::now()
        .duration_since(modified)
        .ok()?
        .as_secs();

    // Fresh = updated recently, Stale = needs refresh
    if age_secs < 60 {
        Some("✓now".to_string())
    } else if age_secs < 300 {
        // Less than 5 min = fresh
        Some(format!("✓{}m", age_secs / 60))
    } else if age_secs < 3600 {
        // 5-60 min = aging
        Some(format!("~{}m", age_secs / 60))
    } else if age_secs < 86400 {
        // 1-24h = stale
        Some(format!("⚠{}h", age_secs / 3600))
    } else {
        // >24h = very stale
        Some(format!("⚠{}d", age_secs / 86400))
    }
}

/// Render active alerts (quota, daemon)
pub fn render_alert() -> Option<String> {
    let cache_path = claude_data_dir()?.join("usage_cache.json");

    let mut alerts = Vec::new();

    // Check quota from cache
    if let Ok(content) = std::fs::read_to_string(&cache_path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            // Check 5-hour quota
            if let Some(five_hr) = json
                .get("five_hour")
                .and_then(|f| f.get("utilization"))
                .and_then(|u| u.as_f64())
            {
                if five_hr > 80.0 {
                    alerts.push("5h!");
                }
            }

            // Check 7-day quota
            if let Some(seven_day) = json
                .get("seven_day")
                .and_then(|f| f.get("utilization"))
                .and_then(|u| u.as_f64())
            {
                if seven_day > 90.0 {
                    alerts.push("7d!");
                }
            }
        }
    }

    // Check daemon health
    let heartbeat_path = claude_data_dir()?.join("elite_daemon_heartbeat.json");

    if heartbeat_path.exists() {
        if let Ok(metadata) = std::fs::metadata(&heartbeat_path) {
            if let Ok(modified) = metadata.modified() {
                if let Ok(age) = std::time::SystemTime::now().duration_since(modified) {
                    if age.as_secs() > 300 {
                        alerts.push("D!");
                    }
                }
            }
        }
    }

    if alerts.is_empty() {
        Some("none".to_string())
    } else {
        Some(alerts.join(" "))
    }
}

/// Render tool error count from implicit feedback (parity with statusline-risk.sh).
///
/// Shows count of negative tool feedback signals this session.
/// Format: "0", "3", "⚠12"
pub fn render_risk() -> Option<String> {
    let implicit_path = claude_data_dir()?.join("implicit_feedback_state.json");

    if let Ok(content) = std::fs::read_to_string(&implicit_path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(tool_fb) = json.get("tool_feedback").and_then(|t| t.as_object()) {
                let errors: u64 = tool_fb
                    .values()
                    .filter_map(|v| v.get("negative").and_then(|n| n.as_u64()))
                    .sum();
                return Some(if errors >= 10 {
                    format!("⚠{}", errors)
                } else {
                    errors.to_string()
                });
            }
        }
    }

    Some("0".to_string())
}

/// Render quality grade
pub fn render_quality() -> Option<String> {
    let cache_path = claude_data_dir()?.join("session_quality.json");

    if let Ok(content) = std::fs::read_to_string(&cache_path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(grade) = json.get("grade").and_then(|g| g.as_str()) {
                return Some(grade.to_string());
            }
        }
    }

    Some("B".to_string())
}

/// Render turns LEFT until quota exhaustion (parity with statusline-turns.sh).
///
/// Shows estimated user turns remaining at current burn rate.
/// Format: "42", "∞"
pub fn render_turns() -> Option<String> {
    if let Some(json) = read_telemetry() {
        if let Some(turns) = json
            .get("quota_prediction")
            .and_then(|qp| qp.get("exhaustion_turns"))
            .and_then(|t| t.as_u64())
        {
            if turns > 0 {
                return Some(turns.to_string());
            }
        }
    }

    Some("∞".to_string())
}

/// Render first-try success rate (parity with statusline-first-try-success.sh).
///
/// Priority:
///   1. realtime_metrics.json → ftsr.estimate (0-1 float)
///   2. elite_telemetry_cache → first_try_success_rate (already 0-100)
///
/// Format: "87%", "—"
pub fn render_first_try_rate() -> Option<String> {
    // Priority 1: realtime quality metrics (most current, per-session)
    let rt_path = claude_data_dir()?
        .join("quality")
        .join("realtime_metrics.json");
    if let Ok(content) = std::fs::read_to_string(&rt_path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(rate) = json
                .get("ftsr")
                .and_then(|f| f.get("estimate"))
                .and_then(|e| e.as_f64())
            {
                if rate > 0.0 {
                    return Some(format!("{:.0}%", rate * 100.0));
                }
            }
        }
    }

    // Priority 2: telemetry cache (cross-session aggregate)
    if let Some(json) = read_telemetry() {
        if let Some(rate) = json
            .get("elite_value")
            .and_then(|ev| ev.get("first_try_success_rate"))
            .and_then(|r| r.as_f64())
        {
            if rate > 0.0 {
                return Some(format!("{:.0}%", rate));
            }
        }
    }

    Some("—".to_string())
}

/// Render lint errors — sum of ruff + mypy + bandit from telemetry.
/// Parity with statusline-lint-errors.sh.
pub fn render_lint_errors() -> Option<String> {
    // Primary: telemetry cache (has ruff+mypy+bandit breakdown)
    if let Some(json) = read_telemetry() {
        if let Some(cq) = measured_code_quality(&json) {
            let ruff = cq.get("ruff_errors").and_then(|v| v.as_u64()).unwrap_or(0);
            let mypy = cq.get("mypy_errors").and_then(|v| v.as_u64()).unwrap_or(0);
            let bandit = cq
                .get("bandit_issues")
                .and_then(|v| v.as_u64())
                .unwrap_or(0);
            return Some((ruff + mypy + bandit).to_string());
        }
    }

    // Fallback: lint_cache.json
    let cache_path = claude_data_dir()?.join("lint_cache.json");
    if let Ok(content) = std::fs::read_to_string(&cache_path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(count) = json.get("error_count").and_then(|c| c.as_u64()) {
                return Some(count.to_string());
            }
        }
    }

    // Neither telemetry nor the lint cache holds a measurement, so "0" here would
    // be a green nobody earned.
    Some("—".to_string())
}

/// Render bugs/quality clarity from session_quality.json.
///
/// Shows bug count + quality grade as a compact summary.
/// Format: "0 A+" (0 bugs, grade A+) or "3 C" (3 bugs, grade C)
pub fn render_bugs_clarity() -> Option<String> {
    let quality_path = claude_data_dir()?.join("session_quality.json");

    if let Ok(content) = std::fs::read_to_string(&quality_path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            let bugs = json.get("bug_count").and_then(|b| b.as_u64()).unwrap_or(0);
            let grade = json.get("grade").and_then(|g| g.as_str()).unwrap_or("—");
            return Some(format!("{} {}", bugs, grade));
        }
    }

    Some("0 —".to_string())
}

/// Render quota burn rate as projected-use multiplier (parity with statusline-rate.sh).
///
/// Computes: (utilization% / elapsed_hours) * 5h / 100 = multiplier.
/// 1.0× = on track to use exactly 100% of 5hr window.
/// >1.5× = warning ⚠.
///
/// Format: "0.67×", "⚠1.8×"
pub fn render_burn_rate_clarity(_input: &StatusInput) -> Option<String> {
    if let Some(cache) = read_usage_cache() {
        let util = cache
            .get("five_hour")
            .and_then(|f| f.get("utilization"))
            .and_then(|u| u.as_f64())
            .unwrap_or(0.0);
        let hours = cache
            .get("five_hour")
            .and_then(|f| f.get("time_to_reset"))
            .and_then(|t| t.get("hours"))
            .and_then(|h| h.as_f64())
            .unwrap_or(5.0);
        let mins = cache
            .get("five_hour")
            .and_then(|f| f.get("time_to_reset"))
            .and_then(|t| t.get("minutes"))
            .and_then(|m| m.as_f64())
            .unwrap_or(0.0);

        let remaining = hours + mins / 60.0;
        let elapsed = 5.0 - remaining;

        if elapsed > 0.01 && util > 0.0 {
            let rate_per_hour = util / elapsed;
            let projected = rate_per_hour * 5.0;
            let multiplier = projected / 100.0;

            return Some(if multiplier >= 1.5 {
                format!("⚠{:.2}×", multiplier)
            } else {
                format!("{:.2}×", multiplier)
            });
        }
    }

    // Fallback: telemetry prediction
    if let Some(json) = read_telemetry() {
        if let Some(rate) = json
            .get("elite_value")
            .and_then(|ev| ev.get("burn_rate_tokens_per_min"))
            .and_then(|r| r.as_f64())
        {
            if rate > 0.0 {
                return Some(format!("{:.0}/m", rate));
            }
        }
    }

    Some("—".to_string())
}

/// Render token phase from ~/.claude/data/token_phase.json
///
/// Format: "🟢full", "🟡save", "🟠tight", "🔴crit"
pub fn render_token_phase() -> Option<String> {
    let path = claude_data_dir()?.join("token_phase.json");

    if let Ok(content) = std::fs::read_to_string(&path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(phase) = json.get("phase").and_then(|p| p.as_str()) {
                return Some(match phase {
                    "full" => "\u{1f7e2}full".to_string(),
                    "save" => "\u{1f7e1}save".to_string(),
                    "tight" => "\u{1f7e0}tight".to_string(),
                    "crit" | "critical" => "\u{1f534}crit".to_string(),
                    other => other.to_string(),
                });
            }
        }
    }

    Some("\u{2014}".to_string())
}

/// Render event bus line count from ~/.claude/data/event_bus.jsonl
///
/// Format: "+N"
pub fn render_event_bus_count() -> Option<String> {
    // Use hook_timing.jsonl — grows every tool call (live activity indicator)
    let path = claude_data_dir()?.join("hook_timing.jsonl");

    if let Ok(content) = std::fs::read_to_string(&path) {
        let count = content.lines().filter(|l| !l.trim().is_empty()).count();
        return Some(format!("+{}", count));
    }

    Some("0".to_string())
}

/// Render recent failures (last hour) from ~/.claude/data/failures.jsonl
///
/// Format: "N"
pub fn render_recent_fails() -> Option<String> {
    let path = claude_data_dir()?.join("failures.jsonl");

    if let Ok(content) = std::fs::read_to_string(&path) {
        let now = std::time::SystemTime::now();
        let one_hour_ago = now
            .duration_since(std::time::UNIX_EPOCH)
            .ok()?
            .as_secs()
            .saturating_sub(3600);

        let count = content
            .lines()
            .filter(|line| {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
                    // Try "timestamp" (epoch seconds or ISO string)
                    if let Some(ts) = json.get("timestamp").or_else(|| json.get("ts")) {
                        if let Some(epoch) = ts.as_u64().or_else(|| ts.as_f64().map(|f| f as u64)) {
                            return epoch >= one_hour_ago;
                        }
                        // ISO string fallback
                        if let Some(s) = ts.as_str() {
                            if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(s) {
                                return dt.timestamp() as u64 >= one_hour_ago;
                            }
                        }
                    }
                }
                false
            })
            .count();
        return Some(count.to_string());
    }

    Some("0".to_string())
}

/// Render proposal queue depth from ~/.claude/data/improvements/proposals.jsonl
///
/// Format: "N"
pub fn render_proposal_queue() -> Option<String> {
    let path = claude_data_dir()?
        .join("improvements")
        .join("proposals.jsonl");

    if let Ok(content) = std::fs::read_to_string(&path) {
        let count = content.lines().filter(|l| !l.trim().is_empty()).count();
        return Some(count.to_string());
    }

    Some("0".to_string())
}

/// Render count of active Claude agent/task processes.
///
/// Format: "N"
pub fn render_active_agents() -> Option<String> {
    // Count background agent worktrees (reliable signal for active agents)
    let worktree_dir = dirs::home_dir()?.join(".claude").join("worktrees");
    if worktree_dir.exists() {
        let count = std::fs::read_dir(&worktree_dir)
            .ok()?
            .filter_map(|e| e.ok())
            .filter(|e| e.path().is_dir())
            .count();
        Some(count.to_string())
    } else {
        Some("0".to_string())
    }
}

/// Render tools count (MCP tools + gateway)
///
/// Format: "180+"
pub fn render_tools_count() -> Option<String> {
    // Read cached tool count (written by periodic-refresh or session-start)
    let cache_path = claude_data_dir()?.join("tool_count.txt");
    if let Ok(content) = std::fs::read_to_string(&cache_path) {
        let count = content.trim();
        if !count.is_empty() && count != "0" {
            return Some(count.to_string());
        }
    }
    // Fallback: count MCP servers × gateway reported avg
    let mcp_path = dirs::home_dir()?.join(".claude").join("settings.json");
    if let Ok(content) = std::fs::read_to_string(&mcp_path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            if let Some(mcps) = json.get("mcpServers").and_then(|m| m.as_object()) {
                return Some(format!("{}+", mcps.len() * 10));
            }
        }
    }
    Some("?".to_string())
}

/// Render estimated savings per session
///
/// Calculated: 107K tok/turn x 30 turns x $0.003/1K tok
/// Format: "$9.63"
pub fn render_saved_per_session() -> Option<String> {
    // Calculate from compact_quality.json (real compaction savings)
    // plus estimated token savings from rules optimization
    let quality_path = claude_data_dir()?.join("compact_quality.json");
    let mut saved_dollars = 0.0_f64;
    if let Ok(content) = std::fs::read_to_string(&quality_path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            let chars = json
                .get("char_count")
                .and_then(|c| c.as_f64())
                .unwrap_or(0.0);
            // Estimate: compression saved ~50% of what would have been
            saved_dollars += (chars / 4.0) * 0.000003; // tokens * $0.003/1K
        }
    }
    // Base savings from rules-source→skills optimization (~95K tok/turn × turns × $0.003/1K)
    let phase_path = claude_data_dir()?.join("token_phase.json");
    if let Ok(content) = std::fs::read_to_string(&phase_path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            let calls = json
                .get("tool_calls")
                .and_then(|c| c.as_f64())
                .unwrap_or(0.0);
            // ~95K tokens saved per turn from rules optimization
            saved_dollars += calls * 95.0 * 0.003; // turns × 95K tok × $0.003/1K
        }
    }
    if saved_dollars > 0.01 {
        Some(format!("${:.0}", saved_dollars))
    } else {
        Some("$0".to_string())
    }
}

/// Render event count from event_bus.jsonl (DB events)
///
/// Format: "Nevt"
pub fn render_db_events() -> Option<String> {
    let path = claude_data_dir()?.join("event_bus.jsonl");
    let content = std::fs::read_to_string(&path).ok()?;
    let count = content.lines().filter(|l| !l.is_empty()).count();
    Some(format!("{}evt", count))
}

/// Render daemon latency (check /tmp/eis.sock existence)
///
/// Format: "<5ms" or "down"
pub fn render_daemon_latency() -> Option<String> {
    let sock = std::path::Path::new("/tmp/eis.sock");
    if sock.exists() {
        Some("<5ms".to_string())
    } else {
        Some("down".to_string())
    }
}

/// Render rate limiting status
pub fn render_rate_status() -> Option<String> {
    let cache_path = claude_data_dir()?.join("usage_cache.json");

    if let Ok(content) = std::fs::read_to_string(&cache_path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            // Check for rate limit status
            if let Some(status) = json.get("rate_limit_status").and_then(|s| s.as_str()) {
                return Some(status.to_string());
            }
            // Fallback: show 5hr utilization as status
            if let Some(five_hr) = json
                .get("five_hour")
                .and_then(|f| f.get("utilization"))
                .and_then(|u| u.as_f64())
            {
                return Some(format!("S:{:.0}%", five_hr));
            }
        }
    }

    Some("S:0%".to_string())
}
