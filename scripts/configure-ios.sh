#!/usr/bin/env bash
# Applies the App Store configuration to the Capacitor iOS project.
# Run on macOS after `npx cap add ios` (the GitHub workflow does this for you).
#
#   MARKETING_VERSION=1.0.0 BUILD_NUMBER=7 bash scripts/configure-ios.sh
#
# - Landscape only (iPhone + iPad), iPad full screen (no multitasking)
# - Hidden status bar, auto-hiding home indicator, no WebView bounce/zoom
# - Playback audio session mixed with other audio (works with the silent switch on)
# - App icon (1024, no alpha) + launch screen image
# - iOS 16.0 minimum, universal (iPhone + iPad), version/build numbers
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/ios/App/App"
PLIST="$APP/Info.plist"
PB=/usr/libexec/PlistBuddy
MARKETING_VERSION="${MARKETING_VERSION:-1.0.0}"
BUILD_NUMBER="${BUILD_NUMBER:-1}"
DISPLAY_NAME="${DISPLAY_NAME:-Snaily Math}"

[ -f "$PLIST" ] || { echo "Info.plist not found at $PLIST (did you run 'npx cap add ios'?)"; exit 1; }
echo "== configuring $APP"

# ---------------------------------------------------------------- Info.plist
pset() { # key type value
  $PB -c "Delete :$1" "$PLIST" >/dev/null 2>&1 || true
  $PB -c "Add :$1 $2 $3" "$PLIST"
}
for KEY in UISupportedInterfaceOrientations "UISupportedInterfaceOrientations~ipad"; do
  $PB -c "Delete :$KEY" "$PLIST" >/dev/null 2>&1 || true
  $PB -c "Add :$KEY array" "$PLIST"
  $PB -c "Add :$KEY:0 string UIInterfaceOrientationLandscapeLeft" "$PLIST"
  $PB -c "Add :$KEY:1 string UIInterfaceOrientationLandscapeRight" "$PLIST"
done
pset UIRequiresFullScreen bool true
pset UIStatusBarHidden bool true
pset UIViewControllerBasedStatusBarAppearance bool false
pset ITSAppUsesNonExemptEncryption bool false
pset CFBundleDisplayName string "$DISPLAY_NAME"
pset CFBundleShortVersionString string "$MARKETING_VERSION"
pset CFBundleVersion string "$BUILD_NUMBER"
pset LSApplicationCategoryType string "public.app-category.education"
# Modern devices only (arm64); the template still says armv7.
$PB -c "Delete :UIRequiredDeviceCapabilities" "$PLIST" >/dev/null 2>&1 || true
$PB -c "Add :UIRequiredDeviceCapabilities array" "$PLIST"
$PB -c "Add :UIRequiredDeviceCapabilities:0 string arm64" "$PLIST"
# Kids app: no tracking, no network permissions requested.
$PB -c "Delete :NSAppTransportSecurity" "$PLIST" >/dev/null 2>&1 || true

# ------------------------------------------- AppDelegate + view controller
python3 - "$APP" <<'PY'
import pathlib, re, sys
app = pathlib.Path(sys.argv[1])

ad = app / "AppDelegate.swift"
s = ad.read_text()
if "SnailyConfigured" not in s:
    if "import AVFoundation" not in s:
        s = s.replace("import Capacitor", "import Capacitor\nimport AVFoundation\nimport WebKit", 1)
    hook = ("        // SnailyConfigured: effects and voice play even with the silent switch on,\n"
            "        // and mix with (never stop) other audio.\n"
            "        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])\n")
    m = re.search(r"didFinishLaunchingWithOptions[^{]*\{\n", s)
    if not m:
        sys.exit("could not find didFinishLaunchingWithOptions in AppDelegate.swift")
    s = s[:m.end()] + hook + s[m.end():]
    s += '''

/// Root view controller (set in Main.storyboard). Hides the home indicator
/// and status bar, and turns off WebView bounce, zoom and swipe navigation.
class MainViewController: CAPBridgeViewController {
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { [.bottom] }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        guard let wv = webView else { return }
        wv.scrollView.bounces = false
        wv.scrollView.alwaysBounceVertical = false
        wv.scrollView.alwaysBounceHorizontal = false
        wv.scrollView.isScrollEnabled = false
        wv.scrollView.contentInsetAdjustmentBehavior = .never
        wv.scrollView.pinchGestureRecognizer?.isEnabled = false
        wv.allowsBackForwardNavigationGestures = false
        wv.allowsLinkPreview = false
        wv.isOpaque = false
        wv.backgroundColor = UIColor(red: 250/255, green: 246/255, blue: 234/255, alpha: 1)
        wv.scrollView.backgroundColor = wv.backgroundColor
    }
}
'''
    ad.write_text(s)
    print("patched AppDelegate.swift")

