<script setup>
import { computed, ref, onMounted, nextTick, watch, onUnmounted } from 'vue';
import MarkdownIt from 'markdown-it';
import mermaid from 'mermaid';
import hljs from 'highlight.js';
import { User, Bot, Copy, ThumbsUp, ThumbsDown, Check, X, RefreshCw, Edit3 } from 'lucide-vue-next';

const props = defineProps({
    message: Object,
    modelName: String,
    messageIndex: Number,
    isStreaming: Boolean,
    diagramEnabled: Boolean,
    codeTheme: String,
    isSelectionMode: Boolean,
    isSelected: Boolean
});

const emit = defineEmits(['resend', 'edit', 'toggleSelection']);

const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    highlight: function (str, lang) {
        // 不在这里高亮，而是返回原始代码，在渲染后再处理
        if (lang) {
            return `<pre><code class="hljs language-${lang}">${md.utils.escapeHtml(str)}</code></pre>`;
        }
        return `<pre><code class="hljs">${md.utils.escapeHtml(str)}</code></pre>`;
    }
});

// 初始化 Mermaid
mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    fontSize: 14,
    suppressErrors: true, // 禁止在页面底部显示错误
    logLevel: 'error' // 只在控制台记录错误日志
});

const contentRef = ref(null);
const mermaidCounter = ref(0);

