<script setup>
import { computed, ref } from 'vue';
import MarkdownIt from 'markdown-it';
import { User, Bot, Copy, ThumbsUp, ThumbsDown, Check, X, RefreshCw } from 'lucide-vue-next';

const props = defineProps({
    message: Object,
    modelName: String,
    messageIndex: Number,
    isStreaming: Boolean
});

const emit = defineEmits(['resend']);

const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true
});

// 从content中提取base64图片
const extractedImages = computed(() => {
    const images = [];
    const content = props.message.content || '';

    // 更强大的正则表达式，匹配完整的base64图片数据
    // 支持 data:image/png;base64,... 或 data:image/jpeg;base64,... 等格式
    const base64Regex = /data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=\s]+/g;
    const matches = content.match(base64Regex);

    if (matches) {
        matches.forEach(match => {
            // 清理可能的空格和换行
            const cleanedMatch = match.replace(/\s+/g, '');
            images.push(cleanedMatch);
        });
    }

    return images;
});

// 合并props.message.images和从content中提取的图片
const allImages = computed(() => {
    const messageImages = props.message.images || [];
    return [...messageImages, ...extractedImages.value];
});

// 从content中移除base64图片数据，避免显示为文本
const cleanedContent = computed(() => {
    let content = props.message.content || '';

    // 移除base64图片数据（包括可能的换行和空格）
    const base64Regex = /data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=\s]+/g;
    content = content.replace(base64Regex, '');

    // 移除markdown图片语法 ![alt](url) 或 ![](url)
    content = content.replace(/!\[.*?\]\(.*?\)/g, '');

    // 移除可能残留的 "image" 文本标记
    content = content.replace(/^image\s*$/gim, '');
    content = content.replace(/\bimage\b\s*$/gim, '');

    // 清理多余的空行和空格
    content = content.replace(/\n{3,}/g, '\n\n');
    content = content.replace(/^\s+|\s+$/g, '');
    content = content.trim();

    return content;
});

const renderedContent = computed(() => {
    return md.render(cleanedContent.value);
});

const isUser = computed(() => props.message.role === 'user');
const copied = ref(false);
const previewImage = ref(null);

const copyToClipboard = async () => {
    try {
        // 如果有图片,复制图片;否则复制文本
        if (allImages.value.length > 0) {
            const base64Image = allImages.value[0];

            // 创建一个Image对象来加载图片
            const img = new Image();
            img.src = base64Image;

            // 等待图片加载完成
            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
            });

            // 创建canvas来转换图片为PNG格式
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            // 将canvas转换为blob (PNG格式，浏览器支持最好)
            const blob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/png');
            });

            // 使用 Clipboard API 复制图片
            await navigator.clipboard.write([
                new ClipboardItem({
                    'image/png': blob
                })
            ]);

            console.log('图片已复制到剪贴板 (PNG格式)');
            copied.value = true;
            setTimeout(() => {
                copied.value = false;
            }, 2000);
        } else {
            // 只复制文本内容（使用清理后的内容）
            await navigator.clipboard.writeText(cleanedContent.value);
            console.log('文本已复制到剪贴板');
            copied.value = true;
            setTimeout(() => {
                copied.value = false;
            }, 2000);
        }
    } catch (err) {
        console.error('复制失败:', err);
        alert('复制失败: ' + err.message + '\n\n请确保:\n1. 使用的是 HTTPS 或 localhost\n2. 浏览器已授予剪贴板权限\n3. 使用的是现代浏览器 (Chrome/Edge/Firefox)');
    }
};

const openImagePreview = (img) => {
    console.log('openImagePreview called with:', img);
    console.log('Setting previewImage.value to:', img);
    previewImage.value = img;
    console.log('previewImage.value is now:', previewImage.value);
};

const closeImagePreview = () => {
    console.log('closeImagePreview called');
    previewImage.value = null;
};

// 重新发送
const handleResend = () => {
    emit('resend', props.messageIndex);
};
</script>

