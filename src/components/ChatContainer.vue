<script setup>
import { ref, onUpdated, nextTick, computed } from 'vue';
import MessageItem from './MessageItem.vue';

const props = defineProps({
    messages: Array,
    modelName: String,
    isStreaming: Boolean,
    diagramEnabled: Boolean,
    codeTheme: String
});

const emit = defineEmits(['resend', 'edit']);

const scrollContainer = ref(null);

const displayName = computed(() => {
    const name = props.modelName || 'ChatGPT';
    if (name.includes('Gemini')) return 'Gemini';
    if (name.includes('Claude')) return 'Claude';
    if (name.includes('GPT')) return 'ChatGPT';
    return 'AI';
});

const scrollToBottom = () => {
    if (scrollContainer.value) {
        scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
    }
};

onUpdated(() => {
    nextTick(scrollToBottom);
});

const handleResend = (messageIndex) => {
    emit('resend', messageIndex);
};

const handleEdit = (messageIndex) => {
    emit('edit', messageIndex);
};
</script>

<template>
    <div ref="scrollContainer" class="flex-1 overflow-y-auto scroll-smooth bg-chatgpt-main dark:bg-chatgpt-dark-main transition-colors duration-200">
        <div v-if="messages.length === 0" class="h-full flex flex-col items-center justify-center text-chatgpt-text dark:text-chatgpt-dark-text px-6 animate-fade-in">
            <div class="w-16 h-16 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-2xl flex items-center justify-center shadow-elevated dark:shadow-dark-elevated mb-6 animate-slide-up">
                <img src="/favicon.svg" class="w-10 h-10 object-contain" alt="ChatGPT" />
            </div>
            <h1 class="text-3xl font-bold mb-3 bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-400 bg-clip-text text-transparent">有什么可以帮您?</h1>
            <div class="flex flex-wrap justify-center gap-3 max-w-3xl mt-8">
                <div v-for="(hint, index) in ['制定健身计划', '写一封感谢信', '总结这篇文章', '规划一次旅行']" :key="hint"
                    class="px-4 py-3 rounded-2xl border-2 border-chatgpt-border dark:border-chatgpt-dark-border bg-white dark:bg-chatgpt-dark-user text-sm text-chatgpt-text dark:text-chatgpt-dark-text hover:bg-gray-50 dark:hover:bg-chatgpt-dark-assistant hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-card dark:hover:shadow-dark-card cursor-pointer transition-all duration-200 font-medium"
                    :style="{ animationDelay: `${index * 100}ms` }">
                    {{ hint }}
                </div>
            </div>
        </div>
        <div v-else class="flex flex-col pb-48 pt-6">
            <MessageItem
                v-for="(msg, index) in messages"
                :key="index"
                :message="msg"
                :message-index="index"
                :model-name="modelName"
                :is-streaming="isStreaming"
                :diagram-enabled="diagramEnabled"
                :code-theme="codeTheme"
                @resend="handleResend"
                @edit="handleEdit"
            />
        </div>
    </div>
</template>
