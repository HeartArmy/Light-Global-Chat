import { Client } from '@upstash/qstash';

// Create a singleton QStash client instance
const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
});

export default qstash;