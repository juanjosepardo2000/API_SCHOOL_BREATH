# 🧘‍♂️ The School of Breath – MongoDB Serverless Setup Guide

This document explains **how MongoDB connections work in a serverless environment** (Vercel, Netlify, AWS Lambda, etc.)  
and how to configure **Mongoose** properly to prevent connection overloads, latency, or backend crashes.

---

## 📘 Table of Contents
1. [Understanding Serverless + MongoDB](#understanding-serverless--mongodb)
2. [The Connection Lifecycle](#the-connection-lifecycle)
3. [Connection Caching Strategy](#connection-caching-strategy)
4. [Recommended Configuration](#recommended-configuration)
5. [When New Instances Are Created](#when-new-instances-are-created)
6. [MongoDB Atlas Connection Limits](#mongodb-atlas-connection-limits)
7. [Example Scenarios](#example-scenarios)
8. [How to Monitor Connections in Atlas](#how-to-monitor-connections-in-atlas)
9. [Optimization Tips](#optimization-tips)
10. [TL;DR Summary](#tldr-summary)

---

## 🧠 Understanding Serverless + MongoDB

In serverless environments:
- **Each serverless instance** is an isolated copy of your backend.
- Each instance runs `mongoose.connect()` **once**, creating a **connection pool** (e.g. 5 sockets).
- **Queries (find, update, insert)** reuse the same sockets — they **don’t create new connections**.
- When traffic increases, the platform spawns more instances → each with its own pool.

### Mapping the flow

| Layer | Meaning | Example Count |
|--------|----------|----------------|
| User | Someone hitting your API endpoint | 1–100,000+ |
| Serverless Instance | A function copy spawned by your platform | 1–50+ |
| MongoDB Connection Pool | Set of sockets per instance | e.g. 5–10 |

---

## 🔄 The Connection Lifecycle

1. **Cold Start** → A new instance is created on first request or after inactivity.  
   `mongoose.connect()` runs → MongoDB opens a new pool.

2. **Warm Requests** → The same instance handles many queries using its existing pool.  
   No new connections are opened.

3. **Scaling Up** → When traffic exceeds capacity, new instances are spun up.  
   Each new instance runs `mongoose.connect()` again → opens its own pool.

4. **Scaling Down / Idle Timeout** → After inactivity, the instance is destroyed →  
   its connections close automatically.

5. **Deployment / Restart** → All instances are replaced → new pools are created.

---

## ♻️ Connection Caching Strategy

Always **cache** your MongoDB connection so it’s reused between requests.

### ✅ Correct Serverless Setup (`db.js`)
```js
// ./configs/db.js
const mongoose = require('mongoose');
const { mongoUri } = require('./vars');

mongoose.set('strictQuery', true);
mongoose.set('bufferCommands', false);

let cached = global.__mongoose || (global.__mongoose = { conn: null, promise: null });

async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(mongoUri, {
      maxPoolSize: 5,         // small pool for M0 (increase on paid tiers)
      minPoolSize: 0,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 30000,
      waitQueueTimeoutMS: 10000,
      appName: 'SchoolOfBreath',
    }).then(m => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

module.exports = connectDB;

Tier
maxPoolSize
Description
M0 (Free)
3–5
Keep small to avoid 500-connection limit
M2
10–20
Light production usage
M5
20–50
Medium-scale production
M10+
50–100+
High-traffic production


🚀 When New Instances Are Created
Trigger
What Happens
MongoDB Effect
🆕 First Request (cold start)
New serverless instance starts
New pool opens
⚡ High Traffic
Platform scales up more instances
New pools added
💤 Idle Timeout
Old instance shut down
Pool closed
🚀 Deployment/Restart
All instances replaced
New pools opened


⚡ Optimization Tips
	•	Use .lean() for fast find() queries.
	•	Select only needed fields (.select('title category')).
	•	Add indexes for common filters (e.g. category, slug).
	•	Cache frequent GET endpoints for 10–30s in memory or Redis.
	•	For pure reads, consider MongoDB Data API (HTTP-based, no persistent sockets).

⸻
Concept
Explanation
A query (find())
Reuses an existing socket from the pool
A serverless instance
Has its own MongoDB connection pool
A connection pool
Group of reusable sockets (e.g. 5)
A MongoDB connection
Opened the first time mongoose.connect() runs in that instance
Atlas “connections”
Total sockets = instances × pool size
Idle/Scaling down
Closes connections automatically
Deploy or restart
Recreates all connections fresh
