# Jelly Cursor 中文说明

Jelly Cursor 是一个为 VS Code 添加果冻感动画光标的扩展。它会跟随 Monaco 编辑器的原生光标位置，在移动时产生平滑动画、果冻形变和可选辉光，并尽量镜像 VS Code/Vim 模式下的条形光标、块状光标等形态。

## 功能

- 平滑光标移动
- 根据移动方向产生果冻形变
- 移动时可显示辉光
- 可自定义光标颜色和辉光颜色
- 可调节角点速度、形变程度、透明度和辉光强度
- 尽量跟随原生条形/块状光标形态
- 为多光标和分屏编辑器分别维护光标状态
- 在分屏编辑器之间切换时支持跨面板动画
- 跳转到未渲染行时，会从上一次可见光标位置开始动画
- 水平和竖直移动时加入对角扭转，让四个角点也能呈现不同速度

## Vim 说明

Jelly Cursor 本身不强制依赖其他扩展。它会镜像 VS Code 当前的 Monaco 原生光标形状。

如果你希望在 Vim 的 normal/insert 模式之间获得块状光标、条形光标等模式切换效果，请先安装并配置 Vim 扩展，例如：

- [VSCodeVim](https://marketplace.visualstudio.com/items?itemName=vscodevim.vim)

当 Vim 扩展改变 VS Code 原生光标形状后，Jelly Cursor 会读取这个形状并为它添加动画。

## 重要说明

Jelly Cursor 使用的是实验性的 DOM Patch 方案。VS Code 的稳定扩展 API 不能直接访问 Monaco 编辑器 DOM，因此本扩展的安装命令会修改 VS Code 的 `workbench.html`，并注入一段脚本来绘制动画光标。

因此你需要知道：

- VS Code 可能提示“安装似乎已损坏”。
- VS Code 更新后可能会移除 Patch。
- VS Code 更新后通常需要重新执行安装命令。
- 首次安装会在 `workbench.html` 旁边创建 `workbench.html.jelly-cursor-backup` 备份文件。
- 如果想移除效果，请先执行卸载命令，然后重启 VS Code。

## 安装 Patch

打开命令面板，执行：

```text
Jelly Cursor: Install DOM Patch
```

然后完全重启 VS Code。

安装器会按以下顺序自动查找 `workbench.html`：

1. 当前正在运行的 VS Code 应用（`vscode.env.appRoot` 和 `process.execPath`）。
2. Windows、macOS、Linux 上 VS Code、VS Code Insiders、Cursor、VSCodium、Windsurf 的常见安装位置。
3. `PATH` 中的 `code` / `cursor` 等命令。
4. 已知的 `out/vs/...` 目录结构，以及受限的递归兜底搜索。

### 如果自动查找失败

扩展会弹出文件选择窗口，并在窗口中给出具体说明。请选择名为 `workbench.html` 的**文件**（不是选择文件夹），在 VS Code 安装目录中依次进入：

```text
resources → app → out → vs → code → electron-browser → workbench → workbench.html
```

常见完整路径：

| 安装方式 | `workbench.html` 路径 |
|---|---|
| Windows 用户安装 | `%LOCALAPPDATA%\Programs\Microsoft VS Code\resources\app\out\vs\code\electron-browser\workbench\workbench.html` |
| Windows 系统安装 | `C:\Program Files\Microsoft VS Code\resources\app\out\vs\code\electron-browser\workbench\workbench.html` |
| macOS | `/Applications/Visual Studio Code.app/Contents/Resources/app/out/vs/code/electron-browser/workbench/workbench.html` |
| Linux | `/usr/share/code/resources/app/out/vs/code/electron-browser/workbench/workbench.html` |

> 注意：较新的 VS Code 可能在 `Microsoft VS Code` 和 `resources` 之间多一层版本号文件夹。

如果你不想每次都手动选择，可以在设置中把 `jellyCursor.workbenchHtmlPath` 配置为 `workbench.html` 的完整路径：

```json
{
  "jellyCursor.workbenchHtmlPath": "C:\\Users\\你\\AppData\\Local\\Programs\\Microsoft VS Code\\resources\\app\\out\\vs\\code\\electron-browser\\workbench\\workbench.html"
}
```

选择窗口还会校验所选文件；如果选成了文件夹或其他文件，会再次弹出并给出指引。

## 卸载 Patch

打开命令面板，执行：

```text
Jelly Cursor: Uninstall DOM Patch
```

然后完全重启 VS Code。

## 查看状态与恢复备份

执行 `Jelly Cursor: Show Patch Status` 可列出所有被发现的 `workbench.html`，显示是否已打补丁、是否存在注入脚本和备份文件。在详情中可以直接复制路径、卸载指定文件的补丁，或恢复该文件的备份。

执行 `Jelly Cursor: Restore workbench.html Backup` 可用首次安装时创建的备份还原当前 `workbench.html`，并删除注入脚本文件。

所有文件写入均采用“临时文件 + 重命名”的原子写入方式；失败时会显示可操作的错误提示，避免 `workbench.html` 被写坏一半。安装、卸载、恢复成功后的提示都带有“立即重启”按钮。

VS Code 更新移除补丁后，扩展会在启动时检测到并提示重新安装（可通过 `jellyCursor.reminders` 关闭）。状态栏也会显示当前补丁状态，诊断日志写入“输出”面板的 **Jelly Cursor** 频道。

## 设置

这些设置会在执行安装 Patch 时写入注入脚本。修改设置后，扩展会提示一键重新安装并重启 VS Code。

```json
{
  "jellyCursor.cursorColor": "#ffffff",
  "jellyCursor.glowColor": "#ffffff",
  "jellyCursor.glowEnabled": true,
  "jellyCursor.glowOpacity": 0.9,
  "jellyCursor.glowIntensity": 1.8,
  "jellyCursor.glowSize": 18,
  "jellyCursor.fastSpeed": 0.42,
  "jellyCursor.midSpeed": 0.24,
  "jellyCursor.slowSpeed": 0.1,
  "jellyCursor.axisBias": 0.45,
  "jellyCursor.twistBoost": 0.16,
  "jellyCursor.minAlpha": 0.03,
  "jellyCursor.animationMode": "full",
  "jellyCursor.maxJumpAnimationDistance": 0,
  "jellyCursor.effectPreset": "custom",
  "jellyCursor.shapeStyle": "native",
  "jellyCursor.trailEnabled": false,
  "jellyCursor.trailLength": 0,
  "jellyCursor.trailOpacity": 0.35,
  "jellyCursor.springEnabled": false,
  "jellyCursor.springStiffness": 0.16,
  "jellyCursor.springDamping": 0.78,
  "jellyCursor.rainbowEnabled": false,
  "jellyCursor.gradientEnabled": false,
  "jellyCursor.rippleEnabled": true,
  "jellyCursor.landingPulseEnabled": true,
  "jellyCursor.sparkEnabled": true,
  "jellyCursor.sparkAmount": 0.5,
  "jellyCursor.reminders": true,
  "jellyCursor.statusBar": true,
  "jellyCursor.workbenchHtmlPath": ""
}
```

### 特效预设

- `jellyCursor.effectPreset`：`custom`、`minimal`、`neon`、`aurora`、`matrix`、`comet`。选择非 custom 预设会覆盖对应的独立特效设置。

### 形状与拖尾

- `jellyCursor.shapeStyle`：`native`、`rounded`、`capsule`。
- `jellyCursor.trailEnabled`：移动时绘制渐隐残影。默认关闭，可手动开启或选择带拖尾的预设。
- `jellyCursor.trailLength`：残影数量。
- `jellyCursor.trailOpacity`：残影最大透明度。

### 动效与光效

- `jellyCursor.springEnabled`：使用带轻微过冲的弹簧物理。
- `jellyCursor.springStiffness`：弹簧刚度。
- `jellyCursor.springDamping`：弹簧阻尼，越小晃动越久。
- `jellyCursor.rainbowEnabled`：光标和辉光彩虹循环。
- `jellyCursor.gradientEnabled`：使用纵向渐变填充。
- `jellyCursor.rippleEnabled`：编辑器内点击时出现涟漪。
- `jellyCursor.landingPulseEnabled`：跳转落地时出现脉冲光环。
- `jellyCursor.sparkEnabled`：快速移动时发射光点粒子。
- `jellyCursor.sparkAmount`：粒子密度。

### 动画模式与跳转

- `jellyCursor.animationMode`：`full` 为完整果冻形变和辉光；`smooth` 为仅平滑跟随、无形变；`off` 为完全关闭动画。
- `jellyCursor.maxJumpAnimationDistance`：跳转动画的最大距离（像素）。设为 `0` 表示完整播放跳转动画。

### 提醒与状态栏

- `jellyCursor.reminders`：VS Code 更新后补丁丢失，或设置需要重装时显示提醒。
- `jellyCursor.statusBar`：在状态栏显示 Jelly Cursor 补丁状态。

### Patch 位置

- `jellyCursor.workbenchHtmlPath`：`workbench.html` 的完整路径。留空时自动探测；仅在自动探测失败时设置。

### 果冻角点设置

- `jellyCursor.fastSpeed`：移动方向前端角点的速度。
- `jellyCursor.midSpeed`：果冻形变时侧边角点的速度。
- `jellyCursor.slowSpeed`：移动方向尾端角点的速度。
- `jellyCursor.axisBias`：控制速度判断更偏向横竖方向还是对角线方向。
- `jellyCursor.twistBoost`：移动时增加对角扭转，同时避免光标点位交叉。
- `jellyCursor.minAlpha`：原生光标闪烁时渲染光标的最低透明度。

### 辉光设置

- `jellyCursor.glowEnabled`：开启或关闭移动辉光。
- `jellyCursor.glowColor`：辉光颜色。留空时跟随光标颜色。
- `jellyCursor.glowOpacity`：移动时最大辉光透明度。
- `jellyCursor.glowIntensity`：辉光亮度倍率。
- `jellyCursor.glowSize`：辉光范围，单位为像素。

## 常见问题

**为什么 VS Code 提示“安装似乎已损坏”？**
因为 Jelly Cursor 修改了 `workbench.html`，改变了安装签名，这是预期现象。如需还原，执行 `Jelly Cursor: Restore workbench.html Backup` 并重启。

**更新 VS Code 后动画不见了？**
更新会替换 `workbench.html`。重新执行 `Jelly Cursor: Install DOM Patch` 并重启即可。启用 `jellyCursor.reminders` 时扩展会自动提醒。

**改了设置没有生效？**
设置会写入注入脚本。修改后接受扩展的一键重装提示（或手动执行安装命令），然后重启 VS Code。

**如何彻底删除？**
执行 `Jelly Cursor: Uninstall DOM Patch`，重启 VS Code，再卸载扩展。备份文件会保留在 `workbench.html` 旁边。

**能降低耗电吗？**
把 `jellyCursor.animationMode` 设为 `off` 或 `smooth`，或者卸载补丁但保留扩展。

## 已知限制

- 这不是稳定 VS Code API 实现。
- Patch 依赖 VS Code 当前的 workbench 文件结构。
- 多光标场景目前会读取 Monaco 的可见 cursor 节点，但主要优化对象仍是主编辑光标。
- 注入脚本中的设置不会实时热更新。

## 开发

```powershell
npm install
npm run compile
```

在 Extension Development Host 中运行扩展，执行安装命令并重启 VS Code 后即可测试注入光标。