// 右键菜单相关
const contextMenu = ref({
    visible: false,
    x: 0,
    y: 0,
    targetSvg: null
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

// 清理 Mermaid 在 body 中插入的错误提示
const cleanMermaidErrors = () => {
    // 查找并删除 mermaid 在 body 中插入的错误 SVG
    const errorSvgs = document.querySelectorAll('body > div[id^="d"]');
    errorSvgs.forEach(errorDiv => {
        // 检查是否包含 mermaid 错误特征
        const svg = errorDiv.querySelector('svg[role="graphics-document document"][aria-roledescription="error"]');
        if (svg) {
            errorDiv.remove();
        }
    });
};

// 渲染 Mermaid 图表
const renderMermaidDiagrams = async () => {
    if (!contentRef.value) return;

    await nextTick();

    const codeBlocks = contentRef.value.querySelectorAll('pre code');

    for (const block of codeBlocks) {
        const code = block.textContent;
        const parent = block.parentElement;

        // 检查是否为 Mermaid 代码（通过常见关键字判断）
        const isMermaid = /^\s*(graph|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|gitGraph|flowchart|mindmap|timeline|quadrantChart|requirementDiagram|C4Context)/i.test(code);

        if (isMermaid && props.diagramEnabled) {
            // 如果已经渲染过,跳过
            if (parent.dataset.mermaidRendered === 'true') continue;

            try {
                mermaidCounter.value++;
                const id = `mermaid-${props.messageIndex}-${mermaidCounter.value}`;

                // 创建容器
                const container = document.createElement('div');
                container.className = 'mermaid-diagram bg-white dark:bg-gray-900 p-4 rounded-xl overflow-auto relative cursor-context-menu';
                container.id = id;
                container.dataset.mermaidRendered = 'true';
                container.dataset.originalCode = code; // 保存原始代码

                // 渲染图表
                const { svg } = await mermaid.render(id, code);
                container.innerHTML = svg;

                // 添加右键菜单事件监听器
                container.addEventListener('contextmenu', handleDiagramContextMenu);

                // 替换原来的代码块
                parent.replaceWith(container);

                // 清理可能插入的错误元素
                cleanMermaidErrors();
            } catch (error) {
                console.error('Mermaid rendering error:', error);

                // 清理 mermaid 在 body 中插入的错误提示
                cleanMermaidErrors();

                // HTML 转义函数
                const escapeHtml = (text) => {
                    const div = document.createElement('div');
                    div.textContent = text;
                    return div.innerHTML;
                };

                // 创建错误提示容器
                const errorContainer = document.createElement('div');
                errorContainer.className = 'mermaid-error bg-red-50 dark:bg-red-950/30 border-2 border-red-200 dark:border-red-800 p-4 rounded-xl my-2';
                errorContainer.dataset.mermaidRendered = 'true';

                // 错误信息
                const errorMessage = document.createElement('div');
                errorMessage.className = 'flex items-start gap-3 mb-3';
                errorMessage.innerHTML = `
                    <svg class="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <div class="flex-1">
                        <div class="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">Mermaid 图表渲染失败</div>
                        <div class="text-xs text-red-700 dark:text-red-400">${escapeHtml(error.message || '语法错误，请检查图表代码')}</div>
                    </div>
                `;
                errorContainer.appendChild(errorMessage);

                // 原始代码块（折叠显示）
                const codeBlock = document.createElement('details');
                codeBlock.className = 'mt-2';
                codeBlock.innerHTML = `
                    <summary class="text-xs text-red-600 dark:text-red-400 cursor-pointer hover:text-red-700 dark:hover:text-red-300 font-medium">查看原始代码</summary>
                    <pre class="mt-2 bg-gray-900 dark:bg-black text-gray-100 p-3 rounded-lg overflow-x-auto text-xs"><code>${escapeHtml(code)}</code></pre>
                `;
                errorContainer.appendChild(codeBlock);

                // 替换原来的代码块
                parent.replaceWith(errorContainer);
            }
        } else if (!isMermaid) {
            // 普通代码块 - 添加语法高亮和复制按钮
            if (parent.dataset.highlighted === 'true') continue;

            try {
                // 应用语法高亮
                hljs.highlightElement(block);

                // 创建复制按钮容器
                const copyButtonContainer = document.createElement('div');
                copyButtonContainer.className = 'code-block-header';

                // 检测语言
                const language = block.className.match(/language-(\w+)/)?.[1] || 'code';

                copyButtonContainer.innerHTML = `
                    <div class="flex items-center gap-1.5">
                        <div class="w-3 h-3 rounded-full bg-red-500"></div>
                        <div class="w-3 h-3 rounded-full bg-yellow-500"></div>
                        <div class="w-3 h-3 rounded-full bg-green-500"></div>
                    </div>
                    <span class="code-language">${language}</span>
                    <button class="copy-code-btn" title="复制代码">
                        <svg class="copy-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        <svg class="check-icon hidden" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                    </button>
                `;

                // 将复制按钮插入到 pre 元素之前
                parent.insertBefore(copyButtonContainer, parent.firstChild);

                // 为复制按钮添加点击事件
                const copyBtn = copyButtonContainer.querySelector('.copy-code-btn');
                copyBtn.addEventListener('click', () => {
                    const codeText = block.textContent;
                    navigator.clipboard.writeText(codeText).then(() => {
                        const copyIcon = copyBtn.querySelector('.copy-icon');
                        const checkIcon = copyBtn.querySelector('.check-icon');
                        copyIcon.classList.add('hidden');
                        checkIcon.classList.remove('hidden');
                        setTimeout(() => {
                            copyIcon.classList.remove('hidden');
                            checkIcon.classList.add('hidden');
                        }, 2000);
                    });
                });

                parent.dataset.highlighted = 'true';
            } catch (error) {
                console.error('代码高亮失败:', error);
            }
        }
    }

    // 如果图表渲染被关闭,检查是否需要恢复代码块
    if (!props.diagramEnabled) {
        const diagrams = contentRef.value.querySelectorAll('.mermaid-diagram');
        diagrams.forEach(diagram => {
            // 移除右键菜单监听器
            diagram.removeEventListener('contextmenu', handleDiagramContextMenu);

            const originalCode = diagram.dataset.originalCode;
            if (originalCode) {
                // 恢复为原始代码块
                const pre = document.createElement('pre');
                const code = document.createElement('code');
                code.textContent = originalCode;
                pre.appendChild(code);
                diagram.replaceWith(pre);
            }
        });
    }
};

// 处理图表右键菜单
const handleDiagramContextMenu = (event) => {
    event.preventDefault();
    const svgElement = event.currentTarget.querySelector('svg');
    if (svgElement) {
        contextMenu.value = {
            visible: true,
            x: event.clientX,
            y: event.clientY,
            targetSvg: svgElement
        };
    }
};

// 关闭右键菜单
const closeContextMenu = () => {
    contextMenu.value.visible = false;
};

// 将 SVG 转换为 Blob
const svgToBlob = async (svgElement) => {
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    // 获取 SVG 的尺寸
    const svgRect = svgElement.getBoundingClientRect();
    canvas.width = svgRect.width * 2; // 2x 分辨率
    canvas.height = svgRect.height * 2;

    // 设置白色背景
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    return new Promise((resolve, reject) => {
        img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/png');
        };
        img.onerror = reject;
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    });
};

// 保存图表为图片
const saveDiagramAsImage = async () => {
    if (!contextMenu.value.targetSvg) return;

    try {
        const blob = await svgToBlob(contextMenu.value.targetSvg);
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `diagram-${Date.now()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        closeContextMenu();
    } catch (error) {
        console.error('保存图表失败:', error);
        alert('保存图表失败: ' + error.message);
    }
};

// 复制图表到剪贴板
const copyDiagramToClipboard = async () => {
    if (!contextMenu.value.targetSvg) return;

    try {
        const blob = await svgToBlob(contextMenu.value.targetSvg);
        await navigator.clipboard.write([
            new ClipboardItem({
                'image/png': blob
            })
        ]);
        console.log('图表已复制到剪贴板');
        closeContextMenu();
    } catch (error) {
        console.error('复制图表失败:', error);
        alert('复制图表失败: ' + error.message);
    }
};

// 监听 diagramEnabled 变化,强制重新渲染整个内容
watch(() => props.diagramEnabled, async () => {
    // 重新渲染内容
    await nextTick();
    await nextTick(); // 等待 DOM 更新
    renderMermaidDiagrams();
}, { immediate: false });

// 监听 message 的变化
watch([() => props.message.content, () => props.message.streaming], async () => {
    if (!props.message.streaming) {
        await nextTick();
        renderMermaidDiagrams();
    }
}, { immediate: false });

// MutationObserver 用于监听并清理 Mermaid 错误元素
let errorObserver = null;

// 首次渲染
onMounted(() => {
    renderMermaidDiagrams();
    // 添加全局点击事件监听器,关闭右键菜单
    document.addEventListener('click', closeContextMenu);

    // 创建 MutationObserver 监听 body 的子元素变化
    errorObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                // 检查是否是 mermaid 错误元素
                if (node.nodeType === 1 && node.id && node.id.startsWith('d')) {
                    const svg = node.querySelector('svg[role="graphics-document document"][aria-roledescription="error"]');
                    if (svg) {
                        console.log('检测到 Mermaid 错误元素，自动清理');
                        node.remove();
                    }
                }
            });
        });
    });

    // 开始监听 body 的子元素变化
    errorObserver.observe(document.body, {
        childList: true,
        subtree: false
    });
});

// 组件卸载时移除监听器
onUnmounted(() => {
    document.removeEventListener('click', closeContextMenu);
    // 停止监听并清理
    if (errorObserver) {
        errorObserver.disconnect();
        errorObserver = null;
    }
    // 清理 loading 文本切换定时器
    if (loadingTextInterval) {
        clearInterval(loadingTextInterval);
        loadingTextInterval = null;
    }
});

const isUser = computed(() => props.message.role === 'user');
const copied = ref(false);
const previewImage = ref(null);

// 判断是否只有图片没有文本内容
const hasOnlyImages = computed(() => {
    return allImages.value.length > 0 && !cleanedContent.value.trim();
});

// 判断是否正在等待回复（消息为空且正在streaming）
const isWaitingResponse = computed(() => {
    return !isUser.value && props.message.streaming && !cleanedContent.value.trim() && allImages.value.length === 0;
});

// Loading 文本数组
const loadingTexts = [
    '思考中',
    '正在分析',
    '处理中',
    '理解中',
    '组织语言',
    '准备回复'
];

// 随机选择一个 loading 文本
const currentLoadingText = ref(loadingTexts[Math.floor(Math.random() * loadingTexts.length)]);

// 定时切换 loading 文本
let loadingTextInterval = null;

// 监听 isWaitingResponse 状态，启动/停止 loading 文本切换
watch(isWaitingResponse, (waiting) => {
    if (waiting) {
        // 开始切换 loading 文本
        loadingTextInterval = setInterval(() => {
            const currentIndex = loadingTexts.indexOf(currentLoadingText.value);
            const nextIndex = (currentIndex + 1) % loadingTexts.length;
            currentLoadingText.value = loadingTexts[nextIndex];
        }, 2000); // 每2秒切换一次
    } else {
        // 停止切换
        if (loadingTextInterval) {
            clearInterval(loadingTextInterval);
            loadingTextInterval = null;
        }
    }
});

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

    // 添加 ESC 键监听
    document.addEventListener('keydown', handleEscKey);
};

const closeImagePreview = () => {
    console.log('closeImagePreview called');
    previewImage.value = null;

    // 移除 ESC 键监听
    document.removeEventListener('keydown', handleEscKey);
};

const handleEscKey = (event) => {
    if (event.key === 'Escape') {
        closeImagePreview();
    }
};

// 重新发送
const handleResend = () => {
    emit('resend', props.messageIndex);
};

// 重新编辑
const handleEdit = () => {
    emit('edit', props.messageIndex);
};
const handleMessageClick = (event) => {
    // 仅在选择模式下生效，且点击的不是复选框本身（避免双重触发）
    // 也不阻止用户点击代码块里的复制按钮
    if (props.isSelectionMode &&
        event.target.tagName.toLowerCase() !== 'input' &&
        !event.target.closest('button')) {
        emit('toggleSelection', props.messageIndex);
    }
};
</script>

<template>
    <div class="py-3 w-full flex justify-center transition-all duration-200">
        <div
            @click="handleMessageClick"
            :class="[
                'max-w-4xl w-full flex gap-4 px-6 md:px-5 group rounded-xl py-3 transition-colors duration-200 border-2',
                isUser ? 'bg-chatgpt-user dark:bg-chatgpt-dark-user' : 'bg-chatgpt-assistant dark:bg-chatgpt-dark-assistant',
                !isSelectionMode ? 'border-transparent' : '',
                isSelectionMode ? 'cursor-pointer' : '',
                isSelectionMode && !isSelected ? 'border-transparent hover:border-dashed hover:border-gray-400 dark:hover:border-gray-500' : '',
                isSelectionMode && isSelected ? 'border-dashed border-blue-500 dark:border-blue-400 bg-blue-50/10 dark:bg-blue-900/10' : ''
            ]"
        >
            <!-- 选择模式下的复选框 -->
            <div v-if="isSelectionMode" class="flex items-start pt-3">
                <input
                    type="checkbox"
                    :checked="isSelected"
                    @change="$emit('toggleSelection', messageIndex)"
                    class="w-5 h-5 cursor-pointer accent-chatgpt-accent dark:accent-chatgpt-dark-accent rounded"
                />
            </div>

            <!-- Avatar -->
            <div
                :class="[
                    'w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm',
                    isUser ? 'bg-gradient-to-br from-blue-500 to-purple-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600'
                ]"
            >
                <User v-if="isUser" :size="18" class="text-white" />
                <Bot v-else :size="18" class="text-white" />
            </div>

            <!-- Content Container -->
            <div class="flex flex-col gap-2 min-w-0 flex-1 relative">
                <!-- User Label -->
                <!-- User Label -->
                <div class="flex flex-col gap-1 mb-1">
                    <!-- 第一行：名称和模型ID标签 -->
                    <!-- 第一行：名称和模型ID标签 -->
                    <div class="flex items-center gap-2">
                        <span class="text-sm font-bold text-chatgpt-text dark:text-chatgpt-dark-text">
                            {{ isUser ? '你' : (message.modelName || modelName || 'AI') }}
                        </span>
                        <!-- 模型ID标签（仅AI消息） -->
                        <span v-if="!isUser && message.modelId" class="inline-flex items-center px-1.5 py-0.5 text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded font-mono border border-blue-200 dark:border-blue-800">
                            {{ message.modelId }}
                        </span>
                    </div>
                    <!-- 第二行：时间 -->
                    <span class="text-[10px] text-chatgpt-subtext dark:text-chatgpt-dark-subtext" v-if="message.timestamp">
                        {{ new Date(message.timestamp).toLocaleTimeString() }}
                    </span>
                </div>

                <!-- Images -->
                <div v-if="allImages.length > 0" class="flex flex-wrap gap-2 mb-1.5">
                    <div
                        v-for="(img, idx) in allImages"
                        :key="idx"
                        class="relative rounded-xl border border-chatgpt-border dark:border-chatgpt-dark-border shadow-sm dark:shadow-dark-card hover:shadow-md dark:hover:shadow-dark-elevated transition-all cursor-pointer group/img"
                        @click="openImagePreview(img)"
                    >
                        <img
                            :src="img"
                            :class="[
                                'block object-contain bg-gray-50 dark:bg-gray-800 rounded-xl',
                                isUser ? 'max-w-[200px] max-h-[200px]' : 'max-w-[320px] max-h-[320px]'
                            ]"
                            alt="Message image"
                            @click="openImagePreview(img)"
                        />
                        <div class="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors flex items-center justify-center pointer-events-none rounded-xl">
                            <span class="text-white text-xs opacity-0 group-hover/img:opacity-100 bg-black/50 px-2 py-1 rounded whitespace-nowrap">点击查看大图</span>
                        </div>
                    </div>
                </div>

                <!-- Loading Effect (when waiting for response) -->
                <div v-if="isWaitingResponse" class="flex items-center gap-2 text-chatgpt-subtext dark:text-chatgpt-dark-subtext">
                    <div class="flex gap-1">
                        <div class="w-2 h-2 bg-chatgpt-accent dark:bg-chatgpt-dark-accent rounded-full animate-bounce" style="animation-delay: 0ms"></div>
                        <div class="w-2 h-2 bg-chatgpt-accent dark:bg-chatgpt-dark-accent rounded-full animate-bounce" style="animation-delay: 150ms"></div>
                        <div class="w-2 h-2 bg-chatgpt-accent dark:bg-chatgpt-dark-accent rounded-full animate-bounce" style="animation-delay: 300ms"></div>
                    </div>
                    <Transition name="fade-text" mode="out-in">
                        <span :key="currentLoadingText" class="text-sm italic">{{ currentLoadingText }}...</span>
                    </Transition>
                </div>

                <!-- Text Content -->
                <div v-else ref="contentRef"
                    :class="[
                        'prose prose-slate dark:prose-invert max-w-none break-words text-sm leading-[1.6] text-chatgpt-text dark:text-chatgpt-dark-text',
                        !isUser && message.streaming ? 'is-streaming' : ''
                    ]"
                    v-html="renderedContent"
                ></div>

                <!-- Streaming Cursor is now handled by CSS ::after on .is-streaming elements -->

                <!-- Actions for AI messages (visible on hover) -->
                <div v-if="!isUser && !message.streaming && message.content && !isSelectionMode" class="flex items-center gap-0.5 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        @click="copyToClipboard"
                        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md text-chatgpt-subtext hover:text-chatgpt-text transition-colors flex items-center gap-1"
                        :title="copied ? '已复制' : '复制'">
                        <Check v-if="copied" :size="13" class="text-green-600" />
                        <Copy v-else :size="13" />
                    </button>
                    <button class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md text-chatgpt-subtext hover:text-chatgpt-text transition-colors">
                        <ThumbsUp :size="13" />
                    </button>
                    <button class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md text-chatgpt-subtext hover:text-chatgpt-text transition-colors">
                        <ThumbsDown :size="13" />
                    </button>
                </div>

                <!-- Actions for User messages (visible on hover) -->
                <div v-if="isUser && !isStreaming && !isSelectionMode" class="flex items-center gap-0.5 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                        @click="handleEdit"
                        class="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-md text-chatgpt-subtext hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1 text-xs"
                        title="重新编辑这条消息">
                        <Edit3 :size="13" />
                        <span class="text-xs">编辑</span>
                    </button>
                    <button
                        @click="handleResend"
                        class="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded-md text-chatgpt-subtext hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors flex items-center gap-1 text-xs"
                        title="重新发送这条消息">
                        <RefreshCw :size="13" />
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

        <!-- Diagram Context Menu -->
        <Transition name="fade">
            <div
                v-if="contextMenu.visible"
                :style="{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }"
                class="fixed z-[10000] bg-white dark:bg-chatgpt-dark-sidebar border-2 border-gray-200 dark:border-chatgpt-dark-border rounded-xl shadow-2xl dark:shadow-dark-elevated overflow-hidden min-w-[180px]"
                @click.stop
            >
                <button
                    @click="copyDiagramToClipboard"
                    class="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-chatgpt-dark-user transition-colors text-left text-sm text-chatgpt-text dark:text-chatgpt-dark-text border-b border-gray-100 dark:border-chatgpt-dark-border"
                >
                    <Copy :size="16" class="text-chatgpt-accent dark:text-chatgpt-dark-accent" />
                    <span>复制图表</span>
                </button>
                <button
                    @click="saveDiagramAsImage"
                    class="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 dark:hover:bg-chatgpt-dark-user transition-colors text-left text-sm text-chatgpt-text dark:text-chatgpt-dark-text"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-chatgpt-accent dark:text-chatgpt-dark-accent">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    <span>保存为图片</span>
                </button>
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

/* Dark mode prose colors */
.dark .prose {
    --tw-prose-body: #ECECF1;
    --tw-prose-headings: #ECECF1;
    --tw-prose-bold: #ECECF1;
}

.prose pre {
    @apply bg-gray-900 dark:bg-black text-gray-100 dark:text-gray-200 rounded-xl overflow-hidden my-4 shadow-md dark:shadow-dark-card relative;
    padding: 0 !important;
}

.prose pre .code-block-header {
    @apply flex items-center justify-between px-4 py-2 bg-gray-800 dark:bg-gray-900 border-b border-gray-700 dark:border-gray-800 gap-2;
}

.prose pre .code-language {
    @apply text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide flex-1;
}

.prose pre .copy-code-btn {
    @apply p-1 rounded-md hover:bg-gray-700 dark:hover:bg-gray-800 transition-colors text-gray-400 hover:text-gray-200 flex items-center justify-center shrink-0;
    width: 24px;
    height: 24px;
}

.prose pre code {
    @apply bg-transparent p-4 text-inherit text-sm font-normal block overflow-x-auto;
    display: block !important;
}

.prose pre .copy-code-btn svg {
    @apply w-3.5 h-3.5;
}

.prose pre .copy-code-btn .check-icon {
    @apply text-green-400;
}

.prose code {
    @apply bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded font-mono text-[13px] text-pink-600 dark:text-pink-400 font-medium;
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

.markdown-body blockquote {
    @apply border-l-4 border-emerald-500 pl-4 py-1 my-2 bg-transparent text-gray-500 dark:text-gray-400 not-italic flex items-center;
}

.markdown-body blockquote p {
    @apply m-0;
}

.prose a {
    @apply text-chatgpt-accent dark:text-chatgpt-dark-accent hover:underline font-medium transition-colors;
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

/* Loading dots animation */
@keyframes loading-bounce {
    0%, 80%, 100% {
        transform: translateY(0);
        opacity: 0.4;
    }
    40% {
        transform: translateY(-8px);
        opacity: 1;
    }
}

.animate-bounce {
    animation: loading-bounce 1.4s infinite ease-in-out;
}

/* Loading text fade transition */
.fade-text-enter-active,
.fade-text-leave-active {
    transition: opacity 0.3s ease;
}

.fade-text-enter-from,
.fade-text-leave-to {
    opacity: 0;
}

/* Streaming Cursor Effect */
.is-streaming > p:last-child::after,
.is-streaming > li:last-child::after,
.is-streaming > pre:last-child code::after,
.is-streaming > blockquote:last-child p:last-child::after,
.is-streaming > h1:last-child::after,
.is-streaming > h2:last-child::after,
.is-streaming > h3:last-child::after,
.is-streaming > h4:last-child::after,
.is-streaming > h5:last-child::after,
.is-streaming > h6:last-child::after {
    content: '';
    display: inline-block;
    width: 0.45rem;
    height: 1rem;
    background-color: var(--chatgpt-accent, #10a37f);
    margin-left: 0.25rem;
    vertical-align: middle;
    animation: cursor-blink 0.8s step-end infinite;
    border-radius: 1px;
    box-shadow: 0 0 4px rgba(16, 163, 127, 0.4);
}

@keyframes cursor-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
}

.dark .is-streaming > p:last-child::after,
.dark .is-streaming > li:last-child::after,
.dark .is-streaming > pre:last-child code::after,
.dark .is-streaming > blockquote:last-child p:last-child::after,
.dark .is-streaming > h1:last-child::after,
.dark .is-streaming > h2:last-child::after,
.dark .is-streaming > h3:last-child::after,
.dark .is-streaming > h4:last-child::after,
.dark .is-streaming > h5:last-child::after,
.dark .is-streaming > h6:last-child::after {
    background-color: var(--chatgpt-dark-accent, #10a37f);
    box-shadow: 0 0 8px rgba(16, 163, 127, 0.6);
}
</style>
