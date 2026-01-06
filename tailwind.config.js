/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        chatgpt: {
          sidebar: '#F7F7F8',
          main: '#FFFFFF',
          input: '#FFFFFF',
          user: '#FFFFFF',
          assistant: '#F9FAFB',
          border: '#E5E7EB',
          text: '#111827',
          subtext: '#6B7280',
          accent: '#10A37F'
        }
      },
      boxShadow: {
        'chat-input': '0 0 0 1px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.05)',
        'card': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'elevated': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
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
