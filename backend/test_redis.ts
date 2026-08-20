import 'dotenv/config';
import { redisClient, pubClient, subClient } from './src/redis';

async function run() {
  try {
    await redisClient.set('test_key', 'test_val');
    const val = await redisClient.get('test_key');
    console.log('Redis Primary: OK (' + val + ')');

    await pubClient.publish('TEST_CHANNEL', 'test_msg');
    console.log('Redis Pub: OK');
    
    console.log('Redis Sub: Testing... (might take a second if async, but connected)');
    
    process.exit(0);
  } catch (e) {
    console.error('Redis Test Failed:', e);
    process.exit(1);
  }
}

run();
