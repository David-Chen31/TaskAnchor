# TaskAnchor

TaskAnchor 是一个极简桌面悬浮任务锚点，不是 Todo List。它只让你看见此刻该做什么，并在跑神时给出轻提示。

## 初始化步骤

```bash
npm install
npm run tauri:dev
```

Windows 上需要先安装 Visual Studio Build Tools，并勾选 “Desktop development with C++”。Tauri/Rust 的 MSVC 目标需要其中的 `link.exe`。

如果普通 PowerShell 找不到 `link.exe`，使用项目内置的 MSVC 包装脚本：

```bash
npm run tauri:dev:msvc
npm run tauri:build:exe:msvc
npm run tauri:build:msvc
```

## 推荐目录结构

```text
.
├─ src/                     # React + TypeScript UI
│  ├─ hooks/                # 本地状态持久化
│  ├─ utils/                # 时间格式化等小工具
│  ├─ App.tsx               # 主界面、计时、提醒、设置
│  ├─ main.tsx
│  └─ styles.css            # Tailwind 入口和全局样式
├─ src-tauri/               # Tauri/Rust 桌面壳
│  ├─ capabilities/         # Tauri v2 权限
│  ├─ src/lib.rs            # 窗口置顶、尺寸、启动位置
│  ├─ src/main.rs
│  └─ tauri.conf.json       # always-on-top、无边框、透明、小尺寸
├─ package.json
├─ tailwind.config.ts
├─ postcss.config.js
└─ vite.config.ts
```

## 本地存储

MVP 使用浏览器 `localStorage`，key 为 `task-anchor:settings:v1`。保存内容包括当前任务、默认专注时长、跑神提醒间隔、始终置顶和自启动预留开关。

## 运行和打包

```bash
npm run tauri:dev
npm run tauri:build:exe
npm run tauri:build
```

`tauri:build:exe` 只生成可运行 exe，不打安装包；完整安装包产物会生成在 `src-tauri/target/release/bundle` 下。

## MVP 后续方向

- 接入 `tauri-plugin-autostart` 实现开机自启动。
- 用 Tauri plugin store 或本地 JSON 文件替代 `localStorage`。
- 增加快捷键：显示/隐藏、快速编辑当前任务。
- 增加托盘菜单：继续、暂停、换任务。
- 增加更温和的系统通知，但保留低频策略。
