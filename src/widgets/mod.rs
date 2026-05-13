//! Widget system for ccstatusline
//!
//! Provides a trait-based widget system with parallel execution for custom commands.

mod builtin;
mod custom_command;
mod feed;

use crate::types::{StatusInput, WidgetItem};
use rayon::prelude::*;
use std::collections::HashMap;

pub use builtin::*;
pub use custom_command::execute_custom_commands;

/// Context for rendering widgets
pub struct RenderContext<'a> {
    pub input: &'a StatusInput,
    pub input_json: &'a str,
    pub custom_results: &'a HashMap<String, String>,
}

/// Render a single widget to text
pub fn render_widget(item: &WidgetItem, ctx: &RenderContext) -> Option<String> {
    match item.widget_type.as_str() {
        "custom-text" => item.custom_text.clone(),
        "custom-command" => {
            let id = item.id.as_ref()?;
            ctx.custom_results.get(id).cloned()
        }
        "model" => render_model(ctx.input),
        "context-percentage" => render_context_percentage(ctx.input),
        "context-percentage-usable" => render_context_percentage_usable(ctx.input),
        "session-cost" => render_session_cost(ctx.input),
        "session-cost-elite" => render_session_cost_elite(ctx.input),
        "session-clock" => render_session_clock(ctx.input),
        "session-npv" => render_session_npv(ctx.input),
        "git-branch" => render_git_branch(),
        "git-changes" => render_git_changes(),
        "cpu" => render_cpu(),
        "memory-percent" => render_memory_percent(),
        "disk-free" | "load-average" => render_disk_free(),
        "mcp-count" => render_mcp_count(),
        "hooks-status" => render_hooks_status(),
        "project-name" => render_project_name(ctx.input),
        "tokens-cached" => render_tokens_cached(ctx.input),
        "tests-percentage" => render_tests_percentage(),
        "roi" => render_roi(ctx.input),
        "codex-tokens-saved" => render_codex_tokens_saved(),
        // Generic widgets (ported from shell scripts)
        "user-email" => render_user_email(),
        "daemon-health" => render_daemon_health(),
        "db-health" | "surrealdb-health" => render_db_health(),
        "fresh" => render_fresh(),
        "alert" => render_alert(),
        "risk" => render_risk(),
        "quality" => render_quality(),
        "turns" => render_turns(),
        "first-try-rate" => render_first_try_rate(),
        "lint-errors" => render_lint_errors(),
        "rate-status" => render_rate_status(),
        "session-quota" => render_session_quota(ctx.input),
        "weekly-quota" => render_weekly_quota(ctx.input),
        // New widgets (2026-04-03)
        "token-phase" => render_token_phase(),
        "event-bus" => render_event_bus_count(),
        "recent-fails" => render_recent_fails(),
        "proposal-queue" => render_proposal_queue(),
        "burn-rate" => render_burn_rate(ctx.input),
        "active-agents" => render_active_agents(),
        "tools-count" => render_tools_count(),
        "commits-today" => render_commits_today(),
        "saved-per-session" => render_saved_per_session(),
        "db-events" => render_db_events(),
        "daemon-latency" => render_daemon_latency(),
        // Existing new widgets
        "context-collapse-risk" => render_context_collapse_risk(ctx.input),
        "bugs-clarity" => render_bugs_clarity(),
        "burn-rate-clarity" => render_burn_rate_clarity(ctx.input),
        "project-elite" => render_project_elite(ctx.input),
        // Aliases: config names → existing implementations
        "first-try-success" => render_first_try_rate(),
        "test-pass-rate" => render_tests_percentage(),
        "alert-detail" => render_alert(),
        "data-freshness" => render_fresh(),
        "coverage" => render_coverage(),
        // Feed widget (native — replaces 5× Python spawns)
        "feed" => feed::render_feed(item),
        _ => Some(format!("[{}]", item.widget_type)),
    }
}

/// Pre-execute all custom commands in parallel
pub fn preload_custom_commands(items: &[WidgetItem], input_json: &str) -> HashMap<String, String> {
    // Collect all custom-command widgets
    let custom_commands: Vec<_> = items
        .iter()
        .filter(|item| item.widget_type == "custom-command")
        .filter(|item| item.command_path.is_some() && item.id.is_some())
        .collect();

    if custom_commands.is_empty() {
        return HashMap::new();
    }

    // Execute all commands in parallel using rayon
    let results: Vec<_> = custom_commands
        .par_iter()
        .map(|item| {
            let id = item.id.as_ref().unwrap().clone();
            let path = item.command_path.as_ref().unwrap();
            let timeout_ms = item.timeout.unwrap_or(1000);
            let preserve_colors = item.preserve_colors.unwrap_or(false);

            let result = execute_custom_commands(path, input_json, timeout_ms, preserve_colors);
            (id, result)
        })
        .collect();

    results
        .into_iter()
        .filter_map(|(id, result)| result.map(|r| (id, r)))
        .collect()
}
