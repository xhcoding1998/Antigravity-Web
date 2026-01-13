<script setup>
import { ref, watch, nextTick } from 'vue';
import { X, Copy, Check, Share2, Wand2, Loader2 } from 'lucide-vue-next';
import { downloadDOMAsImage } from '../utils/exportUtils';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';

const props = defineProps({
    show: Boolean,
    content: String,
    isLoading: Boolean
});

const emit = defineEmits(['close']);

const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    highlight: function (str, lang) {
        // 检查语言是否支持
        if (lang && hljs.getLanguage(lang)) {
            try {
                return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
            } catch (__) {}
        }
        // 不支持的语言，返回转义后的纯文本
        return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
    }
});

const isCopied = ref(false);
const cardRef = ref(null);
const contentAreaRef = ref(null);

// 渲染 Markdown 并自动滚动到底部
const renderedContent = ref('');
watch(() => props.content, (newVal) => {
    renderedContent.value = md.render(newVal || '');
    // 自动滚动到底部
    nextTick(() => {
        if (contentAreaRef.value) {
            contentAreaRef.value.scrollTop = contentAreaRef.value.scrollHeight;
        }
    });
});

// 复制为图片到剪贴板（使用克隆元素，避免闪烁）
const handleShare = async () => {
    if (!cardRef.value) return;

    try {
        const html2canvas = (await import('html2canvas')).default;

        // 克隆卡片元素
        const clonedCard = cardRef.value.cloneNode(true);

        // 设置克隆元素的样式
        clonedCard.style.position = 'absolute';
        clonedCard.style.left = '-9999px';
        clonedCard.style.top = '0';
        clonedCard.style.width = cardRef.value.offsetWidth + 'px';

        // 移除关闭按钮
        const closeBtn = clonedCard.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.remove();
        }

        // 移除内容区的高度限制
        const cardBody = clonedCard.querySelector('.card-body');
        if (cardBody) {
            cardBody.style.maxHeight = 'none';
            cardBody.style.overflow = 'visible';
        }

        // 让代码块换行显示而不是滚动（使用 cssText 强制覆盖）
        const codeBlocks = clonedCard.querySelectorAll('pre, pre.hljs, pre code, .hljs');
        codeBlocks.forEach(block => {
            block.style.cssText += `
                white-space: pre-wrap !important;
                word-wrap: break-word !important;
                word-break: break-all !important;
                overflow-x: visible !important;
                overflow: visible !important;
                max-width: 100% !important;
            `;
        });

        // 修复行内代码样式（避免 html2canvas 渲染偏移）
        const inlineCodes = clonedCard.querySelectorAll('code:not(pre code)');
        inlineCodes.forEach(code => {
            code.style.cssText += `
                display: inline !important;
                vertical-align: baseline !important;
                line-height: inherit !important;
                padding: 2px 6px !important;
                margin: 0 !important;
                position: relative !important;
                top: 0 !important;
            `;
        });

        // 将克隆元素添加到 body
        document.body.appendChild(clonedCard);

        // 等待 DOM 渲染
        await new Promise(resolve => setTimeout(resolve, 100));

        const canvas = await html2canvas(clonedCard, {
            scale: 2,
            backgroundColor: '#ffffff',
            useCORS: true,
            logging: false
        });

        // 移除克隆元素
        document.body.removeChild(clonedCard);

        canvas.toBlob(async (blob) => {
            if (!blob) return;
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]);
                isCopied.value = true;
                setTimeout(() => {
                    isCopied.value = false;
                }, 2000);
            } catch (err) {
                console.error('Clipboard write failed:', err);
                alert('复制失败，请重试');
            }
        });

    } catch (e) {
        console.error('Share failed:', e);
    }
};

</script>

