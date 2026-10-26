import dns from "node:dns";
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/sprint-management";

// Optional comma-separated DNS servers for resolving `mongodb+srv://` hosts.
// Some networks (e.g. a phone hotspot) answer Atlas SRV lookups with a bad
// response → `querySrv EBADRESP` and every API call 500s. Setting e.g.
// MONGODB_DNS_SERVERS=8.8.8.8,1.1.1.1 makes Node use those resolvers instead.
const DNS_SERVERS = process.env.MONGODB_DNS_SERVERS?.split(",").map((s) => s.trim()).filter(Boolean);
if (DNS_SERVERS?.length) dns.setServers(DNS_SERVERS);

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalWithMongoose = global as any;

const cached: MongooseCache = globalWithMongoose.mongoose || { conn: null, promise: null };
globalWithMongoose.mongoose = cached;

export async function dbConnect() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, { bufferCommands: false });
  }
  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }
  return cached.conn;
}
