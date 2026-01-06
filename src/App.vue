<script setup>
import { ref } from 'vue';
import { Plus } from 'lucide-vue-next';
import { useChat } from './composables/useChat';
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
    createNewChat,
    selectChat,
    deleteChat,
    clearHistory,
    sendMessage,
    updateModels,
    updateApiConfig,
    updateDataRetention,
    resetAllSettings
} = useChat();

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

const handleUpdateDataRetention = (days) => {
    updateDataRetention(days);
};

const handleResetAll = () => {
    resetAllSettings();
    showSettings.value = false;
};

</script>

<template>
    <div class="flex h-screen w-full bg-chatgpt-main overflow-hidden text-chatgpt-text font-manrope">
        <!-- Sidebar -->
        <Sidebar
            :history="history"
            :current-chat-id="currentChatId"
            :models="models"
            :selected-model-id="selectedModelId"
            @new="createNewChat"
            @select="selectChat"
            @delete="deleteChat"
            @clear="clearHistory"
            @update:selected-model-id="selectedModelId = $event"
            @open-settings="openSettings"
        />

        <!-- Main Content -->
        <main class="relative flex-1 flex flex-col overflow-hidden">
            <!-- Mobile Header -->
            <div class="md:hidden p-4 border-b border-chatgpt-border flex justify-between items-center bg-chatgpt-sidebar">
                <span class="font-bold text-sm">{{ selectedModel?.name }}</span>
                <button @click="createNewChat" class="p-2 hover:bg-gray-200 rounded-md transition-colors">
                    <Plus :size="20" />
                </button>
            </div>

            <!-- Messages List -->
            <ChatContainer :messages="messages" :model-name="selectedModel?.name" />

            <!-- Input Area -->
            <ChatInput :disabled="isStreaming" :model-name="selectedModel?.name" @send="handleSend" />
        </main>

        <!-- Settings Modal -->
        <Transition name="modal">
            <div v-if="showSettings">
                <Settings
                    :models="models"
                    :api-config="apiConfig"
                    :data-retention="dataRetention"
                    :selected-model-id="selectedModelId"
                    @close="closeSettings"
                    @update:models="handleUpdateModels"
                    @update:api-config="handleUpdateApiConfig"
                    @update:data-retention="handleUpdateDataRetention"
                    @reset-all="handleResetAll"
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
