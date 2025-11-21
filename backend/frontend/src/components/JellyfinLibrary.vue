// 文件: frontend/src/components/JellyfinLibrary.vue

<template>
  <div v-if="isOpen" class="library-overlay">
    <div class="library-modal">
      <div class="library-header">
        <h2>🎬 我的私人影库 (Jellyfin)</h2>
        <button @click="close" class="close-btn">×</button>
      </div>

      <div v-if="loading" class="loading">
        加载中...
      </div>
      
      <div v-else-if="currentSeriesId" class="episode-view">
        <div class="episode-header">
            <h3>{{ currentSeriesName }} - 剧集列表</h3>
            <button @click="backToLibrary" class="btn-secondary">← 返回媒体库</button>
        </div>
        
        <div class="movie-grid">
            <div 
                v-for="item in episodes" 
                :key="item.id" 
                class="movie-card" 
                @click="selectItem(item)"
            >
                <div class="poster-wrapper">
                    <img :src="item.imageUrl" :alt="item.name" loading="lazy" />
                    <div class="play-icon">▶</div>
                </div>
                <div class="movie-info">
                    <h3>S{{ item.seasonNumber || '?' }}E{{ item.episodeNumber || '?' }} - {{ item.name }}</h3>
                </div>
            </div>
        </div>
      </div>

      <div v-else class="movie-grid">
        <div 
          v-for="item in items" 
          :key="item.id" 
          class="movie-card" 
          @click="selectItem(item)"
        >
          <div class="poster-wrapper">
            <img :src="item.imageUrl" :alt="item.name" loading="lazy" />
            <div class="play-icon">{{ item.type === 'Series' ? '📂' : '▶' }}</div>
          </div>
          <div class="movie-info">
            <h3>{{ item.name }} ({{ item.type === 'Series' ? '剧集' : '电影' }})</h3>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

const props = defineProps(['isOpen']);
const emit = defineEmits(['close', 'select']);

// 🚨 请替换为你的 Render 后端地址 (与 App.vue 中保持一致)
const BACKEND_URL = 'https://watchparty-nhd0.onrender.com';

const items = ref([]); // 存储 movies 和 series
const episodes = ref([]); // 存储当前剧集的单集列表
const currentSeriesId = ref(null); 
const currentSeriesName = ref(''); 
const loading = ref(true);

onMounted(async () => {
  // 仅在组件挂载时加载一次数据
  await fetchLibrary();
});

// 独立函数：获取媒体库
const fetchLibrary = async () => {
  loading.value = true;
  try {
    const res = await fetch(`${BACKEND_URL}/api/jellyfin/movies`);
    if (!res.ok) throw new Error('获取失败');
    // 💡 确保 items 列表始终包含电影和剧集
    items.value = await res.json();
  } catch (err) {
    console.error(err);
    alert('无法加载影库，请检查后端连接或 Jellyfin 配置');
  } finally {
    loading.value = false;
  }
};

// 💡 新增：获取剧集下的所有单集
const fetchEpisodes = async (seriesId, seriesName) => {
    loading.value = true;
    try {
        const res = await fetch(`${BACKEND_URL}/api/jellyfin/episodes/${seriesId}`);
        if (!res.ok) throw new Error('Failed to fetch episodes');
        
        const data = await res.json();
        
        currentSeriesId.value = seriesId;
        currentSeriesName.value = seriesName;
        episodes.value = data.episodes;
    } catch (error) {
        console.error('Fetch Episodes Error:', error);
        alert('无法加载单集列表，请检查后端路由是否正确。');
    } finally {
        loading.value = false;
    }
};

// 💡 新增：获取播放流 URL 并播放
const getStreamAndPlay = async (itemId, itemName) => {
    try {
        const res = await fetch(`${BACKEND_URL}/api/jellyfin/stream/${itemId}`);
        if (!res.ok) throw new Error('Failed to get stream URL');
        
        const data = await res.json();
        
        // 将完整的 URL 传回给 App.vue
        emit('select', data.url, itemName);
        close();
    } catch (error) {
        console.error('Get Stream URL Error:', error);
        alert('无法获取播放流，请检查 Jellyfin 服务和网络。');
    }
};


const close = () => emit('close');

// 💡 返回媒体库主视图
const backToLibrary = () => {
    currentSeriesId.value = null;
    episodes.value = [];
    currentSeriesName.value = '';
}

// 💡 核心逻辑：处理点击事件 (无论是媒体库主项还是单集)
const selectItem = (item) => {
    // 1. 如果是剧集 (Series)，则进入选集视图
    if (item.type === 'Series') {
        fetchEpisodes(item.id, item.name);
    } 
    // 2. 如果是电影 (Movie) 或单集 (Episode)，则获取播放流并播放
    else if (item.type === 'Movie' || item.type === 'Episode') {
        getStreamAndPlay(item.id, item.name);
    }
    // 忽略 Season, BoxSet 等其他类型
};
</script>

<style scoped>
/* 样式保持不变，但新增 episode-header 样式 */
.library-overlay {
  position: fixed; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: 1000;
  display: flex; justify-content: center; align-items: center;
}

.library-modal {
  background: #1e1e1e;
  width: 90%; max-width: 1000px; height: 80vh;
  border-radius: 12px;
  display: flex; flex-direction: column;
  padding: 20px;
  box-shadow: 0 0 20px rgba(0,0,0,0.5);
}

.library-header, .episode-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 20px; border-bottom: 1px solid #333; padding-bottom: 10px;
}

.episode-header h3 { margin: 0; }
.btn-secondary { background: #444; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; transition: background 0.2s; }
.btn-secondary:hover { background: #555; }


.close-btn {
  background: none; border: none; color: #fff; font-size: 30px; cursor: pointer;
}

.movie-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 20px;
  overflow-y: auto;
  padding-right: 10px;
}

.movie-card {
  background: #2a2a2a; border-radius: 8px; overflow: hidden;
  cursor: pointer; transition: transform 0.2s;
}

.movie-card:hover { transform: scale(1.05); background: #333; }

.poster-wrapper { position: relative; aspect-ratio: 2/3; }
.poster-wrapper img { width: 100%; height: 100%; object-fit: cover; }

.play-icon {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  font-size: 40px; opacity: 0; transition: opacity 0.2s;
}
.movie-card:hover .play-icon { opacity: 1; }

.movie-info { padding: 10px; text-align: center; }
.movie-info h3 { margin: 0; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.loading { color: white; text-align: center; margin-top: 50px; }
</style>