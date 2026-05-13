//! Custom command execution with timeout support

use std::io::Write;
use std::process::{Command, Stdio};
use std::thread;
use std::time::{Duration, Instant};

/// Execute a custom command with the given input JSON
///
/// Returns None if the command fails or times out
pub fn execute_custom_commands(
    command_path: &str,
    input_json: &str,
    timeout_ms: u64,
    preserve_colors: bool,
) -> Option<String> {
    // Expand ~ in path
    let expanded_path = if command_path.starts_with("~/") {
        if let Some(home) = dirs::home_dir() {
            command_path.replacen("~", &home.to_string_lossy(), 1)
        } else {
            command_path.to_string()
        }
    } else {
        command_path.to_string()
    };

    // Check if it's a script with arguments
    let parts: Vec<&str> = expanded_path.split_whitespace().collect();
    let (cmd, args) = if parts.len() > 1 {
        (parts[0], &parts[1..])
    } else {
        (expanded_path.as_str(), &[][..])
    };

    let mut child = Command::new(cmd)
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .ok()?;

    // Write input to stdin
    if let Some(mut stdin) = child.stdin.take() {
        let _ = stdin.write_all(input_json.as_bytes());
    }

    // Poll with timeout
    let timeout = Duration::from_millis(timeout_ms);
    let start = Instant::now();
    let poll_interval = Duration::from_millis(10);

    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                // Process finished
                if status.success() {
                    let output = child.wait_with_output().ok()?;
                    let mut result = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !preserve_colors {
                        result = strip_ansi_codes(&result);
                    }
                    return if result.is_empty() {
                        None
                    } else {
                        Some(result)
                    };
                } else {
                    return None;
                }
            }
            Ok(None) => {
                // Still running, check timeout
                if start.elapsed() > timeout {
                    // Timeout - kill process
                    let _ = child.kill();
                    let _ = child.wait(); // Reap zombie
                    return None;
                }
                thread::sleep(poll_interval);
            }
            Err(_) => return None,
        }
    }
}

/// Strip ANSI escape codes from a string
fn strip_ansi_codes(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut chars = s.chars().peekable();

    while let Some(c) = chars.next() {
        if c == '\x1b' {
            // Skip escape sequence
            if chars.peek() == Some(&'[') {
                chars.next(); // consume '['
                // Skip until we hit a letter (end of sequence)
                while let Some(&next) = chars.peek() {
                    if next.is_ascii_alphabetic() {
                        chars.next();
                        break;
                    }
                    chars.next();
                }
            }
        } else {
            result.push(c);
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strip_ansi_codes() {
        let input = "\x1b[31mred\x1b[0m normal \x1b[1;32mbold green\x1b[0m";
        let result = strip_ansi_codes(input);
        assert_eq!(result, "red normal bold green");
    }

    #[test]
    fn test_execute_echo() {
        // Use /bin/echo for portability
        let result = execute_custom_commands("/bin/echo hello", "", 1000, false);
        assert!(result.is_some());
        assert_eq!(result.unwrap(), "hello");
    }
}
