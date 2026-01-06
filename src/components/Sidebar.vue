<script setup>
import { ref } from 'vue';
import { Plus, MessageSquare, Trash2, ChevronDown, Settings } from 'lucide-vue-next';
import ConfirmDialog from './ConfirmDialog.vue';

const props = defineProps({
    history: Array,
    currentChatId: String,
    models: Array,
    selectedModelId: String
});

const emit = defineEmits(['select', 'new', 'delete', 'clear', 'update:selectedModelId', 'openSettings']);

const showClearConfirm = ref(false);

const handleClearHistory = () => {
    showClearConfirm.value = true;
};

const confirmClearHistory = () => {
    emit('clear');
};

</script>

<template>
    <div class="flex flex-col h-full bg-chatgpt-sidebar w-[280px] border-r border-chatgpt-border text-chatgpt-text">
        <!-- New Chat Button -->
        <div class="p-4">
            <button
                @click="$emit('new')"
                class="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl border-2 border-chatgpt-border bg-white hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 text-sm font-semibold shadow-card hover:shadow-elevated group"
            >
                <Plus :size="18" class="text-chatgpt-subtext group-hover:text-chatgpt-text transition-colors" />
                新建对话
            </button>
        </div>

        <!-- Chat History -->
        <div class="flex-1 overflow-y-auto px-3 space-y-1.5 py-2 custom-scrollbar">
            <div v-if="history.length === 0" class="text-xs text-chatgpt-subtext text-center mt-12 px-4 leading-relaxed">
                您的对话历史将显示在这里。
            </div>
            <div
                v-for="chat in history"
                :key="chat.id"
                @click="$emit('select', chat.id)"
                :class="[
                    'group flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all duration-200 relative text-sm',
                    currentChatId === chat.id ? 'bg-white shadow-card font-medium' : 'hover:bg-white/60'
                ]"
            >
                <MessageSquare :size="18" :class="['shrink-0 transition-colors', currentChatId === chat.id ? 'text-chatgpt-accent' : 'text-chatgpt-subtext']" />
                <div class="flex-1 truncate pr-6">
                    {{ chat.title }}
                </div>

                <div class="absolute right-2 flex items-center opacity-0 group-hover:opacity-100 transition-opacity bg-inherit pr-1">
                    <button
                        @click.stop="$emit('delete', chat.id)"
                        class="p-1.5 hover:bg-red-50 hover:text-red-500 rounded-lg transition-all duration-200"
                    >
                        <Trash2 :size="16" />
                    </button>
                </div>
            </div>
        </div>

        <!-- Footer -->
        <div class="p-4 space-y-3 border-t border-chatgpt-border bg-chatgpt-sidebar">
            <!-- Enhanced Model Selector -->
            <div class="relative">
                <div class="text-[11px] font-bold text-chatgpt-subtext uppercase px-1 mb-2 tracking-wide">模型</div>
                <div class="relative group">
                    <select
                        :value="selectedModelId"
                        @change="$emit('update:selectedModelId', $event.target.value)"
                        class="w-full bg-white border-2 border-chatgpt-border rounded-xl py-2.5 pl-3 pr-9 text-sm font-medium appearance-none cursor-pointer hover:border-gray-300 hover:bg-gray-50 transition-all duration-200 focus:outline-none focus:border-chatgpt-accent shadow-card truncate"
                    >
                        <option v-for="model in models" :key="model.id" :value="model.id">
                            {{ model.name }}
                        </option>
                    </select>
                    <div class="absolute inset-y-0 right-3 flex items-center pointer-events-none text-chatgpt-subtext">
                        <ChevronDown :size="16" />
                    </div>
                </div>
            </div>

            <div class="pt-1 space-y-1">
                <button
                    @click="handleClearHistory"
                    class="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-white transition-all duration-200 text-sm text-chatgpt-subtext hover:text-chatgpt-text font-medium group"
                >
                    <Trash2 :size="18" class="group-hover:text-red-500 transition-colors" />
                    清空历史
                </button>

                <button
                    @click="$emit('openSettings')"
                    class="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-white transition-all duration-200 text-sm text-chatgpt-subtext hover:text-chatgpt-text font-medium group"
                >
                    <Settings :size="18" class="group-hover:text-chatgpt-accent transition-colors" />
                    设置
                </button>
            </div>
        </div>

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
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.25);
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

select option:hover,
select option:checked {
    background: linear-gradient(to right, #10A37F15, transparent);
    color: #111827;
}
</style>
