<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { X, Plus, Trash2, Edit2, Save, RotateCcw, AlertCircle, HardDrive, RefreshCw, Database } from 'lucide-vue-next';
import Toast from './Toast.vue';
import ConfirmDialog from './ConfirmDialog.vue';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';

const props = defineProps({
    modelGroups: Array,          // 所有模型分组
    currentGroupId: String,      // 当前选中的分组ID
    models: Array,               // 当前分组的模型（computed from parent）
    apiConfig: Object,           // 当前分组的API配置（computed from parent）
    dataRetention: Number,
    selectedModelId: String,
    getStorageInfo: Function,
    history: Array,
    codeTheme: String,
    refreshModels: Function,     // 新增：刷新模型函数
    syncModelsFromApi: Function, // 新增：同步模型函数
    createApiConfig: Function,   // 新增：创建API配置
    deleteApiConfig: Function    // 新增：删除API配置
});

const emit = defineEmits([
    'close',
    'update:models',
    'update:apiConfig',
    'update:dataRetention',
    'update:codeTheme',
    'update:currentGroupId',     // 新增：切换分组
    'update:groupModels',        // 新增：更新分组模型
    'update:groupApiConfig',     // 新增：更新分组API配置
    'resetAll',
    'clearHistory'
]);

// 存储信息
const storageInfo = ref(null);
const isLoadingStorage = ref(false);

// 计算详细统计
const detailedStats = computed(() => {
    if (!props.history) return null;

    const totalChats = props.history.length;
    const totalMessages = props.history.reduce((sum, chat) => sum + (chat.messages?.length || 0), 0);

    // 估算数据大小（粗略估计）
    const estimatedSize = JSON.stringify(props.history).length / (1024 * 1024);

    return {
        totalChats,
        totalMessages,
        estimatedSize: estimatedSize.toFixed(2)
    };
});

// 获取存储信息
const loadStorageInfo = async () => {
    if (props.getStorageInfo) {
        isLoadingStorage.value = true;
        try {
            storageInfo.value = await props.getStorageInfo();
        } catch (e) {
            console.error('获取存储信息失败:', e);
        } finally {
            isLoadingStorage.value = false;
        }
    }
};

// 刷新存储信息
const refreshStorageInfo = async () => {
    await loadStorageInfo();
    showToastMessage('存储信息已刷新', 'success');
};

onMounted(() => {
    loadStorageInfo();
});

// 标签页
const activeTab = ref('models');

// 分组选择器
const selectedGroupId = ref(props.currentGroupId || 'local');

// 切换分组
const switchGroup = (groupId) => {
    selectedGroupId.value = groupId;
    emit('update:currentGroupId', groupId);
    // 切换分组后重新加载该分组的数据
    const group = props.modelGroups?.find(g => g.id === groupId);
    if (group) {
        localModels.value = [...group.models];
        localApiConfig.value = { ...group.apiConfig };
    }
};

// 当前分组信息
const currentGroup = computed(() => {
    return props.modelGroups?.find(g => g.id === selectedGroupId.value);
});

// 更新分组API配置字段
const updateGroupApiConfigField = (groupId, field, value) => {
    const group = props.modelGroups?.find(g => g.id === groupId);
    if (group) {
        group.apiConfig[field] = value;
        // 如果是当前分组，同时更新localApiConfig
        if (groupId === selectedGroupId.value) {
            localApiConfig.value[field] = value;
        }
    }
};

// 模型管理
const localModels = ref([...props.models]);
const editingModelId = ref(null);
const editingModel = ref(null);

// API配置
const localApiConfig = ref({
    baseUrl: props.apiConfig?.baseUrl || '',
    endpoint: props.apiConfig?.endpoint || '/v1/chat/completions',
    apiKey: props.apiConfig?.apiKey || ''
});

// 监听props变化，同步到本地状态
watch(() => props.models, (newModels) => {
    if (newModels) {
        localModels.value = [...newModels];
    }
}, { deep: true });

watch(() => props.apiConfig, (newConfig) => {
    if (newConfig) {
        localApiConfig.value = { ...newConfig };
    }
}, { deep: true });

// 数据保存时间
const localDataRetention = ref(props.dataRetention || 7);

// 代码主题
const localCodeTheme = ref(props.codeTheme || 'vscode');
const codeThemes = [
    { id: 'vscode', name: 'VSCode', desc: 'Visual Studio Code 经典深色主题' },
    { id: 'github', name: 'GitHub', desc: 'GitHub 深色风格代码主题' },
    { id: 'jetbrains', name: 'JetBrains', desc: 'Android Studio / IntelliJ 深色主题' }
];

// 监听 localCodeTheme 变化,实时更新预览
const previewCodeTheme = ref(localCodeTheme.value);
watch(localCodeTheme, (newTheme) => {
    previewCodeTheme.value = newTheme;
});

// 注册 highlight.js 语言
hljs.registerLanguage('javascript', javascript);

// 示例代码
const sampleCode = `function hello() {
  console.log('Hello World!');
}`;

// 计算高亮后的代码
const highlightedCode = computed(() => {
    try {
        return hljs.highlight(sampleCode, { language: 'javascript' }).value;
    } catch (e) {
        return sampleCode;
    }
});

// 动态加载代码主题样式
const loadCodeTheme = async (theme) => {
    // 移除旧的样式
    const oldStyle = document.getElementById('hljs-theme-preview');
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
    link.id = 'hljs-theme-preview';
    link.rel = 'stylesheet';
    link.href = `https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/${themeFile}.min.css`;
    document.head.appendChild(link);
};

// 监听主题变化并加载相应样式
watch(localCodeTheme, (newTheme) => {
    if (newTheme) {
        loadCodeTheme(newTheme);
    }
}, { immediate: true }); // 立即执行以加载初始主题

// Toast 提示
const showToast = ref(false);
const toastMessage = ref('');
const toastType = ref('info');

// 确认对话框
const showConfirm = ref(false);
const confirmConfig = ref({
    title: '',
    message: '',
    type: 'warning',
    onConfirm: null
});

const showToastMessage = (message, type = 'error') => {
    toastMessage.value = message;
    toastType.value = type;
    showToast.value = true;
};

const showConfirmDialog = (title, message, type, onConfirm) => {
    confirmConfig.value = { title, message, type, onConfirm };
    showConfirm.value = true;
};

const handleConfirm = () => {
    if (confirmConfig.value.onConfirm) {
        confirmConfig.value.onConfirm();
    }
};

// 添加新模型
const showAddModel = ref(false);
const newModel = ref({
    id: '',
    name: '',
    desc: ''
});

const startAddModel = () => {
    newModel.value = { id: '', name: '', desc: '' };
    showAddModel.value = true;

    // 自动滚动到新增表单
    nextTick(() => {
        setTimeout(() => {
            // 方法1: 尝试滚动到表单元素
            if (addModelFormRef.value) {
                addModelFormRef.value.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }

            // 方法2: 同时滚动容器到底部（确保表单可见）
            const contentArea = document.querySelector('.flex-1.overflow-y-auto');
            if (contentArea) {
                setTimeout(() => {
                    contentArea.scrollTo({
                        top: contentArea.scrollHeight,
                        behavior: 'smooth'
                    });
                }, 50);
            }
        }, 150);
    });
};

