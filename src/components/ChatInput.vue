<script setup>
import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
import { Send, X, MessageSquare, MessageSquareOff, GitBranch } from 'lucide-vue-next';

const props = defineProps({
    disabled: Boolean,
    modelName: String,
    contextEnabled: Boolean,
    isDrawingModel: Boolean,
    diagramEnabled: Boolean
});

const emit = defineEmits(['send', 'update:contextEnabled', 'update:diagramEnabled']);

const input = ref('');
const images = ref([]);
const textareaRef = ref(null);
const MAX_IMAGES = 3;

const displayName = computed(() => {
    // 从模型名称中提取品牌名
    const name = props.modelName || 'ChatGPT';
    if (name.includes('Gemini')) return 'Gemini';
    if (name.includes('Claude')) return 'Claude';
    if (name.includes('GPT')) return 'ChatGPT';
    return 'AI';
});

// 切换上下文开关
const toggleContext = () => {
    if (!props.isDrawingModel) {  // 绘图模型不允许切换
        emit('update:contextEnabled', !props.contextEnabled);
    }
};

// 切换图表渲染开关
const toggleDiagram = () => {
    emit('update:diagramEnabled', !props.diagramEnabled);
};

const handleSend = () => {
    if ((!input.value.trim() && images.value.length === 0) || props.disabled) return;
    emit('send', input.value, [...images.value]);
    input.value = '';
    images.value = [];
    if (textareaRef.value) {
        textareaRef.value.style.height = 'auto';
    }
};

// 处理键盘事件 - 支持 Ctrl+Enter 换行
const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
        if (event.ctrlKey || event.metaKey) {
            // Ctrl+Enter 或 Cmd+Enter: 插入换行符
            event.preventDefault();
            const textarea = event.target;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const value = input.value;

            // 在光标位置插入换行符
            input.value = value.substring(0, start) + '\n' + value.substring(end);

            // 恢复光标位置
            nextTick(() => {
                textarea.selectionStart = textarea.selectionEnd = start + 1;
                adjustHeight();
            });
        } else {
            // 普通 Enter: 发送消息
            event.preventDefault();
            handleSend();
        }
    }
};

// 处理粘贴事件
const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    // 遍历剪贴板项
    for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // 检查是否是图片
        if (item.type.indexOf('image') !== -1) {
            e.preventDefault(); // 阻止默认粘贴行为

            // 检查图片数量限制
            if (images.value.length >= MAX_IMAGES) {
                alert(`最多只能添加 ${MAX_IMAGES} 张图片`);
                return;
            }

            const file = item.getAsFile();
            if (file) {
                // 将图片转换为base64
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (images.value.length < MAX_IMAGES) {
                        images.value.push(event.target.result);
                    }
                };
                reader.readAsDataURL(file);
            }
        }
    }
};

const removeImage = (index) => {
    images.value.splice(index, 1);
};

const adjustHeight = () => {
    if (textareaRef.value) {
        textareaRef.value.style.height = 'auto';
        textareaRef.value.style.height = Math.min(textareaRef.value.scrollHeight, 200) + 'px';
    }
};

// 组件挂载时添加粘贴事件监听
onMounted(() => {
    if (textareaRef.value) {
        textareaRef.value.addEventListener('paste', handlePaste);
    }
});

// 组件卸载时移除事件监听
onUnmounted(() => {
    if (textareaRef.value) {
        textareaRef.value.removeEventListener('paste', handlePaste);
    }
});

watch(input, adjustHeight);

// 暴露方法供父组件调用
const focus = () => {
    if (textareaRef.value) {
        textareaRef.value.focus();
    }
};

const setEditContent = (content, editImages = []) => {
    input.value = content;
    images.value = [...editImages];
    // 自动聚焦到输入框
    focus();
    adjustHeight();
};

const setContent = (content) => {
    input.value = content;
    adjustHeight();
};

defineExpose({
    setEditContent,
    setContent,
    focus
});
</script>

