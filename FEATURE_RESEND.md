# 重新发送消息功能

## 📋 功能说明

新增"重新发送消息"功能，当 API 调用失败、网络错误或想要重新生成 AI 回复时，用户可以一键重新发送之前的消息。

---

## ✨ 功能特点

### 1. 智能重发
- 自动删除该消息之后的所有内容
- 保留该消息之前的所有对话历史
- 使用原始的消息内容和图片（如果有）
- 生成全新的 AI 回复

### 2. 便捷操作
- 鼠标悬停在用户消息上自动显示按钮
- 带图标和文字提示"重新发送"
- 绿色主题色，清晰可见
- 点击即可重新发送

### 3. 安全检查
- 自动检查 API 配置
- 如未配置，提示用户设置
- 防止在流式输出时重复发送

---

## 🎯 使用场景

### 场景 1: API 调用失败
```
用户: 你好，请介绍一下量子计算
AI: **Error: Failed to get response from server.**

→ 点击用户消息上的「重新发送」按钮
→ 删除失败的 AI 回复
→ 重新调用 API
→ 获取新的回复
```

### 场景 2: 网络超时
```
用户: 写一篇关于人工智能的文章
AI: （长时间无响应或超时）

→ 点击「重新发送」
→ 重新请求
```

### 场景 3: 对回复不满意
```
用户: 推荐几本科幻小说
AI: （回复内容不够详细或不满意）

→ 点击「重新发送」
→ 获取新的推荐结果
```

### 场景 4: 更换模型后重试
```
用户: 用 Gemini 2.5 Flash 发送消息
AI: （给出回复）

→ 切换到 Claude 4.5 Sonnet
→ 点击「重新发送」
→ 使用新模型生成回复
```

---

## 🎨 UI 设计

### 位置
- 显示在用户消息的底部
- 悬停时显示（opacity: 0 → 100）
- 流式输出时隐藏

### 样式
```
┌─────────────────────────────────┐
│ 👤 你                           │
│                                 │
│ 请介绍一下量子计算               │
│                                 │
│ [🔄 重新发送]  ← 悬停时显示    │
└─────────────────────────────────┘
```

### 按钮设计
- **图标**: RefreshCw (旋转箭头)
- **文字**: "重新发送"
- **颜色**:
  - 默认: 灰色文字
  - 悬停: 绿色背景 + 绿色文字
- **大小**: 14px 图标 + 12px 文字

---

## 🔧 技术实现

### 1. useChat.js

#### resendMessage 函数
```javascript
const resendMessage = async (messageIndex) => {
    // 1. 验证索引
    if (messageIndex < 0 || messageIndex >= messages.value.length) {
        console.error('Invalid message index');
        return;
    }

    const messageToResend = messages.value[messageIndex];

    // 2. 确保是用户消息
    if (messageToResend.role !== 'user') {
        console.error('Can only resend user messages');
        return;
    }

    // 3. 删除该消息之后的所有消息
    messages.value = messages.value.slice(0, messageIndex + 1);

    // 4. 保存到历史记录
    const chatIndex = history.value.findIndex(c => c.id === currentChatId.value);
    if (chatIndex !== -1) {
        history.value[chatIndex].messages = [...messages.value];
        saveHistoryDebounced(history.value[chatIndex]);
    }

    // 5. 重新发送（标记为 isResend）
    await sendMessage(messageToResend.content, messageToResend.images || [], true);
};
```

#### sendMessage 修改
```javascript
const sendMessage = async (content, images = [], isResend = false) => {
    // 如果是重新发送，不再添加用户消息（因为已经存在）
    if (!isResend) {
        const userMessage = {...};
        messages.value.push(userMessage);
    }

    // 其余逻辑保持不变
    // ...
};
```

### 2. MessageItem.vue

#### Props 和 Emits
```javascript
const props = defineProps({
    message: Object,
    modelName: String,
    messageIndex: Number,      // 新增：消息索引
    isStreaming: Boolean        // 新增：是否正在流式输出
});

const emit = defineEmits(['resend']);
```

#### 重新发送按钮
```vue
<!-- 仅在用户消息且非流式输出时显示 -->
<div v-if="isUser && !isStreaming" class="...">
    <button @click="handleResend" ...>
        <RefreshCw :size="14" />
        <span>重新发送</span>
    </button>
</div>
```

### 3. ChatContainer.vue

