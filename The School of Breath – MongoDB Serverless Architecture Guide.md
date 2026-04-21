# 🧘‍♂️ The School of Breath – MongoDB Serverless Architecture Guide

A complete, easy-to-understand guide for how **MongoDB connections** work inside a **serverless backend**  
(Vercel, Netlify, AWS Lambda, etc.) using **Mongoose**.  

This explains:
- When a connection pool is created  
- When a new instance spawns  
- What “pool”, “socket”, and “query” really mean  
- How to monitor and optimize connection usage  

---

## 🌐 Overview Diagram

Below is a real-world picture of what happens when 100 users hit your API (for example `/api/courses` and `/api/music`) simultaneously:

                      ┌──────────────────────────────────────────────┐
                      │                  Users                       │
                      │──────────────────────────────────────────────│
                      │ 100 Users → Send API Requests                 │
                      │  • GET /api/courses                           │
                      │  • GET /api/music                             │
                      └──────────────────────────────────────────────┘
                                         │
                                         ▼
                     ┌─────────────────────────────────────────────┐
                     │        Serverless Platform (Vercel)         │
                     │─────────────────────────────────────────────│
                     │  Decides how many instances are needed       │
                     │  • 10 instances created for 100 users        │
                     └─────────────────────────────────────────────┘
                                         │
                   ┌─────────────────────┼─────────────────────┐
                   ▼                     ▼                     ▼
         ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
         │ Instance #1      │   │ Instance #2      │   │ Instance #3      │
         │──────────────────│   │──────────────────│   │──────────────────│
         │  connectDB()     │   │  connectDB()     │   │  connectDB()     │
         │  ↓               │   │  ↓               │   │  ↓               │
         │  Creates 1 Pool  │   │  Creates 1 Pool  │   │  Creates 1 Pool  │
         │  of 5 sockets    │   │  of 5 sockets    │   │  of 5 sockets    │
         │──────────────────│   │──────────────────│   │──────────────────│
         │ Queries reuse    │   │ Queries reuse    │   │ Queries reuse    │
         │ sockets:         │   │ sockets:         │   │ sockets:         │
         │  • find(courses) │   │  • find(music)   │   │  • find(users)   │
         │  • find(videos)  │   │  • find(teachers)│   │  • insert(logs)  │
         └──────────────────┘   └──────────────────┘   └──────────────────┘
                   │                     │                     │
                   └─────────────── All connect to ─────────────┘
                                         │
                                         ▼
                      ┌──────────────────────────────────────────┐
                      │           MongoDB Atlas Cluster          │
                      │──────────────────────────────────────────│
                      │ Receives total: 10 instances × 5 sockets │
                      │ = ~50 active connections                 │
                      └──────────────────────────────────────────┘

---

## ⚙️ Key Definitions

| Term | Meaning | Analogy |
|------|----------|----------|
| **Instance** | A running copy of your serverless function created by the platform (Vercel/Lambda) to handle requests. Each instance is isolated and runs your code independently. | Like a yoga class room with a teacher and mats. |
| **Connection Pool** | A *group* of pre-opened connections (called **sockets**) between your instance and MongoDB. Defined by `maxPoolSize`. | A set of 5 reusable yoga mats that students share instead of bringing new ones each time. |
| **Socket / Connection** | A single network channel (TCP connection) between your app and MongoDB. | One mat that a student (query) uses during practice. |
| **Query** | Any MongoDB operation (`find`, `insert`, `update`, `aggregate`, etc.). | Each student coming to practice on a mat. |
| **Cold Start** | When the serverless platform starts a new instance after being idle or after a deployment. | Opening a new yoga room after the old one closed. |
| **Scaling** | Automatic creation of more instances when many users arrive at once. | Opening more yoga rooms to fit more students. |

---

## 🧩 When Things Are Created

| Event | What Happens | MongoDB Effect |
|--------|---------------|----------------|
| **Deployment or First Request (Cold Start)** | The first request triggers a new serverless instance. `mongoose.connect()` runs. | A new **connection pool** (e.g., 5 sockets) is opened. |
| **Subsequent Requests (Warm)** | The instance is reused. Queries share the same pool. | No new connections. |
| **Traffic Spike (Scaling)** | Platform spins up more instances. | Each new instance opens its own pool. |
| **Idle Timeout (Scaling Down)** | After inactivity, instance is destroyed. | Its pool closes automatically. |
| **Redeploy or Restart** | Old instances removed. | All old pools closed; new ones created. |

---

## 💻 Example Code

### db.js
```js
const mongoose = require('mongoose');
const { mongoUri } = require('./vars');

mongoose.set('strictQuery', true);
mongoose.set('bufferCommands', false);

let cached = global.__mongoose || (global.__mongoose = { conn: null, promise: null });

async function connectDB() {
  if (cached.conn) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose.connect(mongoUri, {
      maxPoolSize: 5,         // small for M0 tier
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

const connectDB = require('./configs/db');
const { Course } = require('./models/Course');

module.exports = async (req, res) => {
  await connectDB();                   // Reuse same connection
  const data = await Course.find({}, null, { lean: true });
  res.status(200).json(data);
};

🔌 How the Pool Works

Request #
Socket Used
Notes
1
#1
find courses
2
#2
find music
3
#3
insert user
4
#4
update log
5
#5
find teachers
6
waits…
Waits until one socket frees up


📊 Real Example: 100 Users at Once

Cold start
1st request after deploy
1
5
5
20 users
Platform scales to 4 instances
4
5
20
100 users
Platform scales to 10 instances
10
5
50
Traffic drops
Instances scale down to 2
2
5
10
