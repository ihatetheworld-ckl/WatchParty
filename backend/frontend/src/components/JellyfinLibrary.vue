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
      <div v-else-if="loadError" class="loading" style="color: red;">
        加载失败：{{ loadError }}
      </div>

      <div v-else class="movie-grid">
        <div 
          v-for="movie in movies" 
          :key="movie.id" 
          class="movie-card" 
          @click="selectMovie(movie)"
        >
          <div class="poster-wrapper">
            <img :src="movie.imageUrl" :alt="movie.name" loading="lazy" />
            <div class="play-icon">▶</div>
          </div>
          <div class="movie-info">
            <h3>{{ movie.name }}</h3>
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

// 🚨 已替换为你的 云服务器 公网 IP 和端口！
const BACKEND_URL = 'http://13.158.77.147:3001';

const movies = ref([]);
const loading = ref(true);
const loadError = ref(null);

const fetchMovies = async () => {
  loading.value = true;
  loadError.value = null;
  try {
    // 确保这里的 URL 使用了正确的 IP
    const res = await fetch(`${BACKEND_URL}/api/jellyfin/movies`);
    if (!res.ok) throw new Error('获取影库列表失败');
    movies.value = await res.json();
  } catch (err) {
    console.error(err);
    loadError.value = '无法加载影库，请检查后端连接或 Jellyfin 配置。';
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
    // 首次加载组件时立即获取数据
    fetchMovies();
});

const close = () => emit('close');


const selectMovie = async (movie) => {
    loading.value = true;
    loadError.value = null;

    try {
        // 1. 通过 API 路由获取流 URL (使用 movie.id)
        const res = await fetch(`${BACKEND_URL}/api/jellyfin/stream/${movie.id}`);
        if (!res.ok) throw new Error('获取影片流直链失败');
        
        const data = await res.json();
        const streamUrl = data.url; // 从后端获取流 URL

        // 2. 将直链和影片名传回给 App.vue
        emit('select', streamUrl, movie.name);
        close();
        
    } catch (err) {
        console.error('选择影片失败:', err);
        alert('无法获取影片流地址，请检查 Jellyfin 服务和后端日志。');
    } finally {
        loading.value = false;
    }
};
</script>

<style scoped>
/* 完整的样式代码，已包含在内 */
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

.library-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 20px; border-bottom: 1px solid #333; padding-bottom: 10px;
}

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