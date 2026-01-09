<script setup>
import { ref, watch, nextTick } from 'vue';
import { CheckSquare, Image, FileText, Download, MoreHorizontal, GripHorizontal, ChevronLeft, ChevronRight, Sparkles, Moon, Sun } from 'lucide-vue-next';

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  isSelectionMode: {
    type: Boolean,
    default: false
  },
  selectedCount: {
    type: Number,
    default: 0
  },
  isDark: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits([
  'toggleSelectionMode',
  'export-as-image',
  'export-as-pdf',
  'export-as-markdown',
  'exportAll',
  'summarize',
  'toggleTheme',
  'close'
]);

// 状态
const isCollapsed = ref(false);

// 位置: 只控制 Y 轴
const topPosition = ref(window.innerHeight / 2 - 150);
const isDragging = ref(false);
const dragStartY = ref(0);
const startTop = ref(0);

const showExportMenu = ref(false);

const startDrag = (e) => {
  if (e.target.closest('button') || e.target.closest('.export-menu')) {
    return;
  }

  isDragging.value = true;
  dragStartY.value = e.clientY;
  startTop.value = topPosition.value;

  const onMouseMove = (moveEvent) => {
    if (!isDragging.value) return;
    const deltaY = moveEvent.clientY - dragStartY.value;
    const newTop = startTop.value + deltaY;
    topPosition.value = Math.max(60, Math.min(newTop, window.innerHeight - 100));
  };

  const onMouseUp = () => {
    isDragging.value = false;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
};

// 点击外部关闭
const handleClickOutside = (e) => {
  if (!e.target.closest('.floating-dock') && !e.target.closest('.dock-menu')) {
    showExportMenu.value = false;
  }
};

watch(() => props.visible, (visible) => {
  if (visible) {
    document.addEventListener('click', handleClickOutside);
  } else {
    document.removeEventListener('click', handleClickOutside);
    showExportMenu.value = false;
  }
});

const toggleExportMenu = (event) => {
  event.stopPropagation();
  showExportMenu.value = !showExportMenu.value;
};

const handleExportAll = (format) => {
  emit('exportAll', format);
  showExportMenu.value = false;
};

const handleExportClick = (type) => {
    let eventName = '';
    switch(type) {
        case 'image': eventName = 'export-as-image'; break;
        case 'pdf': eventName = 'export-as-pdf'; break;
        case 'markdown': eventName = 'export-as-markdown'; break;
    }
    if (eventName) {
        emit(eventName);
    }
};

const toggleCollapse = () => {
    isCollapsed.value = !isCollapsed.value;
    if (isCollapsed.value) {
        showExportMenu.value = false;
    }
};
</script>

<template>
  <Teleport to="body">
    <Transition name="slide-fade">
      <div
        v-if="visible"
        class="floating-dock-container"
        :style="{ top: topPosition + 'px' }"
      >
        <!-- 主体 Dock -->
        <div
            class="floating-dock"
            :class="{
                'dragging': isDragging,
                'collapsed': isCollapsed
            }"
            @mousedown="startDrag"
        >
            <!-- 1. 顶部：拖动手柄 (收起时隐藏) -->
            <div class="dock-header" v-show="!isCollapsed">
                 <GripHorizontal :size="16" class="text-gray-300 dark:text-gray-600" />
            </div>

            <!-- 2. 中间：工具内容区 (收起时隐藏) -->
            <div class="dock-content" :class="{ 'hidden': isCollapsed }">
                 <div class="tools-group">
                    <button
                        @click="$emit('toggleSelectionMode')"
                        :class="{ active: isSelectionMode }"
                        class="dock-button main"
                        :title="isSelectionMode ? '退出选择模式' : '选择消息'"
                    >
                        <CheckSquare :size="18" />
                        <span v-if="isSelectionMode && selectedCount > 0" class="badge">{{ selectedCount }}</span>
                    </button>

                    <template v-if="isSelectionMode">
                         <div class="division-dot"></div>
                         <button @click="handleExportClick('image')" class="dock-button" title="导出图片" :disabled="selectedCount === 0">
                            <Image :size="18" />
                        </button>
                        <button @click="handleExportClick('pdf')" class="dock-button" title="导出PDF" :disabled="selectedCount === 0">
                            <FileText :size="18" />
                        </button>
                        <button @click="handleExportClick('markdown')" class="dock-button" title="导出Markdown" :disabled="selectedCount === 0">
                            <Download :size="18" />
                        </button>
                    </template>

                    <template v-else>
                         <!-- 总结按钮 -->
                        <button
                            @click="$emit('summarize')"
                            class="dock-button"
                            title="智能总结对话"
                        >
                            <Sparkles :size="18" class="text-purple-500" />
                        </button>

                        <button
                            @click="toggleExportMenu"
                            class="dock-button"
                            :class="{ active: showExportMenu }"
                            title="导出选项"
                        >
                            <MoreHorizontal :size="18" />
                        </button>

                    </template>

                    <!-- 分割线 -->
                    <div class="division-dot"></div>

                    <!-- 主题切换 -->
                    <button
                        @click="$emit('toggleTheme')"
                        class="dock-button"
                        :title="isDark ? '切换亮色模式' : '切换深色模式'"
                    >
                        <Sun v-if="isDark" :size="18" class="text-amber-400" />
                        <Moon v-else :size="18" class="text-slate-600" />
                    </button>
                </div>
            </div>

             <!-- 3. 底部：收起/展开按钮 (始终显示，带边框分隔) -->
             <div class="collapse-section">
                <button
                    class="collapse-trigger"
                    @click.stop="toggleCollapse"
                    :title="isCollapsed ? '展开' : '收起'"
                >
                    <!-- 收起时箭头向左(展开)，展开时箭头向右(收起) -->
                    <ChevronLeft v-if="isCollapsed" :size="16" />
                    <ChevronRight v-else :size="16" />
                </button>
             </div>

            <!-- 导出菜单 (左侧弹出) -->
        </div>

        <!-- 导出菜单 (移出 overflow: hidden 容器) -->
        <Transition name="fade">
            <div v-if="showExportMenu && !isSelectionMode && !isCollapsed" class="dock-menu">
                <div class="menu-header">导出当前对话</div>
                <button @click="handleExportAll('image')"><Image :size="14" />图片</button>
                <button @click="handleExportAll('pdf')"><FileText :size="14" />PDF</button>
                <button @click="handleExportAll('markdown')"><Download :size="14" />MD</button>
            </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.floating-dock-container {
    position: fixed;
    right: 0;
    z-index: 100;
    display: flex;
    flex-direction: column; /* 垂直 */
    pointer-events: none;
}

