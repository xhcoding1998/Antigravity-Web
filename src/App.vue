<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { Plus } from 'lucide-vue-next';
import { useChat } from './composables/useChat';
import { useTheme } from './composables/useTheme';
import Sidebar from './components/Sidebar.vue';
import ChatContainer from './components/ChatContainer.vue';
import ChatInput from './components/ChatInput.vue';
import Settings from './components/Settings.vue';
import ConfirmDialog from './components/ConfirmDialog.vue';
import FloatingToolbar from './components/FloatingToolbar.vue';
import Toast from './components/Toast.vue';
import ExportPreviewModal from './components/ExportPreviewModal.vue';
import SummaryModal from './components/SummaryModal.vue';
import {
    prepareMacOSContainerDOM,
    generateMarkdownContent,
    downloadDOMAsImage,
    downloadDOMAsPDF,
    downloadMarkdownString
} from './utils/exportUtils.js';

// 根据主题动态导入 highlight.js 样式
const loadCodeTheme = async (theme) => {
    // 移除旧的样式
    const oldStyle = document.getElementById('hljs-theme');
    if (oldStyle) {
        oldStyle.remove();
    }

    // 加载新样式
    let themeFile = '';
    switch (theme) {
        case 'vscode':
            themeFile = 'vs2015'; // VSCode深色主题
            break;
        case 'github':
            themeFile = 'github-dark';
            break;
        case 'jetbrains':
            themeFile = 'androidstudio'; // JetBrains风格深色主题
            break;
        default:
            themeFile = 'vs2015';
    }

    // 动态导入CSS
    const link = document.createElement('link');
    link.id = 'hljs-theme';
    link.rel = 'stylesheet';
    link.href = `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/${themeFile}.min.css`;
    document.head.appendChild(link);
};

const {
    history,
    currentChatId,
    messages,
    modelGroups,
    currentGroupId,
    currentGroup,
    switchGroup,
    models,
    selectedModelId,
    selectedModel,
    isStreaming,
    apiConfig,
    currentAdapter, // API适配器
    dataRetention,
    isDbReady,
    isInitializing,
    contextEnabled,
    diagramEnabled,
    codeTheme,
    isDrawingModel,
    createNewChat,
    selectChat,
    deleteChat,
    clearHistory,
    sendMessage,
    resendMessage,
    editMessage,
    updateModels,
    updateApiConfig,
    updateDataRetention,
    updateGroupApiConfig,
    updateGroupModels,
    createApiConfig,
    deleteApiConfig,
    refreshModels,
    syncModelsFromApi,
    resetAllSettings,
    getStorageInfo
} = useChat();

// 主题管理
const { isDark, toggleTheme } = useTheme();

// 监听代码主题变化并加载相应样式
watch(codeTheme, (newTheme) => {
    if (newTheme) {
        loadCodeTheme(newTheme);
    }
}, { immediate: true });

// 检测当前是否为绘图模型
const isCurrentDrawingModel = computed(() => isDrawingModel(selectedModelId.value));

// 当切换到绘图模型时，自动关闭上下文
watch(isCurrentDrawingModel, (isDrawing) => {
    if (isDrawing) {
        contextEnabled.value = false;
    }
});

// 确认对话框
const showApiConfigDialog = ref(false);

const handleSend = (content, images) => {
    // 检查API配置
    if (!apiConfig.value.baseUrl || !apiConfig.value.apiKey) {
        showApiConfigDialog.value = true;
        setTimeout(() => {
             chatInputRef.value?.setEditContent(content, images);
        }, 0);
        return;
    }

    sendMessage(content, images);
};

const handleApiConfigConfirm = () => {
    openSettings();
};

const handleNewChat = () => {
    createNewChat();
    setTimeout(() => {
        chatInputRef.value?.focus();
    }, 0);
};

// 设置弹窗
const showSettings = ref(false);

const openSettings = () => {
    showSettings.value = true;
};

const closeSettings = () => {
    showSettings.value = false;
};

const handleUpdateModels = (newModels) => {
    updateModels(newModels);
};

const handleUpdateApiConfig = (newConfig) => {
    updateApiConfig(newConfig);
};

const handleUpdateDataRetention = async (days) => {
    await updateDataRetention(days);
};

const handleUpdateCodeTheme = (theme) => {
    codeTheme.value = theme;
};

const handleResetAll = async () => {
    await resetAllSettings();
    showSettings.value = false;
};

