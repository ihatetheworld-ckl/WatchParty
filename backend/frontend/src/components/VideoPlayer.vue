<template>
  <div class="player-container">
    <div ref="artRef" class="artplayer-box"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import Artplayer from 'artplayer';
import artplayerPluginDanmuku from 'artplayer-plugin-danmuku'; // 引入弹幕插件

const props = defineProps({
  option: Object,     // 播放器基础配置
  socket: Object,     // Socket 实例
  roomId: String,     // 当前房间号
});

const emits = defineEmits(['onMessage']); // 声明发射事件

const artRef = ref(null);
let art = null;
let isRemoteUpdate = false; // 关键标志位：防止同步死循环

onMounted(() => {
  // 1. 初始化 Artplayer
  art = new Artplayer({
    ...props.option,
    container: artRef.value,
    setting: true,
    playbackRate: true,
    fullscreen: true,
    autosize: true,
    
    // 弹幕插件配置
    plugins: [
        artplayerPluginDanmuku({
            danmuku: [], 
            speed: 5,   
            opacity: 0.8,
            fontSize: 25,
            color: '#FFFFFF',
        }),
    ],
  });

  // 2. 监听 Socket 广播的事件 (接收端)
  if (props.socket) {
    // 同步播放
    props.socket.on('sync_play', ({ currentTime }) => {
      isRemoteUpdate = true;
      if (Math.abs(art.currentTime - currentTime) > 1.5) { // 误差大于1.5秒才跳转
        art.seek = currentTime;
      }
      art.play();
      setTimeout(() => { isRemoteUpdate = false; }, 500);
    });

    // 同步暂停
    props.socket.on('sync_pause', ({ currentTime }) => {
      isRemoteUpdate = true;
      art.pause();
      art.currentTime = currentTime;
      setTimeout(() => { isRemoteUpdate = false; }, 500);
    });

    // 同步跳转
    props.socket.on('sync_seek', ({ currentTime }) => {
      isRemoteUpdate = true;
      art.currentTime = currentTime;
      setTimeout(() => { isRemoteUpdate = false; }, 500);
    });
    
    // 接收聊天或弹幕消息
    props.socket.on('receive_message', (data) => {
        // 通知父组件更新聊天日志
        emits('onMessage', data); 

        // 如果是弹幕，则发射到播放器上
        if (data.type === 'danmaku' && art.plugins.artplayerPluginDanmuku) {
            art.plugins.artplayerPluginDanmuku.emit({
                text: data.message,
                color: data.color || '#FFFFFF',
                mode: data.mode || 0, // 0: 滚动，1: 顶部，2: 底部
            });
        }
    });
  }

  // 3. 监听播放器本地操作 (发送端)
  art.on('play', () => {
    if (!isRemoteUpdate) {
      props.socket.emit('play', { roomId: props.roomId, currentTime: art.currentTime });
    }
  });

  art.on('pause', () => {
    if (!isRemoteUpdate) {
      props.socket.emit('pause', { roomId: props.roomId, currentTime: art.currentTime });
    }
  });

  art.on('seek', (currentTime) => {
    if (!isRemoteUpdate) {
      props.socket.emit('seek', { roomId: props.roomId, currentTime });
    }
  });
});

onBeforeUnmount(() => {
  if (art && art.destroy) {
    art.destroy(false);
  }
});

// 监听视频源变化
watch(() => props.option.url, (newUrl) => {
  if (art && newUrl) {
    art.switchUrl(newUrl);
  }
});
</script>

<style scoped>
.player-container {
  width: 100%;
  height: 100%;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0,0,0,0.3);
}
.artplayer-box {
  width: 100%;
  /* 调整高度以适应容器 */
  aspect-ratio: 16 / 9; 
  min-height: 400px;
}
</style>
