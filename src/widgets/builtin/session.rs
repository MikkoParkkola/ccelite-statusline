//! Widgets driven mainly by the session input Claude Code passes on stdin; a few
//! enrich or fall back to Claude Elite files under `~/.claude/data`.

use super::*;

/// Render model name
pub fn render_model(input: &StatusInput) -> Option<String> {
    let model = input.model.as_ref()?;

    // Try display_name first, then id
    let name = model.display_name.as_ref().or(model.id.as_ref())?;

    // Shorten common model names — extract version from ID
    let short = if name.contains("opus") {
        if name.contains("4-5") || name.contains("4.5") {
            "Opus 4.5"
        } else {
            "Opus 4.6"
        }
    } else if name.contains("sonnet") {
        if name.contains("4-5") || name.contains("4.5") {
            "Sonnet 4.5"
        } else {
            "Sonnet 4.6"
        }
    } else if name.contains("haiku") {
        "Haiku"
    } else {
        name.as_str()
    };

    Some(short.to_string())
}

/// Render context percentage (used/limit)
pub fn render_context_percentage(input: &StatusInput) -> Option<String> {
    // Priority 1: Live context_window from Claude Code
    if let Some(cw) = input.context_window.as_ref()
        && let Some(used_pct) = cw.used_percentage
    {
        return Some(format!("{:.0}%", used_pct));
    }

    // Priority 2: Raw token counts
    let ctx = match input.context.as_ref() {
        Some(c) => c,
        None => return Some("—".to_string()),
    };
    let used = ctx.tokens_used.unwrap_or(0);
    let limit = ctx.token_limit.unwrap_or(200000);

    if limit == 0 {
        return Some("0%".to_string());
    }

    let pct = (used as f64 / limit as f64 * 100.0) as u32;
    Some(format!("{}%", pct))
}

/// Render usable context percentage (80% of limit is usable, 100% triggers compact)
pub fn render_context_percentage_usable(input: &StatusInput) -> Option<String> {
    // Priority 1: Live context_window percentages from Claude Code (accurate, session-aware)
    if let Some(cw) = input.context_window.as_ref() {
        if let Some(used_pct) = cw.used_percentage {
            let pct = used_pct.round() as u32;
            let remaining = 100u32.saturating_sub(pct);
            // Show remaining% (how much is left before compact)
            return Some(format!("{}%↓", remaining));
        }
        if let Some(rem_pct) = cw.remaining_percentage {
            let remaining = rem_pct.round() as u32;
            return Some(format!("{}%↓", remaining));
        }
    }

    // Priority 2: Raw token counts from input JSON
    if let Some(ctx) = input.context.as_ref() {
        let used = ctx.tokens_used.unwrap_or(0);
        let limit = ctx.token_limit.unwrap_or(200000);

        // 80% of limit is usable before compact triggers
        let usable_limit = (limit as f64 * 0.8) as u64;

        if usable_limit > 0 && used > 0 {
            let pct = (used as f64 / usable_limit as f64 * 100.0).min(100.0) as u32;
            return Some(format!("{}%", pct));
        }
    }

    // No live data available
    Some("—".to_string())
}

/// Render session cost (basic - from CC input only)
pub fn render_session_cost(input: &StatusInput) -> Option<String> {
    let cost = input.cost.as_ref()?.total_cost_usd?;
    Some(format!("${:.2}", cost))
}

/// Render session cost with cache hit rate (elite).
///
/// Priority:
///   1. Live `cost.total_cost_usd` from CC's piped JSON (always current, zero lag)
///   2. `session_cost.json` file cache (written by pre-tool-metrics hook, may be stale)
///
/// Format: "$0.34" from live data, or "$0.34 (42% cache)" when file cache has richer data.
pub fn render_session_cost_elite(input: &StatusInput) -> Option<String> {
    // Priority 1: live cost field is authoritative for the dollar amount
    let live_cost = input.cost.as_ref().and_then(|c| c.total_cost_usd);

    // Priority 2: file cache may carry cache_hit_pct not in the live payload
    let cache_path = claude_data_dir()?.join("session_cost.json");

    if let Ok(content) = std::fs::read_to_string(&cache_path)
        && let Ok(json) = serde_json::from_str::<serde_json::Value>(&content)
    {
        let file_cost = json.get("cost_usd").and_then(|c| c.as_f64()).unwrap_or(0.0);
        let cache_hit_pct = json
            .get("cache_hit_pct")
            .and_then(|c| c.as_f64())
            .unwrap_or(0.0);

        // Use live cost when available (more accurate), fall back to file cost
        let cost_usd = live_cost.unwrap_or(file_cost);

        if cost_usd > 0.0 {
            if cache_hit_pct > 0.0 {
                return Some(format!("${:.2} ({:.0}% cache)", cost_usd, cache_hit_pct));
            } else {
                return Some(format!("${:.2}", cost_usd));
            }
        }
    }

    // Fallback: live cost with no file cache annotation
    live_cost.map(|c| format!("${:.2}", c))
}

