# Antigravity Design System

> 一套现代化的 Web 应用配色方案与设计规范，支持亮色/暗色双主题。

## 📋 概述

本设计系统基于 **Tailwind CSS**，采用蓝色为主色调，提供了完整的亮色和暗色主题支持。适用于对话式 AI 应用、管理后台、内容型网站等场景。

---

## 🎨 颜色系统

### 主题色 (Accent)

| 模式 | 颜色值 | Tailwind 类 | 预览 |
|------|--------|-------------|------|
| **亮色模式** | `#3B82F6` | `blue-500` | ![#3B82F6](https://via.placeholder.com/60x30/3B82F6/3B82F6) |
| **暗色模式** | `#60A5FA` | `blue-400` | ![#60A5FA](https://via.placeholder.com/60x30/60A5FA/60A5FA) |

### 亮色主题 (Light Mode)

| 用途 | 颜色值 | CSS 变量 | Tailwind 类 |
|------|--------|----------|-------------|
| **侧边栏背景** | `#F7F7F8` | `--chatgpt-sidebar` | `bg-chatgpt-sidebar` |
| **主背景** | `#FFFFFF` | `--chatgpt-main` | `bg-chatgpt-main` |
| **输入框背景** | `#FFFFFF` | `--chatgpt-input` | `bg-chatgpt-input` |
| **用户消息背景** | `#FFFFFF` | `--chatgpt-user` | `bg-chatgpt-user` |
| **AI消息背景** | `#F9FAFB` | `--chatgpt-assistant` | `bg-chatgpt-assistant` |
| **边框颜色** | `#E5E7EB` | `--chatgpt-border` | `border-chatgpt-border` |
| **主文字** | `#111827` | `--chatgpt-text` | `text-chatgpt-text` |
| **次要文字** | `#6B7280` | `--chatgpt-subtext` | `text-chatgpt-subtext` |
| **强调色** | `#3B82F6` | `--chatgpt-accent` | `bg-chatgpt-accent` / `text-chatgpt-accent` |

### 暗色主题 (Dark Mode)

| 用途 | 颜色值 | CSS 变量 | Tailwind 类 |
|------|--------|----------|-------------|
| **侧边栏背景** | `#1E1F23` | `--chatgpt-dark-sidebar` | `dark:bg-chatgpt-dark-sidebar` |
| **主背景** | `#2A2B32` | `--chatgpt-dark-main` | `dark:bg-chatgpt-dark-main` |
| **输入框背景** | `#2A2B32` | `--chatgpt-dark-input` | `dark:bg-chatgpt-dark-input` |
| **用户消息背景** | `#343541` | `--chatgpt-dark-user` | `dark:bg-chatgpt-dark-user` |
| **AI消息背景** | `#3E3F4B` | `--chatgpt-dark-assistant` | `dark:bg-chatgpt-dark-assistant` |
| **边框颜色** | `#4A4B57` | `--chatgpt-dark-border` | `dark:border-chatgpt-dark-border` |
| **主文字** | `#ECECF1` | `--chatgpt-dark-text` | `dark:text-chatgpt-dark-text` |
| **次要文字** | `#9CA3AF` | `--chatgpt-dark-subtext` | `dark:text-chatgpt-dark-subtext` |
| **强调色** | `#60A5FA` | `--chatgpt-dark-accent` | `dark:bg-chatgpt-dark-accent` / `dark:text-chatgpt-dark-accent` |

### 语义色

| 用途 | 亮色 | 暗色 | 使用场景 |
|------|------|------|----------|
| **成功** | `emerald-50/200/600/800` | `emerald-900/400` | Toast 成功提示 |
| **错误** | `red-50/200/600/800` | `red-900/400` | 删除、错误提示 |
| **警告** | `yellow-50/200/600/800` | `yellow-900/400` | 警告对话框 |
| **信息** | `blue-50/200/600/800` | `blue-900/400` | 普通提示 |

---

## 🌑 阴影系统

### Tailwind 配置

```javascript
boxShadow: {
  // 亮色模式阴影
  'chat-input': '0 0 0 1px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.05)',
  'card': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  'elevated': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',

  // 暗色模式阴影
  'dark-card': '0 2px 8px 0 rgba(0, 0, 0, 0.4), 0 1px 3px 0 rgba(0, 0, 0, 0.3)',
  'dark-elevated': '0 10px 30px -5px rgba(0, 0, 0, 0.6), 0 8px 20px -5px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
}
```

### 使用示例

```html
<!-- 亮色模式卡片 -->
<div class="shadow-card dark:shadow-dark-card">...</div>

<!-- 悬浮元素 -->
<div class="shadow-elevated dark:shadow-dark-elevated">...</div>

<!-- 输入框 -->
<input class="shadow-chat-input" />
```

---

## 🎬 动画系统

### 预设动画

```javascript
animation: {
  'fade-in': 'fadeIn 0.3s ease-in-out',
  'slide-up': 'slideUp 0.3s ease-out',
}
```

### 使用示例

```html
<div class="animate-fade-in">淡入动画</div>
<div class="animate-slide-up">上滑动画</div>
```

---

## 📐 组件样式规范

### 按钮

#### 主按钮 (Primary)
```html
<button class="px-4 py-2 bg-chatgpt-accent dark:bg-chatgpt-dark-accent text-white rounded-lg
               hover:bg-blue-600 dark:hover:bg-blue-500 transition-colors shadow-sm hover:shadow-md">
  主按钮
</button>
```

#### 次要按钮 (Secondary)
```html
<button class="px-4 py-2 bg-gray-100 dark:bg-chatgpt-dark-user text-gray-700 dark:text-chatgpt-dark-text
               rounded-lg hover:bg-gray-200 dark:hover:bg-chatgpt-dark-assistant transition-colors">
  次要按钮
</button>
```

#### 危险按钮 (Danger)
```html
<button class="px-4 py-2 bg-red-500 dark:bg-red-600 text-white rounded-lg
               hover:bg-red-600 dark:hover:bg-red-700 transition-colors">
  删除
</button>
```

### 输入框

```html
<input class="w-full px-4 py-3 border-2 border-chatgpt-border dark:border-chatgpt-dark-border
              rounded-xl bg-white dark:bg-chatgpt-dark-input text-chatgpt-text dark:text-chatgpt-dark-text
              focus:border-chatgpt-accent dark:focus:border-chatgpt-dark-accent
              focus:ring-1 focus:ring-chatgpt-accent transition-colors" />
```

### 卡片

```html
<div class="bg-white dark:bg-chatgpt-dark-sidebar rounded-2xl
            border border-chatgpt-border dark:border-chatgpt-dark-border
            shadow-card dark:shadow-dark-card p-6">
  卡片内容
</div>
```

### 消息气泡

#### 用户消息
```html
<div class="bg-chatgpt-user dark:bg-chatgpt-dark-user rounded-xl p-4">
  用户消息内容
</div>
```

#### AI消息
```html
<div class="bg-chatgpt-assistant dark:bg-chatgpt-dark-assistant rounded-xl p-4">
  AI消息内容
</div>
```

### 开关/切换按钮

#### 激活状态
```html
<button class="px-3 py-1.5 rounded-lg text-xs font-medium
               bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400
               hover:bg-blue-200 dark:hover:bg-blue-900/40 transition-colors">
  已开启
</button>
```

#### 未激活状态
```html
<button class="px-3 py-1.5 rounded-lg text-xs font-medium
               bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400
               hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
  未开启
</button>
```

---

## 🖼️ macOS 风格元素

### 窗口控制按钮 (红黄绿)

```html
<div class="flex items-center gap-2">
  <div class="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
  <div class="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
  <div class="w-3 h-3 rounded-full bg-[#27c93f]"></div>
</div>
```

### 窗口阴影 (macOS 风格)

```css
box-shadow: 0 0 0 1px rgba(0,0,0,0.02),
            0 30px 80px rgba(0,0,0,0.15),
            0 10px 30px rgba(0,0,0,0.05);
```

---

## 📜 滚动条样式

```css
/* 亮色模式滚动条 */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.12);
  border-radius: 10px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 0, 0, 0.25);
}

/* 暗色模式滚动条 */
.dark ::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
}

.dark ::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.25);
}
```

---

## ⚙️ Tailwind 配置

### 完整配置文件

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        chatgpt: {
          // 亮色主题
          sidebar: '#F7F7F8',
          main: '#FFFFFF',
          input: '#FFFFFF',
          user: '#FFFFFF',
          assistant: '#F9FAFB',
          border: '#E5E7EB',
          text: '#111827',
          subtext: '#6B7280',
          accent: '#3B82F6',

          // 暗色主题
          dark: {
            sidebar: '#1E1F23',
            main: '#2A2B32',
            input: '#2A2B32',
            user: '#343541',
            assistant: '#3E3F4B',
            border: '#4A4B57',
            text: '#ECECF1',
            subtext: '#9CA3AF',
            accent: '#60A5FA'
          }
        }
      },
      boxShadow: {
        'chat-input': '0 0 0 1px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.05)',
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'elevated': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'dark-card': '0 2px 8px 0 rgba(0, 0, 0, 0.4), 0 1px 3px 0 rgba(0, 0, 0, 0.3)',
        'dark-elevated': '0 10px 30px -5px rgba(0, 0, 0, 0.6), 0 8px 20px -5px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      }
    },
  },
  plugins: [],
}
```

---

## 🔤 字体

### 推荐字体栈

```css
font-family: 'Manrope', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
```

### 字体平滑

```css
body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
```

---

## 🎯 设计原则

1. **一致性** - 所有组件使用统一的配色和圆角
2. **对比度** - 确保亮/暗模式下都有良好的可读性
3. **柔和** - 避免纯黑纯白，使用柔和的灰色调
4. **层次感** - 通过背景色和阴影区分层级
5. **响应式** - 所有尺寸支持移动端适配
6. **过渡动画** - 交互元素添加平滑过渡效果

---

## 📁 项目结构建议

```
src/
├── assets/
│   └── main.css          # 全局样式、滚动条
├── components/           # Vue 组件
└── ...
tailwind.config.js        # Tailwind 配置
```

---

## 📝 版本

- **版本**: 1.0.0
- **更新日期**: 2026-01-13
- **作者**: Antigravity Team