<template>
<Teleport to="body">
    <Transition name="modal">
        <div v-if="show" class="modal-overlay">
            <div class="modal-wrapper" @click.stop>

                <!-- 总结卡片主体 -->
                <div
                    ref="cardRef"
                    class="summary-card"
                >
                    <!-- 右上角关闭按钮 (在卡片内部) -->
                    <button
                        @click="$emit('close')"
                        class="close-btn"
                        aria-label="关闭"
                    >
                        <X :size="20" />
                    </button>

                    <!-- 卡片头部 (macOS 风格) -->
                    <div class="card-header">
                        <div class="window-controls">
                            <div class="dot red"></div>
                            <div class="dot yellow"></div>
                            <div class="dot green"></div>
                        </div>
                        <div class="card-title">
                            <Wand2 :size="14" class="icon-wand" />
                            <span>对话智能总结</span>
                        </div>
                    </div>

                    <!-- 主要内容区域 -->
                    <div ref="contentAreaRef" class="card-body">
                        <div v-if="!content && isLoading" class="loading-state">
                            <Loader2 :size="24" class="animate-spin text-gray-400" />
                            <span>正在生成总结...</span>
                        </div>

                        <div
                            v-else
                            class="markdown-body custom-scrollbar"
                            v-html="renderedContent"
                        ></div>

                        <!-- 打字机光标 -->
                        <span v-if="isLoading && content" class="typing-cursor"></span>
                    </div>

                    <!-- 底部署名/时间 -->
                    <div class="card-footer">
                        <span>Generated by Antigravity AI</span>
                        <span>{{ new Date().toLocaleDateString() }}</span>
                    </div>
                </div>

                <!-- 底部操作栏 - 只保留复制分享按钮 -->
                <div class="action-bar">
                    <button class="action-btn primary" @click="handleShare" :disabled="isLoading && !content">
                        <component :is="isCopied ? Check : Share2" :size="18" />
                        {{ isCopied ? '已复制到剪贴板' : '复制分享卡片' }}
                    </button>
                </div>

            </div>
        </div>
    </Transition>
</Teleport>
</template>

<style scoped>
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
}

/* 右上角关闭按钮 - 相对于卡片定位 */
.close-btn {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.05);
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: #888;
    transition: all 0.2s;
    z-index: 10;
}
.close-btn:hover {
    background: rgba(0, 0, 0, 0.1);
    color: #333;
    transform: scale(1.1);
}
.dark .close-btn {
    background: rgba(255, 255, 255, 0.1);
    color: #888;
}
.dark .close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    color: white;
}

.modal-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
    max-width: 100%;
}

/* 卡片样式 - 也是截图的目标 */
.summary-card {
    position: relative;
    width: 600px;
    max-width: 90vw;
    background: white; /* 浅色模式背景 */
    border-radius: 16px;
    box-shadow: 0 0 0 1px rgba(0,0,0,0.02), 0 30px 80px rgba(0,0,0,0.15), 0 10px 30px rgba(0,0,0,0.05);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    border: 1px solid rgba(0,0,0,0.05);
}

.dark .summary-card {
    background: #1e1e20; /* 深色模式背景 */
    border-color: rgba(255,255,255,0.1);
}

/* 头部 */
.card-header {
    height: 44px;
    background: #f5f5f7;
    border-bottom: 1px solid rgba(0,0,0,0.05);
    display: flex;
    align-items: center;
    justify-content: flex-start; /* 左对齐 */
    padding: 0 16px;
    position: relative; /* 绝对定位锚点 */
}
.dark .card-header {
    background: #2a2a2c;
    border-color: rgba(255,255,255,0.05);
}