#### 传递参数和事件
```vue
<MessageItem
    v-for="(msg, index) in messages"
    :key="index"
    :message="msg"
    :message-index="index"          <!-- 传递索引 -->
    :model-name="modelName"
    :is-streaming="isStreaming"      <!-- 传递流式状态 -->
    @resend="handleResend"           <!-- 处理重新发送事件 -->
/>
```

### 4. App.vue

#### 处理重新发送
```javascript
const handleResend = async (messageIndex) => {
    // 检查 API 配置
    if (!apiConfig.value.baseUrl || !apiConfig.value.apiKey) {
        showApiConfigDialog.value = true;
        return;
    }

    // 调用重新发送
    await resendMessage(messageIndex);
};
```

---

## 📊 数据流

```
用户点击「重新发送」
    ↓
MessageItem emit('resend', messageIndex)
    ↓
ChatContainer 接收并向上传递
    ↓
App.vue handleResend(messageIndex)
    ↓
检查 API 配置
    ↓
调用 resendMessage(messageIndex)
    ↓
1. 获取要重发的消息
2. 删除该消息之后的所有内容
3. 保存到历史记录和 IndexedDB
4. 调用 sendMessage(..., isResend=true)
5. 生成新的 AI 回复
```

---

## ⚠️ 注意事项

### 1. 仅用户消息可重发
- AI 消息不显示重新发送按钮
- 只能重新发送用户的提问

### 2. 会删除后续内容
- 重新发送会删除该消息之后的所有对话
- 包括该消息对应的 AI 回复
- 以及之后的所有问答对

### 3. 流式输出时禁用
- 正在生成回复时，不显示重新发送按钮
- 防止重复请求

### 4. API 配置检查
- 未配置 API 时，会提示用户先配置
- 配置后才能重新发送

### 5. 模型切换
- 重新发送时使用当前选中的模型
- 可能与原始回复使用的模型不同

---

## 🎯 与原功能的区别

| 特性 | 普通发送 | 重新发送 |
|------|----------|----------|
| 添加用户消息 | ✅ 是 | ❌ 否（复用已有） |
| 保留历史 | ✅ 追加 | ⚠️ 删除后续内容 |
| 触发方式 | 输入框发送 | 消息上的按钮 |
| 使用场景 | 新问题 | API 失败/不满意 |

---

## 🧪 测试指南

### 测试 1: 基本功能
1. 发送一条消息
2. 等待 AI 回复
3. 悬停在用户消息上
4. 应该看到「重新发送」按钮
5. 点击按钮
6. 应该删除 AI 回复并重新生成

### 测试 2: 多轮对话
1. 发送多条消息（3-5轮对话）
2. 悬停在第 2 条用户消息上
3. 点击「重新发送」
4. 应该删除第 2 条之后的所有内容
5. 重新生成回复

### 测试 3: API 错误
1. 断开网络或关闭 API 服务
2. 发送消息
3. 看到错误提示
4. 恢复网络/API
5. 点击「重新发送」
6. 应该成功获取回复

### 测试 4: 切换模型
1. 使用模型 A 发送消息
2. 获得回复
3. 切换到模型 B
4. 点击「重新发送」
5. 应该使用模型 B 生成新回复

### 测试 5: 流式输出时
1. 发送消息
2. 在回复生成过程中
3. 悬停在用户消息上
4. 不应该显示「重新发送」按钮

### 测试 6: 带图片的消息
1. 粘贴图片并发送
2. 点击「重新发送」
3. 应该同时重新发送文字和图片

---

## 📈 未来改进

### v1.2.0 可能的增强
- ✅ 重新发送前的确认对话框（可选）
- ✅ 保存多个版本的回复（AB 测试）
- ✅ 右键菜单快捷操作
- ✅ 键盘快捷键支持

### v1.3.0 可能的增强
- ✅ 批量重新发送多条消息
- ✅ 重新发送时可修改原消息
- ✅ 保留原回复以便对比
- ✅ 重新发送历史记录

---

## 🔗 相关文档

- [README.md](./README.md) - 项目说明
- [CHANGELOG.md](./CHANGELOG.md) - 版本日志
- [FEATURES_COMPLETE.md](./FEATURES_COMPLETE.md) - 完整功能列表

---

**功能状态**: ✅ 已实现
**版本**: v1.1.0+
**更新日期**: 2026-01-06

