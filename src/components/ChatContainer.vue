<script setup>
import { ref, watch, nextTick, computed, onMounted, onUnmounted } from 'vue';
import { ArrowDown } from 'lucide-vue-next';
import MessageItem from './MessageItem.vue';

const props = defineProps({
    messages: Array,
    modelName: String,
    isStreaming: Boolean,
    diagramEnabled: Boolean,
    codeTheme: String,
    isSelectionMode: Boolean,
    selectedMessageIds: Set
});

const emit = defineEmits(['resend', 'edit', 'toggleSelection']);

const scrollContainer = ref(null);

// 自动滚动控制状态
const autoScrollEnabled = ref(true);
const showScrollButton = ref(false);
const isUserScrolling = ref(false);
let scrollTimeout = null;
let lastScrollTop = 0;

// 底部输入框的大致高度（包括渐变背景区域）
const INPUT_AREA_HEIGHT = 220;

const displayName = computed(() => {
    const name = props.modelName || 'ChatGPT';
    if (name.includes('Gemini')) return 'Gemini';
    if (name.includes('Claude')) return 'Claude';
    if (name.includes('GPT')) return 'ChatGPT';
    return 'AI';
});

// 检测是否接近底部
const isNearBottom = (threshold = 150) => {
    if (!scrollContainer.value) return true;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainer.value;
    return scrollHeight - scrollTop - clientHeight < threshold;
};

// 滚动到底部（带额外偏移量，确保不被输入框遮挡）
const scrollToBottom = (smooth = false) => {
    if (scrollContainer.value) {
        const targetScroll = scrollContainer.value.scrollHeight;
        if (smooth) {
            scrollContainer.value.scrollTo({
                top: targetScroll,
                behavior: 'smooth'
            });
        } else {
            scrollContainer.value.scrollTop = targetScroll;
        }
    }
};

// 处理用户滚动事件
const handleScroll = () => {
    if (!scrollContainer.value) return;

    const currentScrollTop = scrollContainer.value.scrollTop;
    const scrollDirection = currentScrollTop - lastScrollTop;
    lastScrollTop = currentScrollTop;

    // 判断是否接近底部
    const nearBottom = isNearBottom();

    // 如果用户向上滚动，暂停自动滚动
    if (scrollDirection < -5 && !nearBottom) {
        autoScrollEnabled.value = false;
        isUserScrolling.value = true;
    }

    // 更新返回底部按钮的显示状态
    showScrollButton.value = !nearBottom;

    // 设置滚动结束检测
    if (scrollTimeout) {
        clearTimeout(scrollTimeout);
    }
    scrollTimeout = setTimeout(() => {
        isUserScrolling.value = false;
        // 如果滚动到底部附近，重新启用自动滚动
        if (isNearBottom(50)) {
            autoScrollEnabled.value = true;
            showScrollButton.value = false;
        }
    }, 150);
};

// 点击返回底部按钮
const handleScrollToBottom = () => {
    autoScrollEnabled.value = true;
    showScrollButton.value = false;
    scrollToBottom(true);
};

// 监听消息变化来触发滚动
watch(() => props.messages, (newMessages, oldMessages) => {
    // 只有在非选择模式且自动滚动启用时才滚动
    if (!props.isSelectionMode && autoScrollEnabled.value) {
        nextTick(() => {
            scrollToBottom();
        });
    }
}, { deep: true });

// 监听流式输出状态
watch(() => props.isStreaming, (streaming, wasStreaming) => {
    if (streaming && autoScrollEnabled.value) {
        // 流式输出开始时，确保滚动到底部
        nextTick(() => {
            scrollToBottom();
        });
    }
    if (!streaming && wasStreaming) {
        // 流式输出结束后，再次确保滚动到底部
        nextTick(() => {
            if (autoScrollEnabled.value) {
                scrollToBottom();
            }
        });
    }
});

// 监听消息列表长度变化（发送新消息或切换对话时）
watch(() => props.messages?.length, (newLen, oldLen) => {
    // 新消息添加或切换对话
    if (newLen !== oldLen) {
        // 发送新消息时，重置自动滚动状态
        autoScrollEnabled.value = true;
        showScrollButton.value = false;

        // 延迟滚动，确保DOM完全渲染
        nextTick(() => {
            scrollToBottom();
            // 再次延迟确保滚动到位
            setTimeout(() => {
                scrollToBottom();
            }, 100);
        });
    }
});

