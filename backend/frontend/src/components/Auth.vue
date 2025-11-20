<template>
  <div class="auth-modal-overlay" v-if="show">
    <div class="auth-modal">
      <h2 class="auth-title">{{ isRegister ? '新用户注册' : '用户登录' }}</h2>
      
      <form @submit.prevent="handleSubmit" class="auth-form">
        <input 
          v-model="username" 
          placeholder="用户名" 
          required 
          class="input-dark"
        />
        <input 
          v-model="password" 
          type="password" 
          placeholder="密码" 
          required 
          class="input-dark"
        />
        
        <button type="submit" class="btn-primary auth-submit-btn">
          {{ isRegister ? '立即注册' : '登录' }}
        </button>
      </form>

      <p class="auth-toggle" @click="isRegister = !isRegister">
        {{ isRegister ? '已有账号？去登录' : '没有账号？去注册' }}
      </p>

      <p v-if="message" :class="['auth-message', { 'error': isError }]">{{ message }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, defineProps, defineEmits } from 'vue';
import axios from 'axios';

// ------------------- Props & Emits -------------------
const props = defineProps({
  show: Boolean,
});

const emits = defineEmits(['auth-success']);

// ------------------- 状态 -------------------
const isRegister = ref(false); // 切换注册/登录视图
const username = ref('');
const password = ref('');
const message = ref('');
const isError = ref(false);

const API_BASE = 'https://watchparty-nhd0.onrender.com/api/auth';

// ------------------- 方法 -------------------

// 统一处理表单提交
const handleSubmit = async () => {
  const endpoint = isRegister.value ? 'register' : 'login';
  const url = `${API_BASE}/${endpoint}`;

  message.value = ''; // 清除旧消息
  isError.value = false;

  try {
    const response = await axios.post(url, {
      username: username.value,
      password: password.value,
    });

    const { token, user } = response.data;
    
    // 1. 存储 JWT 到本地
    localStorage.setItem('userToken', token);
    
    // 2. 更新应用状态
    emits('auth-success', { username: user.username, token });

  } catch (err) {
    isError.value = true;
    
    // 从后端返回的JSON中获取错误信息
    if (err.response && err.response.data && err.response.data.message) {
      message.value = err.response.data.message;
    } else {
      message.value = '认证失败，请检查网络或服务器。';
    }
  }
};
</script>

<style scoped>
/* 认证模态框样式 - 极简暗黑风 */
.auth-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.auth-modal {
  background: #1e1e1e;
  padding: 30px;
  border-radius: 10px;
  box-shadow: 0 0 40px rgba(0, 0, 0, 0.5);
  width: 350px;
  text-align: center;
}

.auth-title {
  color: #007bff;
  margin-bottom: 25px;
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.input-dark {
  background: #2a2a2a;
  border: 1px solid #444;
  color: white;
  padding: 12px;
  border-radius: 6px;
  font-size: 16px;
}

.auth-submit-btn {
  background: #007bff;
  color: white;
  border: none;
  padding: 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 16px;
  transition: background 0.2s;
}

.auth-toggle {
  color: #888;
  margin-top: 20px;
  cursor: pointer;
  font-size: 14px;
  transition: color 0.2s;
}

.auth-toggle:hover {
  color: #007bff;
}

.auth-message {
  margin-top: 15px;
  padding: 10px;
  border-radius: 4px;
  font-size: 14px;
  color: #00ff88;
  background: #00301a;
}

.auth-message.error {
  color: #ff4d4d;
  background: #300000;
}
</style>