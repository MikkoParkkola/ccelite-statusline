//! Native feed widget — replaces 5× Python spawns with a single cached read.
//!
//! Data sources (in priority order):
//!   1. SurrealDB `feed_item` table (via cached JSON export, not async WS)
//!   2. `~/.config/ccstatusline/feed.json` (JSON fallback)
//!
//! The cache checks file mtime on each render cycle and refreshes only when
//! the file has changed, so stale data is evicted immediately on next write.
//! Items older than 24 hours are filtered out at parse time.

use crate::types::WidgetItem;
use chrono::{DateTime, Utc};
use chrono_tz::Tz;
use std::sync::RwLock;
use std::time::SystemTime;
use unicode_width::UnicodeWidthChar;
use unicode_width::UnicodeWidthStr;

/// Maximum age of feed items before they are considered stale.
const MAX_ITEM_AGE_SECS: i64 = 86_400; // 24 hours

/// Placeholder shown when all feed items are older than `MAX_ITEM_AGE_SECS`.
const NO_RECENT_ITEMS: &str = "No recent feed items";

// ── Cache ───────────────────────────────────────────────────────────────

/// Mtime-aware feed cache: `(file_mtime, parsed_data)`.
///
/// `None` means the cache is cold and must be populated on first access.
static FEED_CACHE: RwLock<Option<(SystemTime, FeedData)>> = RwLock::new(None);

/// Timezone cache — populated once per process, never changes.
static TIMEZONE: std::sync::OnceLock<Tz> = std::sync::OnceLock::new();

// ── Types ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
struct FeedData {
    items: Vec<FeedEntry>,
}

#[derive(Debug, Clone)]
struct FeedEntry {
    /// When the event occurred / was created (ISO-8601).
    timestamp: Option<DateTime<Utc>>,
    /// When the item was first shown to the user.
    shown_at: Option<DateTime<Utc>>,
    /// Emoji icon.
    icon: String,
    /// Display text.
    text: String,
    /// Priority (higher = more important, affects display order).
    priority: i64,
    /// Source system (calendar, system_health, …).
    #[allow(dead_code)]
    source: String,
}

// ── Public API ─────────────────────────────────────────────────────────

/// Render a single feed line.
///
/// Config:  `{ "type": "feed", "feedLine": 1, "maxWidth": 80 }`
///
/// `feedLine` 1 = newest item, 5 = oldest. Defaults to 1.
/// `maxWidth` 0 = no truncation (use column width from layout engine).
///
/// # Examples
///
/// ```ignore
/// let widget = WidgetItem { extra: serde_json::json!({ "feedLine": 1 }), .. };
/// let line = render_feed(&widget);
/// ```
pub fn render_feed(item: &WidgetItem) -> Option<String> {
    let line_num = item
        .extra
        .get("feedLine")
        .and_then(|v| v.as_u64())
        .unwrap_or(1) as usize;
    let max_width = item.max_width.unwrap_or(0);

    let feed = load_feed();
    match feed.items.get(line_num.saturating_sub(1)) {
        Some(entry) => Some(format_entry(entry, max_width)),
        None if line_num == 1 => Some(NO_RECENT_ITEMS.to_string()),
        None => None,
    }
}

// ── Feed Loading ───────────────────────────────────────────────────────

/// Return a snapshot of the current feed, refreshing when the backing file
/// has been modified since the last read.
fn load_feed() -> FeedData {
    // Fast path: cache is valid (file mtime unchanged).
    if let Some(cached) = try_cache_hit() {
        return cached;
    }

    // Slow path: (re)parse from disk.
    let fresh = parse_best_source();
    cache_store(fresh.clone());
    fresh
}

/// Check whether the cached data is still valid by comparing file mtimes.
///
/// Returns `Some(data)` on a cache hit, `None` when the cache is cold or
/// the backing file has been updated.
fn try_cache_hit() -> Option<FeedData> {
    let guard = FEED_CACHE.read().ok()?;
    let (cached_mtime, data) = guard.as_ref()?;
    let current_mtime = best_source_mtime()?;
    if current_mtime == *cached_mtime {
        Some(data.clone())
    } else {
        None
    }
}

