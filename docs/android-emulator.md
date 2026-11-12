# Android emulator

A local Android Virtual Device (AVD) for running the development build without the physical phone,
and for driving the app from the command line with `adb` (screenshots, UI tree, taps, text, logs).

JS changes hot-reload through Metro. Rebuild and reinstall the APK only when native modules change
(`package.json` dependencies with native code, or config plugins in `app.json`).

## Safety rule: always target the emulator by serial

The physical phone holds the app's on-device SQLite database with real data. Uninstalling or
clearing the app there wipes it. When more than one device is connected, a bare `adb` command fails
or hits the wrong device, so every command below passes `-s "$SERIAL"`.

```bash
adb devices -l                 # emulators show up as emulator-5554, emulator-5556, ...
export SERIAL=emulator-5554
```

Never run `adb uninstall`, `adb shell pm clear`, or `adb install` without `-r` against the phone.

## One-time setup

Prerequisites: Android Studio installed (it provides `~/Android/Sdk`), `/dev/kvm` available.

1. Install **Android SDK Command-line Tools (latest)**: Android Studio → Settings → Languages &
   Frameworks → Android SDK → SDK Tools. This adds `~/Android/Sdk/cmdline-tools/latest/bin`
   (`sdkmanager`, `avdmanager`).

   ```bash
   export ANDROID_HOME="$HOME/Android/Sdk"
   export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/emulator:$PATH"
   ```

   `sdkmanager` prints a deprecation warning pointing at the new `android sdk` CLI. It still works.

2. Install the system image. The app targets API 36 (`compileSdk` / `targetSdk` come from React
   Native 0.81's version catalog; `app.json` does not override them). Google APIs (not Play Store)
   allows `adb root`.

   ```bash
   sdkmanager --install "system-images;android-36;google_apis;x86_64"
   ```

3. Create the AVD on a current Pixel profile (`avdmanager list device -c` lists them):

   ```bash
   echo no | avdmanager create avd -n payroll_pixel10_api36 \
     -k "system-images;android-36;google_apis;x86_64" -d pixel_10
   ```

4. Tune `~/.android/avd/payroll_pixel10_api36.avd/config.ini`:

   ```ini
   hw.gpu.enabled=yes
   hw.ramSize=4096
   hw.keyboard=yes
   ```

   `disk.dataPartition.path=<temp>` is a placeholder. At first boot it resolves to
   `userdata-qemu.img` inside the AVD folder, so app data persists across restarts.

## Boot

```bash
emulator -avd payroll_pixel10_api36 -no-snapshot-save -no-boot-anim -gpu host &
adb -s emulator-5554 wait-for-device
until [ "$(adb -s emulator-5554 shell getprop sys.boot_completed | tr -d '\r')" = 1 ]; do sleep 2; done
```

On this host the emulator logs `Your GPU cannot be used for hardware rendering` and falls back to
software rendering. It still boots and runs the app.

## Install the development build

Option A: the APK from the local EAS build (same binary the phone uses).

Point the build at your own SDK and JDK through environment variables (the values below are
examples; use the paths of your machine):

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export JAVA_HOME=/path/to/your/jdk
pnpm dlx eas-cli build -p android --profile development --local
adb -s "$SERIAL" install -r build-<timestamp>.apk
```

`build-*.apk` files land in the repo root and are git-ignored (`*.apk`). To confirm an APK is a dev
build, check that it has no embedded `assets/index.android.bundle`:

```bash
unzip -Z1 build-<timestamp>.apk | rg index.android.bundle   # no output = dev build
```

Option B: `pnpm exec expo run:android -d <avd-or-serial>` builds locally with Gradle and installs in
one step; incremental rebuilds are faster than EAS. It runs prebuild, which generates an `android/`
folder. That folder is git-ignored (`/android` in `.gitignore`) and must stay untracked: this
project uses Continuous Native Generation, so `app.json` and config plugins are the source of truth.

## Connect to Metro

```bash
pnpm start --dev-client
adb -s "$SERIAL" reverse tcp:8081 tcp:8081
adb -s "$SERIAL" shell am start -a android.intent.action.VIEW \
  -d 'exp+homeslip://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081' \
  io.github.vaayroon.homeslip
```

The first launch shows the Expo developer menu sheet. Close it with `KEYCODE_BACK`; tapping
**Continue** expands the full menu instead.

## Drive the app

Screenshot:

```bash
adb -s "$SERIAL" exec-out screencap -p > screen.png
```

UI tree with element bounds (`text`, `content-desc`, `bounds="[x1,y1][x2,y2]"`):

```bash
adb -s "$SERIAL" shell uiautomator dump /sdcard/ui.xml
adb -s "$SERIAL" exec-out cat /sdcard/ui.xml > ui.xml
```

Tap the centre of an element's bounds, type, press keys, swipe:

```bash
adb -s "$SERIAL" shell input tap 902 358
adb -s "$SERIAL" shell input text 'Test%sEmployee'     # %s is a space
adb -s "$SERIAL" shell input keyevent KEYCODE_BACK     # also hides the soft keyboard
adb -s "$SERIAL" shell input swipe 540 1800 540 600 300
```

Hide the soft keyboard before swiping. A swipe that starts on the keyboard is read as gesture
typing and inserts words into the focused field. Check with:

```bash
adb -s "$SERIAL" shell dumpsys input_method | rg mInputShown
```

JS logs (`console.*`, warnings, errors):

```bash
adb -s "$SERIAL" logcat -c
adb -s "$SERIAL" logcat -s ReactNativeJS:V
```

Use only fake data in the emulator (see the privacy rules in `CLAUDE.md`).

> **Rename note:** the app id changed from the template value to `io.github.vaayroon.homeslip`.
> Android treats it as a different app: uninstall the old development build, install a fresh
> one, and re-enter any local data (the old on-device database does not migrate).
