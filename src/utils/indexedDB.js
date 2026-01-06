/**
 * IndexedDB 工具类
 * 支持存储大容量数据（500MB+）
 */

const DB_NAME = 'AntigravityChat';
const DB_VERSION = 1;
const STORE_HISTORY = 'chatHistory';
const STORE_SETTINGS = 'settings';

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
     */
    async getStorageEstimate() {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            const estimate = await navigator.storage.estimate();
            return {
                usage: estimate.usage,
                quota: estimate.quota,
                usageInMB: (estimate.usage / (1024 * 1024)).toFixed(2),
                quotaInMB: (estimate.quota / (1024 * 1024)).toFixed(2),
                percentUsed: ((estimate.usage / estimate.quota) * 100).toFixed(2)
            };
        }
        return null;
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
}

// 导出单例实例
export const dbManager = new IndexedDBManager();