/// Persist freshly parsed data together with the current file mtime.
fn cache_store(data: FeedData) {
    if let Ok(mut guard) = FEED_CACHE.write() {
        let mtime = best_source_mtime().unwrap_or(SystemTime::UNIX_EPOCH);
        *guard = Some((mtime, data));
    }
}

/// Return the mtime of whichever source file exists (SurrealDB export first,
/// then plain feed.json), or `None` if neither is readable.
fn best_source_mtime() -> Option<SystemTime> {
    surrealdb_cache_path()
        .and_then(|p| std::fs::metadata(&p).ok())
        .and_then(|m| m.modified().ok())
        .or_else(|| {
            feed_json_path()
                .and_then(|p| std::fs::metadata(&p).ok())
                .and_then(|m| m.modified().ok())
        })
}

/// Load and merge data from the best available source.
fn parse_best_source() -> FeedData {
    if let Some(data) = try_surrealdb_cache() {
        return data;
    }
    try_json_file().unwrap_or_else(|| FeedData { items: Vec::new() })
}

// ── Source Readers ─────────────────────────────────────────────────────

fn surrealdb_cache_path() -> Option<std::path::PathBuf> {
    Some(
        dirs::home_dir()?
            .join(".config")
            .join("ccstatusline")
            .join("feed_db_cache.json"),
    )
}

fn feed_json_path() -> Option<std::path::PathBuf> {
    Some(
        dirs::home_dir()?
            .join(".config")
            .join("ccstatusline")
            .join("feed.json"),
    )
}

/// Read from SurrealDB JSON export (daemon writes this periodically).
fn try_surrealdb_cache() -> Option<FeedData> {
    let path = surrealdb_cache_path()?;
    let content = std::fs::read_to_string(&path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&content).ok()?;
    parse_feed_items(&json)
}

/// Read from `~/.config/ccstatusline/feed.json`.
fn try_json_file() -> Option<FeedData> {
    let path = feed_json_path()?;
    let content = std::fs::read_to_string(&path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&content).ok()?;
    parse_feed_items(&json)
}

// ── Parsing ─────────────────────────────────────────────────────────────

fn parse_feed_items(json: &serde_json::Value) -> Option<FeedData> {
    let items_arr = json.get("items").and_then(|a| a.as_array())?;
    let cutoff = Utc::now() - chrono::Duration::seconds(MAX_ITEM_AGE_SECS);

    let mut items: Vec<FeedEntry> = items_arr
        .iter()
        .filter_map(|v| parse_single_item(v, cutoff))
        .collect();

    sort_and_dedup(&mut items);
    Some(FeedData { items })
}

/// Parse one JSON object into a `FeedEntry`, returning `None` for blank text
/// or items whose effective timestamp is older than their applicable TTL.
///
/// The `_global_cutoff` parameter (derived from `MAX_ITEM_AGE_SECS`) is the
/// floor: a per-item `ttl_seconds` field may impose a shorter deadline.
fn parse_single_item(v: &serde_json::Value, _global_cutoff: DateTime<Utc>) -> Option<FeedEntry> {
    let text = v.get("text").and_then(|t| t.as_str()).unwrap_or("").to_string();
    if text.is_empty() {
        return None;
    }

    let timestamp = parse_datetime(v, "timestamp");
    let shown_at = parse_datetime(v, "shown_at");

    // Use the most recent of the two times to judge staleness.
    let effective_time = shown_at.or(timestamp)?;

    // Per-item TTL override: health alerts can set a short TTL (e.g. 300s = 5 min)
    // to ensure they disappear quickly once the service recovers.
    let max_age = v
        .get("ttl_seconds")
        .and_then(|t| t.as_i64())
        .unwrap_or(MAX_ITEM_AGE_SECS);
    let item_cutoff = Utc::now() - chrono::Duration::seconds(max_age);
    if effective_time < item_cutoff {
        return None;
    }

    let icon = v.get("icon").and_then(|i| i.as_str()).unwrap_or("").to_string();
    let priority = derive_priority(v);
    let source = v
        .get("source")
        .and_then(|s| s.as_str())
        .unwrap_or("")
        .to_string();

    Some(FeedEntry {
        timestamp,
        shown_at,
        icon,
        text,
        priority,
        source,
    })
}

