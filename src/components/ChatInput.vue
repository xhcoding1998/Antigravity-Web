<script setup>
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { Send, X, MessageSquare, MessageSquareOff, GitBranch, Square, Paperclip } from 'lucide-vue-next';
import {
    parseFile, getAcceptedFileTypes, isFileSupported,
    formatFileContentForAI, getFileIcon, formatFileSize
} from '../utils/fileParser.js';

const props = defineProps({
    isStreaming: Boolean,
    canStop: Boolean,
    isSelectionMode: Boolean,
    modelName: String,
    contextEnabled: Boolean,
    isDrawingModel: Boolean,
    diagramEnabled: Boolean
});

const emit = defineEmits(['send', 'stop', 'update:contextEnabled', 'update:diagramEnabled']);

const input = ref('');
const images = ref([]);
const textareaRef = ref(null);
const fileInputRef = ref(null);
const MAX_IMAGES = 3;
const MAX_FILES = 5;

// 上传的文件列表
const uploadedFiles = ref([]);
// 解析后的文件内容
const parsedFileContents = ref([]);
// 文件上传状态
const isParsingFiles = ref(false);
const fileParseError = ref('');

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
    if (props.isStreaming) {
        if (props.canStop) {
            emit('stop');
        }
        return;
    }
    if ((!input.value.trim() && images.value.length === 0 && parsedFileContents.value.length === 0) || props.isSelectionMode) return;

    // 构建包含文件内容的消息
    let finalContent = input.value;
    if (parsedFileContents.value.length > 0) {
        finalContent += formatFileContentForAI(parsedFileContents.value);
    }

    emit('send', finalContent, [...images.value]);

    // 重置所有状态
    input.value = '';
    images.value = [];
    uploadedFiles.value = [];
    parsedFileContents.value = [];

    if (textareaRef.value) {
        textareaRef.value.style.height = 'auto';
    }
};

