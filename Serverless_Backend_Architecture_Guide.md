# 🧘‍♂️ The School of Breath — Serverless Backend Architecture Guide

This document explains **how our Node.js + Express + MongoDB backend runs on Vercel’s Serverless Platform**.  
It includes detailed notes on **connection pooling, caching, sockets, scaling, and instance behavior** — all tailored to our production deployment.

---
## ⚙️ Overview

Our backend runs as a **serverless function** on [Vercel](https://vercel.com/).  
It serves API routes such as `/courses`, `/musics`, `/chat`, etc., all through a single Express app bundled in `src/index.js`.

Vercel automatically scales our backend **up or down** depending on user traffic.
---

## 🧩 Architecture Summary

| Component | Description |
|------------|-------------|
| **Platform** | Vercel (Serverless Node.js runtime) |
| **Framework** | Express.js |
| **Database** | MongoDB Atlas |
| **ORM** | Mongoose |
| **Connection Type** | Cached per warm instance |
| **Pooling** | `maxPoolSize: 5` for M0/M2 tier, `10–20` for M5+ |
| **Scaling** | Automatic per function instance |
| **Cold Start** | 100–400 ms delay on new instance spin-up |
| **Region** | Configurable in `vercel.json` |

---

## ⚡️ How Serverless Works (Vercel)

### 🌀 Lifecycle

```
Request → Vercel spins up instance → loads function → connects MongoDB
        → handles requests (warm) → idle → container paused/destroyed
```

- **Cold start**: first request after inactivity (slightly slower)
- **Warm state**: instance reused for subsequent requests (fast)
- **Scale to zero**: idle instances automatically paused to save cost

---

## 🧠 Connection Pooling & Caching

Each instance of the function maintains its own **connection pool** to MongoDB.

### Key Code Snippet
```js
let cached = global.__mongoose;
if (!cached) {
  cached = global.__mongoose = { conn: null, promise: null, listenersAttached: false };
}

async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(mongoUri, {
      maxPoolSize: 5,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 30000,
      appName: 'SchoolOfBreath'
    }).then(m => m);
  }
  cached.conn = await cached.promise;
  return cached.conn;
}
```

### 💡 What This Does
- Keeps **one MongoDB connection pool per instance** (not per user).
- Prevents reconnecting on every request.
- Uses `global.__mongoose` to persist the connection across warm invocations.
- Ensures listeners attach only once (`listenersAttached` flag).

---

## 🧮 What Happens When Many Users Connect

| Users | Behavior |
|--------|-----------|
| **1–10 users** | Served by 1 warm instance → single shared pool (5 sockets). |
| **~100 users** | Vercel spawns 2–3 instances, each with its own 5-socket pool. |
| **~1000 users** | 10–15 instances → 50–75 total Mongo sockets open. |
| **Idle period** | Instances shut down → sockets closed automatically. |

MongoDB Atlas limits connection count depending on the tier (M0 ≈ 100).  
Therefore, our pool size is intentionally small (5) to prevent exhaustion.

---

## 🌐 Example Flow

### Endpoint `/courses`
```
User → /api/courses → Vercel function instance
         ↓
   connectDB() checks global cache
         ↓
   if no conn → mongoose.connect() → create pool (5 sockets)
         ↓
   handle query Course.find()
         ↓
   return response → instance stays warm
```

### Endpoint `/musics`
Handled by same instance (reuses pool), unless scaling spawns another one.

---

## 🧩 Key Concepts Explained

| Term | Description |
|------|--------------|
| **Instance** | One ephemeral environment running your serverless code. |
| **Socket** | A single TCP connection to MongoDB. |
| **Connection Pool** | A group of reusable sockets for concurrent DB queries. |
| **Cold Start** | The first run of a new instance after idle (slower). |
| **Warm Instance** | An active instance serving multiple requests (fast). |
| **Scaling** | Creating new instances when concurrent requests increase. |
| **Cache** | Stores DB connection so warm instances reuse it instantly. |

---

## 🧱 Vercel Configuration (`vercel.json`)

```json
{
  "version": 2,
  "builds": [{ "src": "src/index.js", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "src/index.js" }],
  "functions": {
    "src/index.js": {
      "runtime": "nodejs20.x",
      "memory": 1024,
      "maxDuration": 10,
      "regions": ["iad1"] // pick region nearest MongoDB Atlas cluster
    }
  }
}
```

---

## 🧘‍♀️ Local Development

For local testing, use a persistent Express server.

### `src/dev.js`
```js
require('dotenv').config();
const app = require('./configs/server');
const { connectDB } = require('./configs/database');

const PORT = process.env.PORT || 8080;

(async () => {
  await connectDB();
  app.listen(PORT, () => console.log(`Local server at http://localhost:${PORT}`));
})();
```

Run with:
```bash
npm run dev
```
In production, Vercel calls `src/index.js` instead (no `app.listen()`).

---

## 🔒 Graceful Shutdown
In serverless, no need to close connections manually.  
When the instance stops, MongoDB sockets are automatically released.

For local mode (`src/dev.js`), `Ctrl + C` gracefully closes the connection.

---

## 🚀 Best Practices

| Area | Recommendation |
|------|----------------|
| **Mongo Pool Size** | Keep small (5–10) for free/shared clusters |
| **Use .lean()** | For fast `find()` reads without Mongoose overhead |
| **Indexes** | Add common filters (`slug`, `category`, `createdAt`) |
| **Avoid Long Requests** | No SSE/WebSockets inside serverless |
| **Cold Start Mitigation** | Keep function in region close to DB |
| **Separate Heavy Routes** | Optional split into `/api/*.js` if needed |

---

## 📊 Visualization

```
1000 users → 10 Vercel instances
Each instance → 1 Mongo pool (5 sockets)
Total sockets: 10 × 5 = 50 connections
Atlas M0 limit ≈ 100 sockets → Safe ✅
```
When idle → instances auto-terminate → 0 sockets open.

---

## 🧘‍♂️ TL;DR Summary

- Your entire Express app = one Vercel serverless function.
- Each warm instance reuses one MongoDB connection pool (5 sockets).
- Vercel auto-scales instances for traffic; Atlas sees one pool per instance.
- Cached connection avoids re-opening sockets per request.
- Cold start delay (~200ms) is normal when new instances spin up.
- Keep `.lean()`, small pool size, and efficient indexing.

---

## 📁 File Overview

| File | Purpose |
|------|----------|
| `src/index.js` | Serverless handler (for production) |
| `src/dev.js` | Local persistent Express server |
| `configs/database.js` | Cached MongoDB connection logic |
| `configs/server.js` | Express setup with routes/middleware |
| `vercel.json` | Build + routing configuration |

---

## 🧘‍♂️ Final Insight

> “Serverless doesn’t mean no server — it means no server **to manage**.”  
> Your job is to design stateless, efficient connections and let Vercel handle scaling.

---
