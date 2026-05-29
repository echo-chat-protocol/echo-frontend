use tauri::Manager;

/// Write image bytes to the app cache dir and return the absolute path.
/// Used to stage a message image/GIF so the (vendored) notification plugin can
/// render it as a BigPictureStyle attachment via `file://<path>`.
#[tauri::command]
fn save_notification_image(
  app: tauri::AppHandle,
  data: Vec<u8>,
  ext: String,
) -> Result<String, String> {
  use std::io::Write;

  let base = app.path().app_cache_dir().map_err(|e| e.to_string())?;
  let dir = base.join("notif-media");
  std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

  // Keep the directory bounded WITHOUT clobbering files still in use: a single
  // notification may stage several files (avatar + image), and several
  // notifications may be built back-to-back. Only drop files older than 2
  // minutes — long past the moment the system decodes them into the Notification.
  if let Ok(entries) = std::fs::read_dir(&dir) {
    let now = std::time::SystemTime::now();
    for entry in entries.flatten() {
      let stale = entry
        .metadata()
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| now.duration_since(t).ok())
        .map(|age| age.as_secs() > 120)
        .unwrap_or(false);
      if stale {
        let _ = std::fs::remove_file(entry.path());
      }
    }
  }

  let safe_ext: String = ext
    .chars()
    .filter(|c| c.is_ascii_alphanumeric())
    .take(8)
    .collect();
  let safe_ext = if safe_ext.is_empty() { "img".to_string() } else { safe_ext };

  let stamp = std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .map(|d| d.as_millis())
    .unwrap_or(0);
  let path = dir.join(format!("notif-{stamp}.{safe_ext}"));

  let mut file = std::fs::File::create(&path).map_err(|e| e.to_string())?;
  file.write_all(&data).map_err(|e| e.to_string())?;

  Ok(path.to_string_lossy().to_string())
}

/// Download an image from a URL and save it to the app cache dir, returning the absolute path.
/// This bypasses WebView CORS and avoids doing network IO on the Android UI thread.
#[tauri::command]
fn save_notification_image_from_url(
  app: tauri::AppHandle,
  url: String,
  ext_hint: Option<String>,
  timeout_ms: Option<u64>,
) -> Result<String, String> {
  // Best-effort content fetch with a sane timeout.
  let timeout = std::time::Duration::from_millis(timeout_ms.unwrap_or(4000));
  let resp = reqwest::blocking::Client::builder()
    .timeout(timeout)
    .build()
    .map_err(|e| e.to_string())?
    .get(&url)
    .send()
    .map_err(|e| e.to_string())?;
  if !resp.status().is_success() {
    return Err(format!("fetch failed: HTTP {}", resp.status()));
  }
  // Capture content-type before consuming the response body
  let ct = resp
    .headers()
    .get(reqwest::header::CONTENT_TYPE)
    .and_then(|v| v.to_str().ok())
    .unwrap_or("")
    .to_lowercase();
  let bytes = resp.bytes().map_err(|e| e.to_string())?;
  if bytes.is_empty() {
    return Err("empty response".to_string());
  }
  // Derive an extension from content-type if possible.
  let mut ext = ext_hint.unwrap_or_default();
  if ext.is_empty() {
    if let Some(idx) = ct.rfind('/') {
      ext = ct[(idx + 1)..].to_string();
    }
  }
  if ext.is_empty() {
    ext = "img".to_string();
  }

  // Reuse the same on-disk writer as the bytes-based path.
  save_notification_image(app, bytes.to_vec(), ext)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_notification::init())
    .invoke_handler(tauri::generate_handler![save_notification_image, save_notification_image_from_url])
    .setup(|app| {
      if cfg!(debug_assertions) {
        let _ = app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        );
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
