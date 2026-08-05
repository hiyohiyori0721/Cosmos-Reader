# 📖 Cosmos-Reader

一个**功能完整、开箱即用**的纯前端电子书阅读器。无需后端，支持 **EPUB / TXT / PDF** 三种格式与 **ZIP 压缩包自动识别**，可一键打包为 **Android APK**。

纯原生 JavaScript 实现，零框架依赖；数据保存在浏览器本地（IndexedDB + localStorage），离线可用。

---

## ✨ 功能特性

### 📚 书库管理
- **多格式导入**：EPUB / TXT / PDF 单文件，或 **ZIP 压缩包**（自动解压识别其中的电子书，支持子目录）
- **网格书库**：封面 + 书名/作者 + 阅读进度条展示
- **文件夹分类**：新建 / 重命名 / 删除文件夹，批量移动书籍
- **排序**：最近添加 / 最近阅读 / 书名 / 作者
- **多选**：批量勾选 → 移动到文件夹 / 批量删除
- **书籍信息**：长按卡片 → 预览信息（封面 / 类型 / 大小 / 进度 / 时间），一键开始阅读

### 📖 阅读体验
- **三种格式**：
  - EPUB：分页 / 连续滚动两种模式（epub.js 渲染）
  - TXT：自动识别 **UTF-8 / UTF-16 / GBK / Big5（繁体）/ Shift_JIS（日文）** 编码，智能分章，滚动阅读
  - PDF：pdf.js 渲染，滚动逐页显示，懒加载，支持大纲目录
- **多种翻页方式**：底部翻页栏、点击左右区域、触摸左右滑动、音量键、方向键、鼠标滚轮，带翻页动画
- **沉浸模式**：点击屏幕中央收起 / 展开上下栏；进入阅读 **5 秒自动沉浸**，上下栏半透明毛玻璃悬浮覆盖，全屏阅读
- **阅读状态条**：左下角实时显示时间与电量（可视电池 UI，低电量变红）

### 🎨 外观设置
- **主题**：白天 / 护眼 / 夜间 / **绿意 / 湛蓝 / 墨夜**（下拉选择器，带色块预览）+ **自定义**主题（自定背景 / 文字色）
- **自定义颜色**：自定义阅读**背景色**与**文字颜色**，选择后主题自动切换为「自定义」，可随时「重置」恢复主题
- **排版**：字号、行距、左右留白可调
- **字体**：**跟随书籍** + **自定义字体**（导入 TTF / OTF / WOFF / WOFF2）

### 🔖 笔记与导航
- **书签**：一键添加当前页书签，记录文字摘要，支持跳转 / 删除
- **划线高亮**：选中文字 → 黄 / 绿 / 蓝三色划线，或 **🎨 自定义颜色**；点 🚫 可清除该处划线
- **全文搜索**：EPUB / TXT / PDF 逐页搜索，结果定位高亮
- **目录**：EPUB 目录树 / TXT 章节 / PDF 书签大纲，点击跳转
- **进度记忆**：自动保存（EPUB 用 CFI、TXT 用百分比、PDF 用页码），重开续读

### 💾 数据安全
- **备份 / 恢复**：一键导出 / 导入书库元数据、进度、书签、划线、设置（JSON）

### 🤖 移动端 / Android
- 触摸友好 UI、沉浸模式、返回键逐级处理（弹窗 → 面板 → 阅读 → 书库）
- **音量键翻页**：原生拦截音量键上一页/下一页（可在设置中开关）
- 打包为 Android APK（Capacitor），`@capacitor/app` 管理返回键

---

##  直接下载

不想自己构建？从 GitHub Releases 直接下载 Android APK：

- **最新版本 v1.2**：<https://github.com/hiyohiyori0721/Cosmos-Reader/releases/tag/v1.2>
- Releases 列表：<https://github.com/hiyohiyori0721/Cosmos-Reader/releases>

---

## 🚀 快速开始