.window-controls {
    display: flex;
    gap: 8px;
    z-index: 10;
}
.dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
}
.red { background: #ff5f56; border: 0.5px solid rgba(0,0,0,0.1); }
.yellow { background: #ffbd2e; border: 0.5px solid rgba(0,0,0,0.1); }
.green { background: #27c93f; border: 0.5px solid rgba(0,0,0,0.1); }

.card-title {
    font-size: 13px;
    font-weight: 600;
    color: #666;
    display: flex;
    align-items: center;
    gap: 6px;

    /* 绝对居中 */
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    width: max-content;
}
.dark .card-title {
    color: #aaa;
}
.icon-wand {
    color: #3B82F6;
}

/* 内容区 */
.card-body {
    padding: 30px;
    min-height: 200px; /* 最小高度 */
    max-height: 60vh; /* 最大高度，防止爆屏 */
    overflow-y: auto; /* 允许内部滚动，但截图时html2canvas能否处理？ */
    /* 注意：如果内容很长，html2canvas默认只能截可视区域。我们需要像exportUtils处理Preview一样处理这里吗？
       用户说是“卡片”，通常不会特别长。如果特别长，最好让它自适应高度。
       这里我们设置 max-height 只是为了显示，截图时可能需要 trick。
       不过 exportUtils 的 renderElementToCanvas 已经解决了这个问题。
       但这里 handleShare 是简单的 html2canvas。
       为了简单，可以移除 max-height 让卡片撑开？不行，会撑破屏幕。
       折中方案：显示时 scroll，截图时暂时 clone dom 并展开。
       或者，既然是“总结”，通常不会太长。我们让它 height: auto 但限制 max-height。
    */
    position: relative;
    font-size: 15px;
    line-height: 1.6;
    color: #333;
    scroll-behavior: smooth;
}
.dark .card-body {
    color: #ddd;
}

/* Loading */
.loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    height: 100%;
    min-height: 150px;
    color: #999;
    font-size: 14px;
}

/* Footer */
.card-footer {
    padding: 12px 20px;
    background: #fafafa;
    border-top: 1px solid rgba(0,0,0,0.03);
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: #bbb;
}
.dark .card-footer {
    background: #252527;
    border-color: rgba(255,255,255,0.03);
    color: #666;
}

/* Action Bar */
.action-bar {
    display: flex;
    justify-content: center;
    gap: 12px;
}

.action-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 20px;
    border-radius: 100px;
    border: none;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.action-btn.secondary {
    background: white;
    color: #666;
}
.dark .action-btn.secondary {
    background: #2a2a2c;
    color: #ccc;
}
.action-btn.secondary:hover {
    background: #f5f5f5;
    transform: translateY(-2px);
}

.action-btn.primary {
    background: #3B82F6;
    color: white;
}
.action-btn.primary:hover {
    background: #2563EB;
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(59, 130, 246, 0.3);
}
.action-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
}

/* Markdown Styles */
.markdown-body :deep(p) { margin-bottom: 1em; }
.markdown-body :deep(h1), .markdown-body :deep(h2), .markdown-body :deep(h3) { margin-top: 1em; margin-bottom: 0.5em; font-weight: 600; }
.markdown-body :deep(h2) { font-size: 1.25em; color: #3B82F6; }
.markdown-body :deep(h3) { font-size: 1.1em; color: #6B7280; }
.markdown-body :deep(ul), .markdown-body :deep(ol) { padding-left: 20px; margin-bottom: 1em; }
.markdown-body :deep(ul) { list-style-type: disc; }
.markdown-body :deep(ol) { list-style-type: decimal; }
.markdown-body :deep(li) { margin-bottom: 0.4em; }
.markdown-body :deep(strong) { font-weight: 700; color: #3B82F6; }

/* 代码块样式 */
.markdown-body :deep(pre.hljs) {
    background: #1e1e1e;
    border-radius: 8px;
    padding: 16px;
    margin: 12px 0;
    overflow-x: auto;
    font-size: 13px;
    line-height: 1.5;
}
.markdown-body :deep(pre.hljs code) {
    color: #d4d4d4;
    font-family: 'Fira Code', 'Consolas', 'Monaco', monospace;
}
.markdown-body :deep(code:not(pre code)) {
    background: rgba(59, 130, 246, 0.1);
    color: #3B82F6;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.9em;
}
.dark .markdown-body :deep(code:not(pre code)) {
    background: rgba(96, 165, 250, 0.15);
    color: #60A5FA;
}

.typing-cursor::after {
    content: '▋';
    display: inline-block;
    color: #3B82F6;
    animation: blink 1s step-start infinite;
    margin-left: 4px;
}

@keyframes blink {
    50% { opacity: 0; }
}

/* 模态框动画 */
.modal-enter-active,
.modal-leave-active {
    transition: opacity 0.3s ease;
}
.modal-enter-from,
.modal-leave-to {
    opacity: 0;
}

.modal-enter-active .modal-wrapper {
    animation: pop-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.modal-leave-active .modal-wrapper {
    animation: pop-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) reverse;
}

@keyframes pop-in {
    from { opacity: 0; transform: scale(0.95) translateY(10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
}
</style>