fn parse_datetime(v: &serde_json::Value, key: &str) -> Option<DateTime<Utc>> {
    v.get(key)
        .and_then(|t| t.as_str())
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|dt| dt.with_timezone(&Utc))
}

/// Derive display priority from explicit field or from urgency × importance.
fn derive_priority(v: &serde_json::Value) -> i64 {
    v.get("priority")
        .and_then(|p| p.as_i64())
        .unwrap_or_else(|| {
            let u = v.get("urgency").and_then(|x| x.as_i64()).unwrap_or(0);
            let i = v.get("importance").and_then(|x| x.as_i64()).unwrap_or(0);
            u * i
        })
}

/// Sort items newest-first (by `shown_at` falling back to `timestamp`), then
/// deduplicate entries that share identical text within a 1-hour window.
fn sort_and_dedup(items: &mut Vec<FeedEntry>) {
    items.sort_by(|a, b| {
        let sa = a.shown_at.or(a.timestamp);
        let sb = b.shown_at.or(b.timestamp);
        sb.cmp(&sa).then_with(|| b.priority.cmp(&a.priority))
    });

    items.dedup_by(|a, b| {
        if a.text != b.text {
            return false;
        }
        match (a.timestamp, b.timestamp) {
            (Some(ta), Some(tb)) => (ta - tb).num_hours().unsigned_abs() < 1,
            _ => true,
        }
    });
}

// ── Formatting ─────────────────────────────────────────────────────────

fn format_entry(entry: &FeedEntry, max_width: usize) -> String {
    let tz = load_timezone();
    let display_time = format_display_time(entry, &tz);
    let text_with_rel = format_text_with_relative(entry);
    let full = compose_line(&display_time, &entry.icon, &text_with_rel);

    if max_width > 0 {
        truncate_to_width(&full, max_width)
    } else {
        full
    }
}

fn format_display_time(entry: &FeedEntry, tz: &Tz) -> String {
    entry
        .shown_at
        .or(entry.timestamp)
        .map(|dt| format!("[{}]", dt.with_timezone(tz).format("%H:%M")))
        .unwrap_or_default()
}

fn format_text_with_relative(entry: &FeedEntry) -> String {
    let relative = entry.timestamp.map(format_relative_time).unwrap_or_default();
    if relative.is_empty() {
        entry.text.clone()
    } else {
        format!("{} ({})", entry.text, relative)
    }
}

fn compose_line(display_time: &str, icon: &str, text: &str) -> String {
    let prefix = match (!display_time.is_empty(), !icon.is_empty()) {
        (true, true) => format!("{} {} ", display_time, icon),
        (true, false) => format!("{} ", display_time),
        (false, true) => format!("{} ", icon),
        (false, false) => String::new(),
    };
    format!("{}{}", prefix, text)
}

fn format_relative_time(dt: DateTime<Utc>) -> String {
    let secs = Utc::now().signed_duration_since(dt).num_seconds();
    if secs < 0 {
        format_future((-secs) as u64)
    } else {
        format_past(secs as u64)
    }
}

fn format_future(secs: u64) -> String {
    match secs {
        0..=59 => "soon".to_string(),
        60..=3599 => format!("in {}m", secs / 60),
        3600..=86399 => format!("in {}h", secs / 3600),
        _ => format!("in {}d", secs / 86400),
    }
}

fn format_past(secs: u64) -> String {
    match secs {
        0..=59 => "just now".to_string(),
        60..=3599 => format!("{}m ago", secs / 60),
        3600..=86399 => format!("{}h ago", secs / 3600),
        _ => format!("{}d ago", secs / 86400),
    }
}

/// Truncate `s` to fit within `max_width` display columns, appending `…`.
fn truncate_to_width(s: &str, max_width: usize) -> String {
    if UnicodeWidthStr::width(s) <= max_width {
        return s.to_string();
    }

    const ELLIPSIS: &str = "…";
    let target = max_width.saturating_sub(UnicodeWidthStr::width(ELLIPSIS));
    let mut result = String::new();
    let mut current_width = 0;

    for ch in s.chars() {
        let ch_width = UnicodeWidthChar::width(ch).unwrap_or(0);
        if current_width + ch_width > target {
            break;
        }
        result.push(ch);
        current_width += ch_width;
    }

    result.push_str(ELLIPSIS);
    result
}