const handleResend = async (messageIndex) => {
    // 检查API配置
    if (!apiConfig.value.baseUrl || !apiConfig.value.apiKey) {
        showApiConfigDialog.value = true;
        return;
    }

    await resendMessage(messageIndex);
};

const handleEdit = (messageIndex) => {
    const messageData = editMessage(messageIndex);
    if (messageData) {
        chatInputRef.value?.setEditContent(messageData.content, messageData.images);
    }
};

const chatInputRef = ref(null);

// Toast通知状态
const toast = ref({
    show: false,
    message: '',
    type: 'info'
});

const showToast = (message, type = 'info') => {
    toast.value = { show: true, message, type };
};

const closeToast = () => {
    toast.value.show = false;
};

// 导出功能相关状态
const showFloatingToolbar = ref(true); // 是否显示悬浮工具栏
const isSelectionMode = ref(false); // 是否处于选择模式
const selectedMessageIds = ref(new Set()); // 选中的消息ID集合

// 预览相关状态
const showExportPreview = ref(false);
const previewContent = ref(null);
const exportFormat = ref('image'); // 'image', 'pdf', 'markdown'
const exportFilename = ref('');

// 选中的消息列表
const selectedMessages = computed(() => {
    return messages.value.filter((msg, index) =>
        selectedMessageIds.value.has(index)
    );
});

// 当前对话信息
const currentChat = computed(() => {
    return history.value.find(chat => chat.id === currentChatId.value);
});

// 切换选择模式
const toggleSelectionMode = () => {
    isSelectionMode.value = !isSelectionMode.value;
    if (!isSelectionMode.value) {
        selectedMessageIds.value.clear();
    }
};

// 切换消息选中状态
const toggleMessageSelection = (index) => {
    if (selectedMessageIds.value.has(index)) {
        selectedMessageIds.value.delete(index);
    } else {
        selectedMessageIds.value.add(index);
    }
};

