# 🤖 Antigravity Chat

<div align="center">

一个现代化的 AI 对话平台，支持多模型切换、图片识别、流式输出等功能。

[![Vue 3](https://img.shields.io/badge/Vue-3.5+-42b883?logo=vue.js)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-7.3+-646CFF?logo=vite)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4+-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)

</div>

---

## ✨ 功能特性

### 🎯 核心功能

- **多模型支持** - 内置 Gemini、Claude 系列模型，支持自定义添加
- **流式输出** - 实时流式返回 AI 回复，体验更流畅
- **图片识别** - 支持粘贴图片（Ctrl+V），最多 3 张同时发送
- **对话历史** - 自动保存对话记录，支持 3/7/30 天自动清理
- **Markdown 渲染** - 完美支持代码高亮、表格、列表等格式
- **响应式设计** - 适配桌面端和移动端

### 🎨 用户体验

- **优雅的 UI** - 现代化的 ChatGPT 风格界面
- **自定义主题** - Emerald Green 主题色，清新舒适
- **平滑动画** - 模态框、Toast 提示均带有过渡动画
- **智能提示** - API 未配置时友好引导用户设置
- **快捷操作** - 一键复制、图片预览、快速切换模型

### 🔧 高级功能

- **模型管理** - CRUD 操作，支持自定义模型名称和描述
- **API 配置** - 灵活配置 Base URL 和 API Key
- **数据持久化** - LocalStorage 存储，刷新不丢失
- **缓存优化** - 防抖保存，减少性能开销

---

## 🚀 快速开始

### 环境要求

- **Node.js**: `^20.19.0` 或 `>=22.12.0`
- **包管理器**: npm / yarn / pnpm / bun

### 安装步骤

```bash
# 1. 克隆项目
git clone https://github.com/yourusername/antigravity-web.git
cd antigravity-web

# 2. 安装依赖
npm install
# 或使用其他包管理器
# pnpm install
# bun install

# 3. 启动开发服务器
npm run dev

# 4. 构建生产版本
npm run build

# 5. 预览生产版本
npm run preview
```

访问 `http://localhost:5173` 即可开始使用。

---

## ⚙️ 配置说明

### 首次使用

1. 点击左侧边栏的「设置」按钮
2. 切换到「API配置」标签页
3. 填写你的 API 地址和密钥：
   - **API地址**: 例如 `http://127.0.0.1:8045/v1/chat/completions`
   - **API密钥**: 你的 API Key
4. 点击「保存设置」

### 模型管理

支持添加、编辑、删除自定义模型：

```javascript
// 模型配置示例
{
  id: 'gpt-4',           // 模型ID（必填）
  name: 'GPT-4',         // 显示名称（必填）
  desc: '最强大的语言模型'  // 描述（可选）
}
```

### 数据保留设置

- **3天**: 保留最近 3 天的对话记录
- **7天** (推荐): 保留最近一周的对话记录
- **30天**: 保留最近一个月的对话记录

---

## 🛠️ 技术栈

| 技术 | 版本 | 说明 |
|------|------|------|
| **Vue 3** | 3.5.26 | 渐进式 JavaScript 框架 |
| **Vite** | 7.3.0 | 下一代前端构建工具 |
| **TailwindCSS** | 3.4.19 | 原子化 CSS 框架 |
| **Axios** | 1.13.2 | HTTP 客户端 |
| **Markdown-it** | 14.1.0 | Markdown 解析器 |
| **Lucide Vue** | 0.562.0 | 图标库 |

---

## 📁 项目结构

```
antigravity-web/
├── public/                 # 静态资源
│   ├── favicon.svg        # 网站图标
│   ├── robot-logo.svg     # 机器人 Logo
│   └── logo-full.svg      # 完整品牌 Logo
├── src/
│   ├── assets/            # 资源文件
│   │   ├── fonts/         # 字体文件
│   │   └── main.css       # 全局样式
│   ├── components/        # Vue 组件
│   │   ├── ChatContainer.vue      # 消息列表容器
│   │   ├── ChatInput.vue          # 输入框组件
│   │   ├── ConfirmDialog.vue      # 确认对话框
│   │   ├── MessageItem.vue        # 消息项组件
│   │   ├── Settings.vue           # 设置面板
│   │   ├── Sidebar.vue            # 侧边栏
│   │   └── Toast.vue              # Toast 提示
│   ├── composables/       # 组合式函数
│   │   └── useChat.js     # 聊天逻辑
│   ├── App.vue            # 根组件
│   └── main.js            # 入口文件
├── index.html             # HTML 模板
├── package.json           # 项目配置
├── tailwind.config.js     # Tailwind 配置
├── postcss.config.js      # PostCSS 配置
└── vite.config.js         # Vite 配置
```

---

## 🎨 设计理念

### 配色方案

- **主题色**: `#10A37F` (Emerald Green)
- **背景色**: `#F9FAFB` (Light Gray)
- **文本色**: `#111827` (Dark Gray)
- **边框色**: `#E5E7EB` (Gray)

### UI 组件

所有弹窗和提示均使用自定义组件，统一风格：

- ✅ **Toast** - 顶部中央浮动提示
- ✅ **ConfirmDialog** - 模态确认对话框
- ✅ **Settings** - 多标签页设置面板

---

## 🔒 安全性

- ✅ API 密钥仅存储在浏览器本地 (LocalStorage)
- ✅ 不上传任何用户数据到服务器
- ✅ 支持 HTTPS 部署
- ⚠️ 生产环境请使用环境变量管理敏感信息

---

## 📝 开发指南

### 推荐 IDE 设置

- **IDE**: [VS Code](https://code.visualstudio.com/)
- **插件**: [Vue - Official](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (禁用 Vetur)

### 浏览器开发工具

**Chromium 浏览器** (Chrome, Edge, Brave 等):
- [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
- [开启 Custom Object Formatter](http://bit.ly/object-formatters)

**Firefox**:
- [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
- [开启 Custom Object Formatter](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

---

## 📄 开源协议

本项目采用 MIT 协议开源。

---

## 🙏 致谢

- [Vue.js](https://vuejs.org/) - 渐进式 JavaScript 框架
- [Vite](https://vitejs.dev/) - 下一代前端构建工具
- [TailwindCSS](https://tailwindcss.com/) - 实用优先的 CSS 框架
- [Lucide](https://lucide.dev/) - 优雅的图标库

---

<div align="center">

**⭐ 如果这个项目对你有帮助，请给一个 Star！**

</div>
