#!/bin/bash
set -e

echo "🚀 Building fERP Pro..."

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Clean dist directory
rm -rf dist
mkdir -p dist/chrome dist/firefox

# ── Chrome build ─────────────────────────────────────────────────────────────
echo "📦 Packaging Chrome extension..."
cp -r src/* dist/chrome/

# ── Firefox build ─────────────────────────────────────────────────────────────
echo "📦 Packaging Firefox extension..."
cp -r src/* dist/firefox/

# Firefox: remove Tesseract (uses Function/eval, blocked by AMO linter)
# Firefox will fall back to manual captcha; Chrome keeps full OCR.
rm -rf dist/firefox/scripts/lib/

# Patch Firefox manifest
python3 -c "
import json

with open('dist/firefox/manifest.json', 'r') as f:
    manifest = json.load(f)

# 1. Replace service_worker with scripts array
if 'background' in manifest and 'service_worker' in manifest['background']:
    sw = manifest['background']['service_worker']
    manifest['background'] = {'scripts': [sw]}

# 2. Remove Tesseract from content_scripts (already deleted above)
for cs in manifest.get('content_scripts', []):
    cs['js'] = [f for f in cs.get('js', []) if 'tesseract' not in f]

# 3. Remove web_accessible_resources for tesseract (not needed in Firefox build)
manifest['web_accessible_resources'] = [
    r for r in manifest.get('web_accessible_resources', [])
    if not any('tesseract' in res for res in r.get('resources', []))
]
if not manifest['web_accessible_resources']:
    del manifest['web_accessible_resources']

# 4. Remove Chrome-only CSP (wasm-unsafe-eval not needed without Tesseract)
manifest.pop('content_security_policy', None)

# 5. Add gecko settings with correct strict_min_version (140 = first to support
#    data_collection_permissions) and required data_collection_permissions.
#    'technicalAndInteraction' covers storing user preferences via chrome.storage.
manifest['browser_specific_settings'] = {
    'gecko': {
        'id': 'ferp-pro@nayanbele',
        'strict_min_version': '140.0',
        'data_collection_permissions': {
            'required': ['technicalAndInteraction'],
            'optional': []
        }
    }
}

with open('dist/firefox/manifest.json', 'w') as f:
    json.dump(manifest, f, indent=2)

print('  \u2705 Firefox manifest patched')
print('  \u2022 background: scripts (not service_worker)')
print('  \u2022 strict_min_version: 140.0')
print('  \u2022 data_collection_permissions: technicalAndInteraction')
print('  \u2022 Tesseract removed (eval-free build)')
"

# ── ZIPs ──────────────────────────────────────────────────────────────────────
echo "📁 Creating Chrome ZIP..."
cd dist/chrome && zip -r ../ferp-pro-chrome.zip . > /dev/null && cd ../..

echo "📁 Creating Firefox ZIP..."
cd dist/firefox && zip -r ../ferp-pro-firefox.zip . > /dev/null && cd ../..

echo ""
echo "✅ Build complete!"
echo "   Chrome:  dist/ferp-pro-chrome.zip  ($(du -sh dist/ferp-pro-chrome.zip | cut -f1)) — full OCR"
echo "   Firefox: dist/ferp-pro-firefox.zip ($(du -sh dist/ferp-pro-firefox.zip | cut -f1)) — manual captcha fallback"
echo ""
echo "To install:"
echo "  Chrome:  chrome://extensions → Developer mode → Load unpacked → select dist/chrome/"
echo "  Firefox: about:debugging → Load Temporary Add-on → select dist/firefox/manifest.json"
