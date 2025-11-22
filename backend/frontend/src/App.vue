<template>
  <Auth :show="showAuth" @auth-success="handleAuthSuccess" />
  
  <JellyfinLibrary 
    v-if="showLibrary" 
    :isOpen="showLibrary" 
    @close="showLibrary = false" 
    @select="handleMovieSelect"
  />

  <div class="app-container" v-if="isLoggedIn">
    <header class="header">
      <h1>🎬 SyncCinema </h1>
      <span style="color:#007bff; margin-right: 15px;">{{ user.username }}</span>
      <div class="controls">
        <span class="status-indicator" :class="{ connected: isConnected }"></span>
        <input v-model="roomId" placeholder="输入房间号" class="input-dark" />
        <button @click="joinRoom" class="btn-primary">加入/创建房间</button>
      </div>
    </header>

    <main class="main-content">
      <div class="video-section">
        <div v-if="isJoined" class="url-input-group">
          <input v-model="videoUrl" placeholder="粘贴链接 或 点击右侧选择" class="input-dark full-width" />
          <button @click="changeVideo" class="btn-secondary">加载链接</button>
          <button @click="showLibrary = true" class="btn-primary" style="background-color: #28a745;">📂 选择影片</button>
        </div>

        <div v-if="isJoined" class="player-wrapper">
          <VideoPlayer 
            :option="playerOption" 
            :socket="socket" 
            :roomId="roomId" 
            @onMessage="handlePlayerMessage"
          />
        </div>
        
        <div v-else class="welcome-box">
          <h2>👋 欢迎使用远程同看</h2>
          <p>请输入房间号开始，请确保您的 Node.js 服务已开启</p>
        </div>
      </div>
      <div class="chat-section">
        <ChatBox 
          :messages="messages" 
          :user="user" 
          :socket="socket" 
          :roomId="roomId" 
          :isJoined="isJoined" 
          @onMessage="handleLogMessage" 
        />
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { io } from 'socket.io-client';
import VideoPlayer from './components/VideoPlayer.vue';
import ChatBox from './components/ChatBox.vue';
import Auth from './components/Auth.vue';
import JellyfinLibrary from './components/JellyfinLibrary.vue';

// 🚨 已替换为你的 云服务器 公网 IP 和端口！
// 此 URL 用于 Socket.IO 连接和 Auth 组件的 API 调用
const BACKEND_URL = 'http://13.158.77.147:3001'; 

// --- 认证状态 ---
const showAuth = ref(true);
const isLoggedIn = ref(false);
const user = ref({}); 

const handleAuthSuccess = (userData) => {
    user.value = userData;
    isLoggedIn.value = true;
    showAuth.value = false;
    addLog(`欢迎回来, ${userData.username}!`, 'system');
};

// --- Socket & Room ---
const socket = ref(null);
const roomId = ref('');
const isJoined = ref(false);
const isConnected = ref(false);

// --- Video Player ---
const videoUrl = ref('');
const playerOption = ref({
    url: '',
    title: '',
});

// --- Chat & Log ---
const messages = ref([]);
const showLibrary = ref(false);

const addLog = (text, type = 'system') => {
    messages.value.push({
        id: Date.now(),
        type: type, // 'user', 'system', 'player'
        content: text,
        timestamp: new Date().toLocaleTimeString(),
    });
};

const handleLogMessage = (msg) => {
    addLog(msg.content, msg.type);
};

const handlePlayerMessage = (msg) => {
    addLog(msg.content, 'player');
};


// --- Core Functions ---

const joinRoom = () => {
    if (!roomId.value) {
        alert('请输入房间号');
        return;
    }
    if (socket.value) {
        socket.value.emit('join_room', { roomId: roomId.value, username: user.value.username });
    }
};

const changeVideo = () => {
    if (videoUrl.value && isJoined.value) {
        playerOption.value.url = videoUrl.value;
        socket.value.emit('change_video', { roomId: roomId.value, url: videoUrl.value });
        addLog(`已加载新视频: ${videoUrl.value}`, 'system');
    }
};

// --- 影片选择处理 ---
const handleMovieSelect = (url, name) => {
    videoUrl.value = url;
    playerOption.value.url = url;
    playerOption.value.title = name; // 更新标题
    addLog(`已选择影片: ${name}`, 'system');
    if (isJoined.value) {
        socket.value.emit('change_video', { roomId: roomId.value, url: url });
    }
};


// --- Lifecycle & Connection ---

