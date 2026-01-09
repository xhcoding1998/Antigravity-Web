<template>
    <div class="relative" ref="dropdownRef">
        <!-- 触发按钮 -->
        <button
            @click="toggleDropdown"
            :class="[
                'w-full bg-white dark:bg-chatgpt-dark-input border-2 rounded-xl py-2 pl-3 pr-9 text-sm font-medium appearance-none cursor-pointer transition-all duration-200 focus:outline-none shadow-card dark:shadow-dark-card truncate text-left',
                isOpen
                    ? 'border-chatgpt-accent dark:border-chatgpt-dark-accent'
                    : 'border-chatgpt-border dark:border-chatgpt-dark-border hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-chatgpt-dark-user',
                isEmpty ? 'text-gray-400 dark:text-gray-500' : 'text-chatgpt-text dark:text-chatgpt-dark-text'
            ]"
        >
            {{ displayText }}
        </button>

        <!-- 下拉箭头 -->
        <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400 dark:text-gray-500">
            <ChevronDown :size="14" :class="{ 'rotate-180': isOpen }" class="transition-transform duration-200" />
        </div>

        <!-- 下拉菜单 -->
        <Transition name="dropdown">
            <div
                v-if="isOpen"
                :class="[
                    'absolute left-0 right-0 bg-white dark:bg-chatgpt-dark-input border-2 border-chatgpt-border dark:border-chatgpt-dark-border rounded-xl shadow-elevated dark:shadow-dark-elevated overflow-hidden z-50 flex flex-col',
                    dropdownPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
                ]"
                style="max-height: 320px;"
            >
                <!-- 搜索框 -->
                <div class="p-2 border-b border-gray-100 dark:border-chatgpt-dark-border bg-gray-50 dark:bg-chatgpt-dark-sidebar sticky top-0 z-10">
                    <div class="relative">
                        <input
                            ref="searchInputRef"
                            v-model="searchQuery"
                            type="text"
                            class="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-chatgpt-dark-border bg-white dark:bg-chatgpt-dark-input text-gray-900 dark:text-chatgpt-dark-text focus:border-chatgpt-accent focus:ring-1 focus:ring-chatgpt-accent/50 outline-none transition-colors placeholder:text-gray-400 dark:placeholder:text-gray-500"
                            placeholder="搜索..."
                            @click.stop
                        />
                        <Search :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
                    </div>
                </div>

                <!-- 空状态 -->
                <div v-if="isEmpty" class="px-4 py-6 text-center">
                    <p class="text-sm text-gray-400 dark:text-gray-500">{{ emptyText }}</p>
                </div>

                <!-- 无搜索结果 -->
                <div v-else-if="isNoResults" class="px-4 py-8 text-center">
                    <p class="text-sm text-gray-400 dark:text-gray-500">未找到相关结果</p>
                </div>

                <!-- 选项列表 -->
                <div v-else class="overflow-y-auto flex-1">
                    <button
                        v-for="option in filteredOptions"
                        :key="option.value"
                        @click="selectOption(option)"
                        :class="[
                            'w-full px-4 py-2.5 text-left text-sm transition-colors',
                            modelValue === option.value
                                ? 'bg-chatgpt-accent/10 dark:bg-chatgpt-dark-accent/20 text-chatgpt-accent dark:text-chatgpt-dark-accent font-medium'
                                : 'text-chatgpt-text dark:text-chatgpt-dark-text hover:bg-gray-50 dark:hover:bg-chatgpt-dark-user'
                        ]"
                    >
                        <div class="flex flex-col">
                            <div class="flex items-center justify-between">
                                <span class="truncate">{{ option.label }}</span>
                                <span v-if="option.badge" class="text-xs text-gray-500 dark:text-gray-400 ml-2 shrink-0">
                                    {{ option.badge }}
                                </span>
                            </div>
                            <!-- 显示模型ID -->
                            <span class="text-xs text-gray-400 dark:text-gray-500 mt-0.5 font-mono">
                                {{ option.value }}
                            </span>
                        </div>
                    </button>
                </div>
            </div>
        </Transition>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { ChevronDown, Search } from 'lucide-vue-next';

