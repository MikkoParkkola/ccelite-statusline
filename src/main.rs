//! ccstatusline - Ultra-fast statusline renderer for Claude Code
//!
//! A Rust implementation of ccstatusline that renders the Claude Code
//! statusline with parallel custom command execution.
//!
//! Usage:
//!   echo '{"model":{"id":"claude-opus-4"}}' | ccstatusline
//!
//! Performance target: <50ms for full render including custom commands

mod config;
mod render;
mod types;
mod widgets;

use anyhow::{Context, Result};
use std::io::{self, BufRead, IsTerminal};

fn main() -> Result<()> {
    // Read from stdin only if piped AND has data available
    // Use non-blocking I/O to avoid blocking when stdin is piped but empty
    let input_json = if io::stdin().is_terminal() {
        // No pipe, use empty defaults
        "{}".to_string()
    } else {
        // Set stdin to non-blocking
        #[cfg(unix)]
        {
            use std::os::unix::io::AsRawFd;
            let fd = io::stdin().as_raw_fd();
            unsafe {
                let flags = libc::fcntl(fd, libc::F_GETFL);
                if flags >= 0 {
                    libc::fcntl(fd, libc::F_SETFL, flags | libc::O_NONBLOCK);
                }
            }
        }

        let stdin = io::stdin();
        let mut handle = stdin.lock();
        let mut line = String::new();
        match handle.read_line(&mut line) {
            Ok(0) | Err(_) => "{}".to_string(),
            Ok(_) => {
                let trimmed = line.trim();
                if trimmed.is_empty() { "{}".to_string() } else { trimmed.to_string() }
            }
        }
    };

    // Parse input JSON
    let input: types::StatusInput = serde_json::from_str(&input_json)
        .unwrap_or_default();

    // Load settings
    let settings = config::load_settings()
        .context("Failed to load settings")?;

    // Render the statusline
    render::render_statusline(&settings, &input, &input_json);

    Ok(())
}