sb = app / "Base.lproj" / "Main.storyboard"
t = sb.read_text()
t2, n = re.subn(r'customClass="CAPBridgeViewController"(\s+customModule="Capacitor")?',
                'customClass="MainViewController" customModule="App" customModuleProvider="target"', t)
if n == 0 and 'customClass="MainViewController"' not in t:
    sys.exit("could not find CAPBridgeViewController in Main.storyboard")
sb.write_text(t2)
print("patched Main.storyboard")
PY

# -------------------------------------------------------- icon + launch art
ICONSET="$APP/Assets.xcassets/AppIcon.appiconset"
SPLASH="$APP/Assets.xcassets/Splash.imageset"
replace_pngs() { # dir source
  local dir="$1" src="$2" f w h
  [ -d "$dir" ] || { echo "missing $dir"; return 0; }
  for f in "$dir"/*.png; do
    [ -e "$f" ] || continue
    w=$(sips -g pixelWidth "$f" | awk '/pixelWidth/{print $2}')
    h=$(sips -g pixelHeight "$f" | awk '/pixelHeight/{print $2}')
    cp "$src" "$f"
    # Only resample when the size differs (sips can add an alpha channel,
    # which App Store icons must not have).
    if [ "$(sips -g pixelWidth "$f" | awk '/pixelWidth/{print $2}')" != "$w" ]; then
      sips -z "$h" "$w" "$f" >/dev/null
    fi
    echo "image $(basename "$f") ${w}x${h}"
  done
}
replace_pngs "$ICONSET" "$ROOT/resources/AppIcon-1024.png"
replace_pngs "$SPLASH" "$ROOT/resources/Splash-2732.png"
# Launch screen background = page cream (behind the splash image).
LS="$APP/Base.lproj/LaunchScreen.storyboard"
if [ -f "$LS" ]; then
  python3 - "$LS" <<'PY'
import re, sys, pathlib
p = pathlib.Path(sys.argv[1]); s = p.read_text()
s = re.sub(r'<color key="backgroundColor"[^/]*/>',
           '<color key="backgroundColor" red="0.980" green="0.965" blue="0.918" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>', s)
p.write_text(s)
PY
fi

# ------------------------------------------- privacy manifest (required)
# Declares UserDefaults use (Capacitor Preferences), no tracking, no data
# collected. Added to the App target's resources with the xcodeproj gem
# (ships with CocoaPods on GitHub's macOS images).
cp "$ROOT/resources/PrivacyInfo.xcprivacy" "$APP/PrivacyInfo.xcprivacy"
ruby -e 'require "xcodeproj"' 2>/dev/null || gem install xcodeproj --no-document --user-install
ruby - "$ROOT/ios/App/App.xcodeproj" <<'RB'
begin; require "xcodeproj"; rescue LoadError
  Gem.paths = { "GEM_PATH" => [Gem.user_dir, *Gem.path].join(File::PATH_SEPARATOR) }; require "xcodeproj"; end
proj = Xcodeproj::Project.open(ARGV[0])
target = proj.targets.find { |t| t.name == "App" } or abort("App target not found")
group = proj.main_group.find_subpath("App", false) or abort("App group not found")
unless group.files.any? { |f| f.path == "PrivacyInfo.xcprivacy" }
  ref = group.new_reference("PrivacyInfo.xcprivacy")
  target.resources_build_phase.add_file_reference(ref, true)
  proj.save
  puts "added PrivacyInfo.xcprivacy to App target"
end
RB

# ------------------------------------------------------------ build settings
PBX="$ROOT/ios/App/App.xcodeproj/project.pbxproj"
sed -i '' -E 's/IPHONEOS_DEPLOYMENT_TARGET = [0-9.]+;/IPHONEOS_DEPLOYMENT_TARGET = 16.0;/g' "$PBX"
sed -i '' -E 's/TARGETED_DEVICE_FAMILY = "?1"?;/TARGETED_DEVICE_FAMILY = "1,2";/g' "$PBX"
sed -i '' -E "s/MARKETING_VERSION = [^;]+;/MARKETING_VERSION = $MARKETING_VERSION;/g" "$PBX"
sed -i '' -E "s/CURRENT_PROJECT_VERSION = [^;]+;/CURRENT_PROJECT_VERSION = $BUILD_NUMBER;/g" "$PBX"
grep -E "TARGETED_DEVICE_FAMILY|IPHONEOS_DEPLOYMENT_TARGET" "$PBX" | sort | uniq -c

echo "== Info.plist"
plutil -p "$PLIST"
echo "== done: version $MARKETING_VERSION ($BUILD_NUMBER)"