// 处理键盘事件 - 支持 Shift+Enter 换行
const handleKeyDown = (event) => {
    if (event.key === 'Enter') {
        if (event.shiftKey) {
            // Shift+Enter: 插入换行符
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

// 处理文件（解析并添加到列表）
const processFiles = async (files) => {
    if (files.length === 0) return;

    // 检查文件数量限制
    const totalFiles = uploadedFiles.value.length + files.length;
    if (totalFiles > MAX_FILES) {
        fileParseError.value = `最多只能上传 ${MAX_FILES} 个文件`;
        setTimeout(() => { fileParseError.value = ''; }, 3000);
        return;
    }

    isParsingFiles.value = true;
    fileParseError.value = '';

    for (const file of files) {
        // 检查文件是否支持
        if (!isFileSupported(file)) {
            fileParseError.value = `不支持的文件类型: ${file.name}`;
            setTimeout(() => { fileParseError.value = ''; }, 3000);
            continue;
        }

        try {
            // 解析文件
            const parsed = await parseFile(file);

            // 添加到列表
            uploadedFiles.value.push({
                name: file.name,
                size: file.size,
                icon: getFileIcon(file.name),
                type: parsed.type
            });

            parsedFileContents.value.push(parsed);
        } catch (error) {
            console.error('文件解析错误:', error);
            fileParseError.value = error.message;
            setTimeout(() => { fileParseError.value = ''; }, 3000);
        }
    }

    isParsingFiles.value = false;
};

// 处理粘贴事件 - 支持图片和文件
const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const filesToProcess = [];

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
        // 检查是否是文件（非图片）
        else if (item.kind === 'file') {
            const file = item.getAsFile();
            if (file && isFileSupported(file)) {
                e.preventDefault();
                filesToProcess.push(file);
            }
        }
    }

    // 处理粘贴的文件
    if (filesToProcess.length > 0) {
        await processFiles(filesToProcess);
    }
};

// 触发文件选择
const triggerFileUpload = () => {
    if (fileInputRef.value) {
        fileInputRef.value.click();
    }
};

// 处理文件选择
const handleFileSelect = async (event) => {
    const files = Array.from(event.target.files || []);
    await processFiles(files);

    // 清空 input 以便可以重复选择相同文件
    if (fileInputRef.value) {
        fileInputRef.value.value = '';
    }
};

// 移除上传的文件
const removeFile = (index) => {
    uploadedFiles.value.splice(index, 1);
    parsedFileContents.value.splice(index, 1);
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

// 监听输入变化
watch(input, () => {
    nextTick(adjustHeight);
});

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
    <div class="flex-shrink-0 w-full bg-chatgpt-main dark:bg-chatgpt-dark-main px-6 md:px-4 pb-3 md:pb-5 pt-4 transition-colors duration-200">
        <div class="max-w-4xl mx-auto pb-3 md:pb-0 flex flex-col gap-2">

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
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/40'
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

                <!-- File Previews Above Input -->
                <div v-if="uploadedFiles.length > 0" class="flex flex-wrap gap-2 p-3 border-b border-chatgpt-border/40 dark:border-chatgpt-dark-border/40">
                    <div
                        v-for="(file, idx) in uploadedFiles"
                        :key="'file-' + idx"
                        class="relative group flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
                    >
                        <span class="text-lg">{{ file.icon }}</span>
                        <div class="flex flex-col">
                            <span class="text-xs font-medium text-gray-700 dark:text-gray-300 max-w-32 truncate">{{ file.name }}</span>
                            <span class="text-[10px] text-gray-400 dark:text-gray-500">{{ formatFileSize(file.size) }}</span>
                        </div>
                        <button
                            @click="removeFile(idx)"
                            class="ml-1 p-1 bg-gray-200 dark:bg-gray-700 hover:bg-red-500 dark:hover:bg-red-600 text-gray-500 hover:text-white rounded-full transition-all duration-200"
                            aria-label="删除文件"
                        >
                            <X :size="12" />
                        </button>
                    </div>

                    <!-- 解析中状态 -->
                    <div v-if="isParsingFiles" class="flex items-center gap-2 px-3 py-2 text-xs text-blue-600 dark:text-blue-400">
                        <div class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        解析中...
                    </div>
                </div>

                <!-- File Parse Error -->
                <div v-if="fileParseError" class="px-4 py-2 text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
                    ⚠️ {{ fileParseError }}
                </div>

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
                <div class="flex items-center gap-2 p-2 px-4 md:px-5">
                    <!-- File Upload Button -->
                    <button
                        @click="triggerFileUpload"
                        :disabled="isStreaming || isSelectionMode || uploadedFiles.length >= MAX_FILES"
                        class="p-2.5 rounded-xl transition-all duration-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        :title="uploadedFiles.length >= MAX_FILES ? `最多上传 ${MAX_FILES} 个文件` : '上传文件 (PDF、Excel、TXT、MD等)'"
                    >
                        <Paperclip :size="20" />
                    </button>

                    <!-- Hidden File Input -->
                    <input
                        ref="fileInputRef"
                        type="file"
                        :accept="getAcceptedFileTypes()"
                        multiple
                        class="hidden"
                        @change="handleFileSelect"
                    />

                    <!-- Textarea -->
                    <textarea
                        ref="textareaRef"
                        v-model="input"
                        rows="1"
                        :placeholder="uploadedFiles.length > 0 ? '描述文件内容或提问...' : (images.length > 0 ? '描述图片内容或提问...' : `给 ${displayName} 发消息... (Shift+Enter 换行)`)"
                        @keydown="handleKeyDown"
                        class="flex-1 resize-none border-0 bg-transparent p-3 md:p-3.5 focus:ring-0 focus:outline-none text-chatgpt-text dark:text-chatgpt-dark-text placeholder-gray-400 dark:placeholder-gray-500 text-[15px] max-h-48 custom-scrollbar leading-relaxed"
                        :disabled="isStreaming || isSelectionMode"
                    ></textarea>

                    <button
                        @click="handleSend"
                        :disabled="isStreaming ? !canStop : ((!input.trim() && images.length === 0 && parsedFileContents.length === 0) || isSelectionMode)"
                        class="p-2.5 rounded-xl transition-all duration-200 shadow-card dark:shadow-dark-card"
                        :class="[
                            isStreaming
                                ? (canStop
                                    ? 'bg-red-500 hover:bg-red-600 text-white hover:shadow-elevated hover:scale-105 cursor-pointer'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-300 dark:text-gray-500 cursor-not-allowed')
                                : (input.trim() || images.length > 0 || parsedFileContents.length > 0
                                    ? 'bg-chatgpt-accent dark:bg-chatgpt-dark-accent hover:bg-blue-600 dark:hover:bg-blue-500 text-white hover:shadow-elevated dark:hover:shadow-dark-elevated hover:scale-105'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-300 dark:text-gray-500 cursor-not-allowed')
                        ]"
                    >
                        <Square v-if="isStreaming" :size="20" :fill="canStop ? 'currentColor' : 'none'" />
                        <Send v-else :size="20" />
                    </button>
                </div>
            </div>

            <p class="text-xs text-center text-chatgpt-subtext dark:text-chatgpt-dark-subtext mt-1 px-4">
                {{ displayName }} 可能会出错。请核对重要信息。支持粘贴图片/文件 (Ctrl+V) · Shift+Enter 换行
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
