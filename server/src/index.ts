import http from 'http';
import { app } from './app.js';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { initSocketIO } from './services/socketService.js';
import { startPoolExpiryScheduler } from './services/poolExpiryService.js';

async function bootstrap() {
  try {
    // Connect to database
    await connectDB();

    // Create HTTP server
    const server = http.createServer(app);

    // Initialize Socket.IO
    initSocketIO(server);

    // Start background pool expiry scheduler
    startPoolExpiryScheduler();

    // Start listening
    server.listen(env.PORT, () => {
      console.log(`\n==============================================`);
      console.log(`🦉 NightOwl Backend Server Started`);
      console.log(`🌐 Port: ${env.PORT}`);
      console.log(`📡 Environment: ${env.NODE_ENV}`);
      console.log(`🔗 Health check: http://localhost:${env.PORT}/api/health`);
      console.log(`==============================================\n`);
    });

    const shutdown = async () => {
      console.log('\n🛑 NightOwl Server shutting down gracefully...');
      server.close(() => {
        console.log('HTTP and Socket server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();
