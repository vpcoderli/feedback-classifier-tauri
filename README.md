# feedback-classifier-tauri

桌面版反馈分类系统：Tauri 2 + Vite + Vue 3 + Arco Design，Midnight 暗色风格。

后端是兄弟项目 [`../feedback-classifier`](../feedback-classifier) 的 Express，通过 Tauri sidecar 模式以子进程运行。两端共享同一份业务代码，浏览器版 (`npm start`) 仍可独立使用。

## 开发

依赖：Node 20+、Rust stable、[Bun](https://bun.com) 1.1+。

```bash
# 1. 安装前端依赖
npm install

# 2. 编译当前平台的 sidecar 二进制（依赖兄弟项目）
npm run build:sidecar

# 3. 启动开发模式
npm run tauri dev
```

第一次启动时 macOS 需要 Xcode CLT，Windows 需要 MSVC + WebView2。

每次修改了 `../feedback-classifier/` 下的 routes / services 后，要重跑 `npm run build:sidecar` 才能让新进程加载到。

## 打包

```bash
npm run build:sidecar          # 当前平台
# 或:
npm run build:sidecar -- --all  # 同时打 mac arm/x64 + windows x64

npm run tauri build
```

产物：
- macOS：`src-tauri/target/release/bundle/dmg/*.dmg`
- Windows：`src-tauri/target/release/bundle/nsis/*.exe`

## 数据目录

应用启动时会通过环境变量 `DATA_DIR` 注入 sidecar，对应：
- macOS：`~/Library/Application Support/com.feedback.classifier/`
- Windows：`%APPDATA%\com.feedback.classifier\`

里面包含 `db.json`（lowdb）、`uploads/`、`rules/`。卸载应用不会自动清理这个目录。

## 架构关键点

- **Sidecar 启动**：Rust `src-tauri/src/sidecar.rs` 以 `Command::sidecar("feedback-server") + PORT=0` 起子进程；子进程 stdout 第一行 `LISTENING:<port>` 被 Rust 解析后存入 `app.manage`；前端 `invoke('get_port')` 拉到端口装入 Pinia `backend` store；所有 API 请求拼 `http://127.0.0.1:<port>` 走。
- **关闭即隐藏**：`WindowEvent::CloseRequested` 拦下变成 `hide`，托盘菜单"退出"才真正 `app.exit(0)` 并 kill sidecar。
- **拖文件**：Tauri `onDragDropEvent` 在 ClassifyView 里监听，与点击选择走同一个 `ingestFile` 路径。
- **下载文件**：`save_dialog` 走 Rust → 文件保存对话框 → 前端 fetch 接口拿 blob → `@tauri-apps/plugin-fs` 写到选定路径。

## 常见问题

**Q: 启动后窗口空白**
A: 检查 sidecar 是否成功，终端会有 `Sidecar listening on port xxxx`；没有的话先 `npm run build:sidecar` 重新生成二进制。

**Q: macOS 提示"已损坏，无法打开"**
A: 未签名应用首次启动需 `xattr -dr com.apple.quarantine /Applications/反馈分类系统.app`。

**Q: 修改后端逻辑不生效**
A: sidecar 是预编译二进制，不会跟随 dev 热更。重跑 `npm run build:sidecar` 后再 `npm run tauri dev`。