onMounted(() => {
    // 初始化 Socket.io 连接
    socket.value = io(BACKEND_URL);

    socket.value.on('connect', () => {
        isConnected.value = true;
        addLog('已连接到服务器', 'system');
    });

    socket.value.on('disconnect', () => {
        isConnected.value = false;
        isJoined.value = false;
        addLog('与服务器断开连接', 'system');
    });

    socket.value.on('room_joined', (data) => {
        isJoined.value = true;
        addLog(`已加入房间: ${data.roomId}`, 'system');
        
        // 第一次加入房间时，同步当前视频
        if (data.currentUrl) {
            videoUrl.value = data.currentUrl;
            playerOption.value.url = data.currentUrl;
            addLog('已同步房间当前视频', 'system');
        }
    });

    socket.value.on('room_error', (data) => {
        alert(`房间错误: ${data.message}`);
        isJoined.value = false;
    });

    socket.value.on('chat_message', (data) => {
        addLog(`${data.username}: ${data.content}`, 'user');
    });

    socket.value.on('video_changed', (data) => {
        playerOption.value.url = data.url;
        videoUrl.value = data.url; // 更新输入框
        addLog(`房间视频已切换到: ${data.url}`, 'system');
    });

    socket.value.on('member_joined', (data) => {
        addLog(`${data.username} 加入了房间`, 'system');
    });

    socket.value.on('member_left', (data) => {
        addLog(`${data.username} 离开了房间`, 'system');
    });

});

</script>

<style>
/* (样式代码保持不变) */
:root {
  --primary-color: #007bff;
  --bg-color: #121212;
  --card-bg: #1e1e1e;
  --text-color: #f0f0f0;
}

body {
    margin: 0;
    font-family: Arial, sans-serif;
    background-color: var(--bg-color);
    color: var(--text-color);
}

.app-container {
    padding: 20px;
}

.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding-bottom: 10px;
    border-bottom: 1px solid #333;
}

.header h1 {
    margin: 0;
    font-size: 24px;
    color: var(--primary-color);
}

.controls {
    display: flex;
    align-items: center;
    gap: 10px;
}

.status-indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: #f00; /* Disconnected */
    display: inline-block;
    transition: background-color 0.3s;
}

.status-indicator.connected {
    background-color: #0f0;
}

.input-dark {
    padding: 8px;
    border: 1px solid #333;
    background-color: #222;
    color: var(--text-color);
    border-radius: 4px;
}

.btn-primary { 
    background: var(--primary-color); 
    color: white; 
    border: none; 
    padding: 8px 15px; 
    border-radius: 4px; 
    cursor: pointer; 
    transition: background 0.2s; 
    margin-left: 10px; 
}
.btn-primary:hover { background: #0056b3; }

.btn-secondary { 
    background: #444; 
    color: white; 
    border: none; 
    padding: 8px 15px; 
    border-radius: 4px; 
    cursor: pointer; 
    transition: background 0.2s; 
    margin-left: 10px; 
}
.btn-secondary:hover { background: #555; }

.main-content {
    display: grid;
    grid-template-columns: 3fr 1fr; /* 视频占 3/4，聊天占 1/4 */
    gap: 20px;
}

.video-section { display: flex; flex-direction: column; gap: 15px; }
.url-input-group { display: flex; gap: 10px; }
.player-wrapper { width: 100%; }

.welcome-box { height: 600px; background: #1e1e1e; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 8px; color: #666; }

/* 聊天区样式 */
.chat-box { 
    background: #1e1e1e; 
    height: 650px; 
    padding: 15px; 
    border-radius: 8px; 
    display: flex;
    flex-direction: column;
}
.messages { 
    flex-grow: 1; 
    overflow-y: auto; 
    font-size: 13px; 
    color: #eee; 
    display: flex; 
    flex-direction: column; 
    padding-right: 5px;
}

/* 滚动条美化 */
.messages::-webkit-scrollbar { width: 8px; }
.messages::-webkit-scrollbar-track { background: #1e1e1e; }
.messages::-webkit-scrollbar-thumb { background: #555; border-radius: 4px; }
.messages::-webkit-scrollbar-thumb:hover { background: #777; }

/* 消息行 */
.message-row { 
    margin-bottom: 5px; 
    line-height: 1.4;
    word-wrap: break-word;
}
.message-row.system { color: #aaa; font-style: italic; }
.message-row.player { color: #fcc400; font-style: italic; }

.username { 
    font-weight: bold; 
    color: var(--primary-color); 
    margin-right: 5px;
}

.timestamp { 
    color: #666; 
    font-size: 10px; 
    margin-left: 5px;
}

.message-input-group {
    display: flex;
    margin-top: 10px;
}

.message-input {
    flex-grow: 1;
    margin-right: 10px;
}
</style>