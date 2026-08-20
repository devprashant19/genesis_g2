import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Main redis client for standard operations
export const redisClient = new Redis(redisUrl);

// Dedicated clients for Socket.io Redis adapter (requires pub/sub specific connections)
export const pubClient = new Redis(redisUrl);
export const subClient = pubClient.duplicate();

redisClient.on('error', (err) => console.error('Redis Client Error', err));
pubClient.on('error', (err) => console.error('Redis PubClient Error', err));
subClient.on('error', (err) => console.error('Redis SubClient Error', err));
