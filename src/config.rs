//! Configuration loading for ccstatusline

use crate::types::Settings;
use anyhow::{Context, Result};
use std::fs;
use std::path::PathBuf;

/// Get the config directory path
pub fn config_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".config")
        .join("ccstatusline")
}

/// Get the settings file path
pub fn settings_path() -> PathBuf {
    config_dir().join("settings.json")
}

/// Load settings from the config file
pub fn load_settings() -> Result<Settings> {
    let path = settings_path();

    if !path.exists() {
        // Return default settings if no config file exists
        return Ok(Settings::default());
    }

    let content = fs::read_to_string(&path)
        .with_context(|| format!("Failed to read settings from {}", path.display()))?;

    let settings: Settings = serde_json::from_str(&content)
        .with_context(|| format!("Failed to parse settings from {}", path.display()))?;

    Ok(settings)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_dir() {
        let dir = config_dir();
        assert!(dir.to_string_lossy().contains("ccstatusline"));
    }
}
