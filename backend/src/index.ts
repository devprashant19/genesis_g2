import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import cors from 'cors';
import { pool, initDb } from './db';
import { redisClient, pubClient, subClient } from './redis';
import { validateScore } from './validateScore';

const port = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-prod';

const app = express();
app.use(cors());
app.use(express.json());

const authenticateJwtRest = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Missing token' });
  const token = authHeader.split(' ')[1];
  
  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    (req as any).user = decoded;
    next();
  });
};

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
  }
});

// Use Redis adapter for horizontal scaling
io.adapter(createAdapter(pubClient, subClient));

const registerSchema = z.object({
  name: z.string().min(1).max(50),
  phone: z.string().min(10).max(15) // Basic validation
});

// POST /register
app.post('/register', async (req, res) => {
  try {
    const { name, phone } = registerSchema.parse(req.body);
    
    let playerId;
    
    // Check if player exists or insert
    const result = await pool.query(
      `INSERT INTO players (name, phone_number) 
       VALUES ($1, $2) 
       ON CONFLICT (phone_number) DO UPDATE SET name = EXCLUDED.name 
       RETURNING id`,
      [name, phone]
    );
    
    playerId = result.rows[0].id;
    
    const token = jwt.sign({ id: playerId, name }, JWT_SECRET, { expiresIn: '12h' });
    
    res.json({ token, playerId, name });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /submit-score
app.post('/submit-score', authenticateJwtRest, async (req, res) => {
  try {
    const result = validateScore(req.body);
    if (!result.valid) {
      return res.status(400).json({ error: result.reason });
    }
    
    const userId = (req as any).user.id;
    
    // Save to Postgres
    await pool.query(
      'INSERT INTO match_results (player_id, global_ability, total_score, completion_time_ms, round) VALUES ($1,$2,$3,$4,$5)',
      [userId, req.body.globalAbility, result.recomputedScore, req.body.completionTimeMs, 1]
    );
    
    // Add to Redis ZSET for leaderboard
    await redisClient.zadd('leaderboard:round_1', result.recomputedScore as number, userId);
    
    res.json({ ok: true, score: result.recomputedScore });
  } catch (err) {
    console.error('Score submission error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Socket middleware for JWT auth
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }
  
  if (token === 'admin-secret-token') {
    socket.data.isAdmin = true;
    return next();
  }
  
  jwt.verify(token, JWT_SECRET, (err: any, decoded: any) => {
    if (err) return next(new Error('Authentication error'));
    socket.data.user = decoded;
    next();
  });
});

const broadcastLobbyCount = async () => {
  const count = await redisClient.scard('lobby:active_players');
  io.to('admin_room').emit('lobby_count', count);
};

io.on('connection', async (socket) => {
  if (socket.data.isAdmin) {
    socket.join('admin_room');
    console.log(`Admin connected: ${socket.id}`);
    await broadcastLobbyCount(); // Send current count immediately
    
    socket.on('trigger_start', async (data) => {
      if (data.passcode === '1234') {
        console.log('Admin triggered GAME_START');
        await redisClient.set('game:current_state', 'IN_PROGRESS');
        // No more seed required, just a start signal
        await pubClient.publish('GAME_START_CHANNEL', JSON.stringify({ started: true }));
      }
    });

    socket.on('trigger_leaderboard', async (data) => {
      if (data.passcode === '1234') {
        console.log('Admin triggered LEADERBOARD');
        // Get top 10 from ZSET (highest scores first)
        const topPlayers = await redisClient.zrevrange('leaderboard:round_1', 0, 9, 'WITHSCORES');
        
        // Parse the flat array [id1, score1, id2, score2] into objects
        const leaderboard = [];
        for (let i = 0; i < topPlayers.length; i += 2) {
          leaderboard.push({ playerId: topPlayers[i], score: parseInt(topPlayers[i+1]) });
        }
        
        await pubClient.publish('LEADERBOARD_CHANNEL', JSON.stringify(leaderboard));
      }
    });
    
    socket.on('disconnect', () => console.log('Admin disconnected'));
    return;
  }

  const userId = socket.data.user.id;
  console.log(`Socket connected: ${socket.id} (User: ${userId})`);
  
  // Add to active players set in Redis
  await redisClient.sadd('lobby:active_players', userId);
  await broadcastLobbyCount();
  
  socket.on('disconnect', async () => {
    console.log(`Socket disconnected: ${socket.id} (User: ${userId})`);
    await redisClient.srem('lobby:active_players', userId);
    await broadcastLobbyCount();
  });
});

// Setup Redis subscriber for cross-instance broadcasts
subClient.subscribe('GAME_START_CHANNEL');
subClient.subscribe('LEADERBOARD_CHANNEL');

subClient.on('message', (channel, message) => {
  if (channel === 'GAME_START_CHANNEL') {
    const seed = JSON.parse(message);
    io.emit('GAME_START', seed);
  } else if (channel === 'LEADERBOARD_CHANNEL') {
    const leaderboard = JSON.parse(message);
    io.emit('SHOW_LEADERBOARD', leaderboard);
  }
});

const start = async () => {
  await initDb();
  
  httpServer.listen(port, () => {
    console.log(`Backend server listening on port ${port}`);
  });
};

start().catch(console.error);