const addModel = () => {
    if (!newModel.value.id || !newModel.value.name) {
        showToastMessage('请填写模型ID和名称');
        return;
    }

    if (localModels.value.some(m => m.id === newModel.value.id)) {
        showToastMessage('模型ID已存在');
        return;
    }

    localModels.value.push({ ...newModel.value });
    showAddModel.value = false;
    newModel.value = { id: '', name: '', desc: '' };
    showToastMessage('模型添加成功', 'success');
};

// 编辑模型
const startEditModel = (model) => {
    editingModelId.value = model.id;
    editingModel.value = { ...model };
};

const saveEditModel = () => {
    const index = localModels.value.findIndex(m => m.id === editingModelId.value);
    if (index !== -1) {
        localModels.value[index] = { ...editingModel.value };
    }
    editingModelId.value = null;
    editingModel.value = null;
    showToastMessage('模型更新成功', 'success');
};

const cancelEdit = () => {
    editingModelId.value = null;
    editingModel.value = null;
};

// 删除模型
const deleteModel = (id) => {
    if (localModels.value.length <= 1) {
        showToastMessage('至少需要保留一个模型');
        return;
    }

    // 检查是否是当前选中的模型
    if (id === props.selectedModelId) {
        showToastMessage('不能删除当前选中的模型，请先切换到其他模型');
        return;
    }

    showConfirmDialog(
        '删除模型',
        '确定要删除这个模型吗？',
        'danger',
        () => {
            localModels.value = localModels.value.filter(m => m.id !== id);
            showToastMessage('模型已删除', 'success');
        }
    );
};

// 保存设置并关闭
const saveSettings = () => {
    try {
        // 1. 同步模型组数据
        if (props.modelGroups) {
            props.modelGroups.forEach(group => {
                let modelsToSave;
                let configToSave;

                if (group.id === selectedGroupId.value) {
                    // 当前正在编辑的分组，使用本地状态
                    modelsToSave = JSON.parse(JSON.stringify(localModels.value));
                    configToSave = JSON.parse(JSON.stringify(localApiConfig.value));
                } else {
                    // 其他分组，使用 props 中的数据（可能已经在 API 标签页被修改）
                    modelsToSave = JSON.parse(JSON.stringify(group.models));
                    configToSave = JSON.parse(JSON.stringify(group.apiConfig));
                }

                // 确保 endpoint 格式正确（如果存在）
                if (configToSave.endpoint && !configToSave.endpoint.startsWith('/')) {
                    configToSave.endpoint = '/' + configToSave.endpoint;
                }

                emit('update:groupModels', { groupId: group.id, models: modelsToSave });
                emit('update:groupApiConfig', { groupId: group.id, config: configToSave });
            });
        }

        // 2. 保存通用设置
        emit('update:dataRetention', localDataRetention.value);
        emit('update:codeTheme', localCodeTheme.value);

        // showToastMessage('设置已保存', 'success'); // 用户请求移除
    } catch (error) {
        console.error('保存设置时出错:', error);
        // showToastMessage('保存失败: ' + error.message);
    } finally {
        emit('close');
    }
};

const closeSettings = saveSettings;

// 恢复默认设置 (重置配置)
const confirmResetSettings = () => {
    showConfirmDialog(
        '重置系统配置',
        '确定要重置所有系统配置吗？这将恢复默认设置，但不会删除对话历史。',
        'warning',
        () => {
            emit('resetAll');
            // emit('close'); // 用户可能想留在设置页
            setTimeout(() => {
                loadStorageInfo();
            }, 500);
            showToastMessage('配置已重置', 'success');
        }
    );
};

// 恢复默认设置（代码主题）
const resetToDefaults = () => {
    showConfirmDialog(
        '恢复默认主题',
        '确定要恢复默认代码主题吗？',
        'warning',
        () => {
            localCodeTheme.value = 'github-dark';
            showToastMessage('已恢复默认主题', 'success');
        }
    );
};

// 清空对话历史
const confirmClearHistory = () => {
    showConfirmDialog(
        '清空对话历史',
        '确定要清空所有对话历史吗？此操作无法撤销。',
        'danger',
        () => {
            emit('clearHistory'); // 这通常只清空历史
            setTimeout(() => {
                loadStorageInfo();
            }, 500);
            showToastMessage('对话历史已清空', 'success');
        }
    );
};

// 手动清空所有数据 (历史 + 配置)
const handleClearAllData = () => {
    showConfirmDialog(
        '清空所有数据',
        '⚠️ 此操作将删除所有对话历史记录和自定义配置，且无法恢复！\n\n确定要继续吗？',
        'danger',
        () => {
            emit('clearHistory');
            emit('resetAll');
            setTimeout(() => {
                loadStorageInfo();
            }, 500);
            showToastMessage('所有数据已清空', 'success');
        }
    );
};

// 刷新模型
const isRefreshingModels = ref(false);
const handleRefreshModels = async () => {
    if (!props.refreshModels || isRefreshingModels.value) return;

    isRefreshingModels.value = true;
    try {
        const result = await props.refreshModels(selectedGroupId.value);

        if (result.success) {
            // 刷新成功，更新本地模型列表
            if (result.models) {
                localModels.value = [...result.models];
            }
            showToastMessage(`成功刷新 ${result.models?.length || 0} 个模型`, 'success');
        } else {
            // 刷新失败，显示错误
            showToastMessage(result.error || '刷新模型失败', 'error');
        }
    } catch (error) {
        console.error('刷新模型失败:', error);
        showToastMessage(error.message || '刷新模型失败', 'error');
    } finally {
        isRefreshingModels.value = false;
    }
};

const sortedModelGroups = computed(() => {
    if (!props.modelGroups) return [];
    return [...props.modelGroups].sort((a, b) => {
        if (a.id === selectedGroupId.value) return -1;
        if (b.id === selectedGroupId.value) return 1;
        return 0;
    });
});

// 新增API配置
const showAddApiConfig = ref(false);
const isCreatingApiConfig = ref(false);
const addApiConfigFormRef = ref(null);
const newApiConfig = ref({
    name: '',
    description: '',
    apiAdapter: 'openai',
    baseUrl: '',
    endpoint: '/v1/chat/completions',
    apiKey: ''
});

// 添加模型表单引用
const addModelFormRef = ref(null);

