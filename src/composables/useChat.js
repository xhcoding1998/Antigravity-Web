import { ref, watch, markRaw } from 'vue';
import { Zap, BrainCircuit, Sparkles, Cpu, Image as ImageIcon } from 'lucide-vue-next';

const STORAGE_KEY = 'chatgpt_history';
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
    // 加载设置
    const loadSettings = () => {
        const saved = localStorage.getItem(SETTINGS_KEY);
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                return null;
            }
        }
        return null;
    };

    const savedSettings = loadSettings();

    // 模型列表
    const models = ref(savedSettings?.models || DEFAULT_MODELS.map(m => ({ ...m })));

    // API配置 - 不设置默认值，由用户自行配置
    const apiConfig = ref(savedSettings?.apiConfig || { baseUrl: '', apiKey: '' });

    // 数据保存天数
    const dataRetention = ref(savedSettings?.dataRetention || DEFAULT_DATA_RETENTION);

    // 保存设置到localStorage
    const saveSettings = () => {
        const settings = {
            models: models.value,
            apiConfig: apiConfig.value,
            dataRetention: dataRetention.value
        };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    };

    // 监听设置变化并保存
    watch([models, apiConfig, dataRetention], saveSettings, { deep: true });

    // 清理过期数据
    const cleanupOldData = () => {
        const retentionDays = dataRetention.value;
        const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);

        history.value = history.value.filter(chat => {
            const chatTime = new Date(chat.createdAt).getTime();
            return chatTime >= cutoffTime;
        });
    };

    // 初始化时清理过期数据
    const history = ref(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
    cleanupOldData();

    const currentChatId = ref(null);
    const messages = ref([]);

    // 从缓存加载选中的模型ID
    const savedModelId = localStorage.getItem(SELECTED_MODEL_KEY);
    const initialModelId = savedModelId && models.value.find(m => m.id === savedModelId)
        ? savedModelId
        : models.value[0]?.id;

    const selectedModelId = ref(initialModelId);
    const selectedModel = ref(models.value.find(m => m.id === initialModelId) || models.value[0]);

    watch(selectedModelId, (newId) => {
        selectedModel.value = models.value.find(m => m.id === newId);
        // 缓存选中的模型ID
        localStorage.setItem(SELECTED_MODEL_KEY, newId);
    });

    const isStreaming = ref(false);

    // Save history to localStorage (debounced to avoid blocking)
    let saveTimeout;
    watch(history, (newHistory) => {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(newHistory));
        }, 1000); // Wait 1 second after last change to save
    }, { deep: true });

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

    const deleteChat = (id) => {
        history.value = history.value.filter(c => c.id !== id);
        if (currentChatId.value === id) {
            currentChatId.value = null;
            messages.value = [];
        }
    };

    const clearHistory = () => {
        history.value = [];
        currentChatId.value = null;
        messages.value = [];
        localStorage.removeItem(STORAGE_KEY);
    };

    const sendMessage = async (content, images = []) => {
        if (!content.trim() && images.length === 0) return;

        if (!currentChatId.value) {
            currentChatId.value = createNewChat();
        }

        const userMessage = {
            role: 'user',
            content: content,
            images: images,
            timestamp: new Date().toISOString()
        };

        messages.value.push(userMessage);

        const chatIndex = history.value.findIndex(c => c.id === currentChatId.value);
        if (history.value[chatIndex].messages.length === 0) {
            history.value[chatIndex].title = content.substring(0, 30) || 'Image Analysis';
        }
        history.value[chatIndex].messages = [...messages.value];

        isStreaming.value = true;
        const assistantMessage = {
            role: 'assistant',
            content: '',
            timestamp: new Date().toISOString(),
            streaming: true
        };
        messages.value.push(assistantMessage);

        try {
            const apiMessages = messages.value.slice(0, -1).map(msg => {
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
                history.value[chatIndex].messages = JSON.parse(JSON.stringify(messages.value));
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

    const updateDataRetention = (days) => {
        dataRetention.value = days;
        cleanupOldData();
    };

    // 重置所有设置到默认值
    const resetAllSettings = () => {
        models.value = DEFAULT_MODELS.map(m => ({ ...m }));
        apiConfig.value = { baseUrl: '', apiKey: '' };
        dataRetention.value = DEFAULT_DATA_RETENTION;
        localStorage.removeItem(SETTINGS_KEY);
    };

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
        createNewChat,
        selectChat,
        deleteChat,
        clearHistory,
        sendMessage,
        updateModels,
        updateApiConfig,
        updateDataRetention,
        resetAllSettings
    };
}