// 通用导出准备函数 (带 Try-Catch 和 日志)
const prepareExport = (format, scope) => {
    console.log('[DEBUG] prepareExport called:', format, scope);
    try {
        // 确定要导出的消息范围
        let targetMessages = messages.value;
        let targetIndices = null;

        if (scope === 'selected') {
            if (selectedMessages.value.length === 0) {
                showToast('请先选择要导出的消息', 'warning');
                return;
            }
            targetIndices = selectedMessageIds.value;
        } else {
            if (targetMessages.length === 0) {
                showToast('当前没有消息可导出', 'warning');
                return;
            }
        }

        const title = currentChat.value?.title || '对话导出';

        // 生成带时间戳的文件名: 标题-YYYYMMDD-HHmm
        const now = new Date();
        const timestamp = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}-${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}`;
        exportFilename.value = `${title}-${timestamp}`;

        // 生成预览内容
        if (format === 'markdown') {
            previewContent.value = generateMarkdownContent(targetMessages, title, targetIndices);
        } else {
            // Image 或 PDF 都使用 macOS 风格容器预览
            try {
                const dom = prepareMacOSContainerDOM(targetMessages, title, isDark.value, targetIndices);
                if (!dom) throw new Error('DOM构建返回空');
                previewContent.value = dom;
            } catch (domErr) {
                console.error('DOM Build Error:', domErr);
                throw new Error(`预览界面构建失败: ${domErr.message}`);
            }
        }

        exportFormat.value = format;
        showExportPreview.value = true;
    } catch (e) {
        console.error('Export Preparation Error:', e);
        showToast(`导出准备失败: ${e.message}`, 'error');
    }
};

// 处理导出确认
const handleExportConfirm = async (filename) => {
    showToast('正在导出...', 'info');

    let result;
    try {
        if (exportFormat.value === 'image') {
            result = await downloadDOMAsImage(previewContent.value, filename);
        } else if (exportFormat.value === 'pdf') {
            result = await downloadDOMAsPDF(previewContent.value, filename);
        } else {
            result = downloadMarkdownString(previewContent.value, filename);
        }

        if (result.success) {
            showToast('✅ 导出成功！', 'success');
            showExportPreview.value = false;
            // 导出成功后退出选择模式
            if (isSelectionMode.value) {
                isSelectionMode.value = false;
                selectedMessageIds.value.clear();
            }
        } else {
            showToast(`❌ 导出失败: ${result.error}`, 'error');
        }
    } catch (e) {
        showToast(`❌ 导出异常: ${e.message}`, 'error');
    }
};

// 包装函数，适配 FloatingToolbar 事件
const handleExportAsImage = () => prepareExport('image', 'selected');
const handleExportAsPDF = () => prepareExport('pdf', 'selected');
const handleExportAsMarkdown = () => prepareExport('markdown', 'selected');
const handleExportAll = (format) => prepareExport(format, 'all');


const handleSelectChat = (id) => {
    selectChat(id);
    // 切换对话时退出选择模式
    if (isSelectionMode.value) {
        isSelectionMode.value = false;
        selectedMessageIds.value.clear();
    }
    // 聚焦输入框
    setTimeout(() => {
        chatInputRef.value?.focus();
    }, 0);
};

// --- 对话总结功能 ---
const showSummaryModal = ref(false);
const summaryContent = ref('');
const isSummarizing = ref(false);

const handleSummarize = async () => {
    if (messages.value.length === 0) {
        showToast('暂无对话可总结', 'warning');
        return;
    }

    if (!apiConfig.value.baseUrl || !apiConfig.value.apiKey) {
        showToast('请先配置 API', 'warning');
        return;
    }

    showSummaryModal.value = true;
    summaryContent.value = '';
    isSummarizing.value = true;

    try {
        // 构造上下文
        const validMessages = messages.value.filter(m => !m.error);
        const contextStr = validMessages
            .map(m => {
                // 移除 Markdown 图片语法，避免 base64 过长
                // 匹配 ![...](...) 格式
                let text = m.content || '';
                text = text.replace(/!\[.*?\]\(.*?\)/g, '[图片]');
                return `[${m.role.toUpperCase()}]: ${text}`;
            })
            .join('\n\n');

        const prompt = `请作为一名资深的会议/对话记录助手，对以下对话内容进行结构化、专业且精简的总结。

要求：
1. **核心主题**：用一句话概括讨论的主要内容。
2. **要点摘要**：使用 Markdown 列表列出 3-5 个关键讨论点或结论。
3. **行动项(Action Items)**：如果有，列出需要执行的任务（可选）。
4. 语气客观、专业，去除口语化表达。

以下是对话内容：
${contextStr}`;

        // 构造请求
        const requestMessages = [{ role: 'user', content: prompt }];

        // 使用适配器格式化
        const requestBody = currentAdapter.value.formatRequest(
            requestMessages,
            selectedModelId.value,
            { stream: true }
        );

        // API URL
        const rawBaseUrl = apiConfig.value.baseUrl || '';
        const baseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;
        const rawEndpoint = apiConfig.value.endpoint || '/v1/chat/completions';
        const endpoint = rawEndpoint.startsWith('/') ? rawEndpoint : '/' + rawEndpoint;
        const fullUrl = `${baseUrl}${endpoint}`;

        const response = await fetch(fullUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiConfig.value.apiKey}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

        // 流式读取
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let partialLine = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = (partialLine + chunk).split(/\r?\n/);
            partialLine = lines.pop() || '';

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine || !trimmedLine.startsWith('data:')) continue;
                const data = trimmedLine.replace(/^data:\s*/, '');
                try {
                    const parsed = currentAdapter.value.parseStreamChunk(data);
                    if (parsed && parsed.content) {
                        summaryContent.value += parsed.content;
                    }
                    if (parsed && parsed.done) break;
                } catch (e) {
                    // ignore parse error
                }
            }
        }
    } catch (e) {
        console.error('Summarize Error:', e);
        summaryContent.value += `\n\n> ❌ 总结生成出错: ${e.message}`;
    } finally {
        isSummarizing.value = false; // 完成（或出错）后停止 loading 状态
    }
};

</script>

<template>
    <div class="flex h-screen w-full bg-chatgpt-main dark:bg-chatgpt-dark-main overflow-hidden text-chatgpt-text dark:text-chatgpt-dark-text font-manrope">
        <!-- Sidebar -->
        <Sidebar
            :history="history"
            :current-chat-id="currentChatId"
            :models="models"
            :selected-model-id="selectedModelId"
            :model-groups="modelGroups"
            :current-group-id="currentGroupId"
            :is-dark="isDark"
            @new="handleNewChat"
            @select="handleSelectChat"
            @delete="deleteChat"
            @clear="clearHistory"
            @update:selected-model-id="selectedModelId = $event"
            @update:current-group-id="switchGroup"
            @open-settings="openSettings"
            @toggle-theme="toggleTheme"
        />

        <!-- Main Content -->
        <main class="relative flex-1 flex flex-col overflow-hidden">
            <!-- Mobile Header -->
            <div class="md:hidden p-4 border-b border-chatgpt-border dark:border-chatgpt-dark-border flex justify-between items-center bg-chatgpt-sidebar dark:bg-chatgpt-dark-sidebar">
                <span class="font-bold text-sm">{{ selectedModel?.name }}</span>
                <button @click="handleNewChat" class="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors">
                    <Plus :size="20" />
                </button>
            </div>

            <!-- Messages List -->
            <ChatContainer
                :messages="messages"
                :model-name="selectedModel?.name"
                :is-streaming="isStreaming"
                :diagram-enabled="diagramEnabled"
                :code-theme="codeTheme"
                :is-selection-mode="isSelectionMode"
                :selected-message-ids="selectedMessageIds"
                @resend="handleResend"
                @edit="handleEdit"
                @toggle-selection="toggleMessageSelection"
            />

            <!-- Input Area -->
            <ChatInput
                ref="chatInputRef"
                :disabled="isStreaming || isSelectionMode"
                :model-name="selectedModel?.name"
                :context-enabled="contextEnabled"
                :is-drawing-model="isCurrentDrawingModel"
                :diagram-enabled="diagramEnabled"
                @send="handleSend"
                @update:context-enabled="contextEnabled = $event"
                @update:diagram-enabled="diagramEnabled = $event"
            />
        </main>

        <!-- Settings Modal -->
        <Transition name="modal">
            <div v-if="showSettings">
                <Settings
                    :model-groups="modelGroups"
                    :current-group-id="currentGroupId"
                    :models="models"
                    :api-config="apiConfig"
                    :data-retention="dataRetention"
                    :code-theme="codeTheme"
                    :selected-model-id="selectedModelId"
                    :history="history"
                    :get-storage-info="getStorageInfo"
                    :refresh-models="refreshModels"
                    :sync-models-from-api="syncModelsFromApi"
                    :create-api-config="createApiConfig"
                    :delete-api-config="deleteApiConfig"
                    @close="closeSettings"
                    @update:current-group-id="switchGroup"
                    @update:group-models="({ groupId, models }) => updateGroupModels(groupId, models)"
                    @update:group-api-config="({ groupId, config }) => updateGroupApiConfig(groupId, config)"
                    @update:models="handleUpdateModels"
                    @update:api-config="handleUpdateApiConfig"
                    @update:data-retention="handleUpdateDataRetention"
                    @update:code-theme="handleUpdateCodeTheme"
                    @reset-all="handleResetAll"
                    @clear-history="clearHistory"
                />
            </div>
        </Transition>

        <!-- 导出预览弹窗 -->
        <ExportPreviewModal
            :show="showExportPreview"
            :content="previewContent"
            :format="exportFormat"
            :default-filename="exportFilename"
            @close="showExportPreview = false"
            @confirm="handleExportConfirm"
        />

        <!-- 总结弹窗 -->
        <SummaryModal
            :show="showSummaryModal"
            :content="summaryContent"
            :is-loading="isSummarizing"
            @close="showSummaryModal = false"
        />

        <!-- 悬浮工具栏 -->
        <FloatingToolbar
            :visible="showFloatingToolbar && messages.length > 0"
            :is-selection-mode="isSelectionMode"
            :selected-count="selectedMessageIds.size"
            :is-dark="isDark"
            @toggle-selection-mode="toggleSelectionMode"
            @export-as-image="handleExportAsImage"
            @export-as-pdf="handleExportAsPDF"
            @export-as-markdown="handleExportAsMarkdown"
            @export-all="handleExportAll"
            @summarize="handleSummarize"
            @toggle-theme="toggleTheme"
            @close="showFloatingToolbar = false"
        />

        <!-- API未配置提示对话框 -->
        <ConfirmDialog
            :show="showApiConfigDialog"
            title="API未配置"
            message="请先在设置中配置API地址和密钥。&#10;&#10;点击&quot;前往设置&quot;打开设置页面进行配置。"
            confirm-text="前往设置"
            cancel-text="取消"
            type="warning"
            @confirm="handleApiConfigConfirm"
            @close="showApiConfigDialog = false"
        />

        <!-- Toast通知 -->
        <Toast
            :show="toast.show"
            :message="toast.message"
            :type="toast.type"
            @close="closeToast"
        />
    </div>
</template>

<style>
/* Global styles are in assets/main.css */

/* 模态框背景过渡动画 */
.modal-enter-active,
.modal-leave-active {
    transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
    opacity: 0;
}
</style>