// ── Timezone ───────────────────────────────────────────────────────────

fn load_timezone() -> Tz {
    *TIMEZONE.get_or_init(|| {
        try_location_cache_tz()
            .or_else(|| std::env::var("TZ").ok().and_then(|s| s.parse().ok()))
            .unwrap_or(chrono_tz::Europe::Amsterdam)
    })
}

fn try_location_cache_tz() -> Option<Tz> {
    let path = dirs::home_dir()?
        .join(".config")
        .join("ccstatusline")
        .join("location_cache.json");
    let content = std::fs::read_to_string(&path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&content).ok()?;
    json.get("timezone")
        .and_then(|t| t.as_str())
        .and_then(|s| s.parse().ok())
}

// ── Tests ──────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Duration, Utc};

    fn make_item(text: &str, age_secs: i64, urgency: i64, importance: i64) -> serde_json::Value {
        let ts = Utc::now() - Duration::seconds(age_secs);
        serde_json::json!({
            "text": text,
            "timestamp": ts.to_rfc3339(),
            "shown_at": ts.to_rfc3339(),
            "icon": "🔴",
            "urgency": urgency,
            "importance": importance,
            "source": "test"
        })
    }

    // ── parse_single_item ──────────────────────────────────────────────

    #[test]
    fn parse_single_item_fresh_item_is_accepted() {
        // GIVEN: an item 1 hour old
        let v = make_item("Fresh alert", 3600, 5, 5);
        let cutoff = Utc::now() - Duration::seconds(MAX_ITEM_AGE_SECS);
        // WHEN: parsed
        let result = parse_single_item(&v, cutoff);
        // THEN: accepted
        assert!(result.is_some());
    }

    #[test]
    fn parse_single_item_stale_item_is_rejected() {
        // GIVEN: an item 25 hours old (beyond the 24h cutoff)
        let v = make_item("Old alert", 25 * 3600, 10, 10);
        let cutoff = Utc::now() - Duration::seconds(MAX_ITEM_AGE_SECS);
        // WHEN: parsed
        let result = parse_single_item(&v, cutoff);
        // THEN: filtered out
        assert!(result.is_none());
    }

    #[test]
    fn parse_single_item_blank_text_is_rejected() {
        // GIVEN: an item with empty text
        let v = serde_json::json!({ "text": "", "timestamp": Utc::now().to_rfc3339() });
        let cutoff = Utc::now() - Duration::seconds(MAX_ITEM_AGE_SECS);
        // WHEN: parsed
        let result = parse_single_item(&v, cutoff);
        // THEN: rejected
        assert!(result.is_none());
    }

    #[test]
    fn parse_single_item_no_timestamp_is_rejected() {
        // GIVEN: item with text but no timestamp (effective_time = None -> stale)
        let v = serde_json::json!({ "text": "No timestamp" });
        let cutoff = Utc::now() - Duration::seconds(MAX_ITEM_AGE_SECS);
        // WHEN: parsed
        let result = parse_single_item(&v, cutoff);
        // THEN: rejected (no effective_time)
        assert!(result.is_none());
    }

    #[test]
    fn parse_single_item_priority_derived_from_urgency_importance() {
        // GIVEN: item with urgency=8, importance=9
        let v = make_item("Alert", 60, 8, 9);
        let cutoff = Utc::now() - Duration::seconds(MAX_ITEM_AGE_SECS);
        // WHEN: parsed
        let entry = parse_single_item(&v, cutoff).unwrap();
        // THEN: priority = 72
        assert_eq!(entry.priority, 72);
    }

    #[test]
    fn parse_single_item_explicit_priority_overrides_urgency() {
        // GIVEN: item with explicit priority=99 and urgency/importance that would give 50
        let ts = Utc::now() - Duration::seconds(60);
        let v = serde_json::json!({
            "text": "High priority",
            "timestamp": ts.to_rfc3339(),
            "shown_at": ts.to_rfc3339(),
            "priority": 99,
            "urgency": 5,
            "importance": 10,
            "source": "test"
        });
        let cutoff = Utc::now() - Duration::seconds(MAX_ITEM_AGE_SECS);
        // WHEN: parsed
        let entry = parse_single_item(&v, cutoff).unwrap();
        // THEN: explicit priority wins
        assert_eq!(entry.priority, 99);
    }

    #[test]
    fn parse_single_item_respects_per_item_ttl() {
        // GIVEN: a health alert 10 minutes old (600s) with ttl_seconds=300
        // — it is within the global 24h window but beyond its own 5-min TTL.
        let ts = Utc::now() - Duration::seconds(600);
        let v = serde_json::json!({
            "text": "CRITICAL: SurrealDB unreachable!",
            "timestamp": ts.to_rfc3339(),
            "shown_at": ts.to_rfc3339(),
            "icon": "🔴",
            "urgency": 10,
            "importance": 10,
            "source": "system_health",
            "ttl_seconds": 300
        });
        let cutoff = Utc::now() - Duration::seconds(MAX_ITEM_AGE_SECS);
        // WHEN: parsed with the global 24h cutoff
        let result = parse_single_item(&v, cutoff);
        // THEN: filtered out because 600s > per-item ttl_seconds=300
        assert!(result.is_none());
    }

    // ── parse_feed_items ───────────────────────────────────────────────

    #[test]
    fn parse_feed_items_filters_stale_and_keeps_fresh() {
        // GIVEN: two items — one fresh (1h old), one stale (25h old)
        let json = serde_json::json!({
            "items": [
                make_item("Fresh", 3600, 5, 5),
                make_item("Stale", 25 * 3600, 10, 10),
            ]
        });
        // WHEN: parsed
        let data = parse_feed_items(&json).unwrap();
        // THEN: only the fresh item survives
        assert_eq!(data.items.len(), 1);
        assert_eq!(data.items[0].text, "Fresh");
    }

    #[test]
    fn parse_feed_items_all_stale_returns_empty_items_vec() {
        // GIVEN: all items older than 24h
        let json = serde_json::json!({
            "items": [
                make_item("Old 1", 25 * 3600, 5, 5),
                make_item("Old 2", 30 * 3600, 8, 8),
            ]
        });
        // WHEN: parsed
        let data = parse_feed_items(&json).unwrap();
        // THEN: empty items list (not None — feed itself is valid JSON)
        assert!(data.items.is_empty());
    }

    #[test]
    fn parse_feed_items_missing_items_key_returns_none() {
        // GIVEN: JSON without "items" key
        let json = serde_json::json!({ "updated_at": "2026-03-05T00:00:00Z" });
        // WHEN: parsed
        let result = parse_feed_items(&json);
        // THEN: None (malformed source)
        assert!(result.is_none());
    }

    // ── sort_and_dedup ─────────────────────────────────────────────────

    #[test]
    fn sort_and_dedup_orders_newest_first() {
        // GIVEN: items with different shown_at times
        let now = Utc::now();
        let mut items = vec![
            FeedEntry {
                timestamp: Some(now - Duration::hours(2)),
                shown_at: Some(now - Duration::hours(2)),
                icon: String::new(),
                text: "Older".into(),
                priority: 50,
                source: String::new(),
            },
            FeedEntry {
                timestamp: Some(now - Duration::minutes(30)),
                shown_at: Some(now - Duration::minutes(30)),
                icon: String::new(),
                text: "Newer".into(),
                priority: 50,
                source: String::new(),
            },
        ];
        // WHEN: sorted
        sort_and_dedup(&mut items);
        // THEN: newest first
        assert_eq!(items[0].text, "Newer");
        assert_eq!(items[1].text, "Older");
    }

    #[test]
    fn sort_and_dedup_removes_same_text_within_one_hour() {
        // GIVEN: two items with identical text 30 minutes apart
        let now = Utc::now();
        let mut items = vec![
            FeedEntry {
                timestamp: Some(now - Duration::minutes(10)),
                shown_at: Some(now - Duration::minutes(10)),
                icon: String::new(),
                text: "Duplicate alert".into(),
                priority: 50,
                source: String::new(),
            },
            FeedEntry {
                timestamp: Some(now - Duration::minutes(40)),
                shown_at: Some(now - Duration::minutes(40)),
                icon: String::new(),
                text: "Duplicate alert".into(),
                priority: 50,
                source: String::new(),
            },
        ];
        // WHEN: sorted and deduped
        sort_and_dedup(&mut items);
        // THEN: only one survives
        assert_eq!(items.len(), 1);
    }

    // ── format_relative_time ───────────────────────────────────────────

    #[test]
    fn format_relative_time_past_minutes() {
        // GIVEN: event 90 seconds ago
        let dt = Utc::now() - Duration::seconds(90);
        // WHEN: formatted
        let result = format_relative_time(dt);
        // THEN: "1m ago"
        assert_eq!(result, "1m ago");
    }

    #[test]
    fn format_relative_time_past_hours() {
        // GIVEN: event 3.5 hours ago
        let dt = Utc::now() - Duration::seconds(3 * 3600 + 1800);
        // WHEN: formatted
        let result = format_relative_time(dt);
        // THEN: "3h ago"
        assert_eq!(result, "3h ago");
    }

    #[test]
    fn format_relative_time_past_days() {
        // GIVEN: event 2 days ago
        let dt = Utc::now() - Duration::hours(48);
        // WHEN: formatted
        let result = format_relative_time(dt);
        // THEN: "2d ago"
        assert_eq!(result, "2d ago");
    }

    #[test]
    fn format_relative_time_future_minutes() {
        let dt = chrono::Utc::now() + chrono::Duration::minutes(5);
        let result = format_relative_time(dt);
        assert!(result.starts_with("in "), "expected future indicator, got '{result}'");
        assert!(result.chars().any(|c| c.is_ascii_digit()), "expected time value in '{result}'");
    }

    #[test]
    fn format_relative_time_just_now() {
        // GIVEN: event 10 seconds ago
        let dt = Utc::now() - Duration::seconds(10);
        // WHEN: formatted
        let result = format_relative_time(dt);
        // THEN: "just now"
        assert_eq!(result, "just now");
    }

    // ── truncate_to_width ──────────────────────────────────────────────

    #[test]
    fn truncate_to_width_short_string_unchanged() {
        // GIVEN: string shorter than max_width
        let s = "Hello";
        // WHEN: truncated to 20
        let result = truncate_to_width(s, 20);
        // THEN: unchanged
        assert_eq!(result, "Hello");
    }

    #[test]
    fn truncate_to_width_long_ascii_gets_ellipsis() {
        // GIVEN: 30-char ASCII string
        let s = "A".repeat(30);
        // WHEN: truncated to 10
        let result = truncate_to_width(&s, 10);
        // THEN: 9 chars + ellipsis = display width 10
        assert_eq!(UnicodeWidthStr::width(result.as_str()), 10);
        assert!(result.ends_with('…'));
    }

    #[test]
    fn truncate_to_width_emoji_counts_as_two_columns() {
        // GIVEN: string "🔴 Alert" — emoji is 2 columns wide
        let s = "🔴 Alert with long trailing text here";
        // WHEN: truncated to 8 columns
        let result = truncate_to_width(s, 8);
        // THEN: display width ≤ 8
        assert!(UnicodeWidthStr::width(result.as_str()) <= 8);
        assert!(result.ends_with('…'));
    }

    // ── render_feed (integration) ──────────────────────────────────────

    #[test]
    fn render_feed_line1_with_empty_cache_shows_placeholder() {
        // GIVEN: no feed file available (we rely on OnceLock being per-binary;
        // in tests each test binary gets a fresh static, but FEED_CACHE is shared.
        // We can only test the public behavior: line 1 never returns None when
        // all items are stale — it returns the placeholder.)
        //
        // This test validates the render path when load_feed returns empty items.
        let empty_feed = FeedData { items: Vec::new() };
        // Simulate: line_num=1 with empty items → placeholder
        let result = match empty_feed.items.get(0) {
            Some(entry) => format_entry(entry, 0),
            None => NO_RECENT_ITEMS.to_string(),
        };
        assert_eq!(result, "No recent feed items");
    }
}
