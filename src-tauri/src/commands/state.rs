// ================================================================
// Fit — State Persistence
// Load/save app state as JSON in %APPDATA%/fit/state.json
// ================================================================

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_opened: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TerminalConfig {
    pub id: String,
    pub shell: String,
    pub cwd: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TerminalPanel {
    pub id: String,
    pub shell: String,
    pub cwd: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SplitPanel {
    pub id: String,
    pub direction: String,
    pub children: Vec<PanelNode>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum PanelNode {
    Terminal(TerminalPanel),
    Split(SplitPanel),
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub terminals: Option<Vec<TerminalConfig>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub split_direction: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub root_panel: Option<PanelNode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub show_preview: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preview_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Tab {
    pub id: String,
    #[serde(rename = "type")]
    pub tab_type: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preview_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppState {
    pub workspaces: Vec<Workspace>,
    pub active_workspace_id: Option<String>,
    pub sessions: Vec<Session>,
    pub active_session_id: Option<String>,
    pub open_tabs: Vec<Tab>,
    pub active_tab_id: Option<String>,
    pub file_drawer_open: bool,
    #[serde(default)]
    pub use_web_gl: Option<bool>,
    #[serde(default)]
    pub auto_save: Option<bool>,
    #[serde(default)]
    pub auto_hide_sidebar: bool,
    #[serde(default)]
    pub link_opening_mode: Option<String>,
}


use std::path::Path;

fn resolve_renamed_dir(old_path_str: &str) -> Option<(String, String)> {
    let old_path = Path::new(old_path_str);
    if old_path.is_dir() {
        return None;
    }

    // Get parent directory
    let parent = old_path.parent()?;
    if !parent.is_dir() {
        return None;
    }

    // Get the name of the old directory
    let old_name = old_path.file_name()?.to_string_lossy().to_string();
    let old_name_lower = old_name.to_lowercase();

    // Scan parent directory for subdirectories
    let entries = fs::read_dir(parent).ok()?;
    let mut best_match: Option<(PathBuf, String, usize)> = None;

    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.is_dir() {
                let name = match path.file_name() {
                    Some(n) => n.to_string_lossy().to_string(),
                    None => continue,
                };
                let name_lower = name.to_lowercase();
                
                // Skip common system or development folders to avoid false positives
                if name_lower == ".git" || name_lower == "target" || name_lower == "node_modules" || name_lower == ".ds_store" {
                    continue;
                }

                // Case 1: Exact match (case differences on a case-sensitive filesystem)
                if name_lower == old_name_lower {
                    return Some((path.to_string_lossy().to_string(), name));
                }

                // Case 2: Substring matches (e.g. "Fit Code" -> "Fit", or "Fit" -> "Fit Code")
                if old_name_lower.contains(&name_lower) || name_lower.contains(&old_name_lower) {
                    let score = if old_name_lower.contains(&name_lower) {
                        name_lower.len()
                    } else {
                        old_name_lower.len()
                    };
                    if best_match.is_none() || score > best_match.as_ref().unwrap().2 {
                        best_match = Some((path, name, score));
                    }
                }
            }
        }
    }

    if let Some((matched_path, matched_name, _)) = best_match {
        Some((matched_path.to_string_lossy().to_string(), matched_name))
    } else {
        None
    }
}

fn update_path(path: &str, old_prefix: &str, new_prefix: &str) -> String {
    let path_norm = path.replace('\\', "/");
    let old_prefix_norm = old_prefix.replace('\\', "/");
    let new_prefix_norm = new_prefix.replace('\\', "/");

    if path_norm.starts_with(&old_prefix_norm) {
        let suffix = &path_norm[old_prefix_norm.len()..];
        let joined = format!("{}{}", new_prefix_norm, suffix);
        if new_prefix.contains('\\') {
            joined.replace('/', "\\")
        } else {
            joined
        }
    } else {
        path.to_string()
    }
}

fn update_panel_node_cwd(node: &mut PanelNode, old_prefix: &str, new_prefix: &str) {
    match node {
        PanelNode::Terminal(term) => {
            term.cwd = update_path(&term.cwd, old_prefix, new_prefix);
        }
        PanelNode::Split(split) => {
            for child in &mut split.children {
                update_panel_node_cwd(child, old_prefix, new_prefix);
            }
        }
    }
}

/// Get the path to the state file.
fn state_path() -> PathBuf {
    let app_data = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    let fit_dir = app_data.join("fit");
    fs::create_dir_all(&fit_dir).ok();
    fit_dir.join("state.json")
}

/// Resolve a workspace path if the folder was renamed.
#[tauri::command]
pub fn resolve_workspace_path(path: String) -> Option<(String, String)> {
    resolve_renamed_dir(&path)
}

/// Load state from disk. Returns default state if file doesn't exist.
#[tauri::command]
pub fn load_state() -> AppState {
    let path = state_path();
    let mut state = match fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => AppState::default(),
    };

    // Auto-resolve renamed workspaces
    let mut modified = false;
    let mut resolved_changes = Vec::new();

    for ws in &mut state.workspaces {
        if let Some((new_path, new_name)) = resolve_renamed_dir(&ws.path) {
            resolved_changes.push((ws.id.clone(), ws.path.clone(), new_path.clone(), new_name.clone()));
            ws.path = new_path;
            ws.name = new_name;
            modified = true;
        }
    }

    if modified {
        for (ws_id, old_path, new_path, _) in resolved_changes {
            // Update open tabs
            for tab in &mut state.open_tabs {
                if let Some(ref tab_ws_id) = tab.workspace_id {
                    if tab_ws_id == &ws_id {
                        if let Some(ref mut file_path) = tab.file_path {
                            *file_path = update_path(file_path, &old_path, &new_path);
                        }
                    }
                }
            }

            // Update sessions
            for session in &mut state.sessions {
                if session.workspace_id == ws_id {
                    if let Some(ref mut terminals) = session.terminals {
                        for term in terminals {
                            term.cwd = update_path(&term.cwd, &old_path, &new_path);
                        }
                    }
                    if let Some(ref mut root_panel) = session.root_panel {
                        update_panel_node_cwd(root_panel, &old_path, &new_path);
                    }
                }
            }
        }

        let _ = save_state(state.clone());
    }

    state
}

/// Save state to disk.
#[tauri::command]
pub fn save_state(state: AppState) -> Result<(), String> {
    let path = state_path();
    let json = serde_json::to_string_pretty(&state).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| format!("Failed to save state: {}", e))
}
