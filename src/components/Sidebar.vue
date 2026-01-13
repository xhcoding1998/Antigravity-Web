<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { Plus, MessageSquare, Trash2, Settings, PanelLeftClose, PanelLeft } from 'lucide-vue-next';
import ConfirmDialog from './ConfirmDialog.vue';
import CustomDropdown from './CustomDropdown.vue';

// 缓存 key
const SIDEBAR_WIDTH_KEY = 'chatgpt_sidebar_width';
const SIDEBAR_COLLAPSED_KEY = 'chatgpt_sidebar_collapsed';

const props = defineProps({
    history: Array,
    currentChatId: String,
    models: Array,
    selectedModelId: String,
    modelGroups: Array,
    currentGroupId: String,
    isDark: Boolean
});

const emit = defineEmits([
    'select', 'new', 'delete', 'clear',
    'update:selectedModelId', 'update:currentGroupId',
    'openSettings', 'toggleTheme'
]);

const showClearConfirm = ref(false);

// 侧边栏状态
const MIN_WIDTH = 220;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 280;

// 从 localStorage 加载初始状态
const loadSidebarState = () => {
    try {
        const savedWidth = localStorage.getItem(SIDEBAR_WIDTH_KEY);
        const savedCollapsed = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
        return {
            width: savedWidth ? parseInt(savedWidth) : DEFAULT_WIDTH,
            collapsed: savedCollapsed === 'true'
        };
    } catch (e) {
        return { width: DEFAULT_WIDTH, collapsed: false };
    }
};

const initialState = loadSidebarState();
const sidebarWidth = ref(initialState.width);
const isCollapsed = ref(initialState.collapsed);
const isResizing = ref(false);
const sidebarRef = ref(null);

// 保存到 localStorage
const saveSidebarState = () => {
    try {
        localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.value.toString());
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, isCollapsed.value.toString());
    } catch (e) {
        console.error('保存侧边栏状态失败:', e);
    }
};

// 监听状态变化并保存
watch([sidebarWidth, isCollapsed], () => {
    saveSidebarState();
}, { immediate: false });

// 拖拽开始
const startResize = (e) => {
    if (isCollapsed.value) return;
    e.preventDefault();
    isResizing.value = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
};

// 处理拖拽 - 直接使用鼠标位置
const handleResize = (e) => {
    if (!isResizing.value) return;

    let newWidth = e.clientX;

    // 限制宽度范围
    if (newWidth < MIN_WIDTH) newWidth = MIN_WIDTH;
    if (newWidth > MAX_WIDTH) newWidth = MAX_WIDTH;

    sidebarWidth.value = newWidth;
};

// 停止拖拽
const stopResize = () => {
    isResizing.value = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';

    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
};

// 切换展开/收起
const toggleCollapse = () => {
    isCollapsed.value = !isCollapsed.value;
};

// 转换为下拉选项格式
const groupOptions = computed(() => {
    if (!props.modelGroups || props.modelGroups.length === 0) return [];
    return props.modelGroups.map(group => ({
        value: group.id,
        label: group.name,
        badge: `${group.models?.length || 0} 个模型`
    }));
});

const modelOptions = computed(() => {
    if (!props.models || props.models.length === 0) return [];
    return props.models.map(model => ({
        value: model.id,
        label: model.name
    }));
});

const handleClearHistory = () => {
    showClearConfirm.value = true;
};

const confirmClearHistory = () => {
    emit('clear');
};

// 组件卸载时清理事件监听
onUnmounted(() => {
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
});

</script>

