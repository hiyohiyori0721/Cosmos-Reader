# ============================================================
# build-apk.ps1 — 一键构建 Android APK
# 用法：powershell -ExecutionPolicy Bypass -File build-apk.ps1
# 前置：本机已安装 JDK 17+ 与 Android SDK（或本仓库 .buildtools 已就绪）
# 产物：android/app/build/outputs/apk/debug/app-debug.apk
# ============================================================
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$androidDir = Join-Path $root 'android'

# 优先使用本仓库内置的 JDK 与 SDK（.buildtools）
$jdkHome = Join-Path $root '.buildtools\jdk'
$sdkHome = Join-Path $root '.buildtools\sdk'

if (Test-Path $sdkHome) {
  Write-Host "[build] 使用内置 Android SDK: $sdkHome"
  $env:ANDROID_HOME = $sdkHome
  $env:ANDROID_SDK_ROOT = $sdkHome
  $localProps = Join-Path $androidDir 'local.properties'
  "sdk.dir=$($sdkHome -replace '\\','\\')" | Set-Content -Path $localProps -Encoding ASCII
} else {
  if (-not $env:ANDROID_HOME) {
    Write-Host "[error] 未找到 Android SDK。请设置 ANDROID_HOME 或先运行 setup-buildtools.ps1"
    exit 1
  }
}

if (-not $env:JAVA_HOME -and (Test-Path $jdkHome)) {
  $jdkDir = Get-ChildItem $jdkHome -Directory | Select-Object -First 1
  if ($jdkDir) { $env:JAVA_HOME = $jdkDir.FullName }
}
if (-not $env:JAVA_HOME) {
  Write-Host "[error] 未找到 JDK。请设置 JAVA_HOME 或先运行 setup-buildtools.ps1"
  exit 1
}
Write-Host "[build] JAVA_HOME = $env:JAVA_HOME"

Set-Location $androidDir
Write-Host "[build] 开始构建 Debug APK ..."
& .\gradlew.bat assembleDebug --no-daemon
if ($LASTEXITCODE -ne 0) {
  Write-Host "[error] 构建失败"
  exit $LASTEXITCODE
}

$apk = Join-Path $androidDir 'app\build\outputs\apk\debug\app-debug.apk'
if (Test-Path $apk) {
  Write-Host "[build] 构建成功：$apk"
  Write-Host "[build] 安装到设备：adb install -r `"$apk`""
} else {
  Write-Host "[warn] 未找到 APK 产物，请检查构建日志"
}
