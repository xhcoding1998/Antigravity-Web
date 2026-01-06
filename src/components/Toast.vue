<script setup>
import { ref, watch } from 'vue';
import { CheckCircle, AlertCircle, XCircle, Info } from 'lucide-vue-next';

const props = defineProps({
    show: Boolean,
    message: String,
    type: {
        type: String,
        default: 'info' // success, error, warning, info
    },
    duration: {
        type: Number,
        default: 3000
    }
});

const emit = defineEmits(['close']);

let timer = null;

watch(() => props.show, (newVal) => {
    if (newVal) {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            emit('close');
        }, props.duration);
    }
});

const iconMap = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertCircle,
    info: Info
};

const colorMap = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800'
};

const iconColorMap = {
    success: 'text-emerald-600',
    error: 'text-red-600',
    warning: 'text-yellow-600',
    info: 'text-blue-600'
};
</script>

<template>
    <Transition name="toast">
        <div
            v-if="show"
            :class="[
                'fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-xl border-2 shadow-elevated backdrop-blur-sm min-w-[320px] max-w-md',
                colorMap[type]
            ]"
        >
            <component :is="iconMap[type]" :size="20" :class="['shrink-0', iconColorMap[type]]" />
            <div class="flex-1 text-sm font-medium">{{ message }}</div>
        </div>
    </Transition>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
    transition: all 0.3s ease;
}

.toast-enter-from {
    opacity: 0;
    transform: translate(-50%, -20px);
}

.toast-leave-to {
    opacity: 0;
    transform: translate(-50%, -10px);
}
</style>