<template>
    <div class="absolute bottom-0 left-0 w-full bg-gradient-to-t from-white dark:from-chatgpt-dark-main via-white dark:via-chatgpt-dark-main to-transparent pt-8 px-6 md:px-4 transition-colors duration-200">
        <div class="max-w-4xl mx-auto pb-3 md:pb-5 flex flex-col gap-2">

            <!-- Context Toggle -->
            <div class="flex items-center justify-between px-2 gap-3">
                <!-- Context Toggle Button -->
                <button
                    @click="toggleContext"
                    :disabled="isDrawingModel"
                    :class="[
                        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                        isDrawingModel
                            ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                            : contextEnabled
                                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/40'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    ]"
                    :title="isDrawingModel ? '绘图模型不支持上下文' : (contextEnabled ? '点击关闭上下文' : '点击开启上下文')"
                >
                    <MessageSquare v-if="contextEnabled" :size="14" />
                    <MessageSquareOff v-else :size="14" />
                    <span>{{ isDrawingModel ? '绘图模式' : (contextEnabled ? '上下文' : '上下文') }}</span>
                </button>

                <!-- Diagram Rendering Toggle Button -->
                <button
                    @click="toggleDiagram"
                    :class="[
                        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
                        diagramEnabled
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/40'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                    ]"
                    :title="diagramEnabled ? '点击关闭图表渲染' : '点击开启图表渲染'"
                >
                    <GitBranch :size="14" />
                    <span>{{ diagramEnabled ? '图表渲染' : '图表渲染' }}</span>
                </button>

                <div class="flex-1 text-xs text-chatgpt-subtext dark:text-chatgpt-dark-subtext text-right">
                    {{ diagramEnabled ? '代码块中的流程图将被渲染' : '仅显示代码文本' }}
                </div>
            </div>

            <!-- Main Input Container -->
            <div class="relative flex flex-col w-full bg-white dark:bg-chatgpt-dark-input border-2 border-chatgpt-border dark:border-chatgpt-dark-border rounded-3xl shadow-elevated dark:shadow-dark-elevated transition-all duration-300 focus-within:border-chatgpt-accent dark:focus-within:border-chatgpt-dark-accent focus-within:shadow-xl dark:focus-within:shadow-dark-elevated">

                <!-- Image Previews Above Input -->
                <div v-if="images.length > 0" class="flex flex-wrap gap-3 p-4 border-b border-chatgpt-border/40 dark:border-chatgpt-dark-border/40">
                    <div v-for="(img, idx) in images" :key="idx" class="relative group">
                        <img :src="img" class="w-24 h-24 object-contain rounded-2xl border-2 border-chatgpt-border dark:border-chatgpt-dark-border shadow-card dark:shadow-dark-card bg-gray-50 dark:bg-gray-800" />
                        <button
                            @click="removeImage(idx)"
                            class="absolute -top-2 -right-2 bg-gray-900 dark:bg-gray-700 hover:bg-red-500 dark:hover:bg-red-600 text-white rounded-full p-1.5 shadow-elevated dark:shadow-dark-elevated opacity-0 group-hover:opacity-100 transition-all duration-200"
                            aria-label="删除图片"
                        >
                            <X :size="14" />
                        </button>
                    </div>
                    <div v-if="images.length < MAX_IMAGES" class="w-24 h-24 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center text-gray-400 dark:text-gray-500 text-xs text-center px-2">
                        可粘贴<br />{{ MAX_IMAGES - images.length }} 张
                    </div>
                </div>

                <!-- Input Row -->
                <div class="flex items-end gap-2 p-2 px-4 md:px-5">
                    <textarea
                        ref="textareaRef"
                        v-model="input"
                        rows="1"
                        :placeholder="images.length > 0 ? `描述图片内容或提问...` : `给 ${displayName} 发消息... (Ctrl+Enter 换行)`"
                        @keydown="handleKeyDown"
                        class="flex-1 resize-none border-0 bg-transparent p-3 md:p-3.5 focus:ring-0 focus:outline-none text-chatgpt-text dark:text-chatgpt-dark-text placeholder-gray-400 dark:placeholder-gray-500 text-[15px] max-h-48 custom-scrollbar leading-relaxed"
                        :disabled="disabled"
                    ></textarea>

                    <button
                        @click="handleSend"
                        :disabled="(!input.trim() && images.length === 0) || disabled"
                        class="mb-1.5 p-2.5 rounded-xl transition-all duration-200 shadow-card dark:shadow-dark-card"
                        :class="input.trim() || images.length > 0 ? 'bg-chatgpt-accent dark:bg-chatgpt-dark-accent hover:bg-emerald-600 dark:hover:bg-emerald-500 text-white hover:shadow-elevated dark:hover:shadow-dark-elevated hover:scale-105' : 'bg-gray-100 dark:bg-gray-700 text-gray-300 dark:text-gray-500 cursor-not-allowed'"
                    >
                        <Send :size="20" />
                    </button>
                </div>
            </div>

            <p class="text-xs text-center text-chatgpt-subtext dark:text-chatgpt-dark-subtext mt-1 px-4">
                {{ displayName }} 可能会出错。请核对重要信息。支持粘贴图片 (Ctrl+V) · Ctrl+Enter 换行
            </p>
        </div>
    </div>
</template>

<style scoped>
textarea::-webkit-scrollbar {
    width: 6px;
}
textarea::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 10px;
}
textarea::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.2);
}
</style>
