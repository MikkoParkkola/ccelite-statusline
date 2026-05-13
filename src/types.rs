//! Type definitions for ccstatusline
//!
//! Defines the JSON schema for both input (from Claude Code) and config (settings.json)

use serde::Deserialize;
use std::collections::HashMap;

/// Input JSON from Claude Code via stdin
#[derive(Debug, Deserialize, Default)]
pub struct StatusInput {
    pub model: Option<ModelInfo>,
    pub context: Option<ContextInfo>,
    /// Live context window percentages from Claude Code (added v2.1.6)
    pub context_window: Option<ContextWindowInfo>,
    pub cost: Option<CostInfo>,
    pub workspace: Option<WorkspaceInfo>,
    pub session: Option<SessionInfo>,
    pub transcript_path: Option<String>,
    /// Live quota/rate-limit utilization piped from Claude Code
    pub usage: Option<UsageInfo>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

/// Live quota utilization from Claude Code (piped in each render)
#[derive(Debug, Deserialize, Default)]
pub struct UsageInfo {
    /// 5-hour rolling window utilization (0–100)
    #[serde(alias = "fiveHourUtilization")]
    pub five_hour_utilization: Option<f64>,
    /// 7-day rolling window utilization (0–100)
    #[serde(alias = "sevenDayUtilization")]
    pub seven_day_utilization: Option<f64>,
    /// ISO-8601 timestamp when the 5-hour window resets
    #[serde(alias = "fiveHourResetsAt")]
    pub five_hour_resets_at: Option<String>,
    /// ISO-8601 timestamp when the 7-day window resets
    #[serde(alias = "sevenDayResetsAt")]
    pub seven_day_resets_at: Option<String>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

/// Live context window usage from Claude Code (piped in each render)
#[derive(Debug, Deserialize, Default)]
pub struct ContextWindowInfo {
    pub used_percentage: Option<f64>,
    pub remaining_percentage: Option<f64>,
}

#[derive(Debug, Deserialize, Default)]
pub struct ModelInfo {
    pub id: Option<String>,
    pub display_name: Option<String>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Deserialize, Default)]
pub struct ContextInfo {
    #[serde(alias = "tokensUsed")]
    pub tokens_used: Option<u64>,
    #[serde(alias = "tokenLimit")]
    pub token_limit: Option<u64>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Deserialize, Default)]
pub struct CostInfo {
    #[serde(alias = "total_cost_usd")]
    pub total_cost_usd: Option<f64>,
    #[serde(alias = "total_duration_ms")]
    pub total_duration_ms: Option<u64>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Deserialize, Default)]
pub struct WorkspaceInfo {
    pub current_dir: Option<String>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Deserialize, Default)]
pub struct SessionInfo {
    pub duration_ms: Option<u64>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

/// Settings from ~/.config/ccstatusline/settings.json
#[derive(Debug, Deserialize, Default)]
pub struct Settings {
    pub version: Option<u32>,
    pub lines: Vec<Vec<WidgetItem>>,
    #[serde(default = "default_flex_mode")]
    pub flex_mode: String,
    #[serde(default = "default_compact_threshold", alias = "compactThreshold")]
    pub compact_threshold: u32,
    #[serde(default = "default_color_level", alias = "colorLevel")]
    pub color_level: u32,
    #[serde(default, alias = "defaultSeparator")]
    pub default_separator: String,
    #[serde(default = "default_padding", alias = "defaultPadding")]
    pub default_padding: String,
    #[serde(default, alias = "inheritSeparatorColors")]
    pub inherit_separator_colors: bool,
    #[serde(default, alias = "globalBold")]
    pub global_bold: bool,
    pub powerline: Option<PowerlineSettings>,
}

fn default_flex_mode() -> String {
    "full".to_string()
}
fn default_compact_threshold() -> u32 {
    60
}
fn default_color_level() -> u32 {
    3
}
fn default_padding() -> String {
    " ".to_string()
}

#[derive(Debug, Deserialize, Default)]
pub struct PowerlineSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub theme: String,
    #[serde(default)]
    pub separators: Vec<String>,
    #[serde(default, alias = "separatorInvertBackground")]
    pub separator_invert_background: Vec<bool>,
    #[serde(default, alias = "startCaps")]
    pub start_caps: Vec<String>,
    #[serde(default, alias = "endCaps")]
    pub end_caps: Vec<String>,
    #[serde(default, alias = "autoAlign")]
    pub auto_align: bool,
}

