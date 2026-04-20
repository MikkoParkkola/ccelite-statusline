//! Rendering logic for statusline output

use crate::types::{Color, Settings, StatusInput, WidgetItem, BOLD, RESET};
use crate::widgets::{preload_custom_commands, render_widget, RenderContext};

/// Detect terminal width (columns). Returns None if undetectable.
///
/// Claude Code pipes stdin/stdout to the statusline command, so `isatty(1)` is
/// false and `tput cols` returns the fallback 80. We therefore probe in order:
///   1. `$COLUMNS` env var (if exported by the parent shell/harness)
///   2. `ioctl(TIOCGWINSZ)` on `/dev/tty` (controlling terminal is inherited)
///
/// Without this, the renderer emits ~210-col powerline lines that wrap on any
/// narrower terminal, causing Claude Code's fixed-height statusline area to
/// clobber rows 2..N — producing the "only header visible" symptom.
fn detect_terminal_width() -> Option<usize> {
    // 1. $COLUMNS
    if let Ok(cols) = std::env::var("COLUMNS") {
        if let Ok(n) = cols.parse::<usize>() {
            if n > 0 {
                return Some(n);
            }
        }
    }

    // 2. ioctl(TIOCGWINSZ) on /dev/tty
    unsafe {
        #[repr(C)]
        struct Winsize {
            ws_row: libc::c_ushort,
            ws_col: libc::c_ushort,
            ws_xpixel: libc::c_ushort,
            ws_ypixel: libc::c_ushort,
        }

        let path = b"/dev/tty\0".as_ptr() as *const libc::c_char;
        let fd = libc::open(path, libc::O_RDONLY | libc::O_NOCTTY);
        if fd < 0 {
            return None;
        }

        let mut ws: Winsize = std::mem::zeroed();
        let rc = libc::ioctl(fd, libc::TIOCGWINSZ, &mut ws as *mut Winsize);
        libc::close(fd);

        if rc == 0 && ws.ws_col > 0 {
            return Some(ws.ws_col as usize);
        }
    }

    None
}

/// Truncate a fully-rendered (ANSI-escaped) line to `max` visible columns.
/// Appends RESET so background colors don't bleed past truncation point.
/// Unlike `truncate_with_ansi`, this does NOT append "..." — the statusline
/// already loses the right-side Feed column naturally when clipped.
fn truncate_line_to_width(s: &str, max: usize) -> String {
    use unicode_width::UnicodeWidthChar;

    if strip_ansi_len(s) <= max {
        return s.to_string();
    }

    let mut result = String::new();
    let mut visible_len = 0;
    let mut in_escape = false;

    for c in s.chars() {
        if c == '\x1b' {
            in_escape = true;
            result.push(c);
        } else if in_escape {
            result.push(c);
            if c.is_ascii_alphabetic() {
                in_escape = false;
            }
        } else {
            let char_width = c.width().unwrap_or(0);
            if visible_len + char_width > max {
                break;
            }
            result.push(c);
            visible_len += char_width;
        }
    }

    result.push_str(RESET);
    result
}

/// Pre-rendered widget with content and width
struct PreRenderedWidget {
    content: String,
    plain_len: usize,
    widget: WidgetItem,
}

/// Pre-render all widgets and calculate alignment widths
fn pre_render_all(
    settings: &Settings,
    ctx: &RenderContext,
) -> (Vec<Vec<PreRenderedWidget>>, Vec<usize>) {
    let default_padding = settings.default_padding.as_str();
    let padding_len = default_padding.len();

    // Pre-render all widgets
    let mut pre_rendered_lines: Vec<Vec<PreRenderedWidget>> = Vec::new();

    for line in &settings.lines {
        let mut pre_rendered: Vec<PreRenderedWidget> = Vec::new();

        for widget in line {
            let content = render_widget(widget, ctx).unwrap_or_default();
            let content = if let Some(max) = widget.max_width {
                truncate_with_ansi(&content, max)
            } else {
                content
            };
            let plain_len = strip_ansi_len(&content);

            pre_rendered.push(PreRenderedWidget {
                content,
                plain_len,
                widget: widget.clone(),
            });
        }

        pre_rendered_lines.push(pre_rendered);
    }

    // Calculate max widths by alignment position
    // IMPORTANT: Process data rows (with merges) FIRST to establish column widths,
    // then header rows will inherit those widths
    let mut max_widths: Vec<usize> = Vec::new();

    // First pass: calculate widths from lines WITH merged widgets (data rows)
    for pre_rendered in &pre_rendered_lines {
        // Skip fullWidth lines
        if pre_rendered.iter().any(|w| w.widget.full_width) {
            continue;
        }

        // Check if this line has any merges
        let has_merges = pre_rendered.iter().any(|w| w.widget.merge.is_some());
        if !has_merges {
            continue; // Skip header rows in first pass
        }

        // Filter out separators
        let filtered: Vec<&PreRenderedWidget> = pre_rendered
            .iter()
            .filter(|w| {
                w.widget.widget_type != "separator" && w.widget.widget_type != "flex-separator"
            })
            .collect();

        let mut alignment_pos = 0;
        let mut i = 0;

        while i < filtered.len() {
            let widget = &filtered[i];

            // Calculate widget width (use minWidth for empty content)
            let widget_width = if !widget.content.is_empty() {
                widget.plain_len.max(widget.widget.min_width.unwrap_or(0))
            } else {
                widget.widget.min_width.unwrap_or(0)
            };

            // Calculate total width including merged widgets
            let mut total_width = if widget_width > 0 {
                widget_width + (padding_len * 2)
            } else {
                0
            };

            // Check if this widget merges with next ones
            let mut j = i;
            while j < filtered.len() - 1 && filtered[j].widget.merge.is_some() {
                j += 1;
                let next = &filtered[j];
                let next_width = if !next.content.is_empty() {
                    next.plain_len.max(next.widget.min_width.unwrap_or(0))
                } else {
                    next.widget.min_width.unwrap_or(0)
                };

                if next_width > 0 || !next.content.is_empty() {
                    if filtered[j - 1].widget.merge.as_deref() == Some("no-padding") {
                        total_width += next_width;
                    } else {
                        total_width += next_width + (padding_len * 2);
                    }
                }
            }

            // Update max width for this position
            if alignment_pos >= max_widths.len() {
                max_widths.push(total_width);
            } else {
                max_widths[alignment_pos] = max_widths[alignment_pos].max(total_width);
            }

            i = j + 1;
            alignment_pos += 1;
        }
    }

    // Second pass: header rows (no merges) inherit widths from data rows
    // Header widgets at position N get the width calculated from merged groups at position N
    // This ensures "Identity" header aligns with "User: value" merged data pair

    (pre_rendered_lines, max_widths)
}

