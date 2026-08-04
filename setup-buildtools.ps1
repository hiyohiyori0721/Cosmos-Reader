# ============================================================
# setup-buildtools.ps1 — 自动下载并配置 Android 构建工具链
# 下载：Microsoft OpenJDK 21 + Android SDK cmdline-tools + 必要组件
# 用法：powershell -ExecutionPolicy Bypass -File setup-buildtools.ps1
# ============================================================
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$bt = Join-Path $root '.buildtools'
New-Item -ItemType Directory -Force -Path $bt | Out-Null
Set-Location $bt

$jdkZip = Join-Path $bt 'jdk21.zip'
$cmdZip = Join-Path $bt 'cmdtools.zip'

# 1) JDK 21
if (-not (Test-Path (Join-Path $bt 'jdk'))) {
  Write-Host "[setup] 下载 Microsoft OpenJDK 21 ..."
  curl.exe -L -sS -o $jdkZip "https://aka.ms/download-jdk/microsoft-jdk-21-windows-x64.zip"
  Write-Host "[setup] 解压 JDK ..."
  Expand-Archive $jdkZip -DestinationPath (Join-Path $bt 'jdk') -Force
  Remove-Item $jdkZip -Force
}
$jdkDir = Get-ChildItem (Join-Path $bt 'jdk') -Directory | Select-Object -First 1
$env:JAVA_HOME = $jdkDir.FullName
Write-Host "[setup] JDK = $env:JAVA_HOME"

# 2) Android SDK cmdline-tools
$sdk = Join-Path $bt 'sdk'
if (-not (Test-Path (Join-Path $sdk 'cmdline-tools\latest\bin\sdkmanager.bat'))) {
  Write-Host "[setup] 下载 Android SDK cmdline-tools ..."
  curl.exe -L -sS -o $cmdZip "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"
  Write-Host "[setup] 解压 cmdline-tools ..."
  Expand-Archive $cmdZip -DestinationPath (Join-Path $bt 'sdk-tmp') -Force
  New-Item -ItemType Directory -Force -Path (Join-Path $sdk 'cmdline-tools') | Out-Null
  Move-Item (Join-Path $bt 'sdk-tmp\cmdline-tools') (Join-Path $sdk 'cmdline-tools\latest') -Force
  Remove-Item $cmdZip -Force
}
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$sm = Join-Path $sdk 'cmdline-tools\latest\bin\sdkmanager.bat'

# 3) 接受许可并安装组件
Write-Host "[setup] 接受 SDK 许可 ..."
("y`n" * 30) | & $sm --licenses 2>&1 | Out-Null
Write-Host "[setup] 安装 platform-tools / platforms;android-36 / build-tools;36.0.0 ..."
& $sm "platform-tools" "platforms;android-36" "build-tools;36.0.0" 2>&1 | Out-Null

# 4) 写 local.properties
$localProps = Join-Path $root 'android\local.properties'
"sdk.dir=$($sdk -replace '\\','\\')" | Set-Content -Path $localProps -Encoding ASCII

Write-Host "[setup] 完成！现在可运行 build-apk.ps1 构建 APK"
