const mongoose = require('mongoose');
require('dotenv').config();

let connected = false;

async function connect() {
  if (connected || mongoose.connection.readyState === 1) return mongoose;

  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI not set');

  // Single-call connect helper
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
