#!/usr/bin/env python3
"""Configure landscape mode in the generated Capacitor Android manifest."""
from pathlib import Path

manifest = Path('android/app/src/main/AndroidManifest.xml')
if not manifest.is_file():
    raise SystemExit('AndroidManifest.xml not found. Run npx cap add android first.')
source = manifest.read_text(encoding='utf-8')
if 'android:screenOrientation="landscape"' in source:
    print('Android already set to landscape.')
else:
    target = 'android:name=".MainActivity"'
    if target not in source:
        raise SystemExit('Could not find the MainActivity declaration; check Capacitor version.')
    source = source.replace(target, target + '\n            android:screenOrientation="landscape"', 1)
    manifest.write_text(source, encoding='utf-8')
    print('Android screen orientation set to landscape.')
