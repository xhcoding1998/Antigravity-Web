<script setup>
import { ref, computed, watch } from 'vue';
import { Plus } from 'lucide-vue-next';
import { useChat } from './composables/useChat';
import { useTheme } from './composables/useTheme';
import Sidebar from './components/Sidebar.vue';
import ChatContainer from './components/ChatContainer.vue';
import ChatInput from './components/ChatInput.vue';
import Settings from './components/Settings.vue';
import ConfirmDialog from './components/ConfirmDialog.vue';

const {
    history,
    currentChatId,
    messages,
    models,
    selectedModelId,
    selectedModel,
    isStreaming,
    apiConfig,
    dataRetention,
    isDbReady,
    isInitializing,
    contextEnabled,
    diagramEnabled,
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
    resetAllSettings,
    getStorageInfo
} = useChat();

// 主题管理
const { isDark, toggleTheme } = useTheme();

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
        return;
    }

    sendMessage(content, images);
};

const handleApiConfigConfirm = () => {
    openSettings();
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
        // 将编辑的消息内容和图片传递给输入框
        // 通过ref引用ChatInput组件并调用其方法
        chatInputRef.value?.setEditContent(messageData.content, messageData.images);
    }
};

const chatInputRef = ref(null);

</script>

<template>
    <div class="flex h-screen w-full bg-chatgpt-main dark:bg-chatgpt-dark-main overflow-hidden text-chatgpt-text dark:text-chatgpt-dark-text font-manrope transition-colors duration-200">
        <!-- Sidebar -->
        <Sidebar
            :history="history"
            :current-chat-id="currentChatId"
            :models="models"
            :selected-model-id="selectedModelId"
            :is-dark="isDark"
            @new="createNewChat"
            @select="selectChat"
            @delete="deleteChat"
            @clear="clearHistory"
            @update:selected-model-id="selectedModelId = $event"
            @open-settings="openSettings"
            @toggle-theme="toggleTheme"
        />

        <!-- Main Content -->
        <main class="relative flex-1 flex flex-col overflow-hidden">
            <!-- Mobile Header -->
            <div class="md:hidden p-4 border-b border-chatgpt-border dark:border-chatgpt-dark-border flex justify-between items-center bg-chatgpt-sidebar dark:bg-chatgpt-dark-sidebar transition-colors duration-200">
                <span class="font-bold text-sm">{{ selectedModel?.name }}</span>
                <button @click="createNewChat" class="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors">
                    <Plus :size="20" />
                </button>
            </div>

            <!-- Messages List -->
            <ChatContainer
                :messages="messages"
                :model-name="selectedModel?.name"
                :is-streaming="isStreaming"
                :diagram-enabled="diagramEnabled"
                @resend="handleResend"
                @edit="handleEdit"
            />

            <!-- Input Area -->
            <ChatInput
                ref="chatInputRef"
                :disabled="isStreaming"
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
                    :models="models"
                    :api-config="apiConfig"
                    :data-retention="dataRetention"
                    :selected-model-id="selectedModelId"
                    :history="history"
                    :get-storage-info="getStorageInfo"
                    @close="closeSettings"
                    @update:models="handleUpdateModels"
                    @update:api-config="handleUpdateApiConfig"
                    @update:data-retention="handleUpdateDataRetention"
                    @reset-all="handleResetAll"
                    @clear-history="clearHistory"
                />
            </div>
        </Transition>

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