onMounted(() => {
    if (scrollContainer.value) {
        scrollContainer.value.addEventListener('scroll', handleScroll, { passive: true });
        lastScrollTop = scrollContainer.value.scrollTop;
    }
});

onUnmounted(() => {
    if (scrollContainer.value) {
        scrollContainer.value.removeEventListener('scroll', handleScroll);
    }
    if (scrollTimeout) {
        clearTimeout(scrollTimeout);
    }
});

const handleResend = (messageIndex) => {
    emit('resend', messageIndex);
};

const handleEdit = (messageIndex) => {
    emit('edit', messageIndex);
};
</script>

<template>
    <div class="relative flex-1 overflow-hidden">
        <!-- 滚动容器 -->
        <div ref="scrollContainer" class="h-full overflow-y-auto scroll-smooth bg-chatgpt-main dark:bg-chatgpt-dark-main">
            <div v-if="messages.length === 0" class="h-full flex flex-col items-center justify-center text-chatgpt-text dark:text-chatgpt-dark-text px-6 animate-fade-in">
                <div class="w-16 h-16 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-2xl flex items-center justify-center shadow-elevated dark:shadow-dark-elevated mb-6 animate-slide-up">
                    <img src="/favicon.svg" class="w-10 h-10 object-contain" alt="ChatGPT" />
                </div>
                <h1 class="text-3xl font-bold mb-3 bg-gradient-to-r from-gray-900 to-gray-600 dark:from-gray-100 dark:to-gray-400 bg-clip-text text-transparent">有什么可以帮您?</h1>
                <div class="flex flex-wrap justify-center gap-3 max-w-3xl mt-8">
                    <div v-for="(hint, index) in ['制定健身计划', '写一封感谢信', '总结这篇文章', '规划一次旅行']" :key="hint"
                        class="px-4 py-3 rounded-2xl border-2 border-chatgpt-border dark:border-chatgpt-dark-border bg-white dark:bg-chatgpt-dark-user text-sm text-chatgpt-text dark:text-chatgpt-dark-text hover:bg-gray-50 dark:hover:bg-chatgpt-dark-assistant hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-card dark:hover:shadow-dark-card cursor-pointer font-medium"
                        :style="{ animationDelay: `${index * 100}ms` }">
                        {{ hint }}
                    </div>
                </div>
            </div>
            <!-- 正常布局，不需要额外的底部 padding -->
            <div v-else class="flex flex-col pb-6 pt-6">
                <MessageItem
                    v-for="(msg, index) in messages"
                    :key="index"
                    :message="msg"
                    :message-index="index"
                    :model-name="modelName"
                    :is-streaming="isStreaming"
                    :diagram-enabled="diagramEnabled"
                    :code-theme="codeTheme"
                    :is-selection-mode="isSelectionMode"
                    :is-selected="selectedMessageIds?.has(index)"
                    @resend="handleResend"
                    @edit="handleEdit"
                    @toggle-selection="$emit('toggleSelection', $event)"
                />
            </div>
        </div>

        <!-- 返回底部按钮 - 类似 ChatGPT 风格 -->
        <Transition name="scroll-btn">
            <button
                v-if="showScrollButton"
                @click="handleScrollToBottom"
                class="absolute bottom-4 left-1/2 -translate-x-1/2 z-20
                       flex items-center justify-center
                       w-9 h-9 rounded-full
                       bg-white dark:bg-gray-700
                       border border-gray-200 dark:border-gray-600
                       shadow-lg dark:shadow-dark-elevated
                       text-gray-600 dark:text-gray-300
                       hover:bg-gray-50 dark:hover:bg-gray-600
                       hover:text-gray-900 dark:hover:text-white
                       transition-all duration-200
                       hover:scale-110"
                title="返回底部"
            >
                <ArrowDown :size="18" />
            </button>
        </Transition>
    </div>
</template>

<style scoped>
/* 返回底部按钮过渡动画 */
.scroll-btn-enter-active,
.scroll-btn-leave-active {
    transition: all 0.25s ease;
}

.scroll-btn-enter-from,
.scroll-btn-leave-to {
    opacity: 0;
    transform: translateX(-50%) translateY(10px);
}

.scroll-btn-enter-to,
.scroll-btn-leave-from {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
}
</style>
