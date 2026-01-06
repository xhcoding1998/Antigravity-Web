import { ref, watch, onMounted } from 'vue';

const THEME_KEY = 'chatgpt_theme';

export function useTheme() {
    const isDark = ref(false);

    // 从 localStorage 加载主题设置
    const loadTheme = () => {
        const saved = localStorage.getItem(THEME_KEY);
        if (saved) {
            isDark.value = saved === 'dark';
        } else {
            // 默认使用系统主题
            isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        applyTheme();
    };

    // 应用主题到 DOM
    const applyTheme = () => {
        if (isDark.value) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    };

    // 切换主题
    const toggleTheme = () => {
        isDark.value = !isDark.value;
    };

    // 监听主题变化并保存
    watch(isDark, (newValue) => {
        localStorage.setItem(THEME_KEY, newValue ? 'dark' : 'light');
        applyTheme();
    });

    // 监听系统主题变化
    onMounted(() => {
        loadTheme();

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const handleChange = (e) => {
            // 只有在没有手动设置主题时才跟随系统
            if (!localStorage.getItem(THEME_KEY)) {
                isDark.value = e.matches;
            }
        };

        mediaQuery.addEventListener('change', handleChange);

        // 返回清理函数
        return () => {
            mediaQuery.removeEventListener('change', handleChange);
        };
    });

    return {
        isDark,
        toggleTheme
    };
}
