/**
 * IndexedDB 工具类
 * 支持存储大容量数据（500MB+）
 */

const DB_NAME = 'AntigravityChat';
const DB_VERSION = 2; // 升级到版本2以支持模型分组
const STORE_HISTORY = 'chatHistory';
const STORE_SETTINGS = 'settings';
const STORE_MODEL_GROUPS = 'modelGroups'; // 新增：模型分组存储

class IndexedDBManager {
    constructor() {
        this.db = null;
        this.initPromise = null;
    }

    /**
     * 初始化数据库
     */
    async init() {
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('IndexedDB 初始化失败:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('IndexedDB 初始化成功');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                const oldVersion = event.oldVersion;
                const newVersion = event.newVersion;

                console.log(`数据库升级: ${oldVersion} -> ${newVersion}`);

                // 版本1：创建基础存储
                if (oldVersion < 1) {
                    // 创建聊天历史存储
                    if (!db.objectStoreNames.contains(STORE_HISTORY)) {
                        const historyStore = db.createObjectStore(STORE_HISTORY, { keyPath: 'id' });
                        historyStore.createIndex('createdAt', 'createdAt', { unique: false });
                        console.log('创建 chatHistory 存储');
                    }

                    // 创建设置存储
                    if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
                        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
                        console.log('创建 settings 存储');
                    }
                }

                // 版本2：添加模型分组支持
                if (oldVersion < 2) {
                    // 创建模型分组存储
                    if (!db.objectStoreNames.contains(STORE_MODEL_GROUPS)) {
                        db.createObjectStore(STORE_MODEL_GROUPS, { keyPath: 'id' });
                        console.log('创建 modelGroups 存储');
                    }

                    // 数据迁移将在事务完成后异步执行
                    // 这里只是标记需要迁移
                    this.needsMigrationToGroups = true;
                }
            };
        });

        return this.initPromise;
    }

    /**
     * 确保数据库已初始化
     */
    async ensureDB() {
        if (!this.db) {
            await this.init();
        }
        return this.db;
    }

    /**
     * 保存单条聊天记录
     */
    async saveChat(chat) {
        const db = await this.ensureDB();
        return new Promise((resolve, reject) => {
            try {
                // 确保聊天记录是可序列化的
                let cleanChat;
                try {
                    cleanChat = structuredClone(chat);
                } catch (e) {
                    cleanChat = JSON.parse(JSON.stringify(chat));
                }

                const transaction = db.transaction([STORE_HISTORY], 'readwrite');
                const store = transaction.objectStore(STORE_HISTORY);
                const request = store.put(cleanChat);

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * 批量保存聊天记录
     */
    async saveChatBatch(chats) {
        const db = await this.ensureDB();
        return new Promise((resolve, reject) => {
            try {
                // 清理所有聊天记录，确保可序列化
                let cleanChats;
                try {
                    cleanChats = structuredClone(chats);
                } catch (e) {
                    cleanChats = JSON.parse(JSON.stringify(chats));
                }

                const transaction = db.transaction([STORE_HISTORY], 'readwrite');
                const store = transaction.objectStore(STORE_HISTORY);

                let completed = 0;
                const errors = [];

                cleanChats.forEach((chat, index) => {
                    const request = store.put(chat);
                    request.onsuccess = () => {
                        completed++;
                        if (completed === cleanChats.length) {
                            resolve({ success: true, errors });
                        }
                    };
                    request.onerror = () => {
                        errors.push({ index, error: request.error });
                        completed++;
                        if (completed === cleanChats.length) {
                            resolve({ success: errors.length === 0, errors });
                        }
                    };
                });

                if (cleanChats.length === 0) {
                    resolve({ success: true, errors: [] });
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * 获取单条聊天记录
     */
    async getChat(id) {
        const db = await this.ensureDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_HISTORY], 'readonly');
            const store = transaction.objectStore(STORE_HISTORY);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 获取所有聊天记录
     */
    async getAllChats() {
        const db = await this.ensureDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_HISTORY], 'readonly');
            const store = transaction.objectStore(STORE_HISTORY);
            const request = store.getAll();

            request.onsuccess = () => {
                // 按创建时间倒序排序
                const chats = request.result.sort((a, b) => {
                    return new Date(b.createdAt) - new Date(a.createdAt);
                });
                resolve(chats);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 删除单条聊天记录
     */
    async deleteChat(id) {
        const db = await this.ensureDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_HISTORY], 'readwrite');
            const store = transaction.objectStore(STORE_HISTORY);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 清空所有聊天记录
     */
    async clearAllChats() {
        const db = await this.ensureDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_HISTORY], 'readwrite');
            const store = transaction.objectStore(STORE_HISTORY);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 删除指定日期之前的聊天记录
     */
    async deleteChatsBeforeDate(cutoffDate) {
        const db = await this.ensureDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_HISTORY], 'readwrite');
            const store = transaction.objectStore(STORE_HISTORY);
            const index = store.index('createdAt');

            // 获取所有早于指定日期的记录
            const range = IDBKeyRange.upperBound(cutoffDate.toISOString());
            const request = index.openCursor(range);

            const deletedIds = [];

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    deletedIds.push(cursor.value.id);
                    cursor.delete();
                    cursor.continue();
                } else {
                    resolve(deletedIds);
                }
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 保存设置
     */
    async saveSetting(key, value) {
        const db = await this.ensureDB();
        return new Promise((resolve, reject) => {
            try {
                // 确保值是可序列化的 - 移除 Vue 的响应式代理
                let cleanValue;
                try {
                    // 尝试使用 structuredClone（现代浏览器）
                    cleanValue = structuredClone(value);
                } catch (e) {
                    // 回退到 JSON 序列化
                    cleanValue = JSON.parse(JSON.stringify(value));
                }

                const transaction = db.transaction([STORE_SETTINGS], 'readwrite');
                const store = transaction.objectStore(STORE_SETTINGS);
                const request = store.put({ key, value: cleanValue });

                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * 获取设置
     */
    async getSetting(key) {
        const db = await this.ensureDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_SETTINGS], 'readonly');
            const store = transaction.objectStore(STORE_SETTINGS);
            const request = store.get(key);

            request.onsuccess = () => {
                resolve(request.result ? request.result.value : null);
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 删除设置
     */
    async deleteSetting(key) {
        const db = await this.ensureDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_SETTINGS], 'readwrite');
            const store = transaction.objectStore(STORE_SETTINGS);
            const request = store.delete(key);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 获取数据库使用情况
     * 支持分别统计对话存储和配置存储
     */
    async getStorageEstimate() {
        // 获取总的存储估算
        let totalStats = {
            usage: 0,
            quota: 0
        };

        if ('storage' in navigator && 'estimate' in navigator.storage) {
            totalStats = await navigator.storage.estimate();
        }

        // 统计各个 Store 的大致大小
        const db = await this.ensureDB();
        const stats = {
            total: {
                usage: totalStats.usage,
                quota: totalStats.quota,
                usageInMB: (totalStats.usage / (1024 * 1024)).toFixed(2),
                quotaInMB: (totalStats.quota / (1024 * 1024)).toFixed(2),
                percentUsed: ((totalStats.usage / totalStats.quota) * 100).toFixed(2)
            },
            history: {
                count: 0,
                estimatedBytes: 0,
                usageInMB: "0.00"
            },
            settings: {
                count: 0,
                estimatedBytes: 0,
                usageInMB: "0.00"
            }
        };

        // 辅助函数：计算对象在 IndexedDB 中的大致大小
        const calculateSize = (obj) => {
            const str = JSON.stringify(obj);
            return new TextEncoder().encode(str).length;
        };

        // 统计聊天历史
        await new Promise((resolve) => {
            const transaction = db.transaction([STORE_HISTORY], 'readonly');
            const store = transaction.objectStore(STORE_HISTORY);
            const request = store.openCursor();

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    stats.history.count++;
                    stats.history.estimatedBytes += calculateSize(cursor.value);
                    cursor.continue();
                } else {
                    stats.history.usageInMB = (stats.history.estimatedBytes / (1024 * 1024)).toFixed(2);
                    resolve();
                }
            };
        });

        // 统计设置 (包括 STORE_SETTINGS 和 STORE_MODEL_GROUPS)
        await new Promise((resolve) => {
            let pending = 2; // 需要等待两个 store

            const checkDone = () => {
                pending--;
                if (pending === 0) {
                    stats.settings.usageInMB = (stats.settings.estimatedBytes / (1024 * 1024)).toFixed(2);
                    resolve();
                }
            };

            // 1. 设置 Store
            const t1 = db.transaction([STORE_SETTINGS], 'readonly');
            const s1 = t1.objectStore(STORE_SETTINGS);
            const r1 = s1.openCursor();
            r1.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    // 排除模型缓存数据，只计算真正的设置项
                    if (!cursor.value.key || !cursor.value.key.startsWith('model_cache_')) {
                        stats.settings.count++;
                        stats.settings.estimatedBytes += calculateSize(cursor.value);
                    }
                    cursor.continue();
                } else {
                    checkDone();
                }
            };

            // 2. 模型分组 Store
            const t2 = db.transaction([STORE_MODEL_GROUPS], 'readonly');
            const s2 = t2.objectStore(STORE_MODEL_GROUPS);
            const r2 = s2.openCursor();
            r2.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    stats.settings.estimatedBytes += calculateSize(cursor.value);
                    cursor.continue();
                } else {
                    checkDone();
                }
            };
        });

        return stats;
    }

    /**
     * 从 localStorage 迁移数据到 IndexedDB
     */
    async migrateFromLocalStorage() {
        console.log('开始从 localStorage 迁移数据...');

        try {
            // 迁移聊天历史
            const historyData = localStorage.getItem('chatgpt_history');
            if (historyData) {
                const chats = JSON.parse(historyData);
                if (Array.isArray(chats) && chats.length > 0) {
                    await this.saveChatBatch(chats);
                    console.log(`成功迁移 ${chats.length} 条聊天记录`);
                }
            }

            // 迁移设置
            const settingsData = localStorage.getItem('chatgpt_settings');
            if (settingsData) {
                const settings = JSON.parse(settingsData);

                // 过滤掉不可序列化的字段（如 models 中的 icon）
                if (settings.models && Array.isArray(settings.models)) {
                    settings.models = settings.models.map(m => ({
                        id: m.id,
                        name: m.name,
                        desc: m.desc
                        // 不迁移 icon 字段
                    }));
                }

                await this.saveSetting('chatgpt_settings', settings);
                console.log('成功迁移设置数据');
            }

            // 迁移选中的模型
            const selectedModel = localStorage.getItem('chatgpt_selected_model');
            if (selectedModel) {
                await this.saveSetting('chatgpt_selected_model', selectedModel);
                console.log('成功迁移模型选择');
            }

            console.log('数据迁移完成！');
            return true;
        } catch (error) {
            console.error('数据迁移失败:', error);
            return false;
        }
    }

    /**
     * 清除 localStorage 中的旧数据
     */
    clearLocalStorage() {
        localStorage.removeItem('chatgpt_history');
        localStorage.removeItem('chatgpt_settings');
        localStorage.removeItem('chatgpt_selected_model');
        console.log('已清除 localStorage 中的旧数据');
    }

    /**
     * 保存模型分组
     */
    async saveModelGroup(group) {
        const db = await this.ensureDB();
        return new Promise((resolve, reject) => {
            try {
                const cleanGroup = JSON.parse(JSON.stringify(group));
                const transaction = db.transaction([STORE_MODEL_GROUPS], 'readwrite');
                const store = transaction.objectStore(STORE_MODEL_GROUPS);
                const request = store.put(cleanGroup);

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * 获取单个模型分组
     */
    async getModelGroup(id) {
        const db = await this.ensureDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_MODEL_GROUPS], 'readonly');
            const store = transaction.objectStore(STORE_MODEL_GROUPS);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 获取所有模型分组
     */
    async getAllModelGroups() {
        const db = await this.ensureDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_MODEL_GROUPS], 'readonly');
            const store = transaction.objectStore(STORE_MODEL_GROUPS);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 删除模型分组
     */
    async deleteModelGroup(id) {
        const db = await this.ensureDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_MODEL_GROUPS], 'readwrite');
            const store = transaction.objectStore(STORE_MODEL_GROUPS);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 从旧版本迁移到模型分组结构
     */
    async migrateToModelGroups() {
        console.log('开始迁移到模型分组结构...');

        try {
            // 检查是否已经迁移过
            const existingGroups = await this.getAllModelGroups();
            if (existingGroups && existingGroups.length > 0) {
                console.log('已存在模型分组，跳过迁移');
                return;
            }

            // 由于预设分组已移除，不再需要迁移
            // 用户需要通过"新增API配置"来创建所有配置
            console.log('预设分组已移除，系统初始状态为空');
            console.log('请通过"新增API配置"来创建配置');
            return true;
        } catch (error) {
            console.error('模型分组迁移失败:', error);
            return false;
        }
    }

    /**
     * 保存模型缓存
     * @param {string} groupId - 分组ID
     * @param {Array} models - 模型列表
     * @param {Object} apiConfig - API配置（用于验证缓存是否过期）
     */
    async saveModelCache(groupId, models, apiConfig = null) {
        const cacheKey = `model_cache_${groupId}`;
        const cacheData = {
            groupId,
            models: JSON.parse(JSON.stringify(models)),
            cachedAt: new Date().toISOString(),
            apiConfig: apiConfig ? {
                baseUrl: apiConfig.baseUrl,
                endpoint: apiConfig.endpoint
                // 不保存 apiKey
            } : null
        };

        await this.saveSetting(cacheKey, cacheData);
        console.log(`已缓存分组 ${groupId} 的 ${models.length} 个模型`);
    }

    /**
     * 获取模型缓存
     * @param {string} groupId - 分组ID
     * @returns {Object|null} 缓存数据，包含 { models, cachedAt, apiConfig }
     */
    async getModelCache(groupId) {
        const cacheKey = `model_cache_${groupId}`;
        const cacheData = await this.getSetting(cacheKey);

        if (cacheData && cacheData.models) {
            console.log(`从缓存加载分组 ${groupId} 的 ${cacheData.models.length} 个模型`);
            return cacheData;
        }

        return null;
    }

    /**
     * 清除模型缓存
     * @param {string} groupId - 分组ID
     */
    async clearModelCache(groupId) {
        const cacheKey = `model_cache_${groupId}`;
        await this.deleteSetting(cacheKey);
        console.log(`已清除分组 ${groupId} 的模型缓存`);
    }

    /**
     * 检查模型缓存是否有效
     * @param {string} groupId - 分组ID
     * @param {Object} currentApiConfig - 当前API配置
     * @returns {boolean} 缓存是否有效
     */
    async isModelCacheValid(groupId, currentApiConfig) {
        const cache = await this.getModelCache(groupId);

        if (!cache) {
            return false;
        }

        // 检查API配置是否变化
        if (cache.apiConfig && currentApiConfig) {
            if (cache.apiConfig.baseUrl !== currentApiConfig.baseUrl ||
                cache.apiConfig.endpoint !== currentApiConfig.endpoint) {
                console.log(`分组 ${groupId} 的API配置已变化，缓存失效`);
                return false;
            }
        }

        return true;
    }

}

// 导出单例实例
export const dbManager = new IndexedDBManager();