<template>
    <div class="py-6 w-full flex justify-center transition-all duration-200">
        <div
            :class="[
                'max-w-4xl w-full flex gap-5 px-8 md:px-6 group rounded-2xl py-4',
                isUser ? 'bg-chatgpt-user' : 'bg-chatgpt-assistant'
            ]"
        >
            <!-- Avatar -->
            <div
                :class="[
                    'w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-md',
                    isUser ? 'bg-gradient-to-br from-blue-500 to-purple-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600'
                ]"
            >
                <User v-if="isUser" :size="20" class="text-white" />
                <Bot v-else :size="20" class="text-white" />
            </div>

            <!-- Content Container -->
            <div class="flex flex-col gap-2 min-w-0 flex-1 relative">
                <!-- User Label -->
                <div class="text-sm font-bold text-chatgpt-text mb-1">
                    {{ isUser ? '你' : (modelName || 'AI') }}
                </div>

                <!-- Images -->
                <div v-if="allImages.length > 0" class="flex flex-wrap gap-2 mb-2">
                    <div
                        v-for="(img, idx) in allImages"
                        :key="idx"
                        class="relative overflow-hidden rounded-xl border border-chatgpt-border shadow-sm hover:shadow-md transition-all cursor-pointer group/img"
                        @click="openImagePreview(img)"
                    >
                        <img
                            :src="img"
                            class="max-w-[280px] max-h-[280px] object-contain bg-gray-50 block"
                            alt="Message image"
                            @click="openImagePreview(img)"
                        />
                        <div class="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center pointer-events-none">
                            <span class="text-white text-xs opacity-0 group-hover/img:opacity-100 bg-black/50 px-2 py-1 rounded whitespace-nowrap">点击查看大图</span>
                        </div>
                    </div>
                </div>

                <!-- Text Content -->
                <div class="prose prose-slate max-w-none break-words text-[15px] leading-[1.7] text-chatgpt-text" v-html="renderedContent"></div>

                <!-- Streaming Cursor -->
                <div v-if="!isUser && message.streaming" class="inline-block w-1.5 h-4 bg-chatgpt-accent rounded-sm animate-pulse ml-0.5"></div>

                <!-- Actions for AI messages (visible on hover) -->
                <div v-if="!isUser && !message.streaming && message.content" class="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        @click="copyToClipboard"
                        class="p-1.5 hover:bg-gray-200 rounded-md text-chatgpt-subtext hover:text-chatgpt-text transition-colors flex items-center gap-1"
                        :title="copied ? '已复制' : '复制'">
                        <Check v-if="copied" :size="14" class="text-green-600" />
                        <Copy v-else :size="14" />
                    </button>
                    <button class="p-1.5 hover:bg-gray-200 rounded-md text-chatgpt-subtext hover:text-chatgpt-text transition-colors">
                        <ThumbsUp :size="14" />
                    </button>
                    <button class="p-1.5 hover:bg-gray-200 rounded-md text-chatgpt-subtext hover:text-chatgpt-text transition-colors">
                        <ThumbsDown :size="14" />
                    </button>
                </div>

                <!-- Actions for User messages (visible on hover) -->
                <div v-if="isUser && !isStreaming" class="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        @click="handleResend"
                        class="p-1.5 hover:bg-emerald-100 rounded-md text-chatgpt-subtext hover:text-emerald-600 transition-colors flex items-center gap-1.5 text-sm"
                        title="重新发送这条消息">
                        <RefreshCw :size="14" />
                        <span class="text-xs">重新发送</span>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Image Preview Modal -->
    <Teleport to="body">
        <Transition name="fade">
            <div
                v-if="previewImage"
                class="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm"
                @click="closeImagePreview"
            >
                <button
                    @click.stop="closeImagePreview"
                    class="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-10"
                    aria-label="关闭"
                >
                    <X :size="24" />
                </button>
                <img
                    :src="previewImage"
                    @click.stop
                    class="max-w-[95%] max-h-[95vh] object-contain rounded-lg shadow-2xl"
                    alt="Preview"
                />
            </div>
        </Transition>
    </Teleport>
</template>

<style>
/* Markdown Content Overrides */
.prose {
    --tw-prose-body: #374151;
    --tw-prose-headings: #111827;
    --tw-prose-bold: #111827;
}

.prose pre {
    @apply bg-gray-900 text-gray-100 p-4 rounded-xl overflow-x-auto my-4 shadow-md;
}

.prose code {
    @apply bg-gray-100 px-1.5 py-0.5 rounded font-mono text-[13px] text-pink-600 font-medium;
}

.prose pre code {
    @apply bg-transparent p-0 text-inherit text-sm font-normal;
}

.prose p {
    @apply mb-4 last:mb-0;
}

.prose ul, .prose ol {
    @apply ml-6 mb-4 space-y-1.5;
}

.prose li {
    @apply pl-1;
}

.prose blockquote {
    @apply border-l-4 border-chatgpt-accent pl-4 italic text-gray-600 my-4 bg-gray-50 py-2 rounded-r-lg;
}

.prose a {
    @apply text-chatgpt-accent hover:underline font-medium transition-colors;
}

.prose h1, .prose h2, .prose h3 {
    @apply font-bold mt-6 mb-3;
}

.prose h1 {
    @apply text-2xl;
}

.prose h2 {
    @apply text-xl;
}

.prose h3 {
    @apply text-lg;
}

/* Fade transition for image preview */
.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

/* Hide any remaining image tags or artifacts */
.prose img[src=""],
.prose img:not([src]) {
    display: none;
}
</style>
