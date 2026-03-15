// server/db/mongo.js
const { MongoClient } = require('mongodb');
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

async function getMongoDb() {
  await client.connect();
  return client.db(process.env.MONGO_DB_NAME);
}
module.exports = getMongoDb;