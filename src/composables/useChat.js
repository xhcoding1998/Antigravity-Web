import { ref, watch, markRaw, onMounted } from 'vue';
import { Zap, BrainCircuit, Sparkles, Cpu, Image as ImageIcon } from 'lucide-vue-next';
import { dbManager } from '../utils/indexedDB.js';

const SETTINGS_KEY = 'chatgpt_settings';
const SELECTED_MODEL_KEY = 'chatgpt_selected_model';

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

    // 上下文开关状态
    const contextEnabled = ref(true);

    // 图表渲染开关状态
    const diagramEnabled = ref(true);

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

    const savedSettings = ref(null);

    // 模型列表
    const models = ref(DEFAULT_MODELS.map(m => ({ ...m })));

    // API配置 - 不设置默认值，由用户自行配置
    const apiConfig = ref({ baseUrl: '', apiKey: '' });

    // 数据保存天数
    const dataRetention = ref(DEFAULT_DATA_RETENTION);

    // 保存设置到 IndexedDB
    const saveSettings = async () => {
        if (!isDbReady.value) return;

        try {
            // 过滤掉不可序列化的字段（如 icon）
            const serializableModels = models.value.map(m => ({
                id: m.id,
                name: m.name,
                desc: m.desc
                // 不保存 icon 字段
            }));

            // 使用 JSON.parse(JSON.stringify()) 确保完全可序列化
            const settings = JSON.parse(JSON.stringify({
                models: serializableModels,
                apiConfig: {
                    baseUrl: apiConfig.value.baseUrl || '',
                    apiKey: apiConfig.value.apiKey || ''
                },
                dataRetention: dataRetention.value
            }));

            console.log('准备保存设置:', settings); // 调试日志
            await dbManager.saveSetting(SETTINGS_KEY, settings);
            console.log('设置保存成功'); // 调试日志
        } catch (e) {
            console.error('保存设置失败:', e);
            console.error('models.value:', models.value);
            console.error('apiConfig.value:', apiConfig.value);
        }
    };

    // 监听设置变化并保存（防抖）
    let saveSettingsTimeout;
    watch([models, apiConfig, dataRetention], () => {
        clearTimeout(saveSettingsTimeout);
        saveSettingsTimeout = setTimeout(() => {
            saveSettings();
        }, 500);
    }, { deep: true });

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

    const selectedModelId = ref(models.value[0]?.id);
    const selectedModel = ref(models.value[0]);

    watch(selectedModelId, async (newId) => {
        selectedModel.value = models.value.find(m => m.id === newId);
        // 缓存选中的模型ID到 IndexedDB
        if (isDbReady.value) {
            try {
                await dbManager.saveSetting(SELECTED_MODEL_KEY, newId);
            } catch (e) {
                console.error('保存模型选择失败:', e);
            }
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
        return id;
    };

    const selectChat = (id) => {
        const chat = history.value.find(c => c.id === id);
        if (chat) {
            currentChatId.value = id;
            messages.value = chat.messages;
            selectedModelId.value = chat.modelId;
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
            streaming: true
        };
        messages.value.push(assistantMessage);

        try {
            // 判断当前模型是否为绘图模型
            const isDrawing = isDrawingModel(selectedModelId.value);

            // 根据上下文开关和绘图模型决定发送哪些消息
            // 绘图模型或上下文关闭时,只发送最后一条用户消息
            let messagesToSend;
            if (isDrawing || !contextEnabled.value) {
                // 只发送最后一条用户消息
                const lastUserMessage = messages.value.slice(0, -1).filter(m => m.role === 'user').pop();
                messagesToSend = lastUserMessage ? [lastUserMessage] : [];
            } else {
                // 发送完整的对话历史(不包括正在生成的助手消息)
                messagesToSend = messages.value.slice(0, -1);
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

            // Switching to Fetch API for reliable browser streaming
            const response = await fetch(apiConfig.value.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiConfig.value.apiKey}`
                },
                body: JSON.stringify({
                    model: selectedModelId.value,
                    messages: apiMessages,
                    stream: true
                })
            });

            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let partialLine = '';

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
                    if (data === '[DONE]') continue;

                    try {
                        const json = JSON.parse(data);
                        const delta = json.choices[0]?.delta?.content || '';
                        if (delta) {
                            const lastIndex = messages.value.length - 1;
                            if (lastIndex >= 0) {
                                // Update content and trigger reactivity by replacing the object
                                const currentMsg = messages.value[lastIndex];
                                messages.value[lastIndex] = {
                                    ...currentMsg,
                                    content: currentMsg.content + delta
                                };
                            }
                        }
                    } catch (e) {
                        continue;
                    }
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
                messages.value[lastIndex] = {
                    ...messages.value[lastIndex],
                    content: messages.value[lastIndex].content + '\n\n**Error: Failed to get response from server.**',
                    streaming: false
                };
            }
            assistantMessage.content += '\n\n**Error: Failed to get response from server.**';
            assistantMessage.streaming = false;
        } finally {
            isStreaming.value = false;
        }
    };

    // 更新设置
    const updateModels = (newModels) => {
        models.value = newModels;
    };

    const updateApiConfig = (newConfig) => {
        apiConfig.value = newConfig;
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
        models.value = DEFAULT_MODELS.map(m => ({ ...m }));
        apiConfig.value = { baseUrl: '', apiKey: '' };
        dataRetention.value = DEFAULT_DATA_RETENTION;

        if (isDbReady.value) {
            try {
                await dbManager.deleteSetting(SETTINGS_KEY);
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

            // 加载设置
            const settings = await loadSettings();
            if (settings) {
                savedSettings.value = settings;

                // 恢复模型列表，合并 icon 字段
                if (settings.models) {
                    models.value = settings.models.map(savedModel => {
                        // 从默认模型中查找对应的 icon
                        const defaultModel = DEFAULT_MODELS.find(m => m.id === savedModel.id);
                        return {
                            ...savedModel,
                            icon: defaultModel?.icon || markRaw(Sparkles) // 如果找不到默认 icon，使用通用 icon
                        };
                    });
                } else {
                    models.value = DEFAULT_MODELS.map(m => ({ ...m }));
                }

                apiConfig.value = settings.apiConfig || { baseUrl: '', apiKey: '' };
                dataRetention.value = settings.dataRetention || DEFAULT_DATA_RETENTION;
            }

            // 加载选中的模型
            const savedModelId = await dbManager.getSetting(SELECTED_MODEL_KEY);
            if (savedModelId && models.value.find(m => m.id === savedModelId)) {
                selectedModelId.value = savedModelId;
                selectedModel.value = models.value.find(m => m.id === savedModelId);
            }

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

    // 在组件挂载时初始化
    initializeData();

    return {
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
        getStorageInfo: () => dbManager.getStorageEstimate()
    };
}
