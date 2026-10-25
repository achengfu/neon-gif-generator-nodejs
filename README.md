# 霓虹 GIF 生成器 · Node.js 版 (Neon GIF Generator)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/Node.js-%3E%3D18-339933)](package.json)

基于 [DoutuAPI-Neon-GIF-Generator](https://github.com/jueban/DoutuAPI-Neon-GIF-Generator)（Python FastAPI）的 **Node.js 移植版**，功能与 API 完全兼容，并额外支持 **指定字体、字体大小、纯静态模式、调色盘选色** 等增强能力。无需 Python 环境，`npm install && npm start` 即可跑起来。

## ✨ 功能特性

- **Web 可视化界面**：所见即所得，实时预览 GIF，一键下载、复制接口链接。
- **酷炫特效**：
  - 🌈 **彩虹流动 (Rainbow Flow)**：动态流动的彩虹渐变
  - 🌊 **波浪 (Wave)**：文字像波浪一样上下起伏
  - 🏀 **弹跳 (Bounce)**：文字有节奏地跳动
  - 💡 **霓虹脉冲 (Neon Pulse)**：模拟霓虹灯闪烁发光
  - 🌬️ **呼吸灯 (Breathing)**：双色渐变呼吸
  - ➡️ **滚动 (Scroll)**：文字横向滚动（默认行为）
  - ⏸️ **纯静态 (Static)**：静态文字 GIF（1 帧）
- **字体选择**：内置 8 款中文字体，前端下拉或接口 `font=1/2/3...` 指定，也可随机。
- **字体大小**：任意调节字号（`font_size`），行高自动等比缩放。
- **调色盘选色**：前端调色盘 + 文本框双输入（支持 Hex / CSS 颜色名）。
- **高度可定制**：背景主题（透明/深色/浅色）、宽度、帧数、延迟、自动换行。
- **微信表情友好**：默认宽度 240px，开箱即用于微信表情 GIF。

## 🚀 快速开始

### 环境要求

- Node.js **>= 18**
- npm

### 安装依赖

```bash
npm install
```

> 国内网络连 npm 官方源超时/报错时，改用镜像安装：
>
> ```bash
> npm install --registry=https://registry.npmmirror.com
> ```

### 启动服务

```bash
npm start
# 或 node server.js
```

浏览器打开 **http://127.0.0.1:8000/** 即可使用。可用 `PORT` 环境变量改端口：

```bash
PORT=9000 node server.js
```

## 🖥️ Web 界面

深色赛博朋克风格，左侧参数面板、右侧实时预览：

- 文本内容 / 特效选择 / 主题背景 / **选择字体**（自动拉取 `/fonts`）/ 主题背景
- **文字颜色**：调色盘 + 文本框（Hex、`#0f0` 简写、`cyan` 等 CSS 颜色名）
- 宽度（默认 240px）、**字体大小**（默认 86px）、帧数、延迟、自动换行

## 🔌 API

### `GET /generate` — 生成 GIF

参数与原版 FastAPI 接口一致，并新增 `mode`、`font`、`font_size`：

| 参数 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `text` | string | **必填** | 要生成的文字内容 |
| `frame_count` | int | 20 | 动画帧数（特效模式下不足会自动补足） |
| `delay` | int | 100 | 每帧延迟（毫秒，>= 20） |
| `color` | string | 无 | 颜色名 / Hex / 特效名：`rainbow`、`rainbow_flow`、`wave`、`bounce`、`neon`、`breathing:颜色1:颜色2` |
| `width_pixels` | int | **240** | GIF 宽度（1–5000），默认 240px 为微信表情 GIF 常用尺寸 |
| `theme` | string | transparent | 背景主题：`transparent` / `dark` / `light` |
| `wrap` | bool | false | 自动换行（开启后禁用滚动） |
| `mode` | string | auto | 布局模式：`auto`（无特效非换行时滚动，与原版一致）/ `static`（纯静态，1 帧）/ `scroll`（强制滚动，仅单行纯色场景生效） |
| `font` | int | 0 | 字体序号：`0`=随机（默认）；`1`~`N`=按 `fonts/` 目录文件名排序后的第 N 个字体。用 `GET /fonts` 查看序号对应关系 |
| `font_size` | int | 86 | 字体大小（像素，10–500）。默认 86px 即原版字号，行高随字号等比缩放 |

#### 示例

```
http://127.0.0.1:8000/generate?text=Hello&color=neon&theme=dark
http://127.0.0.1:8000/generate?text=彩虹&color=breathing:#ff0000:#00ff00&width_pixels=240&wrap=true
http://127.0.0.1:8000/generate?text=静态文字&mode=static&theme=dark
http://127.0.0.1:8000/generate?text=指定字体&font=3&font_size=120&theme=dark
```

### `GET /fonts` — 字体列表

```
GET /fonts → { "fonts": [ { "index": 1, "name": "HongLeiBanShuJianTi-2.ttf" }, ... ] }
```

序号按 `fonts/` 目录文件名排序（UTF-16 码位），随目录内容自动变化——往 `fonts/` 里加新字体，前端下拉与接口序号会同步更新。

## 🎨 内置字体

`fonts/` 目录内置 8 款中文字体（与原版项目一致）：

| 序号 | 字体文件 |
|---|---|
| 1 | HongLeiBanShuJianTi-2.ttf（红蕾板竖简体） |
| 2 | YouSheYuFeiTeJianKangTi-2.ttf |
| 3 | ZiKuJiangHuGuFengTi-2.ttf（字酷江湖孤风体） |
| 4 | ZiTiQuanXinYiGuanHeiTi4.0-2.ttf |
| 5 | dingliebabyfont.ttf（丁磊娃娃体） |
| 6 | douyu.otf（斗鱼字体） |
| 7 | jiying.ttf |
| 8 | 爱点风雅黑.ttf |

> 字体文件版权归原作者/字体厂商所有，仅随项目提供用于本地测试；如用于商业用途，请自行确认对应字体的授权范围。

## 🔧 与原版 (Python) 的差异

| 项 | 原版 (FastAPI + PIL) | 本版 (Express + @napi-rs/canvas) |
|---|---|---|
| 运行时 | Python 3.8+ | Node.js >= 18 |
| 字体 | 从 `fonts/` 随机选一个 | 同原版随机，额外支持 `font=N` 指定字体 |
| 文字栅格化 | FreeType | Skia（字形细节略有差异） |
| 颜色量化 | PIL 量化 | gifenc 量化（不透明 `rgb565` / 透明 `rgba4444`） |
| 静态帧合并 | Pillow 自动合并相邻相同帧 | 已实现同样的相邻相同帧去重（静态 GIF 体积一致） |
| 前端 | 原版 `static/` | 复用原版界面，并修复了首页预览 bug、新增字体/字号/调色盘控件 |

### 已知修复（对原版有用的坑）

原版首页预览 GIF 不显示（白板、无样式）：原因是 `index.html` 用**相对路径**引用 `style.css` / `script.js`，在根路径 `/` 下解析为 `/style.css` 404。本版已改为 `/static/...` 绝对路径并增加根路径兜底路由。若你在原版 Python 项目遇到同样问题，编辑 `static/index.html` 两行即可：

```html
<link rel="stylesheet" href="/static/style.css">
<script src="/static/script.js"></script>
```

## 📁 项目结构

```
├── server.js          # Express 服务 & /generate、/fonts 路由
├── gif-generator.js   # 核心 GIF 生成逻辑（gif_generator.py 的移植）
├── lib/
│   └── color-names.js # CSS 颜色名表（对齐 PIL ImageColor.getrgb）
├── static/            # Web 界面（基于原版前端，含预览修复与新增控件）
│   ├── index.html
│   ├── script.js
│   └── style.css
├── fonts/             # 中文字体（与原版一致）
├── package.json
└── README.md
```

## 📄 许可证

[MIT](LICENSE) — 本移植版基于 [DoutuAPI-Neon-GIF-Generator](https://github.com/jueban/DoutuAPI-Neon-GIF-Generator)（MIT, Copyright (c) 2026 juebanliaoshen）移植，致谢原作者。
