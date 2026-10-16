import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { initSocket } from './sockets/socketHandler.js';
import { ENV } from './config/env.js';

const startServer = async () => {
  try {
    // 1. Connect to MongoDB
    await connectDB();

    // 2. Initialize Express App
    const app = createApp();

    // 3. Create HTTP Server
    const server = http.createServer(app);

    // 4. Initialize Socket.IO
    const io = new SocketIOServer(server, {
      cors: {
        origin: [ENV.CLIENT_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'],
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        credentials: true,
      },
    });

    initSocket(io);

    // 5. Start listening
    server.listen(ENV.PORT, () => {
      console.log(`====================================================`);
      console.log(`🚀 Savoria RMS Backend Server running on port ${ENV.PORT}`);
      console.log(`🌐 Base URL: http://localhost:${ENV.PORT}`);
      console.log(`📡 Socket.IO Real-time service active`);
      console.log(`🌱 Environment: ${ENV.NODE_ENV}`);
      console.log(`====================================================`);
    });

    const shutdown = () => {
      server.close(() => {
        process.exit(0);
      });
      setTimeout(() => process.exit(0), 1500).unref();
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('Fatal error starting server:', error);
    process.exit(1);
  }
};

startServer();