const props = defineProps({
    modelValue: {
        type: String,
        default: ''
    },
    options: {
        type: Array,
        default: () => []
    },
    placeholder: {
        type: String,
        default: '请选择'
    },
    emptyText: {
        type: String,
        default: '暂无数据'
    }
});

const emit = defineEmits(['update:modelValue']);

const isOpen = ref(false);
const dropdownRef = ref(null);
const dropdownPosition = ref('bottom'); // 'bottom' 或 'top'
const searchQuery = ref('');
const searchInputRef = ref(null);

// 过滤选项
const filteredOptions = computed(() => {
    if (!searchQuery.value) return props.options;
    const query = searchQuery.value.toLowerCase();
    return props.options.filter(option =>
        option.label.toLowerCase().includes(query) ||
        (option.value && option.value.toLowerCase().includes(query))
    );
});

const isEmpty = computed(() => !props.options || props.options.length === 0);
const isNoResults = computed(() => !isEmpty.value && filteredOptions.value.length === 0);

const displayText = computed(() => {
    if (isEmpty.value) {
        return props.emptyText;
    }

    const selected = props.options.find(opt => opt.value === props.modelValue);
    return selected ? selected.label : props.placeholder;
});

// 检测下拉菜单应该向上还是向下展开
const checkDropdownPosition = () => {
    if (!dropdownRef.value) return;

    const rect = dropdownRef.value.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    // 下拉菜单的最大高度（max-h-64 = 16rem = 256px + search bar ~40px = ~300px）
    // 稍微增加一点余量
    const dropdownMaxHeight = 320;

    // 如果下方空间不足，且上方空间更多，则向上展开
    if (spaceBelow < dropdownMaxHeight && spaceAbove > spaceBelow) {
        dropdownPosition.value = 'top';
    } else {
        dropdownPosition.value = 'bottom';
    }
};

// 滚动到当前选中的选项
const scrollToSelected = () => {
    if (!props.modelValue || !dropdownRef.value) return;

    const listContainer = dropdownRef.value.querySelector('.overflow-y-auto');
    if (!listContainer) return;

    // 找到选中项的索引（在过滤后的列表中）
    const selectedIndex = filteredOptions.value.findIndex(opt => opt.value === props.modelValue);

    if (selectedIndex !== -1) {
        // 等待DOM更新，确保列表渲染完成
        setTimeout(() => {
            const options = listContainer.querySelectorAll('button');
            if (options[selectedIndex]) {
                options[selectedIndex].scrollIntoView({ block: 'center', behavior: 'auto' });
            }
        }, 0);
    }
};

const toggleDropdown = async () => {
    if (!isEmpty.value) {
        isOpen.value = !isOpen.value;

        if (isOpen.value) {
            // 重置搜索
            searchQuery.value = '';

            await nextTick();
            checkDropdownPosition();
            scrollToSelected();

            // 聚焦搜索框
            if (searchInputRef.value) {
                searchInputRef.value.focus();
            }
        }
    }
};

const selectOption = (option) => {
    emit('update:modelValue', option.value);
    isOpen.value = false;
};

// 点击外部关闭下拉菜单
const handleClickOutside = (event) => {
    if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
        isOpen.value = false;
    }
};

// 监听窗口大小变化，重新计算位置
const handleResize = () => {
    if (isOpen.value) {
        checkDropdownPosition();
    }
};

onMounted(() => {
    document.addEventListener('click', handleClickOutside);
    window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
    window.removeEventListener('resize', handleResize);
});
</script>

<style scoped>
.dropdown-enter-active,
.dropdown-leave-active {
    transition: all 0.2s ease;
}

.dropdown-enter-from {
    opacity: 0;
    transform: translateY(-8px);
}

.dropdown-leave-to {
    opacity: 0;
    transform: translateY(-4px);
}
</style>