const startAddApiConfig = () => {
    newApiConfig.value = {
        name: '',
        description: '',
        apiAdapter: 'openai',
        baseUrl: '',
        endpoint: '/v1/chat/completions',
        apiKey: ''
    };
    showAddApiConfig.value = true;

    // 自动滚动到新增表单
    nextTick(() => {
        setTimeout(() => {
            if (addApiConfigFormRef.value) {
                addApiConfigFormRef.value.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);
    });
};

const handleCreateApiConfig = async () => {
    if (!newApiConfig.value.name || !newApiConfig.value.baseUrl || !newApiConfig.value.apiKey) {
        showToastMessage('请填写配置名称、API地址和密钥', 'error');
        return;
    }

    if (!props.createApiConfig) return;

    isCreatingApiConfig.value = true;
    try {
        const result = await props.createApiConfig(newApiConfig.value);

        if (result.success) {
            showAddApiConfig.value = false;

            if (result.models && result.models.length > 0) {
                showToastMessage(`成功创建API配置并同步 ${result.models.length} 个模型`, 'success');
            } else if (result.error) {
                showToastMessage(`API配置已创建，但模型同步失败：${result.error}`, 'warning');
            } else {
                showToastMessage('API配置已创建', 'success');
            }

            // 切换到新创建的分组
            if (result.groupId) {
                switchGroup(result.groupId);
            }
        } else {
            showToastMessage(result.error || '创建API配置失败', 'error');
        }
    } catch (error) {
        console.error('创建API配置失败:', error);
        showToastMessage(error.message || '创建API配置失败', 'error');
    } finally {
        isCreatingApiConfig.value = false;
    }
};

// 删除API配置
const handleDeleteApiConfig = (groupId) => {
    const group = props.modelGroups?.find(g => g.id === groupId);
    if (!group) return;

    if (!group.isCustom) {
        showToastMessage('不能删除预设分组', 'error');
        return;
    }

    showConfirmDialog(
        '删除API配置',
        `确定要删除 "${group.name}" 吗？此操作将删除该配置及其缓存的模型列表。`,
        'danger',
        async () => {
            if (!props.deleteApiConfig) return;

            const result = await props.deleteApiConfig(groupId);
            if (result.success) {
                showToastMessage('API配置已删除', 'success');
            } else {
                showToastMessage(result.error || '删除失败', 'error');
            }
        }
    );
};

</script>

<template>
    <!-- 模态框背景 -->
    <div
        class="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm transition-colors duration-200"
    >
        <!-- 设置面板 -->
        <Transition name="modal-content">
            <div class="bg-white dark:bg-chatgpt-dark-sidebar rounded-2xl shadow-2xl dark:shadow-dark-elevated w-full max-w-3xl max-h-[85vh] flex flex-col transition-colors duration-200 dark:border-2 dark:border-chatgpt-dark-border overflow-hidden" @keydown.esc="closeSettings">
                    <!-- 头部 -->
                    <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-chatgpt-dark-border transition-colors duration-200">
                        <h2 class="text-2xl font-bold text-gray-900 dark:text-chatgpt-dark-text">设置</h2>
                        <button
                            @click="closeSettings"
                            class="p-2 hover:bg-gray-100 dark:hover:bg-chatgpt-dark-user rounded-lg transition-colors"
                            aria-label="关闭"
                        >
                            <X :size="24" class="text-gray-700 dark:text-chatgpt-dark-text" />
                        </button>
                    </div>

            <!-- 标签页导航 -->
            <div class="flex border-b border-gray-200 dark:border-chatgpt-dark-border px-6 transition-colors duration-200">
                <button
                    @click="activeTab = 'models'"
                    :class="[
                        'px-4 py-3 text-sm font-medium transition-colors relative',
                        activeTab === 'models'
                            ? 'text-chatgpt-accent dark:text-chatgpt-dark-accent'
                            : 'text-gray-600 dark:text-chatgpt-dark-subtext hover:text-gray-900 dark:hover:text-chatgpt-dark-text'
                    ]"
                >
                    模型管理
                    <div
                        v-if="activeTab === 'models'"
                        class="absolute bottom-0 left-0 right-0 h-0.5 bg-chatgpt-accent dark:bg-chatgpt-dark-accent"
                    ></div>
                </button>
                <button
                    @click="activeTab = 'api'"
                    :class="[
                        'px-4 py-3 text-sm font-medium transition-colors relative',
                        activeTab === 'api'
                            ? 'text-chatgpt-accent dark:text-chatgpt-dark-accent'
                            : 'text-gray-600 dark:text-chatgpt-dark-subtext hover:text-gray-900 dark:hover:text-chatgpt-dark-text'
                    ]"
                >
                    API配置
                    <div
                        v-if="activeTab === 'api'"
                        class="absolute bottom-0 left-0 right-0 h-0.5 bg-chatgpt-accent dark:bg-chatgpt-dark-accent"
                    ></div>
                </button>
                <button
                    @click="activeTab = 'data'"
                    :class="[
                        'px-4 py-3 text-sm font-medium transition-colors relative',
                        activeTab === 'data'
                            ? 'text-chatgpt-accent dark:text-chatgpt-dark-accent'
                            : 'text-gray-600 dark:text-chatgpt-dark-subtext hover:text-gray-900 dark:hover:text-chatgpt-dark-text'
                    ]"
                >
                    数据管理
                    <div
                        v-if="activeTab === 'data'"
                        class="absolute bottom-0 left-0 right-0 h-0.5 bg-chatgpt-accent dark:bg-chatgpt-dark-accent"
                    ></div>
                </button>
                <button
                    @click="activeTab = 'appearance'"
                    :class="[
                        'px-4 py-3 text-sm font-medium transition-colors relative',
                        activeTab === 'appearance'
                            ? 'text-chatgpt-accent dark:text-chatgpt-dark-accent'
                            : 'text-gray-600 dark:text-chatgpt-dark-subtext hover:text-gray-900 dark:hover:text-chatgpt-dark-text'
                    ]"
                >
                    外观设置
                    <div
                        v-if="activeTab === 'appearance'"
                        class="absolute bottom-0 left-0 right-0 h-0.5 bg-chatgpt-accent dark:bg-chatgpt-dark-accent"
                    ></div>
                </button>
            </div>

            <!-- 内容区域 -->
            <div class="flex-1 overflow-y-auto p-6">
                <!-- 模型管理标签页 -->
                <div v-if="activeTab === 'models'" class="space-y-4">
                    <!-- 分组选择器 -->
                    <div class="bg-gray-50 dark:bg-chatgpt-dark-user/30 rounded-xl p-4 border border-gray-200 dark:border-chatgpt-dark-border">
                        <h3 class="text-sm font-semibold text-gray-700 dark:text-chatgpt-dark-text mb-3">模型分组</h3>

                        <!-- 空状态提示 -->
                        <div v-if="!modelGroups || modelGroups.length === 0" class="text-center">
                            <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">暂无配置</p>
                        </div>

                        <!-- 分组按钮列表 -->
                        <div v-else class="flex gap-2">
                            <button
                                v-for="group in modelGroups"
                                :key="group.id"
                                @click="switchGroup(group.id)"
                                :class="[
                                    'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                                    selectedGroupId === group.id
                                        ? 'bg-chatgpt-accent dark:bg-chatgpt-dark-accent text-white shadow-sm'
                                        : 'bg-white dark:bg-chatgpt-dark-main text-gray-700 dark:text-chatgpt-dark-subtext hover:bg-gray-100 dark:hover:bg-chatgpt-dark-user border border-gray-200 dark:border-chatgpt-dark-border'
                                ]"
                            >
                                <div class="flex flex-col items-center">
                                    <span class="font-semibold">{{ group.name }}</span>
                                    <span class="text-xs opacity-75 mt-0.5">{{ group.models?.length || 0 }} 个模型</span>
                                </div>
                            </button>
                        </div>
                        <p v-if="currentGroup" class="text-xs text-gray-500 dark:text-gray-400 mt-3">
                            {{ currentGroup?.description || '' }}
                        </p>
                    </div>

                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <p class="text-sm text-gray-600 dark:text-chatgpt-dark-subtext">管理您的AI模型列表</p>
                            <p class="text-xs text-gray-400 dark:text-gray-500 dark:text-gray-400 mt-1">共 {{ localModels.length }} 个模型</p>
                        </div>
                        <div class="flex gap-2">
                            <button
                                @click="handleRefreshModels"
                                :disabled="isRefreshingModels"
                                class="flex items-center gap-2 px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm hover:shadow-md dark:shadow-dark-card dark:hover:shadow-dark-elevated disabled:opacity-50 disabled:cursor-not-allowed"
                                title="从API刷新模型列表"
                            >
                                <RefreshCw :size="16" :class="{ 'animate-spin': isRefreshingModels }" />
                                {{ isRefreshingModels ? '刷新中...' : '刷新模型' }}
                            </button>
                            <button
                                @click="startAddModel"
                                class="flex items-center gap-2 px-4 py-2 bg-chatgpt-accent dark:bg-chatgpt-dark-accent text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-500 transition-colors text-sm font-medium shadow-sm hover:shadow-md dark:shadow-dark-card dark:hover:shadow-dark-elevated"
                            >
                                <Plus :size="16" />
                                添加模型
                            </button>
                        </div>
                    </div>

                    <!-- 空状态提示 - 无分组 -->
                    <div v-if="!modelGroups || modelGroups.length === 0" class="text-center py-10">
                        <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 dark:bg-chatgpt-dark-user mb-4">
                            <AlertCircle :size="40" class="text-gray-400 dark:text-gray-500" />
                        </div>
                        <h3 class="text-lg font-semibold text-gray-900 dark:text-chatgpt-dark-text mb-2">暂无API配置</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                            请先在"API配置"标签页创建API配置，然后系统会自动获取模型列表。
                        </p>
                        <button
                            @click="activeTab = 'api'"
                            class="inline-flex items-center gap-2 px-6 py-3 bg-chatgpt-accent dark:bg-chatgpt-dark-accent text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-500 transition-colors text-sm font-medium shadow-sm hover:shadow-md"
                        >
                            前往创建API配置
                        </button>
                    </div>

                    <!-- 空状态提示 - 有分组但无模型 -->
                    <div v-else-if="localModels.length === 0" class="text-center py-10">
                        <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 dark:bg-chatgpt-dark-user mb-4">
                            <Database :size="40" class="text-gray-400 dark:text-gray-500" />
                        </div>
                        <h3 class="text-lg font-semibold text-gray-900 dark:text-chatgpt-dark-text mb-2">暂无模型</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                            当前分组还没有模型。请点击"刷新模型"从API获取模型列表，或手动添加模型。
                        </p>
                        <div class="flex gap-3 justify-center">
                            <button
                                @click="handleRefreshModels"
                                :disabled="isRefreshingModels"
                                class="inline-flex items-center gap-2 px-6 py-3 bg-blue-500 dark:bg-blue-600 text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <RefreshCw :size="18" :class="{ 'animate-spin': isRefreshingModels }" />
                                {{ isRefreshingModels ? '刷新中...' : '刷新模型' }}
                            </button>
                            <button
                                @click="startAddModel"
                                class="inline-flex items-center gap-2 px-6 py-3 bg-chatgpt-accent dark:bg-chatgpt-dark-accent text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-500 transition-colors text-sm font-medium shadow-sm hover:shadow-md"
                            >
                                <Plus :size="18" />
                                手动添加模型
                            </button>
                        </div>
                    </div>

                    <!-- 模型列表 -->
                    <div v-else class="space-y-3">
                        <div
                            v-for="model in localModels"
                            :key="model.id"
                            :class="[
                                'border rounded-xl p-4 hover:shadow-sm dark:hover:shadow-dark-card transition-all',
                                model.id === props.selectedModelId
                                    ? 'border-chatgpt-accent dark:border-chatgpt-dark-accent bg-gradient-to-br from-blue-50 to-indigo-50/50 dark:from-blue-900/20 dark:to-indigo-900/10 shadow-sm dark:shadow-dark-card'
                                    : 'border-gray-200 dark:border-chatgpt-dark-border bg-gradient-to-br from-white to-gray-50/50 dark:from-chatgpt-dark-main dark:to-chatgpt-dark-user/30 hover:border-chatgpt-accent/50 dark:hover:border-chatgpt-dark-accent/50'
                            ]"
                        >
                            <div v-if="editingModelId === model.id" class="space-y-3">
                                <div>
                                    <label class="block text-xs font-semibold text-gray-600 dark:text-chatgpt-dark-subtext mb-1">模型ID</label>
                                    <input
                                        v-model="editingModel.id"
                                        disabled
                                        class="w-full px-3 py-2 border border-gray-300 dark:border-chatgpt-dark-border rounded-lg dark:bg-chatgpt-dark-input dark:text-chatgpt-dark-text bg-gray-50 dark:bg-gray-700 text-sm dark:text-gray-300"
                                        placeholder="模型ID"
                                    />
                                </div>
                                <div>
                                    <label class="block text-xs font-semibold text-gray-600 dark:text-chatgpt-dark-subtext mb-1">模型名称</label>
                                    <input
                                        v-model="editingModel.name"
                                        class="w-full px-3 py-2 border border-gray-300 dark:border-chatgpt-dark-border rounded-lg dark:bg-chatgpt-dark-input dark:text-chatgpt-dark-text focus:border-chatgpt-accent focus:ring-1 focus:ring-chatgpt-accent text-sm"
                                        placeholder="模型名称"
                                    />
                                </div>
                                <div>
                                    <label class="block text-xs font-semibold text-gray-600 dark:text-chatgpt-dark-subtext mb-1">模型描述</label>
                                    <input
                                        v-model="editingModel.desc"
                                        class="w-full px-3 py-2 border border-gray-300 dark:border-chatgpt-dark-border rounded-lg dark:bg-chatgpt-dark-input dark:text-chatgpt-dark-text focus:border-chatgpt-accent focus:ring-1 focus:ring-chatgpt-accent text-sm"
                                        placeholder="模型描述"
                                    />
                                </div>
                                <div class="flex gap-2 pt-2">
                                    <button
                                        @click="saveEditModel"
                                        class="flex items-center gap-1 px-4 py-2 bg-chatgpt-accent text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
                                    >
                                        <Save :size="14" />
                                        保存
                                    </button>
                                    <button
                                        @click="cancelEdit"
                                        class="px-4 py-2 bg-gray-200 dark:bg-chatgpt-dark-user text-gray-700 dark:text-chatgpt-dark-text rounded-lg hover:bg-gray-300 dark:hover:bg-chatgpt-dark-assistant transition-colors text-sm"
                                    >
                                        取消
                                    </button>
                                </div>
                            </div>
                            <div v-else class="flex items-start justify-between gap-4">
                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-2 mb-1">
                                        <div class="font-semibold text-gray-900 dark:text-chatgpt-dark-text text-base">{{ model.name }}</div>
                                        <div class="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs text-gray-600 dark:text-gray-300 font-mono">{{ model.id }}</div>
                                        <div v-if="model.id === props.selectedModelId" class="px-2 py-0.5 bg-chatgpt-accent text-white rounded text-xs font-medium">
                                            当前使用
                                        </div>
                                    </div>
                                    <div class="text-sm text-gray-500 dark:text-gray-400">{{ model.desc || '暂无描述' }}</div>
                                </div>
                                <div class="flex gap-1 shrink-0">
                                    <button
                                        @click="startEditModel(model)"
                                        class="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                                        title="编辑"
                                    >
                                        <Edit2 :size="16" />
                                    </button>
                                    <button
                                        @click="deleteModel(model.id)"
                                        :disabled="model.id === props.selectedModelId"
                                        :class="[
                                            'p-2 rounded-lg transition-colors',
                                            model.id === props.selectedModelId
                                                ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                                                : 'hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-600 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400'
                                        ]"
                                        :title="model.id === props.selectedModelId ? '不能删除当前使用的模型' : '删除'"
                                    >
                                        <Trash2 :size="16" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 添加模型表单 -->
                    <div ref="addModelFormRef" v-if="showAddModel" class="border-2 border-dashed border-chatgpt-accent dark:border-chatgpt-dark-accent rounded-xl p-5 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 dark:from-blue-900/10 dark:to-indigo-900/10 space-y-4">
                        <div class="flex items-center justify-between mb-2">
                            <h4 class="font-semibold text-gray-900 dark:text-chatgpt-dark-text flex items-center gap-2">
                                <Plus :size="18" class="text-chatgpt-accent" />
                                添加新模型
                            </h4>
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-gray-600 dark:text-chatgpt-dark-subtext mb-1">模型ID *</label>
                            <input
                                v-model="newModel.id"
                                class="w-full px-3 py-2 border border-gray-300 dark:border-chatgpt-dark-border rounded-lg dark:bg-chatgpt-dark-input dark:text-chatgpt-dark-text focus:border-chatgpt-accent focus:ring-2 focus:ring-chatgpt-accent/20 text-sm"
                                placeholder="例如：gpt-4"
                            />
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-gray-600 dark:text-chatgpt-dark-subtext mb-1">模型名称 *</label>
                            <input
                                v-model="newModel.name"
                                class="w-full px-3 py-2 border border-gray-300 dark:border-chatgpt-dark-border rounded-lg dark:bg-chatgpt-dark-input dark:text-chatgpt-dark-text focus:border-chatgpt-accent focus:ring-2 focus:ring-chatgpt-accent/20 text-sm"
                                placeholder="例如：GPT-4"
                            />
                        </div>
                        <div>
                            <label class="block text-xs font-semibold text-gray-600 dark:text-chatgpt-dark-subtext mb-1">模型描述</label>
                            <input
                                v-model="newModel.desc"
                                class="w-full px-3 py-2 border border-gray-300 dark:border-chatgpt-dark-border rounded-lg dark:bg-chatgpt-dark-input dark:text-chatgpt-dark-text focus:border-chatgpt-accent focus:ring-2 focus:ring-chatgpt-accent/20 text-sm"
                                placeholder="例如：最强大的语言模型"
                            />
                        </div>
                        <div class="flex gap-2 pt-2">
                            <button
                                @click="addModel"
                                class="flex items-center gap-2 px-5 py-2.5 bg-chatgpt-accent text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium shadow-sm hover:shadow-md"
                            >
                                <Plus :size="16" />
                                添加
                            </button>
                            <button
                                @click="showAddModel = false"
                                class="px-5 py-2.5 bg-white dark:bg-chatgpt-dark-user border border-gray-300 dark:border-chatgpt-dark-border text-gray-700 dark:text-chatgpt-dark-text rounded-lg hover:bg-gray-50 dark:hover:bg-chatgpt-dark-assistant transition-colors text-sm"
                            >
                                取消
                            </button>
                        </div>
                    </div>
                </div>

                <!-- API配置标签页 -->
                <div v-if="activeTab === 'api'" class="space-y-6">
                    <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex gap-3">
                        <AlertCircle :size="20" class="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                        <div class="text-sm text-blue-800 dark:text-blue-200">
                            <p class="font-semibold mb-1">分组API配置</p>
                            <p>每个模型分组可以配置独立的API地址和密钥。修改后需要重新发送消息才会生效。</p>
                        </div>
                    </div>

                    <!-- 新增API配置按钮 -->
                    <div class="flex items-center justify-between mb-4">
                        <div>
                            <p class="text-sm text-gray-600 dark:text-chatgpt-dark-subtext">管理您的API配置</p>
                            <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">共 {{ modelGroups?.length || 0 }} 个配置</p>
                        </div>
                        <button
                            @click="startAddApiConfig"
                            class="flex items-center gap-2 px-4 py-2 bg-chatgpt-accent dark:bg-chatgpt-dark-accent text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-500 transition-colors text-sm font-medium shadow-sm hover:shadow-md"
                        >
                            <Plus :size="16" />
                            新增API配置
                        </button>
                    </div>

                    <!-- 空状态提示 -->
                    <div v-if="(!modelGroups || modelGroups.length === 0) && !showAddApiConfig" class="text-center py-10">
                        <div class="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 dark:bg-chatgpt-dark-user mb-4">
                            <Database :size="40" class="text-gray-400 dark:text-gray-500" />
                        </div>
                        <h3 class="text-lg font-semibold text-gray-900 dark:text-chatgpt-dark-text mb-2">暂无API配置</h3>
                        <p class="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                            您还没有创建任何API配置。点击上方"新增API配置"按钮开始创建您的第一个配置。
                        </p>
                        <button
                            @click="startAddApiConfig"
                            class="inline-flex items-center gap-2 px-6 py-3 bg-chatgpt-accent dark:bg-chatgpt-dark-accent text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-500 transition-colors text-sm font-medium shadow-sm hover:shadow-md"
                        >
                            <Plus :size="18" />
                            创建第一个API配置
                        </button>
                    </div>

                    <!-- 分组API配置列表 -->
                    <div v-else class="space-y-4">
                        <div
                            v-for="group in sortedModelGroups"
                            :key="group.id"
                            :class="[
                                'border rounded-xl p-5 transition-all duration-300',
                                selectedGroupId === group.id
                                    ? 'border-chatgpt-accent dark:border-chatgpt-dark-accent shadow-md ring-1 ring-chatgpt-accent/20 bg-chatgpt-accent/5 dark:bg-chatgpt-dark-accent/10'
                                    : 'border-gray-200 dark:border-chatgpt-dark-border bg-gradient-to-br from-white to-gray-50/50 dark:from-chatgpt-dark-main dark:to-chatgpt-dark-user/30'
                            ]"
                        >
                            <!-- 分组标题 -->
                            <div class="flex items-center justify-between mb-4">
                                <div>
                                    <h3 class="text-lg font-semibold text-gray-900 dark:text-chatgpt-dark-text">
                                        {{ group.name }}
                                    </h3>
                                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {{ group.description }}
                                    </p>
                                </div>
                                <div class="flex items-center gap-2">
                                    <span
                                        :class="[
                                            'px-3 py-1 rounded-full text-xs font-medium',
                                            selectedGroupId === group.id
                                                ? 'bg-chatgpt-accent/10 text-chatgpt-accent dark:bg-chatgpt-dark-accent/20 dark:text-chatgpt-dark-accent'
                                                : 'bg-gray-100 dark:bg-chatgpt-dark-user text-gray-600 dark:text-gray-400'
                                        ]"
                                    >
                                        {{ selectedGroupId === group.id ? '当前分组' : group.models?.length || 0 + ' 个模型' }}
                                    </span>
                                    <button
                                        v-if="group.isCustom"
                                        @click="handleDeleteApiConfig(group.id)"
                                        class="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors text-gray-600 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                                        title="删除此API配置"
                                    >
                                        <Trash2 :size="16" />
                                    </button>
                                </div>
                            </div>

                            <!-- API配置表单 -->
                            <div class="space-y-4">
                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 dark:text-chatgpt-dark-text mb-2">
                                        API基础地址 (Base URL)
                                    </label>
                                    <input
                                        :value="group.apiConfig.baseUrl"
                                        @input="updateGroupApiConfigField(group.id, 'baseUrl', $event.target.value)"
                                        type="text"
                                        class="w-full px-4 py-3 border border-gray-300 dark:border-chatgpt-dark-border rounded-lg dark:bg-chatgpt-dark-input dark:text-chatgpt-dark-text focus:border-chatgpt-accent focus:ring-2 focus:ring-chatgpt-accent/20 text-sm font-mono"
                                        placeholder="https://api.example.com"
                                    />
                                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        API服务器的基础地址（不含路径）
                                    </p>
                                </div>

                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 dark:text-chatgpt-dark-text mb-2">
                                        API端点路径 (Endpoint)
                                    </label>
                                    <input
                                        :value="group.apiConfig.endpoint || '/v1/chat/completions'"
                                        @input="updateGroupApiConfigField(group.id, 'endpoint', $event.target.value)"
                                        type="text"
                                        class="w-full px-4 py-3 border border-gray-300 dark:border-chatgpt-dark-border rounded-lg dark:bg-chatgpt-dark-input dark:text-chatgpt-dark-text focus:border-chatgpt-accent focus:ring-2 focus:ring-chatgpt-accent/20 text-sm font-mono"
                                        placeholder="/v1/chat/completions"
                                    />
                                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        API端点路径，默认为 /v1/chat/completions
                                    </p>
                                </div>

                                <div>
                                    <label class="block text-sm font-semibold text-gray-700 dark:text-chatgpt-dark-text mb-2">
                                        API密钥 (API Key)
                                    </label>
                                    <input
                                        :value="group.apiConfig.apiKey"
                                        @input="updateGroupApiConfigField(group.id, 'apiKey', $event.target.value)"
                                        type="password"
                                        class="w-full px-4 py-3 border border-gray-300 dark:border-chatgpt-dark-border rounded-lg dark:bg-chatgpt-dark-input dark:text-chatgpt-dark-text focus:border-chatgpt-accent focus:ring-2 focus:ring-chatgpt-accent/20 text-sm font-mono"
                                        placeholder="sk-..."
                                    />
                                    <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {{ group.name }} 的API访问密钥
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 新增API配置表单 -->
                    <div ref="addApiConfigFormRef" v-if="showAddApiConfig" class="border-2 border-dashed border-chatgpt-accent dark:border-chatgpt-dark-accent rounded-xl p-5 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 dark:from-blue-900/10 dark:to-indigo-900/10 space-y-4">
                        <div class="flex items-center justify-between mb-2">
                            <h4 class="font-semibold text-gray-900 dark:text-chatgpt-dark-text flex items-center gap-2">
                                <Plus :size="18" class="text-chatgpt-accent" />
                                新增API配置
                            </h4>
                        </div>

                        <div class="grid grid-cols-1 gap-4">
                            <div>
                                <label class="block text-xs font-semibold text-gray-600 dark:text-chatgpt-dark-subtext mb-1">配置名称 *</label>
                                <input
                                    v-model="newApiConfig.name"
                                    class="w-full px-3 py-2 border border-gray-300 dark:border-chatgpt-dark-border rounded-lg dark:bg-chatgpt-dark-input dark:text-chatgpt-dark-text focus:border-chatgpt-accent focus:ring-2 focus:ring-chatgpt-accent/20 text-sm"
                                    placeholder="例如：我的API"
                                />
                            </div>
                            <!-- <div>
                                <label class="block text-xs font-semibold text-gray-600 dark:text-chatgpt-dark-subtext mb-1">适配器类型</label>
                                <select
                                    v-model="newApiConfig.apiAdapter"
                                    class="w-full px-3 py-2 border border-gray-300 dark:border-chatgpt-dark-border rounded-lg dark:bg-chatgpt-dark-input dark:text-chatgpt-dark-text focus:border-chatgpt-accent focus:ring-2 focus:ring-chatgpt-accent/20 text-sm"
                                >
                                    <option value="openai">OpenAI</option>
                                </select>
                            </div> -->
                        </div>

                        <div>
                            <label class="block text-xs font-semibold text-gray-600 dark:text-chatgpt-dark-subtext mb-1">描述</label>
                            <input
                                v-model="newApiConfig.description"
                                class="w-full px-3 py-2 border border-gray-300 dark:border-chatgpt-dark-border rounded-lg dark:bg-chatgpt-dark-input dark:text-chatgpt-dark-text focus:border-chatgpt-accent focus:ring-2 focus:ring-chatgpt-accent/20 text-sm"
                                placeholder="例如：用于测试的API配置"
                            />
                        </div>

                        <div>
                            <label class="block text-xs font-semibold text-gray-600 dark:text-chatgpt-dark-subtext mb-1">API基础地址 *</label>
                            <input
                                v-model="newApiConfig.baseUrl"
                                class="w-full px-3 py-2 border border-gray-300 dark:border-chatgpt-dark-border rounded-lg dark:bg-chatgpt-dark-input dark:text-chatgpt-dark-text focus:border-chatgpt-accent focus:ring-2 focus:ring-chatgpt-accent/20 text-sm font-mono"
                                placeholder="https://api.example.com"
                            />
                        </div>

                        <div>
                            <label class="block text-xs font-semibold text-gray-600 dark:text-chatgpt-dark-subtext mb-1">API端点路径</label>
                            <input
                                v-model="newApiConfig.endpoint"
                                class="w-full px-3 py-2 border border-gray-300 dark:border-chatgpt-dark-border rounded-lg dark:bg-chatgpt-dark-input dark:text-chatgpt-dark-text focus:border-chatgpt-accent focus:ring-2 focus:ring-chatgpt-accent/20 text-sm font-mono"
                                placeholder="/v1/chat/completions"
                            />
                        </div>

                        <div>
                            <label class="block text-xs font-semibold text-gray-600 dark:text-chatgpt-dark-subtext mb-1">API密钥 *</label>
                            <input
                                v-model="newApiConfig.apiKey"
                                type="password"
                                class="w-full px-3 py-2 border border-gray-300 dark:border-chatgpt-dark-border rounded-lg dark:bg-chatgpt-dark-input dark:text-chatgpt-dark-text focus:border-chatgpt-accent focus:ring-2 focus:ring-chatgpt-accent/20 text-sm font-mono"
                                placeholder="sk-..."
                            />
                        </div>

                        <div class="flex gap-2 pt-2">
                            <button
                                @click="handleCreateApiConfig"
                                :disabled="isCreatingApiConfig"
                                class="flex items-center gap-2 px-5 py-2.5 bg-chatgpt-accent text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Plus :size="16" v-if="!isCreatingApiConfig" />
                                <RefreshCw :size="16" :class="{ 'animate-spin': isCreatingApiConfig }" v-else />
                                {{ isCreatingApiConfig ? '创建中...' : '创建并同步模型' }}
                            </button>
                            <button
                                @click="showAddApiConfig = false"
                                :disabled="isCreatingApiConfig"
                                class="px-5 py-2.5 bg-white dark:bg-chatgpt-dark-user border border-gray-300 dark:border-chatgpt-dark-border text-gray-700 dark:text-chatgpt-dark-text rounded-lg hover:bg-gray-50 dark:hover:bg-chatgpt-dark-assistant transition-colors text-sm disabled:opacity-50"
                            >
                                取消
                            </button>
                        </div>
                    </div>
                </div>

                <!-- 数据管理标签页 -->
                <div v-if="activeTab === 'data'" class="space-y-6">
                    <!-- 存储信息 -->
                    <div class="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
                        <div class="flex items-start justify-between mb-4">
                            <div class="flex items-start gap-3">
                                <Database :size="22" class="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                                <div>
                                    <p class="font-bold text-blue-900 dark:text-blue-200 text-lg mb-1">存储统计</p>
                                    <p class="text-sm text-blue-700 dark:text-blue-300">IndexedDB 本地存储，支持 500MB+ 大容量</p>
                                </div>
                            </div>
                            <button
                                @click="refreshStorageInfo"
                                :disabled="isLoadingStorage"
                                class="p-2 hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors disabled:opacity-50"
                                title="刷新存储信息"
                            >
                                <RefreshCw :size="18" :class="['text-blue-600', isLoadingStorage ? 'animate-spin' : '']" />
                            </button>
                        </div>

                        <!-- 浏览器存储配额 -->
                        <div v-if="storageInfo" class="space-y-4">
                            <div class="grid grid-cols-3 gap-3">
                                <div class="bg-white/70 dark:bg-chatgpt-dark-user/70 rounded-lg p-3 text-center border border-blue-100 dark:border-blue-800">
                                    <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">{{ storageInfo.total.usageInMB }}</div>
                                    <div class="text-xs text-gray-600 dark:text-gray-400 mt-1">已使用 (MB)</div>
                                </div>
                                <div class="bg-white/70 dark:bg-chatgpt-dark-user/70 rounded-lg p-3 text-center border border-blue-100 dark:border-blue-800">
                                    <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">{{ storageInfo.total.quotaInMB }}</div>
                                    <div class="text-xs text-gray-600 dark:text-gray-400 mt-1">总配额 (MB)</div>
                                </div>
                                <div class="bg-white/70 dark:bg-chatgpt-dark-user/70 rounded-lg p-3 text-center border border-purple-100 dark:border-purple-800">
                                    <div class="text-2xl font-bold text-purple-600 dark:text-purple-400">{{ storageInfo.total.percentUsed }}%</div>
                                    <div class="text-xs text-gray-600 dark:text-gray-400 mt-1">使用率</div>
                                </div>
                            </div>

                            <!-- 进度条 -->
                            <div class="bg-white/50 dark:bg-chatgpt-dark-user/50 rounded-lg p-3">
                                <div class="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-2">
                                    <span>存储使用进度</span>
                                    <span>{{ storageInfo.total.usageInMB }} MB / {{ storageInfo.total.quotaInMB }} MB</span>
                                </div>
                                <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2.5 overflow-hidden">
                                    <div
                                        class="h-full rounded-full transition-all duration-500"
                                        :class="[
                                            parseFloat(storageInfo.total.percentUsed) > 80 ? 'bg-red-500' :
                                            parseFloat(storageInfo.total.percentUsed) > 50 ? 'bg-yellow-500' :
                                            'bg-blue-500'
                                        ]"
                                        :style="{ width: storageInfo.total.percentUsed + '%' }"
                                    ></div>
                                </div>
                            </div>

                            <!-- 详细存储分布 -->
                            <div class="grid grid-cols-2 gap-3">
                                <!-- 对话数据 -->
                                <div class="bg-white/50 dark:bg-chatgpt-dark-user/50 rounded-lg p-3">
                                    <div class="flex items-center justify-between mb-2">
                                        <div class="text-sm font-semibold text-gray-700 dark:text-chatgpt-dark-text">对话历史</div>
                                        <span class="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded-full">{{ storageInfo.history.usageInMB }} MB</span>
                                    </div>
                                    <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                                        <span>记录数量</span>
                                        <span>{{ storageInfo.history.count }} 条</span>
                                    </div>
                                    <div class="mt-3">
                                        <button
                                            @click="confirmClearHistory"
                                            class="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white dark:bg-chatgpt-dark-user text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors text-xs font-medium"
                                        >
                                            <Trash2 :size="12" />
                                            清空对话
                                        </button>
                                    </div>
                                </div>

                                <!-- 配置数据 -->
                                <div class="bg-white/50 dark:bg-chatgpt-dark-user/50 rounded-lg p-3">
                                    <div class="flex items-center justify-between mb-2">
                                        <div class="text-sm font-semibold text-gray-700 dark:text-chatgpt-dark-text">系统配置</div>
                                        <span class="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/40 px-2 py-0.5 rounded-full">{{ storageInfo.settings.usageInMB }} MB</span>
                                    </div>
                                    <div class="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                                        <span>配置项</span>
                                        <span>{{ storageInfo.settings.count }} 项</span>
                                    </div>
                                    <div class="mt-3">
                                        <button
                                            @click="confirmResetSettings"
                                            class="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white dark:bg-chatgpt-dark-user text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 rounded hover:bg-orange-50 dark:hover:bg-orange-900/30 transition-colors text-xs font-medium"
                                        >
                                            <RefreshCw :size="12" />
                                            重置配置
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <!-- 数据详情 (保留作为总览或移除?)
                                 用户需求是"需要区分"，上面的 grid 已经区分了。
                                 原来的 detailedStats 是基于 props.history 计算的，而 storageInfo 是基于 IndexedDB 实际存储计算的。
                                 可以直接移除 detailedStats 展示区块，或者保留它显示更详细的消息总数（IndexedDB stats 目前只有 count 即记录数）。
                                 为了简洁，我先移除 detailedStats 的展示区块，因为上面的 grid 已经提供了足够的信息。
                            -->

                            <!-- 底部操作按钮 -->
                            <div class="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800 mt-2">
                                <button
                                    @click="refreshStorageInfo"
                                    class="flex-1 px-4 py-2.5 bg-white dark:bg-chatgpt-dark-user text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors text-sm font-medium"
                                >
                                    刷新统计
                                </button>
                                <button
                                    @click="handleClearAllData"
                                    class="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors text-sm font-medium"
                                >
                                    <Trash2 :size="16" />
                                    清空所有数据
                                </button>
                            </div>
                        </div>

                        <!-- 加载中 -->
                        <div v-else class="text-center py-8 text-gray-500 dark:text-gray-400">
                            <RefreshCw :size="24" class="animate-spin mx-auto mb-2" />
                            <p class="text-sm">加载存储信息中...</p>
                        </div>
                    </div>

                    <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 flex gap-3">
                        <AlertCircle :size="20" class="text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
                        <div class="text-sm text-yellow-800 dark:text-yellow-200">
                            <p class="font-semibold mb-1">自动清理说明</p>
                            <p>系统会自动删除超过设定天数的对话记录，以节省存储空间。</p>
                        </div>
                    </div>

                    <div>
                        <label class="block text-sm font-semibold text-gray-700 dark:text-chatgpt-dark-text mb-3">
                            数据保存时间
                        </label>
                        <div class="space-y-3">
                            <label class="flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-gray-300 dark:hover:border-gray-600"
                                :class="localDataRetention === 3 ? 'border-chatgpt-accent bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-chatgpt-dark-border'"
                            >
                                <input
                                    type="radio"
                                    v-model.number="localDataRetention"
                                    :value="3"
                                    class="w-4 h-4 text-chatgpt-accent focus:ring-chatgpt-accent"
                                />
                                <div class="ml-3 flex-1">
                                    <div class="font-semibold text-gray-900 dark:text-chatgpt-dark-text">3天</div>
                                    <div class="text-sm text-gray-500 dark:text-gray-400">保留最近3天的对话记录</div>
                                </div>
                            </label>

                            <label class="flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-gray-300 dark:hover:border-gray-600"
                                :class="localDataRetention === 7 ? 'border-chatgpt-accent bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-chatgpt-dark-border'"
                            >
                                <input
                                    type="radio"
                                    v-model.number="localDataRetention"
                                    :value="7"
                                    class="w-4 h-4 text-chatgpt-accent focus:ring-chatgpt-accent"
                                />
                                <div class="ml-3 flex-1">
                                    <div class="font-semibold text-gray-900 dark:text-chatgpt-dark-text">7天（推荐）</div>
                                    <div class="text-sm text-gray-500 dark:text-gray-400">保留最近一周的对话记录</div>
                                </div>
                            </label>

                            <label class="flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-gray-300 dark:hover:border-gray-600"
                                :class="localDataRetention === 30 ? 'border-chatgpt-accent bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 dark:border-chatgpt-dark-border'"
                            >
                                <input
                                    type="radio"
                                    v-model.number="localDataRetention"
                                    :value="30"
                                    class="w-4 h-4 text-chatgpt-accent focus:ring-chatgpt-accent"
                                />
                                <div class="ml-3 flex-1">
                                    <div class="font-semibold text-gray-900 dark:text-chatgpt-dark-text">30天</div>
                                    <div class="text-sm text-gray-500 dark:text-gray-400">保留最近一个月的对话记录</div>
                                </div>
                            </label>
                        </div>
                    </div>
                </div>

                <!-- 外观设置标签页 -->
                <div v-if="activeTab === 'appearance'" class="space-y-6">
                    <div>
                        <h3 class="text-base font-bold text-gray-900 dark:text-chatgpt-dark-text mb-1">代码主题</h3>
                        <p class="text-sm text-gray-600 dark:text-chatgpt-dark-subtext mb-4">选择代码块的高亮主题风格</p>

                        <div class="grid grid-cols-1 gap-3">
                            <div
                                v-for="theme in codeThemes"
                                :key="theme.id"
                                :class="[
                                    'border rounded-xl px-4 py-2 hover:shadow-sm dark:hover:shadow-dark-card transition-all cursor-pointer',
                                    localCodeTheme === theme.id
                                        ? 'border-chatgpt-accent dark:border-chatgpt-dark-accent bg-gradient-to-br from-blue-50 to-indigo-50/50 dark:from-blue-900/20 dark:to-indigo-900/10 shadow-sm dark:shadow-dark-card'
                                        : 'border-gray-200 dark:border-chatgpt-dark-border bg-gradient-to-br from-white to-gray-50/50 dark:from-chatgpt-dark-main dark:to-chatgpt-dark-user/30 hover:border-chatgpt-accent/50 dark:hover:border-chatgpt-dark-accent/50'
                                ]"
                                @click="localCodeTheme = theme.id"
                            >
                                <div class="flex items-center gap-3">
                                    <input
                                        type="radio"
                                        v-model="localCodeTheme"
                                        :value="theme.id"
                                        class="w-4 h-4 mt-0.5 text-chatgpt-accent focus:ring-chatgpt-accent shrink-0"
                                    />
                                    <div class="flex-1 min-w-0">
                                        <div class="font-semibold text-gray-900 dark:text-chatgpt-dark-text text-base">{{ theme.name }}</div>
                                        <div class="text-sm text-gray-500 dark:text-gray-400">{{ theme.desc }}</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- 预览示例 -->
                        <div class="mt-6">
                            <p class="text-sm font-semibold text-gray-700 dark:text-chatgpt-dark-text mb-3">主题预览</p>
                            <div class="relative bg-gray-900 dark:bg-black rounded-xl p-4 overflow-hidden">
                                <div class="absolute top-3 right-3">
                                    <div class="flex gap-1.5">
                                        <div class="w-3 h-3 rounded-full bg-red-500"></div>
                                        <div class="w-3 h-3 rounded-full bg-yellow-500"></div>
                                        <div class="w-3 h-3 rounded-full bg-green-500"></div>
                                    </div>
                                </div>
                                <pre class="text-sm font-mono"><code class="hljs" v-html="highlightedCode"></code></pre>
                            </div>
                            <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                                💡 主题切换后，新的AI回复将使用选中的代码高亮主题
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 底部操作栏 -->
            <div class="flex items-center justify-end p-6 border-t border-gray-200 dark:border-chatgpt-dark-border bg-gray-50 dark:bg-chatgpt-dark-main transition-colors duration-200">
                <div class="flex gap-3">
                    <button
                        @click="closeSettings"
                        class="px-6 py-2 bg-gray-200 dark:bg-chatgpt-dark-user text-gray-700 dark:text-chatgpt-dark-text rounded-lg hover:bg-gray-300 dark:hover:bg-chatgpt-dark-assistant transition-colors text-sm font-medium"
                    >
                        取消
                    </button>
                    <button
                        @click="closeSettings"
                        class="px-6 py-2 bg-chatgpt-accent dark:bg-chatgpt-dark-accent text-white rounded-lg hover:bg-blue-600 dark:hover:bg-blue-500 transition-colors text-sm font-medium"
                    >
                        保存设置
                    </button>
                </div>
            </div>
        </div>
        </Transition>
    </div>

    <!-- Toast 提示 -->
    <Toast
        :show="showToast"
        :message="toastMessage"
        :type="toastType"
        @close="showToast = false"
    />

    <!-- 确认对话框 -->
    <ConfirmDialog
        :show="showConfirm"
        :title="confirmConfig.title"
        :message="confirmConfig.message"
        :type="confirmConfig.type"
        confirm-text="确定"
        cancel-text="取消"
        @confirm="handleConfirm"
        @close="showConfirm = false"
    />
</template>

<style scoped>
/* 平滑滚动 */
.overflow-y-auto {
    scroll-behavior: smooth;
}

/* 模态框背景过渡动画 */
.modal-enter-active,
.modal-leave-active {
    transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
    opacity: 0;
}

/* 模态框内容过渡动画 */
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
