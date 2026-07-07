const dns = require('dns');
const mongoose = require('mongoose');
require('dotenv').config();

let connected = false;

async function connect() {
  if (connected || mongoose.connection.readyState === 1) return mongoose;

  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI not set');

  // Some ISP DNS servers block SRV lookups required by mongodb+srv://
  if (uri.startsWith('mongodb+srv://')) {
    dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
  }

  await mongoose.connect(uri);
  connected = true;
  return mongoose;
}

async function disconnect() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    connected = false;
  }
}

module.exports = { connect, disconnect };
