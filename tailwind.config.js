/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // 启用 class 模式的暗色主题
  theme: {
    extend: {
      colors: {
        chatgpt: {
          // 亮色主题颜色
          sidebar: '#F7F7F8',
          main: '#FFFFFF',
          input: '#FFFFFF',
          user: '#FFFFFF',
          assistant: '#F9FAFB',
          border: '#E5E7EB',
          text: '#111827',
          subtext: '#6B7280',
          accent: '#10A37F',

          // 暗色主题颜色（柔和配色）
          dark: {
            sidebar: '#1E1F23',      // 深灰侧边栏
            main: '#2A2B32',         // 深灰主背景
            input: '#2A2B32',        // 深灰输入框
            user: '#343541',         // 用户消息背景
            assistant: '#3E3F4B',    // AI消息背景（稍亮）
            border: '#4A4B57',       // 边框颜色
            text: '#ECECF1',         // 主文字颜色（柔和白）
            subtext: '#9CA3AF',      // 次要文字颜色（柔和灰）
            accent: '#19C37D'        // 强调色（柔和绿）
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
