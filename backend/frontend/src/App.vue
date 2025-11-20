<template>
  <Auth :show="showAuth" @auth-success="handleAuthSuccess" />
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
          <input v-model="videoUrl" placeholder="粘贴视频链接 (Jellyfin 或 MP4 直链)" class="input-dark full-width" />
          <button @click="changeVideo" class="btn-secondary">切换视频</button>
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
        <div class="chat-box">
            <h3>房间聊天室 (当前用户: {{ user.username }})</h3>
            <div class="messages">
            <div v-for="(log, index) in logs" :key="index" class="msg-item" :class="[log.type, {'danmaku-msg': log.type === 'danmaku'}]">
              <span class="msg-time">[{{ log.time }}]</span>
              <span class="msg-content">
                  <span v-if="log.type !== 'system'" class="user-name">[{{ log.username }}]:</span> 
                  {{ log.text }}
              </span>
            </div>
          </div>
          
          <div class="input-area" v-if="isJoined">
            <select v-model="chatType" class="input-dark chat-select">
              <option value="chat">普通聊天</option>
              <option value="danmaku">视频弹幕</option>
            </select>
            <input 
              v-model="chatInput" 
              @keyup.enter="sendMessage" 
              placeholder="输入消息，回车发送" 
              class="input-dark chat-input"
            />
            <button @click="sendMessage" class="btn-primary">发送</button>
          </div>
          <div v-else class="input-area">
            <p style="color:#777;">请先加入房间...</p>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue';
import io from 'socket.io-client';
import VideoPlayer from './components/VideoPlayer.vue';
import Auth from './components/Auth.vue'; // ✨ 新增导入

// --- 认证状态 ---
const showAuth = ref(true); // 默认显示认证模态框
const isLoggedIn = ref(false);
const user = reactive({
    username: '',
    token: '',
});

// --- 状态管理 ---
const socket = ref(null);
const isConnected = ref(false);
const isJoined = ref(false);
const roomId = ref('1001'); // 默认房间号
const logs = reactive([]); // 使用 reactive 存储日志数组

// 聊天相关状态
const chatInput = ref('');
const chatType = ref('chat'); // 'chat' 或 'danmaku'
//const username = ref('用户' + Math.floor(Math.random() * 900 + 100)); // 随机用户名

// 播放器状态
const videoUrl = ref('https://artplayer.org/assets/sample/video.mp4'); // 默认测试链接
const playerOption = ref({
  url: videoUrl.value,
  volume: 0.5,
  isLive: false,
  muted: false,
  autoplay: false,
});

// 认证成功后的回调
const handleAuthSuccess = (authData) => {
    user.username = authData.username;
    user.token = authData.token;
    isLoggedIn.value = true;
    showAuth.value = false;
    // 确保聊天室使用正确的用户名
    addLog(`欢迎回来，${user.username}！`, 'system');
};

// --- 生命周期与连接 ---
onMounted(() => {
  // 连接后端 (注意：生产环境需要改为你的云服务器IP或域名)
  socket.value = io('http://localhost:3001');

  socket.value.on('connect', () => {
    isConnected.value = true;
    addLog('已连接到服务器', 'system');
  });

  socket.value.on('disconnect', () => {
    isConnected.value = false;
    addLog('与服务器断开连接', 'system');
  });
  
  // 监听各种同步消息用于打印日志
  socket.value.on('sync_play', () => addLog('收到: 播放指令', 'system'));
  socket.value.on('sync_pause', () => addLog('收到: 暂停指令', 'system'));
  socket.value.on('sync_seek', (d) => addLog(`收到: 跳转 ${d.currentTime.toFixed(1)}s`, 'system'));

  // ✨ 新增: 检查本地是否有 Token
    const savedToken = localStorage.getItem('userToken');
    if (savedToken) {
        // 这里应该调用API验证Token，但我们先简化为直接显示登录界面
        // 稍后会要求用户手动登录
    }
});

// --- 方法 ---
const joinRoom = () => {
  console.log('--- 尝试加入房间:', roomId.value); 
  
  if (!roomId.value) return alert('请输入房间号');
  
  // ✨ 新增诊断：打印 socket 的连接状态
  const isCurrentlyConnected = socket.value ? socket.value.connected : false;
  console.log('Socket.io 状态 (Connected?):', isCurrentlyConnected);
  
  
  if (!isCurrentlyConnected) {
    console.error('Socket 未连接，无法加入房间');
    // 强制提醒用户稍等
    return alert('未连接到服务器 (状态灯为红色)，请稍等或检查网络。');
  }
    
  socket.value.emit('join_room', roomId.value);
  isJoined.value = true;
  addLog(`成功加入房间: ${roomId.value}`, 'system');
};

const changeVideo = () => {
  playerOption.value.url = videoUrl.value; 
  addLog('切换视频源', 'system');
};

const sendMessage = () => {
    if (!chatInput.value.trim() || !isJoined.value) return;

    const data = {
        roomId: roomId.value,
        username: user.username,
        message: chatInput.value,
        type: chatType.value,
    };

    // 1. 发送给服务器
    socket.value.emit('send_message', data);
    
    // 2. 本地也显示 (因为服务器使用 socket.to 不会发给自己)
    handlePlayerMessage(data); 

    chatInput.value = ''; // 清空输入框
};

// 处理来自播放器组件（接收自 Socket）或本地发送的消息
const handlePlayerMessage = (data) => {
    addLog(data.message, data.type, data.username);
};

// 日志辅助函数
const addLog = (text, type = 'system', user = '系统') => {
    const time = new Date().toLocaleTimeString();
    // 使用 push，然后反向显示，确保新消息在底部
    logs.push({
        text: text,
        time: time,
        type: type,
        username: user
    });
};
</script>

<style>
/* 全局样式 */
body { margin: 0; background-color: #121212; color: #eee; font-family: sans-serif; }
</style>

<style scoped>
/* 局部样式 */
.app-container { max-width: 1400px; margin: 0 auto; padding: 20px; }
.header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
.status-indicator { display: inline-block; width: 10px; height: 10px; background: red; border-radius: 50%; margin-right: 10px; }
.status-indicator.connected { background: #00ff88; box-shadow: 0 0 10px #00ff88; }

.main-content { display: grid; grid-template-columns: 3fr 1fr; gap: 20px; }

.input-dark { background: #2a2a2a; border: 1px solid #444; color: white; padding: 8px 12px; border-radius: 4px; outline: none; transition: border-color 0.2s; }
.input-dark:focus { border-color: #007bff; }
.full-width { flex: 1; }
.btn-primary { background: #007bff; color: white; border: none; padding: 8px 20px; border-radius: 4px; cursor: pointer; transition: background 0.2s; }
.btn-primary:hover { background: #0056b3; }
.btn-secondary { background: #444; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; transition: background 0.2s; }
.btn-secondary:hover { background: #555; }

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
    justify-content: flex-end; /* 新消息在下方 */
}

.msg-item { 
    padding: 3px 0; 
    border-bottom: 1px dashed #333;
}
.msg-time { color: #888; margin-right: 5px; font-size: 11px; }
.user-name { font-weight: bold; color: #50b0ff; }
.system .msg-content { color: #aaa; }
.danmaku-msg .user-name { color: #fcc419; } /* 弹幕消息用户高亮 */

.input-area { 
    display: flex; 
    padding-top: 10px; 
    border-top: 1px solid #333;
}
.chat-input { flex-grow: 1; margin-right: 10px; }
.chat-select { width: 100px; margin-right: 10px; }
</style>