/// Render the complete statusline to stdout
pub fn render_statusline(settings: &Settings, input: &StatusInput, input_json: &str) {
    // Collect all widgets for custom command preloading
    let all_widgets: Vec<&WidgetItem> = settings.lines.iter().flatten().collect();

    // Pre-execute all custom commands in parallel
    let custom_results = preload_custom_commands(
        &all_widgets.iter().map(|w| (*w).clone()).collect::<Vec<_>>(),
        input_json,
    );

    let ctx = RenderContext {
        input,
        input_json,
        custom_results: &custom_results,
    };

    // Pre-render and calculate max widths
    let (pre_rendered_lines, max_widths) = pre_render_all(settings, &ctx);

    // Detect terminal width for overflow protection. Without this, wide
    // powerline layouts wrap and collide with Claude Code's input prompt.
    let term_width = detect_terminal_width();

    // Render each line with alignment
    for (line_idx, pre_rendered) in pre_rendered_lines.iter().enumerate() {
        let widgets: Vec<&WidgetItem> = settings.lines[line_idx].iter().collect();
        let rendered = render_line_aligned(&widgets, pre_rendered, settings, &max_widths);
        let rendered = match term_width {
            Some(w) => truncate_line_to_width(&rendered, w),
            None => rendered,
        };
        print!("{}", rendered);

        if line_idx < pre_rendered_lines.len() - 1 {
            println!();
        }
    }
    println!();
}