/* 主体 Dock 样式 */
.floating-dock {
    pointer-events: auto;
    background: rgba(255, 255, 255, 0.9);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow: -4px 4px 20px rgba(0, 0, 0, 0.1);
    border: 1px solid rgba(255,255,255,0.4);
    border-right: none;

    border-top-left-radius: 12px;
    border-bottom-left-radius: 12px;

    padding: 0; /* 内部用 flex 控制 */
    display: flex;
    flex-direction: column; /* 垂直布局 */
    align-items: center;
    width: 42px; /* 固定宽度 */

    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    overflow: hidden; /* 隐藏动画过程中的溢出 */
}

.dark .floating-dock {
    background: rgba(20, 20, 23, 0.85); /* 更深沉的背景 */
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: -4px 4px 24px rgba(0, 0, 0, 0.5); /* 更重的阴影 */
    backdrop-filter: blur(24px); /* 加强毛玻璃 */
}

.floating-dock:hover {
    box-shadow: -6px 6px 28px rgba(0, 0, 0, 0.15);
}

/* 拖动手柄区 */
.dock-header {
    width: 100%;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: grab;
    padding-top: 4px;
}
.dragging .dock-header {
    cursor: grabbing;
}

/* 内容区 */
.dock-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
    padding: 4px 0 8px 0;
    transition: all 0.3s ease;
    opacity: 1;
    max-height: 500px;
}

