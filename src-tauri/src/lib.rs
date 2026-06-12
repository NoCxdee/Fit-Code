// ================================================================
// Fit — Tauri Application Entry Point
// Wires up all IPC commands, plugins, and managed state.
// ================================================================

mod commands;
pub mod audio_toolkit;
pub mod managers;
pub mod settings;
pub mod portable;
pub mod audio_feedback;

use commands::pty::PtyManager;
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let pty_manager = Arc::new(PtyManager::new());

    tauri::Builder::default()
        .manage(pty_manager)
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Create main window programmatically to inject script into all frames globally
            let win_builder = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::default(),
            )
            .title("Fit")
            .inner_size(1280.0, 800.0)
            .min_inner_size(900.0, 600.0)
            .resizable(true)
            .center();

            #[cfg(target_os = "macos")]
            let win_builder = win_builder
                .decorations(true)
                .title_bar_style(tauri::TitleBarStyle::Overlay)
                .hidden_title(true);

            #[cfg(not(target_os = "macos"))]
            let win_builder = win_builder.decorations(false);

            let win_builder = win_builder.initialization_script_for_all_frames(r#"
                if (typeof window !== 'undefined') {
                  if (window.self !== window.top) {
                    console.log('[FIT DEBUG Global] Inspector script loaded inside iframe.');
                    
                    let active = false;

                    const overHandler = (e) => {
                      if (!active) return;
                      e.stopPropagation();
                      e.target.classList.add('fit-inspector-hover');
                    };

                    const outHandler = (e) => {
                      if (!active) return;
                      e.target.classList.remove('fit-inspector-hover');
                    };

                    const clickHandler = (e) => {
                      if (!active) return;
                      e.preventDefault();
                      e.stopPropagation();

                      const target = e.target;
                      const data = target.outerHTML;

                      target.classList.remove('fit-inspector-hover');
                      window.parent.postMessage({ type: 'FIT_INSPECTOR_CAPTURED', payload: data }, '*');
                      active = false;
                      document.querySelectorAll('.fit-inspector-hover').forEach(el => el.classList.remove('fit-inspector-hover'));
                    };

                    const init = () => {
                      console.log('[FIT DEBUG Global] DOMContentLoaded. Initializing style and listeners.');
                      const style = document.createElement('style');
                      style.innerHTML = `
                        .fit-inspector-hover {
                          outline: 2px dashed #d4a857 !important;
                          outline-offset: -2px !important;
                          background-color: rgba(212, 168, 87, 0.2) !important;
                          cursor: crosshair !important;
                        }
                      `;
                      document.head.appendChild(style);

                      document.body.addEventListener('mouseover', overHandler, true);
                      document.body.addEventListener('mouseout', outHandler, true);
                      document.body.addEventListener('click', clickHandler, true);
                    };

                    if (document.readyState === 'loading') {
                      document.addEventListener('DOMContentLoaded', init);
                    } else {
                      init();
                    }

                    window.addEventListener('message', (e) => {
                      if (e.data && e.data.type === 'FIT_TOGGLE_INSPECTOR') {
                        active = e.data.payload;
                        if (!active) {
                          document.querySelectorAll('.fit-inspector-hover').forEach(el => el.classList.remove('fit-inspector-hover'));
                        }
                      }
                    });

                    // Send ready signal to parent
                    window.parent.postMessage({ type: 'FIT_INSPECTOR_READY' }, '*');
                  }
                }
            "#);

            initialize_core_logic(app.handle());
            win_builder.build()?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Filesystem
            commands::filesystem::read_dir,
            commands::filesystem::read_file,
            commands::filesystem::write_file,
            commands::filesystem::create_file,
            commands::filesystem::create_dir,
            commands::filesystem::search_files,
            commands::filesystem::rename_item,
            commands::filesystem::delete_item,
            commands::filesystem::check_directory_exists,
            // PTY
            commands::pty::pty_spawn,
            commands::pty::pty_write,
            commands::pty::pty_resize,
            commands::pty::pty_kill,
            // Ports
            commands::ports::scan_ports,
            // Shell
            commands::shell::detect_shells,
            commands::shell::relaunch_app,
            // State
            commands::state::load_state,
            commands::state::save_state,
            commands::state::resolve_workspace_path,
            // Git
            commands::git::git_status,
            commands::git::git_stage,
            commands::git::git_unstage,
            commands::git::git_stage_all,
            commands::git::git_unstage_all,
            commands::git::git_commit,
            commands::git::git_push,
            commands::git::git_pull,
            commands::git::git_fetch,
            commands::git::git_show_file,
            commands::git::git_discard_file,
            commands::git::git_run_command,
            commands::clipboard::get_clipboard_files,
            // Audio STT Commands
            commands::audio::check_custom_sounds,
            commands::audio::get_windows_microphone_permission_status,
            commands::audio::open_microphone_privacy_settings,
            commands::audio::update_microphone_mode,
            commands::audio::get_microphone_mode,
            commands::audio::get_available_microphones,
            commands::audio::set_selected_microphone,
            commands::audio::get_selected_microphone,
            commands::audio::get_available_output_devices,
            commands::audio::set_selected_output_device,
            commands::audio::get_selected_output_device,
            commands::audio::play_test_sound,
            commands::audio::set_clamshell_microphone,
            commands::audio::get_clamshell_microphone,
            commands::audio::is_recording,
            // Models STT Commands
            commands::models::get_available_models,
            commands::models::get_model_info,
            commands::models::download_model,
            commands::models::delete_model,
            commands::models::set_active_model,
            commands::models::get_current_model,
            commands::models::get_transcription_model_status,
            commands::models::is_model_loading,
            commands::models::has_any_models_available,
            commands::models::has_any_models_or_downloads,
            commands::models::cancel_download,
            // Transcription STT Commands
            commands::transcription::get_app_settings,
            commands::transcription::save_app_settings,
            commands::transcription::set_model_unload_timeout,
            commands::transcription::get_model_load_status,
            commands::transcription::unload_model_manually,
            commands::transcription::start_transcription,
            commands::transcription::stop_transcription,
            commands::transcription::cancel_transcription,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Fit");
}

fn initialize_core_logic(app_handle: &tauri::AppHandle) {
    let model_manager = Arc::new(
        managers::model::ModelManager::new(app_handle).expect("Failed to initialize model manager")
    );
    let transcription_manager = Arc::new(
        managers::transcription::TranscriptionManager::new(app_handle, model_manager.clone())
            .expect("Failed to initialize transcription manager")
    );
    let recording_manager = Arc::new(
        managers::audio::AudioRecordingManager::new(app_handle).expect("Failed to initialize recording manager")
    );

    // Apply accelerator preferences before any model loads
    managers::transcription::apply_accelerator_settings(app_handle);

    // Add managers to Tauri's managed state
    app_handle.manage(recording_manager);
    app_handle.manage(model_manager);
    app_handle.manage(transcription_manager);
}
