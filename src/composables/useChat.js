import { ref, watch, markRaw, onMounted, computed } from 'vue';
import { Zap, BrainCircuit, Sparkles, Cpu, Image as ImageIcon } from 'lucide-vue-next';
import { dbManager } from '../utils/indexedDB.js';
import ApiAdapterFactory from '../utils/apiAdapters.js';
import PRESET_GROUPS from '../config/presetGroups.js';

const SETTINGS_KEY = 'chatgpt_settings';
const SELECTED_MODEL_KEY = 'chatgpt_selected_model';

// 代码主题配置
const CODE_THEME_KEY = 'chatgpt_code_theme';
const DEFAULT_CODE_THEME = 'vscode'; // vscode, github, jetbrains

// 默认配置
const DEFAULT_MODELS = [
    {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        desc: 'Fast and efficient for most tasks',
        icon: markRaw(Zap)
    },
    {
        id: 'gemini-2.5-flash-thinking',
        name: 'Gemini 2.5 Flash Thinking',
        desc: 'Great for logical reasoning',
        icon: markRaw(BrainCircuit)
    },
    {
        id: 'gemini-3-pro-low',
        name: 'Gemini 3 Pro (Low)',
        desc: 'Balanced performance',
        icon: markRaw(Sparkles)
    },
    {
        id: 'gemini-3-pro-high',
        name: 'Gemini 3 Pro (High)',
        desc: 'Maximum reasoning power',
        icon: markRaw(Cpu)
    },
    {
        id: 'gemini-3-pro-image-16x9',
        name: 'Gemini 3 Pro (16:9)',
        desc: 'Landscape image generation',
        icon: markRaw(ImageIcon)
    },
    {
        id: 'gemini-3-pro-image-9x16',
        name: 'Gemini 3 Pro (9:16)',
        desc: 'Portrait image generation',
        icon: markRaw(ImageIcon)
    },
    {
        id: 'gemini-3-pro-image-4x3',
        name: 'Gemini 3 Pro (4:3)',
        desc: 'Standard image generation',
        icon: markRaw(ImageIcon)
    },
    {
        id: 'gemini-3-pro-image-3x4',
        name: 'Gemini 3 Pro (3:4)',
        desc: 'Vertical image generation',
        icon: markRaw(ImageIcon)
    },
    {
        id: 'gemini-3-pro-image-1x1',
        name: 'Gemini 3 Pro (1:1)',
        desc: 'Square image generation',
        icon: markRaw(ImageIcon)
    },
    {
        id: 'claude-sonnet-4-5',
        name: 'Claude 4.5 Sonnet',
        desc: 'Balanced and intelligent',
        icon: markRaw(Sparkles)
    },
    {
        id: 'claude-sonnet-4-5-thinking',
        name: 'Claude 4.5 Sonnet Thinking',
        desc: 'Reasoning-focused Sonnet',
        icon: markRaw(BrainCircuit)
    },
    {
        id: 'claude-opus-4-5-thinking',
        name: 'Claude 4.5 Opus Thinking',
        desc: 'Most advanced reasoning',
        icon: markRaw(BrainCircuit)
    }
];

const DEFAULT_DATA_RETENTION = 7; // 默认保存7天

