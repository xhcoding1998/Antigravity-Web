<script setup>
import { computed, ref, onMounted, nextTick, watch, onUnmounted } from 'vue';
import MarkdownIt from 'markdown-it';
import mermaid from 'mermaid';
import hljs from 'highlight.js';
import { User, Bot, Copy, ThumbsUp, ThumbsDown, Check, X, RefreshCw, Edit3, ChevronDown, ChevronUp, FileText, Download } from 'lucide-vue-next';
import html2canvas from 'html2canvas';

const props = defineProps({
    message: Object,
    modelName: String,
    messageIndex: Number,
    isStreaming: Boolean,
    diagramEnabled: Boolean,
    codeTheme: String,
    isSelectionMode: Boolean,
    isSelected: Boolean,
    apiConfig: Object,
    selectedModelId: String,
    currentAdapter: Object
});

const emit = defineEmits(['resend', 'edit', 'toggleSelection']);

const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    highlight: function (str, lang) {
        // 检查语言是否被 hljs 支持
        if (lang && hljs.getLanguage(lang)) {
            try {
                return `<pre><code class="hljs language-${lang}">${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
            } catch (e) {
                // 高亮失败，回退到纯文本
            }
        }
        // 语言不支持或高亮失败，返回转义后的纯文本
        return `<pre><code class="hljs">${md.utils.escapeHtml(str)}</code></pre>`;
    }
});

// 自定义链接渲染规则，使所有链接在新标签页中打开
const defaultRender = md.renderer.rules.link_open || function(tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
};

md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
    // 添加 target="_blank"
    const aIndex = tokens[idx].attrIndex('target');
    if (aIndex < 0) {
        tokens[idx].attrPush(['target', '_blank']);
    } else {
        tokens[idx].attrs[aIndex][1] = '_blank';
    }

    // 添加 rel="noopener noreferrer" 以提高安全性
    const relIndex = tokens[idx].attrIndex('rel');
    if (relIndex < 0) {
        tokens[idx].attrPush(['rel', 'noopener noreferrer']);
    } else {
        tokens[idx].attrs[relIndex][1] = 'noopener noreferrer';
    }

    return defaultRender(tokens, idx, options, env, self);
};

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

// 提取附件内容
const attachments = computed(() => {
    const content = props.message.content || '';
    const attachmentRegex = /<!--ATTACHMENT_START-->\n<!--ATTACHMENT_META:({.*?})-->\n([\s\S]*?)<!--ATTACHMENT_END-->/g;
    const results = [];
    let match;

    while ((match = attachmentRegex.exec(content)) !== null) {
        try {
            const meta = JSON.parse(match[1]);
            const attachmentContent = match[2].trim();
            results.push({
                ...meta,
                content: attachmentContent,
                expanded: false
            });
        } catch (e) {
            console.error('解析附件元数据失败:', e);
        }
    }

    return results;
});

// 附件展开状态
const attachmentExpandState = ref({});

const toggleAttachment = (index) => {
    attachmentExpandState.value[index] = !attachmentExpandState.value[index];
};

const isAttachmentExpanded = (index) => {
    return !!attachmentExpandState.value[index];
};

// 获取附件类型描述
const getAttachmentTypeDesc = (attachment) => {
    if (attachment.type === 'pdf') {
        return `PDF 文档, ${attachment.pages} 页`;
    } else if (attachment.type === 'pptx') {
        return `PPT 演示文稿, ${attachment.slides} 页`;
    } else if (attachment.type === 'docx') {
        return `Word 文档`;
    } else if (attachment.type === 'excel') {
        return `Excel 表格, ${attachment.sheets} 个工作表`;
    } else if (attachment.type === 'code') {
        return `${attachment.extension?.toUpperCase() || ''} 代码文件`;
    } else if (attachment.type === 'ocr') {
        return `OCR 识别结果, 置信度 ${attachment.confidence}%`;
    } else {
        return `文本文件`;
    }
};

// 获取附件预览内容（默认显示前200字符）
const getAttachmentPreview = (content, maxLength = 200) => {
    if (!content) return '';
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
};

// 从content中移除base64图片数据和附件标记，避免显示为文本
const cleanedContent = computed(() => {
    let content = props.message.content || '';

    // 移除附件标记内容
    content = content.replace(/<!--ATTACHMENT_START-->[\s\S]*?<!--ATTACHMENT_END-->/g, '');

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
            // 普通代码块 - 添加复制按钮（高亮已在 markdown-it 渲染时完成）
            if (parent.dataset.highlighted === 'true') continue;

            try {
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
                // 静默处理错误，不打印到控制台
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

    // 渲染表格增强功能
    renderTables();
};

// 渲染表格增强功能（调整宽度、导出图片）
const renderTables = async () => {
    if (!contentRef.value) return;

    await nextTick();

    const tables = contentRef.value.querySelectorAll('table');

    tables.forEach((table, index) => {
        // 如果已经处理过，跳过
        if (table.dataset.tableEnhanced === 'true') return;
        table.dataset.tableEnhanced = 'true';

        // 1. 包裹容器
        const wrapper = document.createElement('div');
        wrapper.className = 'table-wrapper group/table';

        // 2. 创建头部工具栏（导出按钮）
        const toolbar = document.createElement('div');
        toolbar.className = 'table-toolbar opacity-0 group-hover/table:opacity-100 transition-opacity';

        const exportBtn = document.createElement('button');
        exportBtn.className = 'table-export-btn';
        exportBtn.title = '导出为图片';
        exportBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>导出图片</span>
        `;

        exportBtn.addEventListener('click', async () => {
            try {
                // 暂时移除 toolbar 避免出现在截图中
                toolbar.style.display = 'none';

                // 为了导出美观，临时给 wrapper 增加 inner padding 和圆角背景
                // 模拟消息列表中的卡片效果
                const originalPadding = wrapper.style.padding;
                const originalBackground = wrapper.style.background;
                const originalBoxShadow = wrapper.style.boxShadow;

                wrapper.style.padding = '32px';
                wrapper.style.borderRadius = '24px';

                const isDark = document.documentElement.classList.contains('dark');
                // 使用 tailwind config 中的颜色: assistant 背景
                const bgColor = isDark ? '#3E3F4B' : '#F9FAFB';
                wrapper.style.background = bgColor;
                wrapper.style.boxShadow = isDark ? '0 20px 50px rgba(0,0,0,0.5)' : '0 20px 50px rgba(0,0,0,0.1)';

                const canvas = await html2canvas(wrapper, {
                    backgroundColor: bgColor,
                    scale: 3, // 提高清晰度 (3x)
                    logging: false,
                    useCORS: true,
                    borderRadius: 24,
                    onclone: (clonedDoc) => {
                        // 在克隆中隐藏工具栏（双重保险）
                        const clonedToolbar = clonedDoc.querySelector('.table-toolbar');
                        if (clonedToolbar) clonedToolbar.style.display = 'none';
                    }
                });

                // 恢复样式
                wrapper.style.padding = originalPadding;
                wrapper.style.background = originalBackground;
                wrapper.style.boxShadow = originalBoxShadow;
                toolbar.style.display = 'flex';

                const url = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                link.href = url;
                link.download = `table-${Date.now()}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch (err) {
                console.error('导出表格图片失败:', err);
                toolbar.style.display = 'flex';
            }
        });

        toolbar.appendChild(exportBtn);

        // 将表格包裹起来
        table.parentNode.insertBefore(wrapper, table);
        wrapper.appendChild(toolbar);
        wrapper.appendChild(table);

        // 3. 添加列宽调整逻辑
        const headers = table.querySelectorAll('th');
        headers.forEach((th) => {
            th.style.position = 'relative';

            const resizer = document.createElement('div');
            resizer.className = 'table-resizer';
            th.appendChild(resizer);

            let startX, startWidth;

            const onMouseMove = (e) => {
                const width = startWidth + (e.pageX - startX);
                th.style.width = `${width}px`;
                th.style.minWidth = `${width}px`;
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                resizer.classList.remove('resizing');
            };

            resizer.addEventListener('mousedown', (e) => {
                startX = e.pageX;
                startWidth = th.offsetWidth;
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
                resizer.classList.add('resizing');
                e.preventDefault();
            });
        });
    });
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
        renderTables();
        // 重新附加链接预览监听器
        await nextTick();
        removeLinkPreviewListeners();
        attachLinkPreviewListeners();
    }
}, { immediate: false });

// MutationObserver 用于监听并清理 Mermaid 错误元素
let errorObserver = null;

// 首次渲染
onMounted(() => {
    renderMermaidDiagrams();
    renderTables();
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

    // 添加链接预览监听器
    nextTick(() => {
        attachLinkPreviewListeners();
    });

    // 添加文本选择监听器（仅在非选择模式下）
    if (!props.isSelectionMode && contentRef.value) {
        contentRef.value.addEventListener('mouseup', handleTextSelection);
    }
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
    // 清理链接预览相关
    removeLinkPreviewListeners();
    if (previewShowTimeout) {
        clearTimeout(previewShowTimeout);
        previewShowTimeout = null;
    }
    if (previewHideTimeout) {
        clearTimeout(previewHideTimeout);
        previewHideTimeout = null;
    }
    if (iframeLoadTimeout) {
        clearTimeout(iframeLoadTimeout);
        iframeLoadTimeout = null;
    }
    // 清理术语解释相关
    if (contentRef.value) {
        contentRef.value.removeEventListener('mouseup', handleTextSelection);
    }
    if (selectionTimeout) {
        clearTimeout(selectionTimeout);
        selectionTimeout = null;
    }
    if (explanationAbortController) {
        explanationAbortController.abort();
        explanationAbortController = null;
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
    '已接收信息',
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

// 链接预览功能
const linkPreview = ref({
    visible: false,
    url: '',
    x: 0,
    y: 0,
    targetLink: null,
    loading: true
});

let previewShowTimeout = null;
let previewHideTimeout = null;
let iframeLoadTimeout = null; // iframe 加载超时定时器

// 显示链接预览
const showLinkPreview = (event) => {
    const link = event.target.closest('a');
    if (!link || !link.href) return;

    // 清除之前的隐藏定时器
    if (previewHideTimeout) {
        clearTimeout(previewHideTimeout);
        previewHideTimeout = null;
    }

    // 延迟显示预览（避免快速划过时频繁显示）
    previewShowTimeout = setTimeout(() => {
        const rect = link.getBoundingClientRect();
        const url = link.href;

        // 计算预览卡片位置（优先显示在链接右侧，如果空间不够则显示在左侧）
        const previewWidth = 400;
        const previewHeight = 300;
        const spacing = 12;

        let x = rect.right + spacing;
        let y = rect.top;

        // 如果右侧空间不够，显示在左侧
        if (x + previewWidth > window.innerWidth - 20) {
            x = rect.left - previewWidth - spacing;
        }

        // 如果左侧也不够，显示在链接下方
        if (x < 20) {
            x = rect.left;
            y = rect.bottom + spacing;
        }

        // 确保不超出视口底部
        if (y + previewHeight > window.innerHeight - 20) {
            y = window.innerHeight - previewHeight - 20;
        }

        // 确保不超出视口顶部
        if (y < 20) {
            y = 20;
        }

        linkPreview.value = {
            visible: true,
            url,
            x,
            y,
            targetLink: link,
            loading: true
        };

        // 清除之前的超时定时器
        if (iframeLoadTimeout) {
            clearTimeout(iframeLoadTimeout);
        }

        // 设置30秒超时
        iframeLoadTimeout = setTimeout(() => {
            if (linkPreview.value.loading) {
                linkPreview.value.loading = false;
                console.log('iframe 加载超时（30秒）');
            }
        }, 30000); // 30秒
    }, 500); // 500ms 延迟
};

// 隐藏链接预览
const hideLinkPreview = () => {
    // 清除显示定时器
    if (previewShowTimeout) {
        clearTimeout(previewShowTimeout);
        previewShowTimeout = null;
    }

    // 延迟隐藏（给用户时间移动到预览卡片上）
    previewHideTimeout = setTimeout(() => {
        linkPreview.value.visible = false;
    }, 200);
};

// 保持预览显示（当鼠标移到预览卡片上时）
const keepPreviewVisible = () => {
    if (previewHideTimeout) {
        clearTimeout(previewHideTimeout);
        previewHideTimeout = null;
    }
};

// 关闭预览
const closePreview = () => {
    if (previewShowTimeout) {
        clearTimeout(previewShowTimeout);
        previewShowTimeout = null;
    }
    if (previewHideTimeout) {
        clearTimeout(previewHideTimeout);
        previewHideTimeout = null;
    }
    if (iframeLoadTimeout) {
        clearTimeout(iframeLoadTimeout);
        iframeLoadTimeout = null;
    }
    linkPreview.value.visible = false;
};

// 为内容中的所有链接添加悬停事件
const attachLinkPreviewListeners = () => {
    if (!contentRef.value) return;

    const links = contentRef.value.querySelectorAll('a');
    links.forEach(link => {
        link.addEventListener('mouseenter', showLinkPreview);
        link.addEventListener('mouseleave', hideLinkPreview);
    });
};

// 移除链接预览监听器
const removeLinkPreviewListeners = () => {
    if (!contentRef.value) return;

    const links = contentRef.value.querySelectorAll('a');
    links.forEach(link => {
        link.removeEventListener('mouseenter', showLinkPreview);
        link.removeEventListener('mouseleave', hideLinkPreview);
    });
};

// iframe 加载完成
const onIframeLoad = () => {
    linkPreview.value.loading = false;
    // 清除超时定时器
    if (iframeLoadTimeout) {
        clearTimeout(iframeLoadTimeout);
        iframeLoadTimeout = null;
    }
};

// ========== 术语解释功能 ==========
const termExplanation = ref({
    visible: false,
    term: '',
    explanation: '',
    loading: false,
    x: 0,
    y: 0
});

let explanationAbortController = null;
let selectionTimeout = null;

// 处理文本选择
const handleTextSelection = (event) => {
    // 清除之前的定时器
    if (selectionTimeout) {
        clearTimeout(selectionTimeout);
    }

    // 延迟处理，避免频繁触发
    selectionTimeout = setTimeout(() => {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        // 如果没有选中文本或文本过长，隐藏解释卡片
        if (!selectedText || selectedText.length > 100) {
            termExplanation.value.visible = false;
            return;
        }

        // 获取选区的位置
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // 计算卡片位置（显示在选中文本下方）
        const cardWidth = 350;
        const cardMaxHeight = 400;
        const spacing = 8;

        let x = rect.left + (rect.width / 2) - (cardWidth / 2);
        let y = rect.bottom + spacing;

        // 确保不超出视口右侧
        if (x + cardWidth > window.innerWidth - 20) {
            x = window.innerWidth - cardWidth - 20;
        }

        // 确保不超出视口左侧
        if (x < 20) {
            x = 20;
        }

        // 如果下方空间不够，显示在上方
        if (y + cardMaxHeight > window.innerHeight - 20) {
            y = rect.top - spacing - Math.min(cardMaxHeight, 200);
        }

        // 显示卡片并开始获取解释
        termExplanation.value = {
            visible: true,
            term: selectedText,
            explanation: '',
            loading: true,
            x,
            y
        };

        // 调用 AI 获取解释
        fetchTermExplanation(selectedText);
    }, 300); // 300ms 延迟
};

// 调用 AI 获取术语解释
const fetchTermExplanation = async (term) => {
    try {
        console.log('开始获取术语解释:', term);

        // 取消之前的请求
        if (explanationAbortController) {
            explanationAbortController.abort();
        }

        explanationAbortController = new AbortController();

        // 从父组件获取 API 配置
        const { apiConfig, selectedModelId, currentAdapter } = await getApiConfig();

        console.log('API 配置:', {
            hasApiConfig: !!apiConfig,
            hasBaseUrl: !!apiConfig?.baseUrl,
            hasApiKey: !!apiConfig?.apiKey,
            modelId: selectedModelId,
            hasAdapter: !!currentAdapter
        });

        if (!apiConfig || !apiConfig.baseUrl || !apiConfig.apiKey) {
            throw new Error('API 配置未设置');
        }

        if (!currentAdapter || typeof currentAdapter.formatRequest !== 'function') {
            throw new Error('API 适配器未正确配置');
        }

        // 构建提示词
        const prompt = `请详细解释以下术语或概念："${term}"

要求：
1. **核心定义**（2-3句话）：用通俗易懂的语言说明这个术语的本质含义
2. **应用场景**（如果是技术术语）：说明它在实际中如何使用，解决什么问题
3. **关键特点**：列出2-3个重要特征或优势
4. **举例说明**（如果适用）：给一个简单的例子帮助理解

注意：
- 语言要通俗易懂，避免过于专业的术语
- 如果遇到缩写，请先说明完整名称
- 保持客观中立，不要有主观评价
- 直接开始解释，不要有开场白或客套话`;

        console.log('构建请求...');

        // 格式化请求（不限制 max_tokens，让 AI 自然完成）
        const requestBody = currentAdapter.formatRequest(
            [{ role: 'user', content: prompt }],
            selectedModelId,
            { stream: true }
        );

        console.log('请求体:', requestBody);

        // 组合完整的API地址
        const rawBaseUrl = apiConfig.baseUrl || '';
        const baseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;
        const rawEndpoint = apiConfig.endpoint || '/v1/chat/completions';
        const endpoint = rawEndpoint.startsWith('/') ? rawEndpoint : '/' + rawEndpoint;
        const fullUrl = `${baseUrl}${endpoint}`;

        console.log('请求 URL:', fullUrl);

        const response = await fetch(fullUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiConfig.apiKey}`
            },
            body: JSON.stringify(requestBody),
            signal: explanationAbortController.signal
        });

        console.log('响应状态:', response.status);

        if (!response.ok) {
            let errorDetail = '';
            try {
                const errorJson = await response.json();
                errorDetail = errorJson.error?.message || errorJson.message || JSON.stringify(errorJson);
            } catch (e) {
                errorDetail = await response.text();
            }
            throw new Error(`HTTP ${response.status}: ${errorDetail}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let partialLine = '';
        let chunkCount = 0;

        console.log('开始读取流...');

        while (true) {
            const { done, value } = await reader.read();

            if (done) {
                console.log('流读取完成，共处理', chunkCount, '个数据块');
                // 处理最后可能残留的部分行
                if (partialLine.trim()) {
                    console.log('处理残留数据:', partialLine);
                    const trimmedLine = partialLine.trim();
                    if (trimmedLine.startsWith('data:')) {
                        const data = trimmedLine.replace(/^data:\s*/, '');
                        if (data !== '[DONE]') {
                            try {
                                const parsed = currentAdapter.parseStreamChunk(data);
                                if (parsed && parsed.content) {
                                    termExplanation.value.explanation += parsed.content;
                                }
                            } catch (e) {
                                console.error('解析残留数据失败:', e);
                            }
                        }
                    }
                }
                break;
            }

            chunkCount++;
            const chunk = decoder.decode(value, { stream: true });
            console.log(`接收到第 ${chunkCount} 个数据块，长度:`, chunk.length);

            const lines = (partialLine + chunk).split(/\r?\n/);
            partialLine = lines.pop() || '';

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine) continue;

                if (!trimmedLine.startsWith('data:')) {
                    console.log('跳过非data行:', trimmedLine);
                    continue;
                }

                const data = trimmedLine.replace(/^data:\s*/, '');

                if (data === '[DONE]') {
                    console.log('收到 [DONE] 信号');
                    termExplanation.value.loading = false;
                    continue;
                }

                try {
                    const parsed = currentAdapter.parseStreamChunk(data);
                    if (parsed && parsed.content) {
                        termExplanation.value.explanation += parsed.content;
                        console.log('累计内容长度:', termExplanation.value.explanation.length);
                    }
                    if (parsed && parsed.done) {
                        console.log('解析器返回 done 信号');
                        termExplanation.value.loading = false;
                    }
                } catch (e) {
                    console.error('解析流数据失败:', e, '原始数据:', data.substring(0, 100));
                }
            }
        }

        // 确保 loading 状态被设置为 false
        termExplanation.value.loading = false;
        console.log('解释生成完成，最终内容长度:', termExplanation.value.explanation.length);

    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('术语解释请求已取消');
            return;
        }
        console.error('获取术语解释失败:', error);
        termExplanation.value.explanation = `获取解释失败: ${error.message}`;
        termExplanation.value.loading = false;
    }
};

// 获取 API 配置（从 props）
const getApiConfig = async () => {
    return {
        apiConfig: props.apiConfig || {},
        selectedModelId: props.selectedModelId || 'gemini-2.5-flash',
        currentAdapter: props.currentAdapter || {
            formatRequest: () => ({}),
            parseStreamChunk: () => ({})
        }
    };
};

// 关闭术语解释卡片
const closeTermExplanation = () => {
    termExplanation.value.visible = false;
    if (explanationAbortController) {
        explanationAbortController.abort();
        explanationAbortController = null;
    }
    // 清除文本选择
    window.getSelection().removeAllRanges();
};

// 复制术语解释到剪贴板
const copyTermExplanation = async () => {
    try {
        const text = termExplanation.value.explanation;

        // 优先使用现代 Clipboard API
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            console.log('复制成功（Clipboard API）');
        } else {
            // 降级方案：使用传统方法
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();

            try {
                document.execCommand('copy');
                console.log('复制成功（execCommand）');
            } catch (err) {
                console.error('复制失败:', err);
            }

            document.body.removeChild(textArea);
        }
    } catch (error) {
        console.error('复制术语解释失败:', error);
    }
};
</script>

<template>
    <div class="py-3 w-full flex justify-center">
        <div
            @click="handleMessageClick"
            :class="[
                'max-w-4xl w-full flex gap-4 px-6 md:px-5 group rounded-xl py-6 border-2',
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
                    isUser ? 'bg-gradient-to-br from-blue-500 to-purple-600' : 'bg-gradient-to-br from-blue-500 to-indigo-600'
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
                        class="relative rounded-xl border border-chatgpt-border dark:border-chatgpt-dark-border shadow-sm dark:shadow-dark-card hover:shadow-md dark:hover:shadow-dark-elevated cursor-pointer group/img"
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
                        <div class="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 flex items-center justify-center pointer-events-none rounded-xl">
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

                <!-- Attachment Cards -->
                <div v-if="attachments.length > 0" class="mt-3 space-y-2">
                    <div
                        v-for="(attachment, idx) in attachments"
                        :key="'attachment-' + idx"
                        class="attachment-card bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
                    >
                        <!-- Attachment Header -->
                        <div
                            @click="toggleAttachment(idx)"
                            class="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                        >
                            <div class="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0">
                                <FileText :size="20" class="text-white" />
                            </div>
                            <div class="flex-1 min-w-0">
                                <div class="text-sm font-medium text-chatgpt-text dark:text-chatgpt-dark-text truncate">
                                    {{ attachment.name }}
                                </div>
                                <div class="text-xs text-chatgpt-subtext dark:text-chatgpt-dark-subtext">
                                    {{ getAttachmentTypeDesc(attachment) }} · 点击{{ isAttachmentExpanded(idx) ? '收起' : '展开' }}内容
                                </div>
                            </div>
                            <button class="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                                <ChevronUp v-if="isAttachmentExpanded(idx)" :size="18" class="text-chatgpt-subtext dark:text-chatgpt-dark-subtext" />
                                <ChevronDown v-else :size="18" class="text-chatgpt-subtext dark:text-chatgpt-dark-subtext" />
                            </button>
                        </div>

                        <!-- Attachment Full Content (expanded) -->
                        <Transition name="slide">
                            <div v-if="isAttachmentExpanded(idx)" class="px-4 pb-3">
                                <div class="text-xs text-chatgpt-text dark:text-chatgpt-dark-text bg-gray-100 dark:bg-gray-900/50 rounded-lg p-3 font-mono whitespace-pre-wrap overflow-auto max-h-96">
                                    {{ attachment.content }}
                                </div>
                            </div>
                        </Transition>
                    </div>
                </div>

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
                        class="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-md text-chatgpt-subtext hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1 text-xs"
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

        <!-- Link Preview Card -->
        <Transition name="fade">
            <div
                v-if="linkPreview.visible"
                :style="{ top: `${linkPreview.y}px`, left: `${linkPreview.x}px` }"
                class="fixed z-[10000] bg-white dark:bg-chatgpt-dark-sidebar border-2 border-gray-200 dark:border-chatgpt-dark-border rounded-xl shadow-2xl dark:shadow-dark-elevated overflow-hidden"
                @mouseenter="keepPreviewVisible"
                @mouseleave="hideLinkPreview"
                @click.stop
            >
                <!-- Header -->
                <div class="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                    <div class="flex items-center gap-2 flex-1 min-w-0">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-chatgpt-accent dark:text-chatgpt-dark-accent shrink-0">
                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                        </svg>
                        <span class="text-xs text-chatgpt-text dark:text-chatgpt-dark-text truncate font-medium">{{ linkPreview.url }}</span>
                    </div>
                    <button
                        @click="closePreview"
                        class="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors shrink-0"
                        title="关闭预览"
                    >
                        <X :size="14" class="text-chatgpt-subtext dark:text-chatgpt-dark-subtext" />
                    </button>
                </div>

                <!-- Preview Content -->
                <div class="w-[400px] h-[300px] bg-white dark:bg-gray-900 relative">
                    <iframe
                        :src="linkPreview.url"
                        class="w-full h-full border-0"
                        sandbox="allow-same-origin allow-scripts"
                        loading="lazy"
                        @load="onIframeLoad"
                    ></iframe>
                    <!-- Loading overlay -->
                    <div v-if="linkPreview.loading" class="absolute inset-0 bg-white dark:bg-gray-900 flex flex-col">
                        <!-- 模拟浏览器顶部栏 -->
                        <div class="h-8 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center px-3 gap-2">
                            <div class="flex gap-1.5">
                                <div class="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse"></div>
                                <div class="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse" style="animation-delay: 0.1s"></div>
                                <div class="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" style="animation-delay: 0.2s"></div>
                            </div>
                            <div class="flex-1 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                        </div>

                        <!-- 模拟页面内容 - 骨架屏 -->
                        <div class="flex-1 p-4 space-y-3 overflow-hidden">
                            <!-- 标题骨架 -->
                            <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse"></div>

                            <!-- 内容骨架 -->
                            <div class="space-y-2">
                                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6 animate-pulse" style="animation-delay: 0.1s"></div>
                                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/5 animate-pulse" style="animation-delay: 0.2s"></div>
                            </div>

                            <!-- 图片骨架 -->
                            <div class="h-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" style="animation-delay: 0.3s"></div>

                            <!-- 更多内容骨架 -->
                            <div class="space-y-2">
                                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" style="animation-delay: 0.4s"></div>
                                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-11/12 animate-pulse" style="animation-delay: 0.5s"></div>
                                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse" style="animation-delay: 0.6s"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                    <a
                        :href="linkPreview.url"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-xs text-chatgpt-accent dark:text-chatgpt-dark-accent hover:underline flex items-center gap-1"
                    >
                        <span>在新标签页中打开</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                    </a>
                </div>
            </div>
        </Transition>

        <!-- Term Explanation Card -->
        <Transition name="fade">
            <div
                v-if="termExplanation.visible"
                :style="{ top: `${termExplanation.y}px`, left: `${termExplanation.x}px` }"
                class="fixed z-[10001] w-[350px] bg-white dark:bg-chatgpt-dark-sidebar border-2 border-blue-400 dark:border-blue-500 rounded-xl shadow-2xl dark:shadow-dark-elevated overflow-hidden"
                @click.stop
            >
                <!-- Header -->
                <div class="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 border-b border-blue-200 dark:border-blue-700">
                    <div class="flex items-center gap-2 flex-1 min-w-0 pr-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-blue-600 dark:text-blue-400 shrink-0">
                            <circle cx="12" cy="12" r="10"></circle>
                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                        </svg>
                        <span class="text-xs font-semibold text-blue-900 dark:text-blue-100 truncate" :title="termExplanation.term">{{ termExplanation.term }}</span>
                    </div>
                    <button
                        @click="closeTermExplanation"
                        class="p-1 hover:bg-blue-100 dark:hover:bg-blue-800 rounded transition-colors shrink-0"
                        title="关闭"
                    >
                        <X :size="14" class="text-blue-600 dark:text-blue-400" />
                    </button>
                </div>

                <!-- Content -->
                <div class="p-4 max-h-[300px] overflow-y-auto overflow-x-hidden">
                    <!-- Loading State -->
                    <div v-if="termExplanation.loading && !termExplanation.explanation" class="flex items-center gap-2 text-chatgpt-subtext dark:text-chatgpt-dark-subtext">
                        <div class="flex gap-1">
                            <div class="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style="animation-delay: 0ms"></div>
                            <div class="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style="animation-delay: 150ms"></div>
                            <div class="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style="animation-delay: 300ms"></div>
                        </div>
                        <span class="text-sm">AI 正在思考...</span>
                    </div>

                    <!-- Explanation Content with Markdown rendering -->
                    <div
                        v-else
                        class="term-explanation-content prose prose-sm prose-slate dark:prose-invert max-w-none text-chatgpt-text dark:text-chatgpt-dark-text"
                        v-html="md.render(termExplanation.explanation)"
                    ></div>

                    <!-- Streaming cursor -->
                    <span v-if="termExplanation.loading && termExplanation.explanation" class="inline-block w-1 h-4 bg-blue-500 animate-pulse ml-1"></span>
                </div>

                <!-- Footer -->
                <div class="px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                    <span class="text-xs text-chatgpt-subtext dark:text-chatgpt-dark-subtext">由 AI 生成</span>
                    <button
                        v-if="!termExplanation.loading && termExplanation.explanation"
                        @click="copyTermExplanation"
                        class="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                        title="复制解释"
                    >
                        <Copy :size="12" />
                        <span>复制</span>
                    </button>
                </div>
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
    @apply border-l-4 border-blue-500 pl-4 py-1 my-2 bg-transparent text-gray-500 dark:text-gray-400 not-italic flex items-center;
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

/* Table Styles Enhancement */
.table-wrapper {
    @apply my-6 relative overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-all duration-200;
    background-color: white;
}

.dark .table-wrapper {
    background-color: #2D2D35; /* 稍深于 assistant 背景，突出表格区域 */
}

.table-wrapper:hover {
    @apply border-blue-400/30 dark:border-blue-500/30 shadow-md;
}

.prose table {
    @apply w-full border-collapse text-sm m-0 !important;
    table-layout: auto;
}

.prose thead {
    @apply bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700;
}

.prose th {
    @apply px-5 py-3.5 text-left font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap !important;
}

.prose td {
    @apply px-5 py-3 border-b border-gray-100 dark:border-gray-800/50 text-gray-700 dark:text-gray-300 !important;
}

.prose tr:last-child td {
    @apply border-b-0;
}

.prose tr:nth-child(even) {
    background-color: rgba(0, 0, 0, 0.02);
}

.dark .prose tr:nth-child(even) {
    background-color: rgba(255, 255, 255, 0.02);
}

.prose tr:hover td {
    @apply bg-blue-50/50 dark:bg-blue-900/20;
}

/* Table Resizer */
.table-resizer {
    @apply absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500/50 transition-colors z-10;
}

.table-resizer.resizing {
    @apply bg-blue-500 w-0.5;
}

/* Table Toolbar */
.table-toolbar {
    @apply absolute top-2 right-2 flex gap-2 z-20;
}

.table-export-btn {
    @apply flex items-center gap-1.5 px-2 py-1 bg-white/90 dark:bg-gray-900/90 border border-gray-200 dark:border-gray-700 rounded-lg text-[11px] font-medium text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-200 dark:hover:border-blue-800 shadow-sm transition-all;
}

.table-export-btn svg {
    @apply opacity-70;
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
    background-color: var(--chatgpt-accent, #3B82F6);
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
    background-color: var(--chatgpt-dark-accent, #3B82F6);
    box-shadow: 0 0 8px rgba(16, 163, 127, 0.6);
}

/* Attachment card slide transition */
.slide-enter-active,
.slide-leave-active {
    transition: all 0.3s ease;
    overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
    opacity: 0;
    max-height: 0;
}

.slide-enter-to,
.slide-leave-from {
    opacity: 1;
    max-height: 500px;
}

/* Attachment card styling */
.attachment-card {
    transition: all 0.2s ease;
}

.attachment-card:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.dark .attachment-card:hover {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

/* 术语解释卡片平滑动画 */
.fade-enter-active {
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.fade-leave-active {
    transition: all 0.2s cubic-bezier(0.4, 0, 1, 1);
}

.fade-enter-from {
    opacity: 0;
    transform: translateY(-8px) scale(0.96);
}

.fade-leave-to {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
}

.fade-enter-to,
.fade-leave-from {
    opacity: 1;
    transform: translateY(0) scale(1);
}

/* 术语解释内容强制换行 */
.term-explanation-content * {
    word-wrap: break-word;
    overflow-wrap: break-word;
    word-break: break-word;
    max-width: 100%;
}

.term-explanation-content h1,
.term-explanation-content h2,
.term-explanation-content h3,
.term-explanation-content h4,
.term-explanation-content h5,
.term-explanation-content h6 {
    word-wrap: break-word;
    overflow-wrap: break-word;
    hyphens: auto;
}

.term-explanation-content code,
.term-explanation-content pre {
    white-space: pre-wrap;
    word-wrap: break-word;
    overflow-wrap: break-word;
}

/* 术语解释内容字体大小调整 */
.term-explanation-content {
    font-size: 0.8125rem; /* 13px */
    line-height: 1.5;
}

.term-explanation-content h1 {
    font-size: 1rem; /* 16px */
    margin-top: 0.75rem;
    margin-bottom: 0.5rem;
}

.term-explanation-content h2 {
    font-size: 0.9375rem; /* 15px */
    margin-top: 0.625rem;
    margin-bottom: 0.375rem;
}

.term-explanation-content h3 {
    font-size: 0.875rem; /* 14px */
    margin-top: 0.5rem;
    margin-bottom: 0.25rem;
}

.term-explanation-content h4,
.term-explanation-content h5,
.term-explanation-content h6 {
    font-size: 0.8125rem; /* 13px */
    margin-top: 0.5rem;
    margin-bottom: 0.25rem;
}

.term-explanation-content p {
    margin-top: 0.375rem;
    margin-bottom: 0.375rem;
}

.term-explanation-content code {
    font-size: 0.75rem; /* 12px */
    padding: 0.125rem 0.25rem;
}

.term-explanation-content pre {
    font-size: 0.75rem; /* 12px */
    padding: 0.5rem;
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
}

.term-explanation-content ul,
.term-explanation-content ol {
    margin-top: 0.375rem;
    margin-bottom: 0.375rem;
    padding-left: 1.25rem;
}

.term-explanation-content li {
    margin-top: 0.125rem;
    margin-bottom: 0.125rem;
}
</style>