/// Render a single line with proper alignment
fn render_line_aligned(
    _widgets: &[&WidgetItem],
    pre_rendered: &[PreRenderedWidget],
    settings: &Settings,
    max_widths: &[usize],
) -> String {
    let mut output = String::new();
    let mut prev_bg: Option<Color> = None;
    let default_padding = settings.default_padding.as_str();
    let padding_len = default_padding.len();

    // Filter to non-separator widgets
    let filtered: Vec<(usize, &PreRenderedWidget)> = pre_rendered
        .iter()
        .enumerate()
        .filter(|(_, w)| {
            w.widget.widget_type != "separator" && w.widget.widget_type != "flex-separator"
        })
        .collect();

    let mut alignment_pos = 0;
    let mut i = 0;

    while i < filtered.len() {
        let (_, widget) = &filtered[i];

        // Skip empty widgets that aren't part of a merge chain
        if widget.content.is_empty() && widget.widget.merge.is_none() {
            i += 1;
            continue;
        }

        // Find all widgets merged with this one
        let mut merge_end = i;
        while merge_end < filtered.len() - 1
            && filtered[merge_end].1.widget.merge.is_some()
        {
            merge_end += 1;
        }

        // Render merged group
        let mut group_width = 0;
        for k in i..=merge_end {
            let (_, w) = &filtered[k];

            // Get colors
            let fg: Option<Color> = w.widget.color.as_ref().and_then(|c| Color::parse(c));
            let bg: Option<Color> = w.widget.background_color.as_ref().and_then(|c| Color::parse(c));

            // Powerline transition - only at start of merged group (k == i)
            // Separators are drawn between groups, not between merged widgets
            // NOTE: Separator width is NOT counted in group_width because it's
            // extra space between columns, not part of the column itself
            if k == i && settings.powerline.as_ref().map(|p| p.enabled).unwrap_or(false) {
                if let Some(ref prev) = prev_bg {
                    if let Some(ref current_bg) = bg {
                        let sep = settings
                            .powerline
                            .as_ref()
                            .and_then(|p| p.separators.first())
                            .map(|s| s.as_str())
                            .unwrap_or(" ");
                        output.push_str(&prev.to_ansi_fg());
                        output.push_str(&current_bg.to_ansi_bg());
                        output.push_str(sep);
                    }
                }
            }

            // Apply colors
            output.push_str(RESET);
            if settings.global_bold || w.widget.bold {
                output.push_str(BOLD);
            }
            if let Some(ref color) = fg {
                output.push_str(&color.to_ansi_fg());
            }
            if let Some(ref color) = bg {
                output.push_str(&color.to_ansi_bg());
            }

            // Padding handling
            let omit_leading = k > i; // After first widget in merge group
            let omit_trailing = w.widget.merge.as_deref() == Some("no-padding") && k < merge_end;

            // Handle minWidth
            let visible_len = w.plain_len;
            let min_width = w.widget.min_width.unwrap_or(0);
            let effective_width = visible_len.max(min_width);

            // Only render if there's content or minWidth
            if effective_width > 0 || !w.content.is_empty() {
                // Add leading padding
                if !omit_leading {
                    output.push_str(default_padding);
                    group_width += padding_len;
                }

                // Render content with minWidth padding
                output.push_str(&w.content);
                if visible_len < min_width {
                    output.push_str(&" ".repeat(min_width - visible_len));
                }
                group_width += effective_width;

                // Add trailing padding
                if !omit_trailing {
                    output.push_str(default_padding);
                    group_width += padding_len;
                }
            }

            prev_bg = bg;
        }

        // Pad to max width for this alignment position
        let target_width = max_widths.get(alignment_pos).copied().unwrap_or(0);
        if group_width < target_width {
            output.push_str(&" ".repeat(target_width - group_width));
        }

        i = merge_end + 1;
        alignment_pos += 1;
    }

    output.push_str(RESET);
    output
}

/// Get visible terminal width of string (excluding ANSI codes)
/// Uses unicode-width for proper handling of emojis and CJK characters
fn strip_ansi_len(s: &str) -> usize {
    use unicode_width::UnicodeWidthChar;

    let mut len = 0;
    let mut in_escape = false;

    for c in s.chars() {
        if c == '\x1b' {
            in_escape = true;
        } else if in_escape {
            if c.is_ascii_alphabetic() {
                in_escape = false;
            }
        } else {
            // Use unicode width for proper terminal display width
            len += c.width().unwrap_or(0);
        }
    }

    len
}

/// Truncate string with ANSI codes to max visible terminal width
/// Uses unicode-width for proper handling of emojis and CJK characters
fn truncate_with_ansi(s: &str, max: usize) -> String {
    use unicode_width::UnicodeWidthChar;

    // First, check if truncation is needed
    let total_width = strip_ansi_len(s);
    if total_width <= max {
        return s.to_string();
    }

    // Need to truncate - collect chars with widths
    let mut result = String::new();
    let mut visible_len = 0;
    let mut in_escape = false;
    let target = if max >= 3 { max - 3 } else { 0 }; // Leave room for "..."

    for c in s.chars() {
        if c == '\x1b' {
            in_escape = true;
            result.push(c);
        } else if in_escape {
            result.push(c);
            if c.is_ascii_alphabetic() {
                in_escape = false;
            }
        } else {
            let char_width = c.width().unwrap_or(0);
            if visible_len + char_width <= target {
                result.push(c);
                visible_len += char_width;
            } else {
                break;
            }
        }
    }

    if max >= 3 {
        result.push_str("...");
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strip_ansi_len() {
        assert_eq!(strip_ansi_len("hello"), 5);
        assert_eq!(strip_ansi_len("\x1b[31mred\x1b[0m"), 3);
    }

    #[test]
    fn test_truncate_with_ansi() {
        assert_eq!(truncate_with_ansi("hello world", 5), "he...");
        assert_eq!(truncate_with_ansi("\x1b[31mhello\x1b[0m", 3), "\x1b[31m...");
    }

    #[test]
    fn test_truncate_line_to_width_short() {
        // No truncation needed
        assert_eq!(truncate_line_to_width("abc", 10), "abc");
    }

    #[test]
    fn test_truncate_line_to_width_plain() {
        // Plain truncation, RESET appended
        let out = truncate_line_to_width("abcdefgh", 3);
        assert_eq!(out, format!("abc{}", RESET));
    }

    #[test]
    fn test_truncate_line_to_width_preserves_escapes() {
        // ANSI sequences before the cut point are preserved
        let input = "\x1b[31mab\x1b[42mcdef\x1b[0m";
        let out = truncate_line_to_width(input, 3);
        // Should contain red fg, "ab", bg-green start, "c", reset
        assert!(out.starts_with("\x1b[31mab\x1b[42mc"));
        assert!(out.ends_with(RESET));
    }
}
