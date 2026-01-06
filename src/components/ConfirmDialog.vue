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
            class="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4 backdrop-blur-sm"
            @click.self="handleCancel"
        >
            <Transition name="modal-content">
                <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                    <!-- 内容区域 -->
                    <div class="p-6 space-y-4">
                        <div class="flex gap-4">
                            <div class="shrink-0">
                                <div :class="['p-2 rounded-full', type === 'danger' ? 'bg-red-100' : type === 'info' ? 'bg-blue-100' : 'bg-yellow-100']">
                                    <AlertCircle :size="24" :class="iconColorMap[type]" />
                                </div>
                            </div>
                            <div class="flex-1 min-w-0">
                                <h3 class="text-lg font-bold text-gray-900 mb-2">{{ title }}</h3>
                                <p class="text-sm text-gray-600 whitespace-pre-line">{{ message }}</p>
                            </div>
                        </div>
                    </div>

                    <!-- 按钮区域 -->
                    <div class="flex gap-3 px-6 pb-6">
                        <button
                            @click="handleCancel"
                            class="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors text-sm font-medium"
                        >
                            {{ cancelText }}
                        </button>
                        <button
                            @click="handleConfirm"
                            :class="[
                                'flex-1 px-4 py-2.5 rounded-xl transition-colors text-sm font-medium text-white',
                                type === 'danger' ? 'bg-red-500 hover:bg-red-600' : 'bg-chatgpt-accent hover:bg-emerald-600'
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