.dock-content.hidden {
    opacity: 0;
    max-height: 0;
    padding: 0;
    overflow: hidden;
}

.tools-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: center;
    width: 100%;
}

/* 底部收起区 */
.collapse-section {
    width: 100%;
    border-top: 1px solid rgba(0,0,0,0.06); /* 分隔线 */
    display: flex;
    justify-content: center;
     background: rgba(255,255,255,0.3);
}
.dark .collapse-section {
    border-color: rgba(255,255,255,0.06);
    background: rgba(0,0,0,0.2);
}

.collapse-trigger {
    width: 100%;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    cursor: pointer;
    color: #999;
    transition: all 0.2s;
}

.collapse-trigger:hover {
    background: rgba(0,0,0,0.03);
    color: #555;
}
.dark .collapse-trigger:hover {
    background: rgba(255,255,255,0.05);
    color: #ddd;
}

/* 收起状态的特殊样式 */
.floating-dock.collapsed {
    width: 24px; /* 变窄 */
    border-top-left-radius: 8px; /* 圆角变小 */
    border-bottom-left-radius: 8px;
    background: rgba(255,255,255,0.6); /* 更透明 */
}
.dark .floating-dock.collapsed {
    background: rgba(30,31,36,0.6);
}

.floating-dock.collapsed .collapse-section {
    border-top: none; /* 收起时去掉分隔线 */
    background: transparent;
}
.floating-dock.collapsed .collapse-trigger {
    height: 48px; /* 增加点击区域 */
}


/* 按钮样式 */
.dock-button {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: #666;
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
}
.dark .dock-button {
    color: #999;
}

.dock-button:hover:not(:disabled) {
    background: rgba(0,0,0,0.05);
    color: #333;
    transform: scale(1.05);
}
.dark .dock-button:hover:not(:disabled) {
    background: rgba(255,255,255,0.1);
    color: #fff;
}

.dock-button.active {
    background: #10a37f !important;
    color: white !important;
}

.division-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: rgba(0,0,0,0.1);
    margin: 2px 0;
}
.dark .division-dot {
    background: rgba(255,255,255,0.2);
}

.badge {
    position: absolute;
    top: -2px;
    right: -2px;
    background: #FF4136;
    color: white;
    font-size: 9px;
    font-weight: 700;
    min-width: 12px;
    height: 12px;
    line-height: 12px;
    border-radius: 6px;
    text-align: center;
    padding: 0 2px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
}

/* 侧边菜单 */
.dock-menu {
    position: absolute;
    right: 100%;
    top: 94px; /* 调整位置以对齐按钮 */
    margin-right: 12px;
    background: rgba(255,255,255,0.95);
    backdrop-filter: blur(12px);
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    padding: 6px;
    min-width: 120px;
    border: 1px solid rgba(0,0,0,0.05);
    animation: fade-in-left 0.2s ease;
    pointer-events: auto; /* 必须启用，因为父容器禁用了 */
}
.dark .dock-menu {
    background: rgba(30,31,36,0.95);
    border-color: rgba(255,255,255,0.08);
}

@keyframes fade-in-left {
    from { opacity: 0; transform: translateX(10px); }
    to { opacity: 1; transform: translateX(0); }
}

.menu-header {
    font-size: 10px;
    color: #999;
    padding: 4px 8px 6px;
    border-bottom: 1px solid rgba(0,0,0,0.05);
    margin-bottom: 4px;
}

.dock-menu button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    color: #444;
}
.dark .dock-menu button { color: #ccc; }
.dock-menu button:hover { background: rgba(0,0,0,0.05); }
.dark .dock-menu button:hover { background: rgba(255,255,255,0.08); }

/* Animation */
.slide-fade-enter-active,
.slide-fade-leave-active {
    transition: all 0.3s ease;
}
.slide-fade-enter-from,
.slide-fade-leave-to {
    opacity: 0;
    transform: translateX(20px);
}
</style>
