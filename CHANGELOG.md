# Changelog

所有重要的变更都将记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
并且本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.1.0] - 2026-01-06

### 🚀 重大更新

#### IndexedDB 存储升级

这是一个**重大更新**，将数据存储从 LocalStorage 升级到 IndexedDB，彻底解决了存储容量限制问题！

### ✨ 新增功能

- ✅ **IndexedDB 存储**: 替代 LocalStorage，支持存储 500MB+ 的对话数据
- ✅ **自动数据迁移**: 首次启动时自动从 LocalStorage 迁移旧数据
- ✅ **存储监控**: 在控制台显示实时存储使用情况
- ✅ **存储管理界面**: 在设置中可视化显示存储使用情况
  - 实时显示已使用空间、总配额、使用率
  - 数据详情统计（对话数、消息数、大小）
  - 彩色进度条（绿/黄/红警示）
  - 手动刷新和清理功能
- ✅ **重新发送消息**: 一键重新发送任意用户消息
  - API 失败时快速重试
  - 对回复不满意可重新生成
  - 切换模型后重新获取回复
  - 自动删除后续内容并重新生成
- ✅ **高性能**: 异步存储操作，不阻塞 UI 渲染
- ✅ **结构化存储**: 使用索引优化查询性能
- ✅ **批量操作**: 支持批量保存和删除聊天记录

### 📈 性能改进

- ⚡ **大容量支持**: 从 ~10MB (LocalStorage) 提升到 500MB+ (IndexedDB)
- ⚡ **异步操作**: 所有数据库操作不阻塞主线程
- ⚡ **防抖优化**: 减少不必要的数据库写入
- ⚡ **索引查询**: 快速查找和删除过期数据

### 🛠️ 技术改进

- 新增 `src/utils/indexedDB.js` - IndexedDB 管理工具类
- 重构 `src/composables/useChat.js` - 完全支持异步存储
- 改进数据清理机制 - 按日期索引高效删除过期数据

### 🔄 数据迁移

**用户无需手动操作！** 应用会自动处理：

1. 检测 LocalStorage 中的旧数据
2. 自动迁移到 IndexedDB
3. 清理 LocalStorage 释放空间
4. 迁移过程在控制台显示日志

### 📦 存储容量说明

| 浏览器 | 存储容量 | 实际可用 |
|--------|----------|----------|
| Chrome/Edge | 磁盘的 60% | 通常数 GB |
| Firefox | 磁盘的 50% | 通常数 GB |
| Safari | 最多 1GB | iOS 更少 |

### ⚠️ 破坏性变更

- `useChat` 中的部分函数现在返回 Promise（异步）
  - `deleteChat()` → `await deleteChat()`
  - `clearHistory()` → `await clearHistory()`
  - `updateDataRetention()` → `await updateDataRetention()`
  - `resetAllSettings()` → `await resetAllSettings()`

### 🐛 修复

- 修复大量对话数据导致的存储溢出问题
- 修复 LocalStorage quota exceeded 错误
- 修复 Vue 组件引用 (icon) 无法序列化的问题
- 修复 Vue 响应式代理对象无法存储到 IndexedDB 的问题
- 改进数据保存的可靠性（双重保护策略）

---

## [1.0.0] - 2026-01-06

### 🎉 首次发布

这是 Antigravity Chat 的首个正式版本！

### ✨ 新增功能

#### 核心功能
- ✅ **多模型支持**: 内置 Gemini、Claude 系列模型
- ✅ **流式输出**: 实时显示 AI 回复内容
- ✅ **图片识别**: 支持粘贴图片（Ctrl+V），最多 3 张
- ✅ **对话历史**: 自动保存对话，支持多会话管理
- ✅ **Markdown 渲染**: 完整支持代码高亮、表格等格式

#### 用户界面
- ✅ **现代化 UI**: ChatGPT 风格的清新界面
- ✅ **响应式设计**: 完美适配桌面端和移动端
- ✅ **平滑动画**: 模态框、Toast 提示的过渡效果
- ✅ **自定义主题**: Emerald Green 主题色

#### 设置功能
- ✅ **模型管理**: 添加、编辑、删除自定义模型
- ✅ **API 配置**: 灵活配置 Base URL 和 API Key
- ✅ **数据管理**: 3/7/30 天自动清理对话记录
- ✅ **恢复默认**: 一键重置所有设置

#### 交互优化
- ✅ **自定义弹窗**: 统一风格的 Toast 和 ConfirmDialog
- ✅ **智能提示**: API 未配置时友好引导
- ✅ **防误删**: 不能删除当前选中的模型
- ✅ **数据持久化**: 本地存储，刷新不丢失

### 🎨 UI/UX 改进

- 优雅的消息气泡设计
- 流畅的打字机效果
- 图片预览大图功能
- 一键复制消息内容
- 模型选择下拉菜单
- 对话历史侧边栏

### 🛠️ 技术栈

- Vue 3.5.26
- Vite 7.3.0
- TailwindCSS 3.4.19
- Axios 1.13.2
- Markdown-it 14.1.0
- Lucide Vue 0.562.0

### 📦 资源文件

- `favicon.svg` - 机器人图标 favicon
- `robot-logo.svg` - 120x120 机器人 Logo
- `logo-full.svg` - 完整品牌 Logo

### 🔒 安全性

- API 密钥仅存储在浏览器本地
- 不上传任何用户数据
- 支持 HTTPS 部署

---

## 未来计划

### v1.2.0 (计划中)
- 🚀 支持导出对话记录
- 🚀 添加快捷键支持
- 🚀 支持自定义主题色
- 🚀 优化移动端体验

### v1.3.0 (计划中)
- 🚀 支持语音输入
- 🚀 支持多语言国际化
- 🚀 添加插件系统
- 🚀 云端同步功能

---

[1.1.0]: https://github.com/yourusername/antigravity-web/releases/tag/v1.1.0
[1.0.0]: https://github.com/yourusername/antigravity-web/releases/tag/v1.0.0
