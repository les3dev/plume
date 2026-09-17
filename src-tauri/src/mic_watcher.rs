//! Watches the system default input device via CoreAudio and notifies the
//! frontend when the microphone gets activated by *any* process (Discord,
//! Teams, Google Meet, etc.), not just by Plume's own capture.
//!
//! Uses `kAudioDevicePropertyDeviceIsRunningSomewhere`, the same public
//! CoreAudio property macOS menu-bar mic-indicator apps rely on — it flips to
//! true as soon as any client (including the system itself) opens the
//! device, and back to false once nothing is using it anymore.

use crate::capture_state::CaptureState;
use coreaudio_sys::{
    kAudioDevicePropertyDeviceIsRunningSomewhere, kAudioHardwarePropertyDefaultInputDevice,
    kAudioObjectPropertyScopeGlobal, kAudioObjectSystemObject, AudioObjectAddPropertyListener,
    AudioObjectGetPropertyData, AudioObjectID, AudioObjectPropertyAddress,
    AudioObjectRemovePropertyListener, OSStatus,
};
use mac_notification_sys::{MainButton, Notification, NotificationResponse};
use std::os::raw::c_void;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use tauri::{AppHandle, Emitter, Manager};

// kAudioObjectPropertyElementMain: stable value (0) across SDKs; the symbol
// itself was renamed from kAudioObjectPropertyElementMaster in recent SDKs,
// so we use the raw value instead of depending on either name existing.
const ELEMENT_MAIN: u32 = 0;

struct WatcherCtx {
    app: AppHandle,
    was_active: AtomicBool,
    watched_device: AtomicU32,
}

fn running_somewhere_address() -> AudioObjectPropertyAddress {
    AudioObjectPropertyAddress {
        mSelector: kAudioDevicePropertyDeviceIsRunningSomewhere,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: ELEMENT_MAIN,
    }
}

fn default_input_device_address() -> AudioObjectPropertyAddress {
    AudioObjectPropertyAddress {
        mSelector: kAudioHardwarePropertyDefaultInputDevice,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: ELEMENT_MAIN,
    }
}

fn get_default_input_device() -> Option<AudioObjectID> {
    let address = default_input_device_address();
    let mut device_id: AudioObjectID = 0;
    let mut size = std::mem::size_of::<AudioObjectID>() as u32;
    let status = unsafe {
        AudioObjectGetPropertyData(
            kAudioObjectSystemObject,
            &address,
            0,
            std::ptr::null(),
            &mut size,
            &mut device_id as *mut _ as *mut c_void,
        )
    };
    (status == 0).then_some(device_id)
}

fn is_running_somewhere(device_id: AudioObjectID) -> bool {
    let address = running_somewhere_address();
    let mut value: u32 = 0;
    let mut size = std::mem::size_of::<u32>() as u32;
    let status = unsafe {
        AudioObjectGetPropertyData(
            device_id,
            &address,
            0,
            std::ptr::null(),
            &mut size,
            &mut value as *mut _ as *mut c_void,
        )
    };
    status == 0 && value != 0
}

unsafe extern "C" fn running_listener(
    device_id: AudioObjectID,
    _num_addresses: u32,
    _addresses: *const AudioObjectPropertyAddress,
    client_data: *mut c_void,
) -> OSStatus {
    let ctx = &*(client_data as *const WatcherCtx);
    let now_active = is_running_somewhere(device_id);
    let was_active = ctx.was_active.swap(now_active, Ordering::SeqCst);

    if now_active && !was_active {
        let already_recording = ctx
            .app
            .try_state::<CaptureState>()
            .map(|state| state.sys_engine.lock().unwrap().is_some())
            .unwrap_or(false);

        if !already_recording {
            trigger_activity_notification(ctx.app.clone());
        }
    }

    0
}

/// Shows a native notification offering to create a meeting, and emits
/// `mic-activity-detected` to the frontend if the user clicks it.
///
/// `tauri-plugin-notification`'s action-button support only exists on
/// mobile — its desktop backend (`notify-rust`) has no click/action
/// callback at all — so this talks to macOS's legacy (but still fully
/// functional) `NSUserNotificationCenter` API directly via
/// `mac-notification-sys`, which does support a clickable action button and
/// blocks synchronously until the user interacts with it. Run on its own
/// thread since that wait can be arbitrarily long (the notification stays
/// in Notification Center after the banner disappears).
pub fn trigger_activity_notification(app: AppHandle) {
    std::thread::spawn(move || {
        let response = Notification::new()
            .title("Plume")
            .message("Microphone activé - créer une réunion ?")
            .main_button(MainButton::SingleAction("Créer une réunion"))
            .wait_for_click(true)
            .send();

        let confirmed = matches!(
            response,
            Ok(NotificationResponse::ActionButton(_)) | Ok(NotificationResponse::Click)
        );

        if confirmed {
            let _ = app.emit("mic-activity-detected", ());
        }
    });
}

unsafe extern "C" fn default_device_listener(
    _object_id: AudioObjectID,
    _num_addresses: u32,
    _addresses: *const AudioObjectPropertyAddress,
    client_data: *mut c_void,
) -> OSStatus {
    let ctx = &*(client_data as *const WatcherCtx);
    let Some(new_device) = get_default_input_device() else {
        return 0;
    };

    let old_device = ctx.watched_device.swap(new_device, Ordering::SeqCst);
    if old_device == new_device {
        return 0;
    }

    let running_addr = running_somewhere_address();
    // Best-effort: the old device may already be gone (e.g. unplugged), so
    // ignore errors from removing its listener.
    AudioObjectRemovePropertyListener(
        old_device,
        &running_addr,
        Some(running_listener),
        client_data,
    );

    ctx.was_active
        .store(is_running_somewhere(new_device), Ordering::SeqCst);
    AudioObjectAddPropertyListener(
        new_device,
        &running_addr,
        Some(running_listener),
        client_data,
    );

    0
}

/// Registers the CoreAudio listeners for the lifetime of the app. Safe to
/// call once from `.setup()`; the leaked context lives until process exit.
pub fn start(app: AppHandle) {
    let Some(device_id) = get_default_input_device() else {
        eprintln!("[mic_watcher] no default input device found, skipping");
        return;
    };

    let ctx = Box::into_raw(Box::new(WatcherCtx {
        app,
        was_active: AtomicBool::new(is_running_somewhere(device_id)),
        watched_device: AtomicU32::new(device_id),
    })) as *mut c_void;

    let running_addr = running_somewhere_address();
    let status = unsafe {
        AudioObjectAddPropertyListener(device_id, &running_addr, Some(running_listener), ctx)
    };
    if status != 0 {
        eprintln!("[mic_watcher] failed to register running-somewhere listener: {status}");
    }

    let default_device_addr = default_input_device_address();
    let status = unsafe {
        AudioObjectAddPropertyListener(
            kAudioObjectSystemObject,
            &default_device_addr,
            Some(default_device_listener),
            ctx,
        )
    };
    if status != 0 {
        eprintln!("[mic_watcher] failed to register default-device listener: {status}");
    }
}
