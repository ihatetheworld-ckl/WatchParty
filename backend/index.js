const { httpServer } = require('./server'); // 引入 server.js 创建的 HTTP 服务器
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken'); // 引入 jsonwebtoken 依赖

// 🚨 必须定义 JWT_SECRET，并确保它与 authController.js 中的密钥完全一致！
const JWT_SECRET = 'ihatetheworld'; 

// 简单的内存存储房间状态 (必须在 io.on 外部定义)
const rooms = {}; 

// 配置 Socket.io
const io = new Server(httpServer, {
    cors: {
        // 生产环境需改为你的前端域名
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

// ------------------- Socket.io 认证中间件 -------------------
io.use((socket, next) => {
    // 从连接的查询参数中获取 Token
    const token = socket.handshake.query.token;

    if (!token) {
        // 允许未认证用户连接，但 socket.user 不会被设置
        return next(); 
    }

    try {
        // 验证 Token
        const decoded = jwt.verify(token, JWT_SECRET);
        // 将解码后的用户信息（userId, username）附加到 socket 对象上
        socket.user = decoded; 
        next(); // 验证成功
    } catch (err) {
        // ✨ 新增：打印验证失败的原因
        console.error("❌ Socket Token 验证失败！错误信息:", err.message);
        // Token 无效或过期，记录错误但不阻止连接（如果允许未认证观看）
        console.error("Socket Auth Error: Invalid or expired token");
        return next(); 
    }
});
// -----------------------------------------------------------


io.on('connection', (socket) => {
    // 检查 socket.user 来确定用户身份
    const userIdentifier = socket.user ? socket.user.username : socket.id;
    console.log(`用户连接: ${socket.id} (身份: ${userIdentifier})`);

    // --- 房间管理与状态同步 ---
    socket.on('join_room', (roomId) => {
        socket.join(roomId);
        
        // 🚨 确保日志显示真实用户名或 Socket ID
        const currentIdentifier = socket.user ? socket.user.username : socket.id;
        console.log(`用户 ${currentIdentifier} 加入房间: ${roomId}`);
        
        if (!rooms[roomId]) {
            // 如果房间不存在，则初始化房间状态
            rooms[roomId] = { isPlaying: false, currentTime: 0, updateTime: Date.now() };
        }

        // 发送当前房间状态给新加入的人
        socket.emit('sync_status', rooms[roomId]);
    });

    // --- 播放同步信令 ---
    socket.on('play', ({ roomId, currentTime }) => {
        // ⚠️ 建议在这里添加权限检查: if (!socket.user) return;
        if (rooms[roomId]) {
            rooms[roomId].isPlaying = true;
            rooms[roomId].currentTime = currentTime;
            rooms[roomId].updateTime = Date.now();
            
            // 广播给房间内 *除自己以外* 的所有人
            socket.to(roomId).emit('sync_play', { currentTime });
        }
    });

    socket.on('pause', ({ roomId, currentTime }) => {
        // ⚠️ 建议在这里添加权限检查: if (!socket.user) return;
        if (rooms[roomId]) {
            rooms[roomId].isPlaying = false;
            rooms[roomId].currentTime = currentTime;
            
            socket.to(roomId).emit('sync_pause', { currentTime });
        }
    });

    socket.on('seek', ({ roomId, currentTime }) => {
        // ⚠️ 建议在这里添加权限检查: if (!socket.user) return;
        if (rooms[roomId]) {
            rooms[roomId].currentTime = currentTime;
            rooms[roomId].updateTime = Date.now(); 
            socket.to(roomId).emit('sync_seek', { currentTime });
        }
    });
    
    // --- 聊天/弹幕转发 ---
    socket.on('send_message', (data) => {
        // 广播给房间内 *除自己以外* 的所有人 (data 包含 username)
        socket.to(data.roomId).emit('receive_message', data);
    });

    socket.on('disconnect', () => {
        const disconnectedIdentifier = socket.user ? socket.user.username : socket.id;
        console.log('用户断开连接', disconnectedIdentifier);
    });
});

// ------------------- 服务器启动 -------------------
// 🚨 关键修改：使用环境变量或默认值
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`📡 WebSocket/HTTP Server 正在监听 ${PORT}`);
});