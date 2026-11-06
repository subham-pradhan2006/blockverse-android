@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1 || (echo ERROR: Install Node.js 20 or 22 first.& pause & exit /b 1)
where java >nul 2>&1 || (echo ERROR: Install Android Studio/JDK 17 and configure JAVA_HOME first.& pause & exit /b 1)
echo Installing project dependencies...
call npm install
if errorlevel 1 goto fail
if not exist android\gradlew.bat (
 echo Creating native Android project...
 call npm run android:init
) else (
 echo Syncing Android application...
 call npm run android:sync
)
if errorlevel 1 goto fail
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\configure-android.ps1"
if errorlevel 1 goto fail
pushd android
call gradlew.bat assembleDebug
if errorlevel 1 (popd & goto fail)
popd
if not exist android\app\build\outputs\apk\debug\app-debug.apk goto fail
copy /y android\app\build\outputs\apk\debug\app-debug.apk Blockverse_3D_Android_Debug.apk >nul
echo.
echo SUCCESS! APK: %~dp0Blockverse_3D_Android_Debug.apk
pause
exit /b 0
:fail
echo.
echo BUILD FAILED. Review the error above; Android Studio with SDK must be installed.
pause
exit /b 1
