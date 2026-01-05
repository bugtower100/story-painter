<template>
  <div ref="containerRef" class="virtual-list-container" @scroll="handleScroll">
    <div :style="{ height: `${phantomHeight}px` }" id="virtual-list-phantom"></div>

    <div ref="contentRef" class="virtual-list-content" :style="{ transform: `translateY(${contentOffset}px)` }">
      <div
        v-for="(source, index) in visibleData"
        :key="source[trackBy] || index"
        :data-index="startIndex + index"
        class="virtual-list-item"
        :class="{ [highlightClass]: (startIndex + index) === highlightIndex }"
      >
        <slot name="item" :item="source" :index="startIndex + index"></slot>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick, watch } from 'vue';

// --- 1. Props 参数定义 ---
const props = defineProps({
  // 必须：完整的数据源数组
  data: {
    type: Array,
    required: true,
  },
  // 必须：列表容器的高度 (px)
  containerHeight: {
    type: Number,
    required: true,
  },
  // 可选：用于 Vue key 追踪的字段名 (默认为 'id')
  trackBy: {
    type: String,
    default: 'id',
  },
  // 可选：预估的平均高度 (用于初始化，避免滚动条跳动)
  estimatedItemHeight: {
    type: Number,
    default: 100,
  },
  // 可选：在当前视口上下多渲染的缓冲项数量
  buffer: {
    type: Number,
    default: 5,
  },
  // 可选：高亮项的全局索引 (用于搜索跳转)
  highlightIndex: {
    type: Number,
    default: -1,
  },
  // 可选：高亮项的 CSS 类名
  highlightClass: {
    type: String,
    default: 'highlight',
  },
});

// --- 2. 状态与引用 (Refs) ---
const containerRef = ref(null);
const contentRef = ref(null);

const startIndex = ref(0);
const endIndex = ref(0);
const scrollTop = ref(0);

// 高度缓存和偏移缓存 (需要响应式，但由于数据量大，我们手动管理，避免 Vue 深度劫持开销)
const state = reactive({
  itemHeights: [],    // [height1, height2, ...]
  offsetCache: [],    // [offset1, offset2, ...]
  isJumping: false,   // 是否正在执行平滑跳转
});

// --- 3. 计算属性 (Computed) ---

// 1. 占位元素总高度
const phantomHeight = computed(() => {
  const lastOffset = state.offsetCache[state.offsetCache.length - 1] || 0;
  const lastHeight = state.itemHeights[state.itemHeights.length - 1] || 0;
  return lastOffset + lastHeight;
});

// 2. 实际渲染内容的垂直偏移量
const contentOffset = computed(() => state.offsetCache[startIndex.value] || 0);

// 3. 可见数据 (切片后的实际渲染数据)
const visibleData = computed(() => {
  return props.data.slice(startIndex.value, endIndex.value);
});


// --- 4. 核心方法：高度与偏移量计算 ---

/**
 * 查找给定滚动偏移量对应的起始索引 (使用二分查找提高效率)
 * @param {number} offset - 滚动位置
 */
