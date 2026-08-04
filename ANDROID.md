# 📱 打包为 Android APK

本项目使用 [Capacitor](https://capacitorjs.com/) 将 Web 阅读器封装为原生 Android 应用。
Web 资源位于 `www/`，Android 工程位于 `android/`。

## 方式一：本仓库一键脚本（自动下载工具链并构建）

> 需要已安装 [Node.js](https://nodejs.org/)，且网络可访问 Microsoft / Google 下载源。

```powershell
# 1) 自动下载 JDK 21 + Android SDK（约 1GB，仅首次需要）
powershell -ExecutionPolicy Bypass -File setup-buildtools.ps1

# 2) 构建 Debug APK
powershell -ExecutionPolicy Bypass -File build-apk.ps1
```

产物：`android/app/build/outputs/apk/debug/app-debug.apk`

安装到已连接的手机/模拟器：

```powershell
adb install -r android\app\build\outputs\apk\debug\app-debug.apk
```

## 方式二：Android Studio（最省心）

1. 安装 [Android Studio](https://developer.android.com/studio)（自带 JDK 与 SDK）
2. 用 Android Studio 打开本仓库的 `android/` 目录（首次会自动同步 Gradle）
3. 菜单 **Build → Build App Bundle(s) / APK(s) → Build APK(s)**
4. 产物位于 `android/app/build/outputs/apk/debug/`

> 若提示 SDK 缺失，在 Android Studio 的 **SDK Manager** 安装：`Android SDK Platform 36`、`Build-Tools 36.0.0`、`Platform-Tools`。

## 方式三：命令行（已手动安装 JDK/SDK）

```powershell
$env:JAVA_HOME = "你的JDK路径"
$env:ANDROID_HOME = "你的SDK路径"
cd android
.\gradlew.bat assembleDebug
```

## 修改应用信息

| 内容 | 位置 |
| ---- | ---- |
| 应用名 | `android/app/src/main/res/values/strings.xml`（`app_name`） |
| 包名 / 应用 ID | `capacitor.config.json` 的 `appId`（改后需 `npx cap sync android`） |
| 图标 | `android/app/src/main/res/mipmap-*/` |

## Web 资源更新后

修改了 `index.html` / `css` / `js` / `lib` 后，需要同步到 Android 工程再构建：

```powershell
# 复制 web 资源到 www（若手动改的是根目录文件）
Copy-Item index.html www\ -Force
Copy-Item css www\ -Recurse -Force
Copy-Item js www\ -Recurse -Force
Copy-Item lib www\ -Recurse -Force

# 同步到 Android 工程
npx.cmd cap sync android
```

## 说明

- 阅读数据（书籍、进度、书签）保存在应用 WebView 的 IndexedDB / localStorage 中，卸载应用会清空
- `file://` 协议下部分浏览器限制已由 Capacitor 的 `https://localhost` 加载方式规避，功能完整
