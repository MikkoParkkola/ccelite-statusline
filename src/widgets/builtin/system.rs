//! Widgets that report machine and repository state: git, CPU, memory, load, disk.

use super::*;

/// Render git branch
pub fn render_git_branch() -> Option<String> {
    let output = Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .output()
        .ok()?;

    if output.status.success() {
        let branch = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if branch.len() > 20 {
            Some(format!("{}...", &branch[..17]))
        } else {
            Some(branch)
        }
    } else {
        Some("⎇ no git".to_string())
    }
}

/// Render git changes (+added, -removed)
pub fn render_git_changes() -> Option<String> {
    let output = Command::new("git")
        .args(["diff", "--shortstat"])
        .output()
        .ok()?;

    if output.status.success() {
        let stat = String::from_utf8_lossy(&output.stdout);
        if stat.trim().is_empty() {
            return Some("clean".to_string());
        }

        // Parse "X files changed, Y insertions(+), Z deletions(-)"
        let mut insertions = 0;
        let mut deletions = 0;

        for part in stat.split(',') {
            let part = part.trim();
            if part.contains("insertion") {
                if let Some(num) = part.split_whitespace().next() {
                    insertions = num.parse().unwrap_or(0);
                }
            } else if part.contains("deletion") {
                if let Some(num) = part.split_whitespace().next() {
                    deletions = num.parse().unwrap_or(0);
                }
            }
        }

        if insertions > 0 || deletions > 0 {
            Some(format!("+{} -{}", insertions, deletions))
        } else {
            Some("clean".to_string())
        }
    } else {
        None
    }
}

/// Render CPU usage
pub fn render_cpu() -> Option<String> {
    // macOS: use top -l 1
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("ps")
            .args(["-A", "-o", "%cpu"])
            .output()
            .ok()?;

        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout);
            let total: f64 = text
                .lines()
                .skip(1)
                .filter_map(|l| l.trim().parse::<f64>().ok())
                .sum();

            // Rough estimate - divide by number of cores
            let cores = num_cpus();
            let pct = (total / cores as f64).min(100.0) as u32;
            return Some(format!("{}%", pct));
        }
    }

    Some("?".to_string())
}

/// Get number of CPU cores
fn num_cpus() -> usize {
    std::thread::available_parallelism()
        .map(|p| p.get())
        .unwrap_or(4)
}

/// Render memory usage percentage
pub fn render_memory_percent() -> Option<String> {
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("vm_stat").output().ok()?;

        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout);

            let mut free = 0u64;
            let mut active = 0u64;
            let mut inactive = 0u64;
            let mut wired = 0u64;

            for line in text.lines() {
                if line.contains("Pages free:") {
                    if let Some(num) = extract_number(line) {
                        free = num;
                    }
                } else if line.contains("Pages active:") {
                    if let Some(num) = extract_number(line) {
                        active = num;
                    }
                } else if line.contains("Pages inactive:") {
                    if let Some(num) = extract_number(line) {
                        inactive = num;
                    }
                } else if line.contains("Pages wired down:") {
                    if let Some(num) = extract_number(line) {
                        wired = num;
                    }
                }
            }

            let total = free + active + inactive + wired;
            if total > 0 {
                let used = active + wired;
                let pct = (used as f64 / total as f64 * 100.0) as u32;
                return Some(format!("{}%", pct));
            }
        }
    }

    Some("?".to_string())
}

fn extract_number(line: &str) -> Option<u64> {
    line.split_whitespace()
        .filter_map(|s| s.trim_end_matches('.').parse().ok())
        .next()
}

/// Render free disk space on the main volume.
///
/// Format: "92G", "1.2T", "450M"
/// One-minute load average.
///
/// The `load-average` type used to be aliased to `render_disk_free`, so a cell
/// labelled "Load:" reported free disk space — 253G where a load figure belongs.
pub fn render_load_average() -> Option<String> {
    #[cfg(target_os = "macos")]
    {
        let mut loads = [0f64; 3];
        let count = unsafe { libc::getloadavg(loads.as_mut_ptr(), 3) };
        if count > 0 {
            return Some(format!("{:.2}", loads[0]));
        }
    }

    None
}

pub fn render_disk_free() -> Option<String> {
    #[cfg(target_os = "macos")]
    {
        // statvfs on / — avoids spawning a process
        use std::mem::MaybeUninit;
        let path = std::ffi::CString::new("/").ok()?;
        let mut stat = MaybeUninit::<libc::statvfs>::uninit();
        let rc = unsafe { libc::statvfs(path.as_ptr(), stat.as_mut_ptr()) };
        if rc == 0 {
            let stat = unsafe { stat.assume_init() };
            let free_bytes = stat.f_bavail as u64 * stat.f_frsize as u64;
            let gb = free_bytes as f64 / 1_073_741_824.0;
            return Some(if gb >= 1000.0 {
                format!("{:.1}T", gb / 1024.0)
            } else if gb >= 10.0 {
                format!("{:.0}G", gb)
            } else if gb >= 1.0 {
                format!("{:.1}G", gb)
            } else {
                format!("{:.0}M", gb * 1024.0)
            });
        }
    }

    Some("?".to_string())
}

/// Render commits in the last 12 hours
///
/// Format: "N"
pub fn render_commits_today() -> Option<String> {
    let output = Command::new("git")
        .args(["log", "--oneline", "--since=12 hours ago"])
        .output()
        .ok()?;
    let count = String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter(|l| !l.is_empty())
        .count();
    Some(count.to_string())
}
