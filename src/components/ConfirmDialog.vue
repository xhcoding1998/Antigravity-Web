<script setup>
import { AlertCircle } from 'lucide-vue-next';

const props = defineProps({
    show: Boolean,
    title: String,
    message: String,
    confirmText: {
        type: String,
        default: '确定'
    },
    cancelText: {
        type: String,
        default: '取消'
    },
    type: {
        type: String,
        default: 'warning' // warning, danger, info
    }
});

const emit = defineEmits(['confirm', 'cancel', 'close']);

const handleConfirm = () => {
    emit('confirm');
    emit('close');
};

const handleCancel = () => {
    emit('cancel');
    emit('close');
};

const iconColorMap = {
    warning: 'text-yellow-600',
    danger: 'text-red-600',
    info: 'text-blue-600'
};
</script>

<template>
    <Transition name="modal">
        <div
            v-if="show"
            class="fixed inset-0 bg-black/50 dark:bg-black/70 z-[200] flex items-center justify-center p-4 backdrop-blur-sm transition-colors duration-200"
        >
            <Transition name="modal-content">
                <div class="bg-white dark:bg-chatgpt-dark-sidebar rounded-2xl shadow-2xl dark:shadow-dark-elevated w-full max-w-md transition-colors duration-200 dark:border-2 dark:border-chatgpt-dark-border" @keydown.esc="handleCancel">
                    <!-- 内容区域 -->
                    <div class="p-6 space-y-4">
                        <div class="flex gap-4">
                            <div class="shrink-0">
                                <div :class="['p-2 rounded-full', type === 'danger' ? 'bg-red-100 dark:bg-red-900/30' : type === 'info' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30']">
                                    <AlertCircle :size="24" :class="[type === 'danger' ? 'text-red-600 dark:text-red-400' : type === 'info' ? 'text-blue-600 dark:text-blue-400' : 'text-yellow-600 dark:text-yellow-400']" />
                                </div>
                            </div>
                            <div class="flex-1 min-w-0">
                                <h3 class="text-lg font-bold text-gray-900 dark:text-chatgpt-dark-text mb-2">{{ title }}</h3>
                                <p class="text-sm text-gray-600 dark:text-chatgpt-dark-subtext whitespace-pre-line">{{ message }}</p>
                            </div>
                        </div>
                    </div>

                    <!-- 按钮区域 -->
                    <div class="flex gap-3 px-6 pb-6">
                        <button
                            @click="handleCancel"
                            class="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-chatgpt-dark-user text-gray-700 dark:text-chatgpt-dark-text rounded-xl hover:bg-gray-200 dark:hover:bg-chatgpt-dark-assistant transition-colors text-sm font-medium"
                        >
                            {{ cancelText }}
                        </button>
                        <button
                            @click="handleConfirm"
                            :class="[
                                'flex-1 px-4 py-2.5 rounded-xl transition-colors text-sm font-medium text-white',
                                type === 'danger' ? 'bg-red-500 dark:bg-red-600 hover:bg-red-600 dark:hover:bg-red-700' : 'bg-chatgpt-accent dark:bg-chatgpt-dark-accent hover:bg-blue-600 dark:hover:bg-blue-500'
                            ]"
                        >
                            {{ confirmText }}
                        </button>
                    </div>
                </div>
            </Transition>
        </div>
    </Transition>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
    transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
    opacity: 0;
}

.modal-content-enter-active {
    transition: all 0.3s ease;
}

.modal-content-leave-active {
    transition: all 0.2s ease;
}

.modal-content-enter-from {
    opacity: 0;
    transform: scale(0.95) translateY(-20px);
}

.modal-content-leave-to {
    opacity: 0;
    transform: scale(0.95);
}
</style>