/// A single widget item in the statusline
#[derive(Debug, Deserialize, Clone)]
pub struct WidgetItem {
    pub id: Option<String>,
    #[serde(rename = "type")]
    pub widget_type: String,

    // Common properties
    pub color: Option<String>,
    #[serde(alias = "backgroundColor")]
    pub background_color: Option<String>,
    #[serde(default)]
    pub bold: bool,
    pub padding: Option<String>,
    pub merge: Option<String>,

    // Widget-specific properties
    #[serde(alias = "customText")]
    pub custom_text: Option<String>,
    #[serde(alias = "commandPath")]
    pub command_path: Option<String>,
    pub timeout: Option<u64>,
    #[serde(alias = "preserveColors")]
    pub preserve_colors: Option<bool>,
    #[serde(alias = "minWidth")]
    pub min_width: Option<usize>,
    #[serde(alias = "maxWidth")]
    pub max_width: Option<usize>,
    #[serde(default, alias = "fullWidth")]
    pub full_width: bool,

    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

/// Parsed color value
#[derive(Debug, Clone)]
pub enum Color {
    Named(String),
    Hex(u8, u8, u8),
    Ansi256(u8),
}

impl Color {
    pub fn parse(s: &str) -> Option<Self> {
        if s.starts_with("hex:") {
            let hex = s.strip_prefix("hex:")?;
            if hex.len() == 6 {
                let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
                let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
                let b = u8::from_str_radix(&hex[4..6], 16).ok()?;
                return Some(Color::Hex(r, g, b));
            }
        }
        Some(Color::Named(s.to_string()))
    }

    pub fn to_ansi_fg(&self) -> String {
        match self {
            Color::Hex(r, g, b) => format!("\x1b[38;2;{};{};{}m", r, g, b),
            Color::Ansi256(n) => format!("\x1b[38;5;{}m", n),
            Color::Named(name) => match name.as_str() {
                "black" => "\x1b[30m".to_string(),
                "red" => "\x1b[31m".to_string(),
                "green" => "\x1b[32m".to_string(),
                "yellow" => "\x1b[33m".to_string(),
                "blue" => "\x1b[34m".to_string(),
                "magenta" => "\x1b[35m".to_string(),
                "cyan" => "\x1b[36m".to_string(),
                "white" => "\x1b[37m".to_string(),
                "brightBlack" => "\x1b[90m".to_string(),
                "brightRed" => "\x1b[91m".to_string(),
                "brightGreen" => "\x1b[92m".to_string(),
                "brightYellow" => "\x1b[93m".to_string(),
                "brightBlue" => "\x1b[94m".to_string(),
                "brightMagenta" => "\x1b[95m".to_string(),
                "brightCyan" => "\x1b[96m".to_string(),
                "brightWhite" => "\x1b[97m".to_string(),
                _ => "\x1b[39m".to_string(),
            },
        }
    }

    pub fn to_ansi_bg(&self) -> String {
        match self {
            Color::Hex(r, g, b) => format!("\x1b[48;2;{};{};{}m", r, g, b),
            Color::Ansi256(n) => format!("\x1b[48;5;{}m", n),
            Color::Named(name) => match name.as_str() {
                "black" => "\x1b[40m".to_string(),
                "red" => "\x1b[41m".to_string(),
                "green" => "\x1b[42m".to_string(),
                "yellow" => "\x1b[43m".to_string(),
                "blue" => "\x1b[44m".to_string(),
                "magenta" => "\x1b[45m".to_string(),
                "cyan" => "\x1b[46m".to_string(),
                "white" => "\x1b[47m".to_string(),
                _ => "\x1b[49m".to_string(),
            },
        }
    }
}

pub const RESET: &str = "\x1b[0m";
pub const BOLD: &str = "\x1b[1m";
pub const BOLD_OFF: &str = "\x1b[22m";
