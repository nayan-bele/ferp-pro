#!/bin/bash
set -e

echo "🚀 Building fERP Pro..."

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Clean dist directory
rm -rf dist
mkdir -p dist/chrome dist/firefox

# Copy source to Chrome dist
echo "📦 Packaging Chrome extension..."
cp -r src/* dist/chrome/

# Copy source to Firefox dist
echo "📦 Packaging Firefox extension..."
cp -r src/* dist/firefox/

# Patch manifest for Firefox:
# 1. Replace service_worker with scripts (Firefox doesn't support MV3 service_worker yet)
# 2. Add browser_specific_settings with gecko ID + data_collection_permissions (required by AMO)
python3 -c "
import json

with open('dist/firefox/manifest.json', 'r') as f:
    manifest = json.load(f)

# Fix background: replace service_worker with scripts
if 'background' in manifest and 'service_worker' in manifest['background']:
    sw = manifest['background']['service_worker']
    manifest['background'] = { 'scripts': [sw] }

# Remove content_security_policy (not needed/supported the same way in Firefox)
manifest.pop('content_security_policy', None)

# Add gecko-specific settings including required data_collection_permissions
manifest['browser_specific_settings'] = {
    'gecko': {
        'id': 'ferp-pro@nayanbele',
        'strict_min_version': '109.0',
        'data_collection_permissions': {
            'required': [],
            'optional': []
        }
    }
}

with open('dist/firefox/manifest.json', 'w') as f:
    json.dump(manifest, f, indent=2)

print('  \u2705 Firefox manifest patched (scripts, gecko, data_collection_permissions)')
"

# Create Chrome ZIP
echo "📁 Creating Chrome ZIP..."
cd dist/chrome
zip -r ../ferp-pro-chrome.zip . > /dev/null
cd ../..

# Create Firefox ZIP
echo "📁 Creating Firefox ZIP..."
cd dist/firefox
zip -r ../ferp-pro-firefox.zip . > /dev/null
cd ../..

echo ""
echo "✅ Build complete!"
echo "   Chrome:  dist/ferp-pro-chrome.zip  ($(du -sh dist/ferp-pro-chrome.zip | cut -f1))"
echo "   Firefox: dist/ferp-pro-firefox.zip ($(du -sh dist/ferp-pro-firefox.zip | cut -f1))"
echo ""
echo "To install:"
echo "  Chrome:  chrome://extensions → Developer mode → Load unpacked → select dist/chrome/"
echo "  Firefox: about:debugging → Load Temporary Add-on → select dist/firefox/manifest.json"
