# Bug 修复：Icon 序列化问题

## 🐛 问题描述

### 错误信息
```
DataCloneError: Failed to execute 'put' on 'IDBObjectStore':
[object Array] could not be cloned.
```

### 问题原因

在 `models` 数组中，每个模型都包含一个 `icon` 字段，该字段是使用 Vue 的 `markRaw()` 包装的组件引用：

```javascript
const DEFAULT_MODELS = [
    {
        id: 'gemini-2.5-flash',
        name: 'Gemini 2.5 Flash',
        desc: 'Fast and efficient for most tasks',
        icon: markRaw(Zap)  // ❌ 这个不能被 IndexedDB 序列化
    },
    ...
];
```

**IndexedDB 只能存储可序列化的数据**，不能存储：
- 函数
- Symbol
- DOM 节点
- Vue 组件引用
- 使用 `markRaw()` 包装的对象

## ✅ 解决方案（最终版本）

### 核心问题

IndexedDB 无法存储以下内容：
1. **Vue 组件引用**（markRaw 包装的对象）
2. **Vue 响应式代理对象**（Proxy）
3. 函数、Symbol、循环引用等

### 双重保护策略

我们在两个层面进行数据清理：

#### 层面 1: 应用层（useChat.js）
过滤掉不可序列化的字段

#### 层面 2: 数据库层（indexedDB.js）
使用 structuredClone 或 JSON 序列化移除响应式代理

### 1. 保存时过滤不可序列化字段

在 `useChat.js` 的 `saveSettings()` 函数中：

```javascript
const saveSettings = async () => {
    if (!isDbReady.value) return;

    try {
        // 过滤掉不可序列化的字段（如 icon）
        const serializableModels = models.value.map(m => ({
            id: m.id,
            name: m.name,
            desc: m.desc
            // ✅ 不保存 icon 字段
        }));

        const settings = {
            models: serializableModels,
            apiConfig: apiConfig.value,
            dataRetention: dataRetention.value
        };
        await dbManager.saveSetting(SETTINGS_KEY, settings);
    } catch (e) {
        console.error('保存设置失败:', e);
    }
};
```

### 2. 加载时恢复 icon 字段

在 `initializeData()` 函数中：

```javascript
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
                icon: defaultModel?.icon || markRaw(Sparkles) // 使用默认或通用 icon
            };
        });
    } else {
        models.value = DEFAULT_MODELS.map(m => ({ ...m }));
    }

    // ...
}
```

### 3. 数据库层双重保护（关键修复）

在 `indexedDB.js` 中，对所有保存操作添加数据清理：

```javascript
async saveSetting(key, value) {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
        try {
            // 移除 Vue 响应式代理，确保完全可序列化
            let cleanValue;
            try {
                cleanValue = structuredClone(value); // 现代浏览器
            } catch (e) {
                cleanValue = JSON.parse(JSON.stringify(value)); // 回退方案
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
```

同样的保护也应用于：
- `saveChat()` - 保存单条聊天
- `saveChatBatch()` - 批量保存聊天

### 4. 数据迁移时也要过滤

在 `indexedDB.js` 的 `migrateFromLocalStorage()` 中：

```javascript
// 迁移设置
const settingsData = localStorage.getItem('chatgpt_settings');
if (settingsData) {
    const settings = JSON.parse(settingsData);

    // 过滤掉不可序列化的字段
    if (settings.models && Array.isArray(settings.models)) {
        settings.models = settings.models.map(m => ({
            id: m.id,
            name: m.name,
            desc: m.desc
            // ✅ 不迁移 icon 字段
        }));
    }

    await this.saveSetting('chatgpt_settings', settings);
    console.log('成功迁移设置数据');
}
```

## 🎯 核心原则

### IndexedDB 可存储的数据类型

✅ **可以存储**：
- 字符串 (String)
- 数字 (Number)
- 布尔值 (Boolean)
- Date 对象
- Array（可序列化的）
- Object（可序列化的）
- Blob
- File
- ArrayBuffer

❌ **不能存储**：
- 函数 (Function)
- Symbol
- undefined（会被忽略）
- DOM 元素
- 循环引用的对象
- Vue 组件引用
- markRaw() 包装的对象

### 最佳实践

1. **分离数据和展示**
   - 数据层：只存储纯数据（id, name, desc）
   - 展示层：在运行时添加 UI 相关内容（icon, component）

2. **保存前清理数据**
   ```javascript
   const cleanData = (obj) => {
       return JSON.parse(JSON.stringify(obj)); // 简单方法
       // 或手动过滤
   };
   ```

3. **加载后恢复**
   ```javascript
   const enrichData = (savedData) => {
       return {
           ...savedData,
           icon: getIconByType(savedData.type)
       };
   };
   ```

## 📊 修复前后对比

### 修复前

```javascript
// ❌ 直接保存包含 icon 的模型
const settings = {
    models: models.value,  // 包含 markRaw(Component)
    apiConfig: apiConfig.value,
    dataRetention: dataRetention.value
};
await dbManager.saveSetting(SETTINGS_KEY, settings);
// 抛出: DataCloneError
```

### 修复后

```javascript
// ✅ 保存前过滤掉不可序列化字段
const serializableModels = models.value.map(m => ({
    id: m.id,
    name: m.name,
    desc: m.desc
}));

const settings = {
    models: serializableModels,  // 纯数据
    apiConfig: apiConfig.value,
    dataRetention: dataRetention.value
};
await dbManager.saveSetting(SETTINGS_KEY, settings);
// ✅ 成功保存
```

## 🧪 验证修复

### 测试步骤

1. 启动应用
2. 打开设置
3. 修改任意设置（如添加模型、修改 API 配置）
4. 点击保存
5. 刷新页面
6. 确认设置已保存且 icon 正常显示

### 控制台检查

应该看到：
```
✅ 成功保存设置
✅ 没有 DataCloneError 错误
```

### Application 面板检查

1. F12 → Application → IndexedDB → AntigravityChat → settings
2. 查看 `chatgpt_settings` 记录
3. 确认 `models` 数组中的对象**不包含** `icon` 字段

## 🔍 相关代码位置

| 文件 | 行数 | 说明 |
|------|------|------|
| `src/composables/useChat.js` | ~113-127 | saveSettings() 保存时过滤 |
| `src/composables/useChat.js` | ~446-462 | initializeData() 加载时恢复 |
| `src/utils/indexedDB.js` | ~298-313 | migrateFromLocalStorage() 迁移时过滤 |

## 💡 其他注意事项

### 1. 用户自定义模型

用户通过 Settings 添加的自定义模型本身就不包含 icon，所以不会有问题：

```javascript
// 用户添加的模型（Settings.vue）
const newModel = {
    id: 'custom-model',
    name: 'My Custom Model',
    desc: 'Description'
    // ✅ 没有 icon 字段
};
```

加载时会自动分配一个通用 icon：

```javascript
icon: defaultModel?.icon || markRaw(Sparkles)
```

### 2. 默认模型的 icon

内置的默认模型 icon 在运行时从 `DEFAULT_MODELS` 中获取，不会保存到数据库。

### 3. 性能影响

由于 icon 不保存，每次加载都需要重新映射，但这个操作非常快（< 1ms），对性能影响可忽略。

## 📚 相关资源

- [MDN: IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Structured Clone Algorithm](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm)
- [Vue 3: markRaw](https://vuejs.org/api/reactivity-advanced.html#markraw)

---

**修复日期**: 2026-01-06
**问题严重级别**: 🔴 Critical（阻塞功能）
**修复状态**: ✅ 已修复