### 方式一：本地服务器（推荐）
需要 [Node.js](https://nodejs.org/)。在项目目录运行：

```bash
node server.js            # 默认端口 3000
# node server.js --port 8080  指定端口
```

浏览器打开 <http://localhost:3000>。

### 方式二：直接双击
用 Chrome / Edge 直接打开 `index.html` 即可（绝大多数功能可用）。

### 导入书籍
1. 点击右下角 **＋** → **导入小说**，选择 `.epub` / `.txt` / `.pdf` / `.zip` 文件
2. 或直接把文件**拖拽**到页面
3. 点击书库中的封面开始阅读

> 数据（书籍文件、进度、书签、设置）保存在浏览器 IndexedDB 与 localStorage，关闭页面不丢失。

---

## 📱 打包为 Android APK

使用 [Capacitor](https://capacitorjs.com/) 封装。完整说明见 [ANDROID.md](ANDROID.md)。

```powershell
# 首次：自动下载 JDK 21 + Android SDK（约 1GB）
powershell -ExecutionPolicy Bypass -File setup-buildtools.ps1

# 构建 Debug APK
powershell -ExecutionPolicy Bypass -File build-apk.ps1
```

**构建正式版（Release）APK：**

```powershell
# 方式一：用仓库脚本自动配置工具链（推荐）
powershell -ExecutionPolicy Bypass -File setup-buildtools.ps1

# 方式二：已手动安装 JDK / Android SDK，自行设置环境变量后构建
$env:JAVA_HOME = "你的 JDK 路径"
$env:ANDROID_HOME = "你的 Android SDK 路径"
cd android
.\gradlew.bat assembleRelease --no-daemon
```

产物：`android/app/build/outputs/apk/release/app-release.apk`

> 正式版默认使用 debug 签名以便直接安装；若需上架应用商店，请在 `android/app/build.gradle` 的 `release` 中配置正式 keystore。

---

## 🧱 技术栈

| 技术 | 用途 |
| ---- | ---- |
| 原生 JavaScript | 应用逻辑（无框架） |
| [epub.js](https://github.com/futurepress/epub.js) | EPUB 解析与渲染 |
| [pdf.js](https://mozilla.github.io/pdf.js/) | PDF 渲染 |
| [JSZip](https://stuk.github.io/jszip/) | ZIP 解压 / EPUB 元数据提取 |
| [Capacitor](https://capacitorjs.com/) | Android 封装（`@capacitor/app` 返回键） |
| IndexedDB / localStorage | 书籍文件与元数据存储 |

---

## 📁 项目结构

```
reader/
├── index.html          # 入口页面
├── css/style.css       # 样式（六套主题 + 自定义、动画）
├── js/
│   ├── storage.js      # IndexedDB + localStorage 存储 API（含备份）
│   ├── reader.js       # 阅读器核心（EPUB / TXT / PDF）
│   └── app.js          # 应用逻辑（书库、导入、面板、设置、交互）
├── lib/                # 第三方库（epub.js / pdf.js / jszip）
├── www/                # Web 构建副本（Capacitor 用）
├── android/            # Capacitor Android 工程
├── test/               # 测试样例生成脚本与示例文件
├── server.js           # 零依赖本地静态服务器
├── capacitor.config.json
├── ANDROID.md          # Android 打包详细文档
├── build-apk.ps1       # 一键构建脚本
└── setup-buildtools.ps1# 工具链自动安装脚本
```

---

## 📝 使用提示

- **划线**：选中文字后弹出划线条（黄 / 绿 / 蓝 / 🎨 自定义颜色），点 🚫 清除；也可在「书签与笔记」面板管理
- **沉浸模式**：阅读时点击屏幕中央收起/展开上下栏；进入阅读 5 秒自动沉浸
- **自定义颜色**：设置 → 自定义背景 / 自定义文字颜色，选择即生效，可随时「重置」
- **返回键**（Android）：依次关闭弹窗 → 面板 → 退出阅读 → 返回书库；书库再按一次退出应用
- **音量键翻页**（Android）：设置中开启后，按音量键上一页/下一页
- **自定义字体**：设置 → 自定义字体 → 导入，之后在「字体」下拉中选择
- **数据备份**：设置 → 数据备份 → 导出 / 导入，建议定期备份防止数据丢失

---

## 📄 许可

MIT License