<template>
    <div class="relative flex h-full shrink-0">
        <!-- Sidebar Content -->
        <div
            ref="sidebarRef"
            :class="[
                'flex flex-col h-full bg-chatgpt-sidebar dark:bg-chatgpt-dark-sidebar border-r border-chatgpt-border dark:border-chatgpt-dark-border text-chatgpt-text dark:text-chatgpt-dark-text overflow-hidden',
                isResizing ? '' : 'transition-[width] duration-300'
            ]"
            :style="{ width: isCollapsed ? '0px' : `${sidebarWidth}px` }"
        >
            <!-- New Chat Button -->
            <div class="p-4 shrink-0">
                <button
                    @click="$emit('new')"
                    class="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl border-2 border-chatgpt-border dark:border-chatgpt-dark-border bg-white dark:bg-chatgpt-dark-user hover:bg-gray-50 dark:hover:bg-chatgpt-dark-assistant hover:border-gray-300 dark:hover:border-gray-600 text-sm font-semibold shadow-card dark:shadow-dark-card hover:shadow-elevated dark:hover:shadow-dark-elevated group whitespace-nowrap"
                >
                    <Plus :size="18" class="text-chatgpt-subtext dark:text-chatgpt-dark-subtext group-hover:text-chatgpt-text dark:group-hover:text-chatgpt-dark-text shrink-0" />
                    <span>新建对话</span>
                </button>
            </div>

            <!-- Chat History -->
            <div class="flex-1 overflow-y-auto px-3 space-y-1.5 py-2 custom-scrollbar">
                <div v-if="history.length === 0" class="text-xs text-chatgpt-subtext dark:text-chatgpt-dark-subtext text-center mt-12 px-4 leading-relaxed whitespace-nowrap">
                    您的对话历史将显示在这里。
                </div>
                <div
                    v-for="chat in history"
                    :key="chat.id"
                    @click="$emit('select', chat.id)"
                    :class="[
                        'group flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer relative text-sm',
                        currentChatId === chat.id ? 'bg-white dark:bg-chatgpt-dark-user shadow-card dark:shadow-dark-card font-medium' : 'hover:bg-white/60 dark:hover:bg-chatgpt-dark-user/50'
                    ]"
                >
                    <MessageSquare :size="18" :class="['shrink-0', currentChatId === chat.id ? 'text-chatgpt-accent dark:text-chatgpt-dark-accent' : 'text-chatgpt-subtext dark:text-chatgpt-dark-subtext']" />
                    <div class="flex-1 truncate pr-6" :title="new Date(parseInt(chat.id)).toLocaleString()">
                        {{ chat.title }}
                    </div>

                    <div class="absolute right-2 flex items-center opacity-0 group-hover:opacity-100 bg-inherit pr-1">
                        <button
                            @click.stop="$emit('delete', chat.id)"
                            class="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-500 dark:hover:text-red-400 rounded-lg"
                        >
                            <Trash2 :size="16" />
                        </button>
                    </div>
                </div>
            </div>

            <!-- Footer -->
            <div class="p-4 space-y-3 border-t border-chatgpt-border dark:border-chatgpt-dark-border bg-chatgpt-sidebar dark:bg-chatgpt-dark-sidebar shrink-0">
                <!-- Enhanced Model Selector -->
                <div class="relative space-y-3">
                     <!-- Group Selector -->
                     <div class="relative group">
                        <div class="text-[11px] font-bold text-chatgpt-subtext dark:text-chatgpt-dark-subtext uppercase px-1 mb-1.5 tracking-wide whitespace-nowrap">配置项</div>
                        <CustomDropdown
                            :model-value="currentGroupId"
                            :options="groupOptions"
                            placeholder="请选择配置"
                            empty-text="暂无配置"
                            @update:model-value="$emit('update:currentGroupId', $event)"
                        />
                    </div>

                    <!-- Model Selector -->
                    <div class="relative group">
                        <div class="text-[11px] font-bold text-chatgpt-subtext dark:text-chatgpt-dark-subtext uppercase px-1 mb-1.5 tracking-wide whitespace-nowrap">支持模型</div>
                        <CustomDropdown
                            :model-value="selectedModelId"
                            :options="modelOptions"
                            placeholder="请选择模型"
                            empty-text="暂无模型"
                            @update:model-value="$emit('update:selectedModelId', $event)"
                        />
                    </div>
                </div>

                <div class="pt-1 space-y-1">
                    <button
                        @click="handleClearHistory"
                        class="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-white dark:hover:bg-chatgpt-dark-user text-sm text-chatgpt-subtext dark:text-chatgpt-dark-subtext hover:text-chatgpt-text dark:hover:text-chatgpt-dark-text font-medium group whitespace-nowrap"
                    >
                        <Trash2 :size="18" class="group-hover:text-red-500 shrink-0" />
                        <span>清空历史</span>
                    </button>

                    <button
                        @click="$emit('openSettings')"
                        class="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-white dark:hover:bg-chatgpt-dark-user text-sm text-chatgpt-subtext dark:text-chatgpt-dark-subtext hover:text-chatgpt-text dark:hover:text-chatgpt-dark-text font-medium group whitespace-nowrap"
                    >
                        <Settings :size="18" class="group-hover:text-chatgpt-accent dark:group-hover:text-chatgpt-dark-accent shrink-0" />
                        <span>设置</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Resize Handle -->
        <div
            v-if="!isCollapsed"
            @mousedown="startResize"
            :class="[
                'w-1.5 h-full cursor-col-resize flex-shrink-0 group relative',
                'hover:bg-chatgpt-accent/30 dark:hover:bg-chatgpt-dark-accent/30',
                isResizing ? 'bg-chatgpt-accent dark:bg-chatgpt-dark-accent' : 'bg-transparent'
            ]"
        >
            <!-- 拖拽指示线 -->
            <div :class="[
                'absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 transition-colors',
                isResizing ? 'bg-chatgpt-accent dark:bg-chatgpt-dark-accent' : 'bg-transparent group-hover:bg-chatgpt-accent/50 dark:group-hover:bg-chatgpt-dark-accent/50'
            ]"></div>
        </div>

        <!-- Toggle Button -->
        <button
            @click="toggleCollapse"
            :class="[
                'absolute top-4 z-20 p-2 rounded-lg bg-white dark:bg-chatgpt-dark-sidebar border border-chatgpt-border dark:border-chatgpt-dark-border shadow-card dark:shadow-dark-card hover:shadow-elevated dark:hover:shadow-dark-elevated transition-all',
                isResizing ? '' : 'duration-300'
            ]"
            :style="{ left: isCollapsed ? '12px' : `${sidebarWidth + 12}px` }"
            :title="isCollapsed ? '展开侧边栏' : '收起侧边栏'"
        >
            <PanelLeft v-if="isCollapsed" :size="18" class="text-chatgpt-subtext dark:text-chatgpt-dark-subtext" />
            <PanelLeftClose v-else :size="18" class="text-chatgpt-subtext dark:text-chatgpt-dark-subtext" />
        </button>

        <!-- 清空历史确认对话框 -->
        <ConfirmDialog
            :show="showClearConfirm"
            title="清空对话历史"
            message="确定要清空所有对话历史吗？此操作无法撤销。"
            confirm-text="清空"
            cancel-text="取消"
            type="danger"
            @confirm="confirmClearHistory"
            @close="showClearConfirm = false"
        />
    </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
    width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 10px;
}
.custom-scrollbar:hover::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.15);
}
.dark .custom-scrollbar:hover::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.15);
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.25);
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.25);
}

/* 美化 select 下拉框 */
select {
    background-image: none;
}

select option {
    padding: 10px 12px;
    background-color: white;
    color: #111827;
    font-weight: 500;
}

/* Dark mode select options */
.dark select option {
    background-color: #2A2B32;
    color: #ECECF1;
}

select option:hover,
select option:checked {
    background: linear-gradient(to right, #3B82F615, transparent);
    color: #111827;
}

.dark select option:hover,
.dark select option:checked {
    background: linear-gradient(to right, #60A5FA20, transparent);
    color: #ECECF1;
}
</style>
