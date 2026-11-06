$ErrorActionPreference = 'Stop'
$manifest = Join-Path $PSScriptRoot '..\android\app\src\main\AndroidManifest.xml'
if (!(Test-Path $manifest)) { throw 'AndroidManifest.xml not found. Run npm run android:init first.' }
$xml = [System.IO.File]::ReadAllText($manifest)
$xml = $xml -replace 'android:name="\.MainActivity"', 'android:name=".MainActivity" android:screenOrientation="landscape"'
[System.IO.File]::WriteAllText($manifest, $xml, (New-Object System.Text.UTF8Encoding($false)))
Write-Host 'Android game configured for landscape orientation.'
