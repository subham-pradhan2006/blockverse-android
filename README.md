# GitHub Cloud APK Build (no Android Studio on your PC)

**Start with `GITHUB_APK_INSTRUCTIONS.md`.** Push this project to a GitHub repo and run the provided Actions workflow. No Android SDK installation is needed locally.

---

# Blockverse 3D — Android game build project

This is an **Android APK build project**, not a precompiled APK. The uploaded source is retained unmodified under `original/`, and the mobile-adapted runtime is in `src/App.tsx`.

## Build APK on Windows 10/11

1. Install Node.js 20 or 22, and Android Studio with Android SDK + JDK 17. In Android Studio's SDK Manager, install an Android SDK platform (API 35 recommended), platform tools and build tools. Set `ANDROID_HOME`/`ANDROID_SDK_ROOT` or let Android Studio create `android/local.properties` with `sdk.dir`.
2. Unzip into a writable folder. Double-click **BUILD_ANDROID_APK_WINDOWS.bat**. The first build downloads npm packages and Gradle dependencies; internet access is needed.
3. Install `Blockverse_3D_Android_Debug.apk` on an Android phone (allow installation from this source when prompted).
4. If the script cannot locate the SDK, run `npm install`, `npm run android:init`, open `android/` in Android Studio, then Build > Build APK(s). The APK is generated at `android/app/build/outputs/apk/debug/app-debug.apk`.

## Mobile gameplay controls

* **Landscape:** app's Android activity is configured to landscape.
* Left D-pad: forward / backwards / strafe left / strafe right.
* Swipe/drag the **right-middle game area** to turn and look.
* JUMP, RUN, MINE/HIT (hold), PLACE (hold), FLY.
* Game HUD retains inventory, hotbar, pause and menus from the existing source.

## Local save and automatic resume

* IndexedDB (`blockverse_mobile_worlds_v1`) stores the complete current game snapshot, including world blocks, mob state, position, camera rotation, health, inventory and settings.
* Automatic checkpoints every ~12 seconds, also on page hide/background events and when manually saving.
* Reopening restores the latest checkpoint **paused**. Continue using Resume Gameplay.
* Save data is **app-private**. Uninstalling or clearing the app's storage generally deletes saves. Back up important worlds with the game JSON export where supported by Android's WebView.
* World size is large and WebGL rendering is demanding; performance depends on phone GPU and memory. This code has not been hardware-tested.

## Integrity / boundaries

* `original/blockverse_3d_sandbox (1).tsx` is the original user upload (not edited).
* `src/App.tsx` is a derivative needed for Android touch controls and session save/resume.
* Capacitor packages the compiled web game in a native Android WebView; **no browser tab or web server** is needed to play installed APK. Internet is needed only while building.
* An APK cannot be compiled in the supplied execution environment because it lacks the Android SDK and cannot download build dependencies. This ZIP is intended for building locally with Android Studio.