const findStartIndexByOffset = (offset) => {
  let low = 0;
  let high = state.offsetCache.length - 1;
  let index = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (state.offsetCache[mid] <= offset) {
      index = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return index;
};

/**
 * 更新高度缓存和偏移缓存
 */
const updateCaches = () => {
  // 初始化/重置缓存
  if (state.itemHeights.length !== props.data.length) {
    state.itemHeights = new Array(props.data.length).fill(props.estimatedItemHeight);
  }
  state.offsetCache = [];
  
  let currentOffset = 0;
  
  // 1. 计算所有项的累计偏移量
  for (let i = 0; i < props.data.length; i++) {
    state.offsetCache[i] = currentOffset;
    currentOffset += state.itemHeights[i];
  }

  // 2. 遍历当前渲染的 DOM 元素，获取实际高度并校正缓存
  if (contentRef.value) {
    const items = contentRef.value.children;
    for (let i = 0; i < items.length; i++) {
      const globalIndex = startIndex.value + i;
      const itemEl = items[i];
      if (globalIndex < props.data.length) {
        // offsetHeight 获取实际渲染高度 (包括 padding/border)
        const actualHeight = itemEl.offsetHeight + (parseFloat(getComputedStyle(itemEl).marginBottom) || 0);
        
        if (actualHeight > 0 && actualHeight !== state.itemHeights[globalIndex]) {
           // 只有当高度实际发生变化时才更新
           state.itemHeights[globalIndex] = actualHeight;
        }
      }
    }
  }
  
  // 3. 重新计算一次偏移缓存，因为 itemHeights 可能更新了
  state.offsetCache = [];
  currentOffset = 0;
  for (let i = 0; i < props.data.length; i++) {
      state.offsetCache[i] = currentOffset;
      currentOffset += state.itemHeights[i];
  }
};


// --- 5. 渲染逻辑 ---

/**
 * 虚拟列表渲染函数
 */
const virtualRender = () => {
  if (state.isJumping) return;
  
  // 1. 更新缓存（确保 phantomHeight 和 offsetCache 最新）
  updateCaches(); 

  // 2. 计算起始索引 (考虑上缓冲)
  const bufferPx = props.buffer * props.estimatedItemHeight; // 缓冲像素
  const startOffset = Math.max(0, scrollTop.value - bufferPx);
  startIndex.value = findStartIndexByOffset(startOffset); 

  // 3. 计算结束索引 (考虑下缓冲)
  const endOffset = scrollTop.value + props.containerHeight + bufferPx;
  endIndex.value = findStartIndexByOffset(endOffset) + 1;
  endIndex.value = Math.min(props.data.length, endIndex.value);
  
  // 避免 buffer 导致 endIndex < startIndex
  if (endIndex.value <= startIndex.value) {
      endIndex.value = startIndex.value + 1;
  }
};


// --- 6. 事件处理与暴露方法 ---

/**
 * 滚动事件处理函数
 */
const handleScroll = (e) => {
  scrollTop.value = e.target.scrollTop;
  // 使用 nextTick 确保 scrollTop 更新后进行渲染，防止频繁触发
  nextTick(virtualRender);
};

/**
 * 暴露给父组件的跳转方法
 * @param {number} globalIndex - 要跳转到的子项的全局索引
 */
const jumpTo = (globalIndex) => {
  if (!containerRef.value || globalIndex < 0 || globalIndex >= props.data.length) {
    console.error('无效的跳转索引或容器未挂载');
    return;
  }
  
  // 1. 确保缓存是最新的，以获得精确的滚动位置
  updateCaches(); 
  
  // 2. 获取精确的滚动位置
  const targetOffset = state.offsetCache[globalIndex];

  // 3. 标记正在跳转
  state.isJumping = true;
  
  // 4. 滚动容器 (自动滑动/平滑滚动)
  containerRef.value.scrollTo({
    top: targetOffset,
    behavior: 'smooth',
  });

  // 5. 滚动结束后，清除标记并重新渲染，确保高亮和缓存更新
  // 监听 scrollend 是最佳实践，但兼容性较差，这里使用 setTimeout 模拟
  // 优化：在滚动过程中，Vue 会触发多次 virtualRender，高亮项最终会进入可视区。
  setTimeout(() => {
    state.isJumping = false;
    virtualRender(); // 确保最终状态正确
  }, 500); // 预留 500ms 给平滑滚动
};


// --- 7. 生命周期与监听 ---

onMounted(() => {
  // 首次挂载时，执行初始渲染
  updateCaches(); 
  virtualRender();
  // 设置容器高度
  if (containerRef.value) {
      containerRef.value.style.height = `${props.containerHeight}px`;
  }
});

// 监听数据变化：当数据源变化时，重置状态并重新渲染
watch(() => props.data.length, (newLength, oldLength) => {
    if (newLength !== oldLength) {
        // 数据变化，重置高度缓存
        state.itemHeights = new Array(newLength).fill(props.estimatedItemHeight);
        state.offsetCache = [];
        containerRef.value.scrollTop = 0;
        scrollTop.value = 0;
        nextTick(virtualRender);
    }
});


// 监听容器高度变化 (如果父组件动态修改了 containerHeight)
watch(() => props.containerHeight, (newHeight) => {
    if (containerRef.value) {
        containerRef.value.style.height = `${newHeight}px`;
    }
    nextTick(virtualRender);
});

// 将跳转方法暴露给父组件 (通过 template ref 调用)
defineExpose({
  jumpTo,
});
</script>

<style scoped>
.virtual-list-container {
  overflow-y: auto;
  position: relative;
  /* 必须设置高度，否则无法滚动 */
}

#virtual-list-phantom {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: -1; /* 确保不覆盖内容 */
}

.virtual-list-content {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  /* 使用 will-change 优化性能 */
  will-change: transform; 
}

/* 子项样式：如果子项没有设置 margin-bottom，需要在这里添加 */
.virtual-list-item {
  box-sizing: border-box;
  /* 确保子项能够自然撑开高度 */
}

/* 默认高亮样式 (可被父组件覆盖) */
.virtual-list-item.highlight {
    outline: 2px solid #ff0000; 
    box-shadow: 0 0 5px rgba(255, 0, 0, 0.5);
    transition: all 0.2s;
}
</style>