export function useChat() {
    // 数据库初始化状态
    const isDbReady = ref(false);
    const isInitializing = ref(true);

    // 模型分组相关状态
    const modelGroups = ref([]);  // 所有模型分组
    const currentGroupId = ref('local');  // 当前选中的分组ID

    // 查找模型所属的分组
    const findGroupOfModel = (modelId) => {
        if (!modelId) return null;
        for (const group of modelGroups.value) {
            const found = group.models.find(m => m.id === modelId);
            if (found) return group;
        }
        return null;
    };

    // 当前分组的计算属性
    const currentGroup = computed(() => {
        return modelGroups.value.find(g => g.id === currentGroupId.value) || null;
    });

    // 当前分组的模型列表
    const models = computed(() => {
        return currentGroup.value?.models || [];
    });

    // 选中的模型对象（计算属性，在所有分组中查找）
    const selectedModel = computed(() => {
        if (!selectedModelId.value) return null;
        for (const group of modelGroups.value) {
            const model = group.models.find(m => m.id === selectedModelId.value);
            if (model) return model;
        }
        return null;
    });

    // 当前分组的API配置
    const apiConfig = computed(() => {
        return currentGroup.value?.apiConfig || { baseUrl: '', apiKey: '' };
    });

    // 当前分组的API适配器
    const currentAdapter = computed(() => {
        const adapterType = currentGroup.value?.apiAdapter || 'openai';
        return ApiAdapterFactory.getAdapter(adapterType);
    });

    // 上下文开关状态
    const contextEnabled = ref(true);

    // 图表渲染开关状态
    const diagramEnabled = ref(true);

    // 代码主题
    const codeTheme = ref(DEFAULT_CODE_THEME);

    // 判断是否为绘图模型（包含比例的模型名称）
    const isDrawingModel = (modelId) => {
        return modelId && (
            modelId.includes('16:9') ||
            modelId.includes('9:16') ||
            modelId.includes('4:3') ||
            modelId.includes('3:4') ||
            modelId.includes('1:1') ||
            modelId.includes('image')
        );
    };

    // 加载设置
    const loadSettings = async () => {
        try {
            const saved = await dbManager.getSetting(SETTINGS_KEY);
            return saved;
        } catch (e) {
            console.error('加载设置失败:', e);
            return null;
        }
    };

    // 加载代码主题
    const loadCodeTheme = async () => {
        try {
            const saved = await dbManager.getSetting(CODE_THEME_KEY);
            return saved || DEFAULT_CODE_THEME;
        } catch (e) {
            console.error('加载代码主题失败:', e);
            return DEFAULT_CODE_THEME;
        }
    };

    const savedSettings = ref(null);

    // 数据保存天数
    const dataRetention = ref(DEFAULT_DATA_RETENTION);

    // ========== 模型分组管理函数 ==========

    /**
     * 加载所有模型分组
     */
    const loadModelGroups = async () => {
        try {
            const groups = await dbManager.getAllModelGroups();
            if (groups && groups.length > 0) {
                modelGroups.value = groups;
                return true;
            }
            return false;
        } catch (e) {
            console.error('加载模型分组失败:', e);
            return false;
        }
    };

    /**
     * 初始化模型分组
     */
    const initializeModelGroups = async () => {
        try {
            // 加载所有分组
            const groups = await dbManager.getAllModelGroups();

            if (groups && groups.length > 0) {
                modelGroups.value = groups;
                console.log(`✅ 加载了 ${groups.length} 个API配置分组`);

                // 设置当前分组
                const savedGroupId = await dbManager.getSetting('currentGroupId');
                if (savedGroupId && modelGroups.value.find(g => g.id === savedGroupId)) {
                    currentGroupId.value = savedGroupId;
                } else {
                    currentGroupId.value = modelGroups.value[0].id;
                }
            } else {
                // 无分组，系统初始状态为空
                modelGroups.value = [];
                currentGroupId.value = null;
                console.log('📝 系统初始状态：无API配置');
                console.log('💡 请打开设置 → API配置 → 新增API配置');
            }
        } catch (e) {
            console.error('初始化模型分组失败:', e);
            modelGroups.value = [];
            currentGroupId.value = null;
        }
    };


    /**
     * 切换当前分组
     */
    const switchGroup = (groupId) => {
        if (modelGroups.value.find(g => g.id === groupId)) {
            currentGroupId.value = groupId;
            // 切换分组后，选择该分组的第一个模型
            if (models.value.length > 0) {
                selectedModelId.value = models.value[0].id;
            }
        }
    };

    /**
     * 更新分组的API配置（增强版，自动同步模型）
     */
    const updateGroupApiConfig = async (groupId, config) => {
        const group = modelGroups.value.find(g => g.id === groupId);
        if (group) {
            // 保存旧配置用于比较
            const oldConfig = { ...group.apiConfig };

            // 更新配置
            group.apiConfig = { ...config };
            await dbManager.saveModelGroup(group);

            // 检查API配置是否有实质性变化
            const configChanged =
                oldConfig.baseUrl !== config.baseUrl ||
                oldConfig.apiKey !== config.apiKey ||
                oldConfig.endpoint !== config.endpoint;

            // 如果配置有变化且新配置完整，自动同步模型
            if (configChanged && config.baseUrl && config.apiKey) {
                console.log(`🔄 API配置已更新，自动同步分组 ${groupId} 的模型...`);
                const result = await syncModelsFromApi(groupId, false);
                return result;
            }

            return { success: true };
        }
        return { success: false, error: '分组不存在' };
    };

    /**
     * 向分组添加模型
     */
    const addModelToGroup = async (groupId, model) => {
        const group = modelGroups.value.find(g => g.id === groupId);
        if (group) {
            group.models.push(model);
            await dbManager.saveModelGroup(group);
        }
    };

    /**
     * 从分组删除模型
     */
    const removeModelFromGroup = async (groupId, modelId) => {
        const group = modelGroups.value.find(g => g.id === groupId);
        if (group) {
            group.models = group.models.filter(m => m.id !== modelId);
            await dbManager.saveModelGroup(group);
        }
    };

    /**
     * 更新分组中的模型列表
     */
    const updateGroupModels = async (groupId, models) => {
        const group = modelGroups.value.find(g => g.id === groupId);
        if (group) {
            group.models = models;
            await dbManager.saveModelGroup(group);
        }
    };

    /**
     * 创建新的API配置（分组）
     * @param {Object} config - 配置对象
     * @returns {Promise<{success: boolean, groupId?: string, error?: string}>}
     */
    const createApiConfig = async (config) => {
        try {
            // 验证必填字段
            if (!config.baseUrl || !config.apiKey) {
                return { success: false, error: 'API地址和密钥不能为空' };
            }

            // 生成唯一ID
            const groupId = `custom_${Date.now()}`;

            // 创建临时分组对象（不保存到数据库）
            const newGroup = {
                id: groupId,
                name: config.name || '新API配置',
                description: config.description || '',
                apiAdapter: config.apiAdapter || 'openai',
                apiConfig: {
                    baseUrl: config.baseUrl,
                    endpoint: config.endpoint || '/v1/chat/completions',
                    apiKey: config.apiKey
                },
                models: [],
                isCustom: true,
                enabled: true
            };

            // 先测试API，尝试获取模型列表
            console.log(`🔄 测试API连接并获取模型...`);

            const { fetchModels } = await import('../services/modelService.js');
            const models = await fetchModels(config.baseUrl, config.apiKey, '/v1/models');

            if (!models || models.length === 0) {
                return { success: false, error: 'API返回的模型列表为空' };
            }

            // API测试成功，设置模型列表
            newGroup.models = models;

            // 保存到数据库
            await dbManager.saveModelGroup(newGroup);

            // 添加到内存
            modelGroups.value.push(newGroup);

            // 保存模型缓存
            await dbManager.saveModelCache(groupId, models, newGroup.apiConfig);

            console.log(`✅ 成功创建API配置并同步 ${models.length} 个模型`);
            return { success: true, groupId, models };

        } catch (error) {
            console.error('创建API配置失败:', error);
            return { success: false, error: error.message || '创建失败' };
        }
    };

    /**
     * 删除API配置（分组）
     * @param {string} groupId - 分组ID
     * @returns {Promise<{success: boolean, error?: string}>}
     */
    const deleteApiConfig = async (groupId) => {
        try {
            const group = modelGroups.value.find(g => g.id === groupId);

            if (!group) {
                return { success: false, error: '分组不存在' };
            }

            // 不允许删除非自定义分组
            if (!group.isCustom) {
                return { success: false, error: '不能删除预设分组' };
            }

            // 如果是当前分组，切换到其他分组
            if (currentGroupId.value === groupId) {
                const otherGroup = modelGroups.value.find(g => g.id !== groupId);
                if (otherGroup) {
                    currentGroupId.value = otherGroup.id;
                }
            }

            // 从数据库删除
            await dbManager.deleteModelGroup(groupId);

            // 清除缓存
            await dbManager.clearModelCache(groupId);

            // 从内存删除
            const index = modelGroups.value.findIndex(g => g.id === groupId);
            if (index !== -1) {
                modelGroups.value.splice(index, 1);
            }

            return { success: true };
        } catch (error) {
            console.error('删除API配置失败:', error);
            return { success: false, error: error.message || '删除失败' };
        }
    };

    // 保存设置到 IndexedDB（现在只保存dataRetention，models和apiConfig在分组中）
    const saveSettings = async () => {
        if (!isDbReady.value) return;

        try {
            const settings = {
                dataRetention: dataRetention.value
            };

            await dbManager.saveSetting(SETTINGS_KEY, settings);
        } catch (e) {
            console.error('保存设置失败:', e);
        }
    };

    // 监听设置变化并保存（防抖）
    let saveSettingsTimeout;
    watch(dataRetention, () => {
        clearTimeout(saveSettingsTimeout);
        saveSettingsTimeout = setTimeout(() => {
            saveSettings();
        }, 500);
    });

    // 监听代码主题变化并保存
    watch(codeTheme, async (newTheme) => {
        if (!isDbReady.value) return;
        try {
            await dbManager.saveSetting(CODE_THEME_KEY, newTheme);
        } catch (e) {
            console.error('保存代码主题失败:', e);
        }
    });

    // 清理过期数据
    const cleanupOldData = async () => {
        if (!isDbReady.value) return;

        try {
            const retentionDays = dataRetention.value;
            const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));

            const deletedIds = await dbManager.deleteChatsBeforeDate(cutoffDate);

            // 从内存中移除已删除的聊天
            history.value = history.value.filter(chat => !deletedIds.includes(chat.id));

            if (deletedIds.length > 0) {
                console.log(`清理了 ${deletedIds.length} 条过期对话`);
            }
        } catch (e) {
            console.error('清理过期数据失败:', e);
        }
    };

    // 聊天历史
    const history = ref([]);

    const currentChatId = ref(null);
    const messages = ref([]);

    const selectedModelId = ref(null);

    // 监控模型ID变化，自动同步分组
    watch(selectedModelId, (newId) => {
        if (!newId) return;

        // 如果当前模型不在当前分组中，尝试自动切换分组
        const currentGroupHasModel = models.value.some(m => m.id === newId);
        if (!currentGroupHasModel) {
            const group = findGroupOfModel(newId);
            if (group) {
                currentGroupId.value = group.id;
            }
        }

        // 根据模型类型自动调整上下文开关
        if (isDrawingModel(newId)) {
            contextEnabled.value = false;
        } else {
            contextEnabled.value = true;
        }

        // 缓存选中的模型ID到 IndexedDB
        if (isDbReady.value) {
            dbManager.saveSetting(SELECTED_MODEL_KEY, newId).catch(console.error);
        }
    });

    const isStreaming = ref(false);

    // 保存聊天历史到 IndexedDB（防抖）
    let saveHistoryTimeout;
    const saveHistoryDebounced = (chat) => {
        clearTimeout(saveHistoryTimeout);
        saveHistoryTimeout = setTimeout(async () => {
            if (!isDbReady.value) return;

            try {
                await dbManager.saveChat(chat);
            } catch (e) {
                console.error('保存聊天历史失败:', e);
            }
        }, 1000);
    };

    const createNewChat = () => {
        // 检查最新的历史记录是否为空
        if (history.value.length > 0) {
            const latestChat = history.value[0];
            if (latestChat.messages.length === 0) {
                // 如果最新记录为空，直接切换到该记录
                selectChat(latestChat.id);
                // 重置设置（可选）
                diagramEnabled.value = true;
                contextEnabled.value = !isDrawingModel(selectedModelId.value);
                return latestChat.id;
            }
        }

        const id = Date.now().toString();
        const newChat = {
            id,
            title: 'New Chat',
            messages: [],
            modelId: selectedModelId.value,
            createdAt: new Date().toISOString()
        };
        history.value.unshift(newChat);
        currentChatId.value = id; // Fixed .ref bug
        messages.value = [];

        // 重置开关状态为默认值
        diagramEnabled.value = true;
        // 如果是图片模型，关闭上下文；否则开启上下文
        contextEnabled.value = !isDrawingModel(selectedModelId.value);

        return id;
    };

    const selectChat = (id) => {
        const chat = history.value.find(c => c.id === id);
        if (chat) {
            currentChatId.value = id;
            messages.value = chat.messages;
            // 不再自动切换模型 ID，保持用户当前的选择
            // 这样可以避免模型列表在切换历史时因为跨分组而“清空”或异常跳变
        }
    };

    const deleteChat = async (id) => {
        history.value = history.value.filter(c => c.id !== id);
        if (currentChatId.value === id) {
            currentChatId.value = null;
            messages.value = [];
        }

        // 从 IndexedDB 删除
        if (isDbReady.value) {
            try {
                await dbManager.deleteChat(id);
            } catch (e) {
                console.error('删除聊天失败:', e);
            }
        }
    };

    const clearHistory = async () => {
        history.value = [];
        currentChatId.value = null;
        messages.value = [];

        // 清空 IndexedDB 中的聊天记录
        if (isDbReady.value) {
            try {
                await dbManager.clearAllChats();
            } catch (e) {
                console.error('清空聊天历史失败:', e);
            }
        }
    };

    const sendMessage = async (content, images = [], isResend = false) => {
        if (!content.trim() && images.length === 0) return;

        if (!currentChatId.value) {
            currentChatId.value = createNewChat();
        }

        // 如果不是重新发送，才添加用户消息
        if (!isResend) {
            const userMessage = {
                role: 'user',
                content: content,
                images: images,
                timestamp: new Date().toISOString()
            };
            messages.value.push(userMessage);
        }

        const chatIndex = history.value.findIndex(c => c.id === currentChatId.value);
        const currentChat = history.value[chatIndex];

        if (currentChat.messages.length === 0) {
            currentChat.title = content.substring(0, 30) || 'Image Analysis';
        }
        currentChat.messages = [...messages.value];

        // 保存到 IndexedDB
        saveHistoryDebounced(currentChat);

        isStreaming.value = true;
        const assistantMessage = {
            role: 'assistant',
            content: '',
            timestamp: new Date().toISOString(),
            streaming: true,
            modelName: selectedModel.value?.name // 记录当前使用的模型名称
        };
        messages.value.push(assistantMessage);

        try {
            // 判断当前模型是否为绘图模型
            const isDrawing = isDrawingModel(selectedModelId.value);

            // 根据上下文开关和绘图模型决定发送哪些消息
            // 绘图模型或上下文关闭时,只发送最后一条用户消息
            let messagesToSend;
            if (isDrawing || !contextEnabled.value) {
                // 只发送最后一条用户消息（过滤掉报错的消息）
                const lastUserMessage = messages.value.slice(0, -1)
                    .filter(m => m.role === 'user' && !m.error)
                    .pop();
                messagesToSend = lastUserMessage ? [lastUserMessage] : [];
            } else {
                // 发送完整的对话历史(不包括正在生成的助手消息，并过滤掉报错的消息)
                messagesToSend = messages.value.slice(0, -1).filter(m => !m.error);
            }

            const apiMessages = messagesToSend.map(msg => {
                if (msg.images && msg.images.length > 0) {
                    const contentArr = [{ type: 'text', text: msg.content }];
                    msg.images.forEach(img => {
                        contentArr.push({
                            type: 'image_url',
                            image_url: { url: img }
                        });
                    });
                    return { role: msg.role, content: contentArr };
                }
                return { role: msg.role, content: msg.content };
            });

            // 使用API适配器格式化请求
            const requestBody = currentAdapter.value.formatRequest(
                messagesToSend,
                selectedModelId.value,
                { stream: true }
            );

            // 组合完整的API地址
            const rawBaseUrl = apiConfig.value.baseUrl || '';
            const baseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;
            const rawEndpoint = apiConfig.value.endpoint || '/v1/chat/completions';
            const endpoint = rawEndpoint.startsWith('/') ? rawEndpoint : '/' + rawEndpoint;
            const fullUrl = `${baseUrl}${endpoint}`;

            if (!baseUrl) {
                throw new Error('API 基础地址未配置');
            }

            // Switching to Fetch API for reliable browser streaming
            const response = await fetch(fullUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiConfig.value.apiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                let errorDetail = '';
                try {
                    const errorJson = await response.json();
                    errorDetail = errorJson.error?.message || errorJson.message || JSON.stringify(errorJson);
                } catch (e) {
                    errorDetail = await response.text();
                }
                throw new Error(errorDetail || `HTTP error! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let partialLine = '';
            let hasContent = false;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                // SSE can use both \n\n and \n as separators
                const lines = (partialLine + chunk).split(/\r?\n/);
                partialLine = lines.pop() || '';

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine || !trimmedLine.startsWith('data:')) continue;

                    const data = trimmedLine.replace(/^data:\s*/, '');

                    // 使用适配器解析流式响应
                    try {
                        const parsed = currentAdapter.value.parseStreamChunk(data);
                        if (parsed && parsed.content) {
                            hasContent = true;
                            const lastIndex = messages.value.length - 1;
                            if (lastIndex >= 0) {
                                // Update content and trigger reactivity by replacing the object
                                const currentMsg = messages.value[lastIndex];
                                messages.value[lastIndex] = {
                                    ...currentMsg,
                                    content: currentMsg.content + parsed.content
                                };
                            }
                        }

                        // 如果适配器指示完成，跳出
                        if (parsed && parsed.done) {
                            break;
                        }
                    } catch (e) {
                        console.error('Failed to parse stream chunk:', e);
                        continue;
                    }
                }
            }

            // 如果流结束了依然没有内容，给出提示
            if (!hasContent) {
                const lastIndex = messages.value.length - 1;
                if (lastIndex >= 0) {
                    messages.value[lastIndex] = {
                        ...messages.value[lastIndex],
                        content: '> ⚠️ 收到空响应。可能是模型未返回任何内容或 API 配置有误。',
                        error: true // 标记为错误消息，下次请求不带上
                    };
                }
            }

            // After stream is finished, update history and streaming status
            const lastIndex = messages.value.length - 1;
            if (lastIndex >= 0) {
                messages.value[lastIndex].streaming = false;
            }

            if (chatIndex !== -1) {
                const updatedChat = history.value[chatIndex];
                updatedChat.messages = JSON.parse(JSON.stringify(messages.value));

                // 保存到 IndexedDB
                saveHistoryDebounced(updatedChat);
            }

        } catch (error) {
            console.error('API Error:', error);
            const lastIndex = messages.value.length - 1;
            if (lastIndex >= 0) {
                const errorMsg = `\n\n> ❌ **API 错误：**\n> ${error.message || '连接服务器失败，请检查网络或 API 配置。'}`;
                messages.value[lastIndex] = {
                    ...messages.value[lastIndex],
                    content: messages.value[lastIndex].content + errorMsg,
                    streaming: false,
                    error: true // 标记为错误消息，持久化但下次请求过滤掉
                };

                // 报错时也需要保存历史以持久化错误显示
                if (chatIndex !== -1) {
                    const updatedChat = history.value[chatIndex];
                    updatedChat.messages = JSON.parse(JSON.stringify(messages.value));
                    saveHistoryDebounced(updatedChat);
                }
            }
        } finally {
            isStreaming.value = false;
        }
    };

    // 更新设置（现在操作当前分组）
    const updateModels = async (newModels) => {
        await updateGroupModels(currentGroupId.value, newModels);
    };

    const updateApiConfig = async (newConfig) => {
        await updateGroupApiConfig(currentGroupId.value, newConfig);
    };

    const updateDataRetention = async (days) => {
        dataRetention.value = days;
        await cleanupOldData();
    };

    // 重新发送消息
    const resendMessage = async (messageIndex) => {
        if (messageIndex < 0 || messageIndex >= messages.value.length) {
            console.error('Invalid message index');
            return;
        }

        const messageToResend = messages.value[messageIndex];

        // 确保是用户消息
        if (messageToResend.role !== 'user') {
            console.error('Can only resend user messages');
            return;
        }

        // 删除该消息之后的所有消息（包括AI回复）
        messages.value = messages.value.slice(0, messageIndex + 1);

        // 保存到历史记录
        const chatIndex = history.value.findIndex(c => c.id === currentChatId.value);
        if (chatIndex !== -1) {
            history.value[chatIndex].messages = [...messages.value];
            saveHistoryDebounced(history.value[chatIndex]);
        }

        // 重新发送该消息
        await sendMessage(messageToResend.content, messageToResend.images || [], true);
    };

    // 编辑并重新发送消息
    const editMessage = (messageIndex) => {
        if (messageIndex < 0 || messageIndex >= messages.value.length) {
            console.error('Invalid message index');
            return null;
        }

        const messageToEdit = messages.value[messageIndex];

        // 确保是用户消息
        if (messageToEdit.role !== 'user') {
            console.error('Can only edit user messages');
            return null;
        }

        // 返回要编辑的消息内容和图片,并删除该消息之后的所有消息
        messages.value = messages.value.slice(0, messageIndex);

        // 保存到历史记录
        const chatIndex = history.value.findIndex(c => c.id === currentChatId.value);
        if (chatIndex !== -1) {
            history.value[chatIndex].messages = [...messages.value];
            saveHistoryDebounced(history.value[chatIndex]);
        }

        return {
            content: messageToEdit.content,
            images: messageToEdit.images || []
        };
    };

    // 重置所有设置到默认值
    const resetAllSettings = async () => {
        if (isDbReady.value) {
            try {
                // 1. 清除所有模型分组
                const groups = await dbManager.getAllModelGroups();
                if (groups && groups.length > 0) {
                    for (const group of groups) {
                        await dbManager.deleteModelGroup(group.id);
                        // 清除该分组的模型缓存
                        await dbManager.clearModelCache(group.id);
                    }
                }

                // 2. 清除所有设置（包括currentGroupId等）
                await dbManager.deleteSetting(SETTINGS_KEY);
                await dbManager.deleteSetting('currentGroupId');
                await dbManager.deleteSetting('codeTheme');
                await dbManager.deleteSetting('dataRetention');

                // 3. 重置内存中的状态
                modelGroups.value = [];
                currentGroupId.value = null;
                dataRetention.value = DEFAULT_DATA_RETENTION;

                console.log('✅ 所有设置已重置');
            } catch (e) {
                console.error('重置设置失败:', e);
            }
        }
    };

    // 初始化数据库和数据
    const initializeData = async () => {
        try {
            // 初始化 IndexedDB
            await dbManager.init();
            isDbReady.value = true;

            // 检查是否需要从 localStorage 迁移数据
            const hasOldData = localStorage.getItem('chatgpt_history') ||
                              localStorage.getItem('chatgpt_settings');

            if (hasOldData) {
                console.log('检测到 localStorage 中的旧数据，开始迁移...');
                await dbManager.migrateFromLocalStorage();
                // 迁移完成后清除 localStorage
                dbManager.clearLocalStorage();
            }

            // 初始化模型分组
            await initializeModelGroups();

            // 加载设置（现在只有dataRetention）
            const settings = await loadSettings();
            if (settings) {
                savedSettings.value = settings;
                dataRetention.value = settings.dataRetention || DEFAULT_DATA_RETENTION;
            }

            // 加载选中的模型
            const savedModelId = await dbManager.getSetting(SELECTED_MODEL_KEY);
            if (savedModelId) {
                // 尝试找到模型所属的分组并切换
                const group = findGroupOfModel(savedModelId);
                if (group) {
                    currentGroupId.value = group.id;
                    selectedModelId.value = savedModelId;
                } else if (models.value.length > 0) {
                    selectedModelId.value = models.value[0].id;
                }
            } else if (models.value.length > 0) {
                // 如果没有保存的模型，选择当前分组第一个
                selectedModelId.value = models.value[0].id;
            }

            // 加载代码主题
            const savedCodeTheme = await loadCodeTheme();
            codeTheme.value = savedCodeTheme;

            // 加载聊天历史
            const chats = await dbManager.getAllChats();
            history.value = chats;

            // 清理过期数据
            await cleanupOldData();

            // 获取存储使用情况
            const storageInfo = await dbManager.getStorageEstimate();
            if (storageInfo) {
                console.log(`📊 存储使用情况: ${storageInfo.usageInMB}MB / ${storageInfo.quotaInMB}MB (${storageInfo.percentUsed}%)`);
            }

        } catch (error) {
            console.error('初始化失败:', error);
        } finally {
            isInitializing.value = false;
        }
    };

    // ========== 模型同步功能 ==========

    /**
     * 从API同步模型到缓存
     * @param {string} groupId - 分组ID
     * @param {boolean} showToast - 是否显示Toast提示
     * @returns {Promise<{success: boolean, models?: Array, error?: string}>}
     */
    const syncModelsFromApi = async (groupId, showToast = true) => {
        const group = modelGroups.value.find(g => g.id === groupId);
        if (!group) {
            return { success: false, error: '分组不存在' };
        }

        const { baseUrl, apiKey } = group.apiConfig;

        if (!baseUrl || !apiKey) {
            const errorMsg = 'API配置不完整，请先配置API地址和密钥';
            if (showToast) {
                // 这里需要通过事件或其他方式通知UI显示Toast
                console.error(errorMsg);
            }
            return { success: false, error: errorMsg };
        }

        try {
            // 动态导入modelService
            const { fetchModels } = await import('../services/modelService.js');

            // 从API获取模型列表（固定使用 /v1/models 端点）
            const models = await fetchModels(baseUrl, apiKey, '/v1/models');

            if (!models || models.length === 0) {
                throw new Error('API返回的模型列表为空');
            }

            // 更新分组的模型列表
            group.models = models;
            await dbManager.saveModelGroup(group);

            // 保存到缓存
            await dbManager.saveModelCache(groupId, models, group.apiConfig);

            console.log(`✅ 成功从API同步 ${models.length} 个模型到分组 ${group.name}`);

            return { success: true, models };

        } catch (error) {
            const errorMsg = error.message || '同步模型失败';
            console.error('同步模型失败:', error);
            return { success: false, error: errorMsg };
        }
    };

    /**
     * 刷新指定分组的模型（手动刷新）
     * @param {string} groupId - 分组ID
     * @returns {Promise<{success: boolean, models?: Array, error?: string}>}
     */
    const refreshModels = async (groupId) => {
        console.log(`🔄 手动刷新分组 ${groupId} 的模型...`);
        return await syncModelsFromApi(groupId, true);
    };

    /**
     * 加载分组的模型（优先从缓存加载）
     * @param {string} groupId - 分组ID
     */
    const loadGroupModels = async (groupId) => {
        const group = modelGroups.value.find(g => g.id === groupId);
        if (!group) return;

        // 尝试从缓存加载
        const cache = await dbManager.getModelCache(groupId);

        if (cache && cache.models && cache.models.length > 0) {
            // 检查缓存是否有效
            const isValid = await dbManager.isModelCacheValid(groupId, group.apiConfig);

            if (isValid) {
                console.log(`📦 从缓存加载分组 ${groupId} 的模型`);
                group.models = cache.models;
                await dbManager.saveModelGroup(group);
                return;
            } else {
                console.log(`⚠️ 分组 ${groupId} 的缓存已失效`);
            }
        }

        // 如果没有缓存或缓存失效，且API已配置，尝试从API同步
        if (group.apiConfig.baseUrl && group.apiConfig.apiKey) {
            console.log(`🌐 从API加载分组 ${groupId} 的模型...`);
            await syncModelsFromApi(groupId, false);
        }
    };

    // 在组件挂载时初始化
    initializeData();


    return {
        // 聊天相关
        history,
        currentChatId,
        messages,
        isStreaming,
        createNewChat,
        selectChat,
        deleteChat,
        clearHistory,
        sendMessage,
        resendMessage,
        editMessage,

        // 模型分组相关
        modelGroups,
        currentGroupId,
        currentGroup,
        switchGroup,

        // 当前分组的状态（computed）
        models,
        apiConfig,
        currentAdapter,

        // 模型选择
        selectedModelId,
        selectedModel,

        // 设置相关
        dataRetention,
        codeTheme,
        contextEnabled,
        diagramEnabled,
        updateModels,
        updateApiConfig,
        updateDataRetention,
        updateGroupApiConfig,
        updateGroupModels,
        addModelToGroup,
        removeModelFromGroup,
        createApiConfig,         // 新增：创建API配置
        deleteApiConfig,         // 新增：删除API配置
        refreshModels,           // 新增：手动刷新模型
        syncModelsFromApi,       // 新增：从API同步模型
        resetAllSettings,

        // 工具函数
        isDrawingModel,

        // 状态
        isDbReady,
        isInitializing,

        // 其他
        getStorageInfo: () => dbManager.getStorageEstimate()
    };
}
