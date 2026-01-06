<script setup>
import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
import { Send, X } from 'lucide-vue-next';

const props = defineProps({
    disabled: Boolean,
    modelName: String
});

const emit = defineEmits(['send']);

const input = ref('');
const images = ref([]);
const textareaRef = ref(null);
const MAX_IMAGES = 3;

const displayName = computed(() => {
    // 从模型名称中提取品牌名
    const name = props.modelName || 'ChatGPT';
    if (name.includes('Gemini')) return 'Gemini';
    if (name.includes('Claude')) return 'Claude';
    if (name.includes('GPT')) return 'ChatGPT';
    return 'AI';
});

const handleSend = () => {
    if ((!input.value.trim() && images.value.length === 0) || props.disabled) return;
    emit('send', input.value, [...images.value]);
    input.value = '';
    images.value = [];
    if (textareaRef.value) {
        textareaRef.value.style.height = 'auto';
    }
};

// 处理粘贴事件
const handlePaste = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    // 遍历剪贴板项
    for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // 检查是否是图片
        if (item.type.indexOf('image') !== -1) {
            e.preventDefault(); // 阻止默认粘贴行为

            // 检查图片数量限制
            if (images.value.length >= MAX_IMAGES) {
                alert(`最多只能添加 ${MAX_IMAGES} 张图片`);
                return;
            }

            const file = item.getAsFile();
            if (file) {
                // 将图片转换为base64
                const reader = new FileReader();
                reader.onload = (event) => {
                    if (images.value.length < MAX_IMAGES) {
                        images.value.push(event.target.result);
                    }
                };
                reader.readAsDataURL(file);
            }
        }
    }
};

const removeImage = (index) => {
    images.value.splice(index, 1);
};

const adjustHeight = () => {
    if (textareaRef.value) {
        textareaRef.value.style.height = 'auto';
        textareaRef.value.style.height = Math.min(textareaRef.value.scrollHeight, 200) + 'px';
    }
};

// 组件挂载时添加粘贴事件监听
onMounted(() => {
    if (textareaRef.value) {
        textareaRef.value.addEventListener('paste', handlePaste);
    }
});

// 组件卸载时移除事件监听
onUnmounted(() => {
    if (textareaRef.value) {
        textareaRef.value.removeEventListener('paste', handlePaste);
    }
});

watch(input, adjustHeight);
</script>

<template>
    <div class="absolute bottom-0 left-0 w-full bg-gradient-to-t from-white via-white to-transparent pt-8 px-6 md:px-4">
        <div class="max-w-4xl mx-auto pb-3 md:pb-5 flex flex-col gap-2">

            <!-- Main Input Container -->
            <div class="relative flex flex-col w-full bg-white border-2 border-chatgpt-border rounded-3xl shadow-elevated transition-all duration-300 focus-within:border-chatgpt-accent focus-within:shadow-xl">

                <!-- Image Previews Above Input -->
                <div v-if="images.length > 0" class="flex flex-wrap gap-3 p-4 border-b border-chatgpt-border/40">
                    <div v-for="(img, idx) in images" :key="idx" class="relative w-24 h-24 group">
                        <img :src="img" class="w-full h-full object-cover rounded-2xl border-2 border-chatgpt-border shadow-card" />
                        <button
                            @click="removeImage(idx)"
                            class="absolute -top-2 -right-2 bg-gray-900 hover:bg-red-500 text-white rounded-full p-1.5 shadow-elevated opacity-0 group-hover:opacity-100 transition-all duration-200"
                            aria-label="删除图片"
                        >
                            <X :size="14" />
                        </button>
                    </div>
                    <div v-if="images.length < MAX_IMAGES" class="w-24 h-24 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-xs text-center px-2">
                        可粘贴<br />{{ MAX_IMAGES - images.length }} 张
                    </div>
                </div>

                <!-- Input Row -->
                <div class="flex items-end gap-2 p-2 px-4 md:px-5">
                    <textarea
                        ref="textareaRef"
                        v-model="input"
                        rows="1"
                        :placeholder="images.length > 0 ? `描述图片内容或提问...` : `给 ${displayName} 发消息... (可粘贴图片)`"
                        @keydown.enter.prevent="handleSend"
                        class="flex-1 resize-none border-0 bg-transparent p-3 md:p-3.5 focus:ring-0 focus:outline-none text-chatgpt-text placeholder-gray-400 text-[15px] max-h-48 custom-scrollbar leading-relaxed"
                        :disabled="disabled"
                    ></textarea>

                    <button
                        @click="handleSend"
                        :disabled="(!input.trim() && images.length === 0) || disabled"
                        class="mb-1.5 p-2.5 rounded-xl transition-all duration-200 shadow-card"
                        :class="input.trim() || images.length > 0 ? 'bg-chatgpt-accent hover:bg-emerald-600 text-white hover:shadow-elevated hover:scale-105' : 'bg-gray-100 text-gray-300 cursor-not-allowed'"
                    >
                        <Send :size="20" />
                    </button>
                </div>
            </div>

            <p class="text-xs text-center text-chatgpt-subtext mt-1 px-4">
                {{ displayName }} 可能会出错。请核对重要信息。{{ images.length === 0 ? ' 支持粘贴图片 (Ctrl+V)' : '' }}
            </p>
        </div>
    </div>
</template>

<style scoped>
textarea::-webkit-scrollbar {
    width: 6px;
}
textarea::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.1);
    border-radius: 10px;
}
textarea::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.2);
}
</style>