/// Render session clock (duration)
pub fn render_session_clock(input: &StatusInput) -> Option<String> {
    let duration_ms = input
        .cost
        .as_ref()
        .and_then(|c| c.total_duration_ms)
        .or_else(|| input.session.as_ref().and_then(|s| s.duration_ms))
        .unwrap_or(0);

    let seconds = duration_ms / 1000;
    let minutes = seconds / 60;
    let hours = minutes / 60;

    if hours > 0 {
        Some(format!("{}h{}m", hours, minutes % 60))
    } else if minutes > 0 {
        Some(format!("{}m", minutes))
    } else {
        Some(format!("{}s", seconds))
    }
}

/// Render project name from workspace
pub fn render_project_name(input: &StatusInput) -> Option<String> {
    let dir = input.workspace.as_ref()?.current_dir.as_ref()?;

    // Get last component of path
    let name = std::path::Path::new(dir)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| dir.clone());

    // Width is a layout concern: render.rs applies the cell's maxWidth. Clipping
    // here fought the config and sliced by byte, which panics mid-codepoint.
    Some(name)
}

/// Render 5-hour quota utilization with adaptive reset countdown.
///
/// Format: "35% · 2h 9m", "80% · 8m 30s", "35%"
pub fn render_session_quota(input: &StatusInput) -> Option<String> {
    let cache = read_usage_cache();

    let util = input
        .usage
        .as_ref()
        .and_then(|u| u.five_hour_utilization)
        .or_else(|| {
            cache
                .as_ref()
                .and_then(|j| j.get("five_hour"))
                .and_then(|f| f.get("utilization"))
                .and_then(|u| u.as_f64())
        })?;

    Some(match quota_ttl(&cache, "five_hour") {
        Some(t) => format!("{:.0}% · {}", util, t),
        None => format!("{:.0}%", util),
    })
}

/// Render 7-day quota utilization with adaptive reset countdown.
///
/// Format: "6% · 6d 21h", "67% · 23h 45m", "67%"
pub fn render_weekly_quota(input: &StatusInput) -> Option<String> {
    let cache = read_usage_cache();

    let util = input
        .usage
        .as_ref()
        .and_then(|u| u.seven_day_utilization)
        .or_else(|| {
            cache
                .as_ref()
                .and_then(|j| j.get("seven_day"))
                .and_then(|f| f.get("utilization"))
                .and_then(|u| u.as_f64())
        })?;

    Some(match quota_ttl(&cache, "seven_day") {
        Some(t) => format!("{:.0}% · {}", util, t),
        None => format!("{:.0}%", util),
    })
}

/// Render context collapse risk based on context_window usage velocity.
///
/// Estimates risk of hitting autocompact based on how fast context is filling.
/// Uses live context_window percentages when available.
///
/// Format: "low", "med", "high", "!crit"
pub fn render_context_collapse_risk(input: &StatusInput) -> Option<String> {
    if let Some(cw) = input.context_window.as_ref()
        && let Some(used_pct) = cw.used_percentage
    {
        // Simple threshold-based risk assessment
        return Some(if used_pct >= 85.0 {
            "!crit".to_string()
        } else if used_pct >= 70.0 {
            "high".to_string()
        } else if used_pct >= 50.0 {
            "med".to_string()
        } else {
            "low".to_string()
        });
    }

    // No live data — check file cache for context percentage
    if let Some(ctx) = input.context.as_ref() {
        let used = ctx.tokens_used.unwrap_or(0) as f64;
        let limit = ctx.token_limit.unwrap_or(200000) as f64;
        if limit > 0.0 {
            let pct = used / limit * 100.0;
            return Some(if pct >= 85.0 {
                "!crit".to_string()
            } else if pct >= 70.0 {
                "high".to_string()
            } else if pct >= 50.0 {
                "med".to_string()
            } else {
                "low".to_string()
            });
        }
    }

    Some("—".to_string())
}

/// Render project name (elite variant) — same as project-name but truncated to 10 chars.
pub fn render_project_elite(input: &StatusInput) -> Option<String> {
    let dir = input.workspace.as_ref()?.current_dir.as_ref()?;

    let name = std::path::Path::new(dir)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| dir.clone());

    // No truncation here: render.rs already honours the cell's maxWidth, and a
    // hardcoded 10 clipped "claude-elite" to "claude-el…" in a column with room
    // to spare. Slicing by byte also panics on a multi-byte boundary.
    Some(name)
}

/// Render burn rate ($N/hr) from session cost and duration.
///
/// Format: "$4/hr", "$0.50/hr", "—"
pub fn render_burn_rate(input: &StatusInput) -> Option<String> {
    let cost = input.cost.as_ref().and_then(|c| c.total_cost_usd)?;
    let duration_ms = input
        .cost
        .as_ref()
        .and_then(|c| c.total_duration_ms)
        .or_else(|| input.session.as_ref().and_then(|s| s.duration_ms))
        .unwrap_or(0);

    if duration_ms == 0 || cost <= 0.0 {
        return Some("\u{2014}".to_string());
    }

    let hours = duration_ms as f64 / 3_600_000.0;
    let rate = cost / hours;

    Some(if rate >= 10.0 {
        format!("${:.0}/hr", rate)
    } else if rate >= 1.0 {
        format!("${:.1}/hr", rate)
    } else {
        format!("${:.2}/hr", rate)
    })
}
