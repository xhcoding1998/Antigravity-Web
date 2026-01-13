<script setup>
import { ref, onMounted, watch, nextTick } from 'vue';
import { X, Download, FileText, Image as ImageIcon, Copy, Check } from 'lucide-vue-next';
import { copyDOMAsImage } from '../utils/exportUtils';

const props = defineProps({
    show: Boolean,
    format: {
        type: String, // 'image', 'pdf', 'markdown'
        default: 'image'
    },
    // 对于 image/pdf，content 是一个 DOM 元素（容器）
    // 对于 markdown，content 是字符串
    content: [Object, String, HTMLElement],
    defaultFilename: {
        type: String,
        default: 'ChatExport'
    }
});

const emit = defineEmits(['close', 'confirm']);

const filename = ref('');
const previewContainer = ref(null);

// 初始化或者重置
watch(() => props.show, async (newVal) => {
    if (newVal) {
        filename.value = props.defaultFilename;
        await nextTick();
        renderPreview();
    }
});

const renderPreview = () => {
    if (!previewContainer.value || !props.content) return;

    if (props.format === 'markdown') {
        // Markdown 直接显示文本
        return;
    }

    // Image/PDF: 清空容器并插入 DOM 元素
    previewContainer.value.innerHTML = '';
    // 如果是 DOM 节点，直接 append
    if (props.content instanceof HTMLElement) {
        previewContainer.value.appendChild(props.content);
    }
};

const isCopying = ref(false);
const copySuccess = ref(false);

const handleConfirm = () => {
    if (!filename.value.trim()) {
        alert('请输入文件名');
        return;
    }
    emit('confirm', filename.value);
};

const handleCopy = async () => {
    if (isCopying.value || !props.content) return;
    if (props.format === 'image' && !(props.content instanceof HTMLElement)) return;

    isCopying.value = true;
    try {
        if (props.format === 'markdown') {
            await navigator.clipboard.writeText(props.content);
            copySuccess.value = true;
            setTimeout(() => {
                copySuccess.value = false;
            }, 2000);
        } else {
            const result = await copyDOMAsImage(props.content);
            if (result.success) {
                copySuccess.value = true;
                setTimeout(() => {
                    copySuccess.value = false;
                }, 2000);
            } else {
                alert('复制失败: ' + result.error);
            }
        }
    } catch (e) {
        alert('复制失败: ' + e.message);
    } finally {
        isCopying.value = false;
    }
};

</script>

<template>
    <Teleport to="body">
        <Transition name="fade">
            <div v-if="show" class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
                <!-- Modal Window -->
                <!-- max-h-[85vh] 配合 flex-col，当内容多时只有中间滚动，内容少时高度自适应 -->
                <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-[90vw] max-w-4xl max-h-[85vh] flex flex-col border border-gray-200 dark:border-gray-700 transition-all" @click.stop>

                    <!-- Header -->
                    <div class="flex-none flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
                        <div class="flex items-center gap-3">
                            <div class="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-500">
                                <ImageIcon v-if="format === 'image'" :size="20" />
                                <FileText v-else-if="format === 'pdf'" :size="20" />
                                <Download v-else :size="20" />
                            </div>
                            <div>
                                <h3 class="text-lg font-bold text-gray-800 dark:text-gray-100">导出预览</h3>
                                <p class="text-xs text-gray-500 dark:text-gray-400">
                                    {{ format === 'image' ? '生成图片' : format === 'pdf' ? '生成 PDF 文档' : '生成 Markdown 文本' }}
                                </p>
                            </div>
                        </div>
                        <button @click="$emit('close')" class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500">
                            <X :size="20" />
                        </button>
                    </div>

                    <!-- Body: Preview Area -->
                    <!-- flex-1 + overflow-hidden 确保它占据剩余空间 -->
                    <!-- min-h-0 是嵌套 flex scroll 的关键 -->
                    <div class="flex-1 overflow-hidden bg-gray-50 dark:bg-gray-900 flex flex-col min-h-0">
                        <!-- Scrollable Content -->
                        <!-- items-start 防止内容少时被拉伸居中或者占满高度 -->
                        <div class="flex-1 overflow-auto p-4 md:p-8 custom-scrollbar flex justify-center items-start">

                            <!-- Markdown Preview -->
                            <!-- 使用 h-auto 和 min-height 让它看起来自然 -->
                            <textarea
                                v-if="format === 'markdown'"
                                readonly
                                :value="content"
                                class="w-full h-[50vh] max-w-3xl bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 font-mono text-sm resize-none focus:outline-none text-gray-700 dark:text-gray-300 leading-relaxed"
                            ></textarea>

                            <!-- DOM Preview (Image/PDF) -->
                            <div
                                v-else
                                ref="previewContainer"
                                class="preview-stage shadow-lg rounded-lg overflow-hidden bg-white dark:bg-gray-800 origin-top shrink-0"
                            >
                                <!-- Content will be injected here -->
                            </div>

                        </div>
                    </div>

                    <!-- Footer: Filename and Actions -->
                    <div class="flex-none p-6 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 z-10 flex flex-col md:flex-row gap-4 items-center justify-between">

                        <!-- Filename Input -->
                        <div class="flex-1 w-full md:w-auto">
                            <div class="relative">
                                <input
                                    v-model="filename"
                                    type="text"
                                    placeholder="输入文件名..."
                                    class="w-full pl-4 pr-12 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500/50 outline-none transition-all text-gray-700 dark:text-white"
                                    @keyup.enter="handleConfirm"
                                />
                                <span class="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium select-none pointer-events-none">
                                    .{{ format === 'markdown' ? 'md' : format }}
                                </span>
                            </div>
                        </div>

                        <!-- Buttons -->
                        <div class="flex gap-3 w-full md:w-auto">
                            <button
                                v-if="format === 'pdf'"
                                @click="$emit('close')"
                                class="flex-1 md:flex-none px-6 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                            >
                                取消
                            </button>
                            <button
                                v-else
                                @click="handleCopy"
                                :disabled="isCopying"
                                class="flex-1 md:flex-none px-6 py-2.5 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium flex items-center justify-center gap-2"
                            >
                                <component :is="copySuccess ? Check : Copy" :size="18" />
                                {{ copySuccess ? '已复制' : (isCopying ? '复制中...' : (format === 'markdown' ? '复制文本' : '复制图片')) }}
                            </button>
                            <button
                                @click="handleConfirm"
                                class="flex-1 md:flex-none px-8 py-2.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-100 transition-all font-bold shadow-lg shadow-gray-200 dark:shadow-none flex items-center justify-center gap-2"
                            >
                                <Download :size="18" />
                                确认导出
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<style scoped>
.preview-stage {
    /* 限制最大宽度，防止内容过宽溢出 */
    max-width: 100%;
}

.custom-scrollbar::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}
.custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(0,0,0,0.1);
    border-radius: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgba(0,0,0,0.2);
}
.dark .custom-scrollbar::-webkit-scrollbar-thumb {
    background: rgba(255,255,255,0.1);
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}
</style>
