# 第三方库许可声明（Third-Party Notices）

本应用通过 CDN / 本地文件方式引用以下开源库，仅作功能集成，未修改其源码。各库按以下许可证使用：

| 库 | 版本 | 许可证 | 用途 |
| ---- | ---- | ---- | ---- |
| [epub.js](https://github.com/futurepress/epub.js) | 0.3.x | BSD-3-Clause | EPUB 解析与渲染 |
| [pdf.js](https://github.com/mozilla/pdf.js) | 3.11.x | Apache-2.0 | PDF 渲染 |
| [JSZip](https://github.com/Stuk/jszip) | 3.10.x | MIT 或 GPL-3.0 | ZIP 解压 / EPUB 元数据提取 |
| [Capacitor](https://github.com/ionic-team/capacitor) | 8.x | MIT | Android 应用封装 |

## 许可义务说明

### epub.js — BSD-3-Clause
Copyright (c) 2020, FuturePress
保留来源：https://github.com/futurepress/epub.js
BSD-3-Clause 允许使用、修改与再分发（含商业用途），需保留上述版权声明及免责声明。本仓库内 `lib/epub.min.js` 为压缩构建产物，压缩过程剥离了许可证头，特此声明其原始许可证。

### pdf.js — Apache-2.0
Copyright 2023 Mozilla Foundation
保留来源：https://github.com/mozilla/pdf.js
Apache-2.0 允许使用、修改与再分发，需保留版权声明与 NOTICE。

### JSZip — MIT / GPL-3.0（双许可，本项目按 MIT 条款使用）
Copyright (c) 2009-2016 Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso
保留来源：https://github.com/Stuk/jszip
MIT 条款允许自由使用与分发，需保留版权声明。

### Capacitor — MIT
Copyright (c) 2017-present Ionic
保留来源：https://github.com/ionic-team/capacitor

## 说明
- 以上库均为宽松开源许可，集成使用不构成版权风险；本声明用于满足各许可的**保留版权声明**义务。
- 本仓库**不包含任何受版权保护的电子书正文或字体文件**；示例书籍由 `test/make_test_*.py` 自动生成，无版权。
