# Mantras API Documentation

## Overview

This document describes the new Mantras API endpoints created for the School of Breath backend. The API provides a complete CRUD system for managing mantras with rich metadata based on the web version implementation.

## Base URL

All endpoints are prefixed with `/mantras`

## Data Model

### Mantra Schema

```javascript
{
  // Basic information
  title: String (required)
  description: String (required)
  duration: Number (required, in seconds)

  // Media URLs
  audioUrl: String (required)
  thumbnailUrl: String
  visualUrl: String // Optional custom visual (GIF/Video)

  // Categorization
  category: String // 'MANTRA', 'SHIVA', 'KRISHNA', 'HANUMAN', 'DEVI', 'GANESHA', 'GURU', 'UNIVERSAL'
  tags: [String]

  // Mantra-specific exploration fields
  deity: String (required) // 'SHIVA', 'HANUMAN', 'KRISHNA', 'DEVI', 'GANESHA', 'GURU', 'UNIVERSAL'
  benefit: String (required) // 'ENERGY', 'CALM', 'SLEEP', 'PROTECTION', 'HEALING', 'DEVOTION', 'CONFIDENCE', 'FORGIVENESS'
  difficulty: String // 'BEGINNER', 'INTERMEDIATE', 'ADVANCED' (default: 'BEGINNER')

  // Visual styling
  color: String // Tailwind CSS class or hex color (default: 'bg-cyan-500')

  // Engagement metrics
  popularityScore: Number (default: 0)
  pointsReward: Number (default: 50)
  views: Number (default: 0)

  // Access control
  isPremium: Boolean (default: false)
  isActive: Boolean (default: true)

  // Ordering
  position: Number (default: 0)

  // Timestamps
  createdAt: Date
  updatedAt: Date
}
```

## Category Endpoints

### 0.1. Get All Deities

**GET** `/mantras/categories/deities`

Get all deity categories with images, descriptions, and mantra counts.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "type": "DEITY",
      "identifier": "SHIVA",
      "label": "Shiva",
      "description": "Stillness & Power",
      "longDescription": "Lord Shiva represents the transformative aspect...",
      "image": "https://storage.googleapis.com/.../ShivaMantraImage.jpg",
      "icon": "Flame",
      "color": "bg-gradient-to-br from-indigo-900 to-purple-800",
      "keywords": ["transformation", "meditation", "stillness"],
      "mantraCount": 8,
      "order": 0
    }
  ]
}
```

### 0.2. Get All Benefits

**GET** `/mantras/categories/benefits`

Get all benefit categories with icons, colors, and mantra counts.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "type": "BENEFIT",
      "identifier": "ENERGY",
      "label": "Energy & Focus",
      "description": "Boost vitality and sharpen concentration",
      "icon": "Zap",
      "color": "bg-gradient-to-br from-orange-400 to-red-500",
      "mantraCount": 9
    }
  ]
}
```

### 0.3. Get All Difficulties

**GET** `/mantras/categories/difficulties`

Get difficulty levels with mantra counts.

### 0.4. Get All Categories (Grouped)

**GET** `/mantras/categories/all`

Get all categories grouped by type (deities, benefits, difficulties).

**Response:**
```json
{
  "success": true,
  "data": {
    "deities": [...],
    "benefits": [...],
    "difficulties": [...]
  }
}
```

### 0.5. Get Category Statistics

**GET** `/mantras/categories/stats`

Get overall statistics including total counts and top mantras.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalMantras": 21,
    "byDeity": [{ "_id": "SHIVA", "count": 8 }],
    "byBenefit": [{ "_id": "ENERGY", "count": 9 }],
    "byDifficulty": [{ "_id": "BEGINNER", "count": 15 }],
    "topMantras": [...]
  }
}
```

## Mantra Endpoints

### 1. Get All Mantras

**GET** `/mantras`

Get all active mantras with filtering, pagination, and access control.

**Query Parameters:**
- `email` (optional): User email for access control check
- `deity` (optional): Filter by deity (case-insensitive)
- `benefit` (optional): Filter by benefit (case-insensitive)
- `difficulty` (optional): Filter by difficulty (case-insensitive)
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 20): Items per page

**Response:**
```json
{
  "success": true,
  "mantras": [
    {
      "_id": "...",
      "title": "Hare Krishna (Peace & Healing)",
      "description": "Hare Krishna Mahamantra for deep spiritual peace and healing.",
      "duration": 600,
      "audioUrl": "https://...",
      "thumbnailUrl": "https://...",
      "category": "MANTRA",
      "deity": "KRISHNA",
      "benefit": "HEALING",
      "difficulty": "BEGINNER",
      "tags": ["Peace", "Healing", "Bhakti"],
      "color": "bg-cyan-500",
      "popularityScore": 19500,
      "pointsReward": 50,
      "views": 1234,
      "isPremium": false,
      "isActive": true,
      "position": 0
    }
  ],
  "hasAccess": true,
  "pagination": {
    "total": 50,
    "page": 1,
    "limit": 20,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### 2. Get Single Mantra

**GET** `/mantras/:id`

Get a single mantra by ID. Automatically increments view count.

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "...",
    "title": "Om Namah Shivaya",
    ...
  }
}
```

### 3. Get Mantras by Deity

**GET** `/mantras/explore/by-deity`

Get mantras grouped by deity for exploration UI.

**Query Parameters:**
- `email` (optional): User email for access control check

**Response:**
```json
{
  "success": true,
  "data": {
    "SHIVA": [{ ... }],
    "KRISHNA": [{ ... }],
    "HANUMAN": [{ ... }],
    "DEVI": [{ ... }],
    "GANESHA": [{ ... }],
    "GURU": [{ ... }],
    "UNIVERSAL": [{ ... }]
  },
  "hasAccess": true
}
```

### 4. Get Mantras by Benefit

**GET** `/mantras/explore/by-benefit`

Get mantras grouped by benefit for exploration UI.

**Query Parameters:**
- `email` (optional): User email for access control check

**Response:**
```json
{
  "success": true,
  "data": {
    "ENERGY": [{ ... }],
    "CALM": [{ ... }],
    "SLEEP": [{ ... }],
    "PROTECTION": [{ ... }],
    "HEALING": [{ ... }],
    "DEVOTION": [{ ... }],
    "CONFIDENCE": [{ ... }],
    "FORGIVENESS": [{ ... }]
  },
  "hasAccess": true
}
```

### 5. Get Popular Mantras

**GET** `/mantras/popular/list`

Get the most popular mantras sorted by popularity score and views.

**Query Parameters:**
- `limit` (optional, default: 20): Number of mantras to return

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "title": "Most Popular Mantra",
      "popularityScore": 25000,
      "views": 5000,
      ...
    }
  ]
}
```

## Admin Endpoints

**Note:** These endpoints should be protected with authentication middleware in production.

### 6. Create Mantra

**POST** `/mantras`

Create a new mantra.

**Request Body:**
```json
{
  "title": "New Mantra Title",
  "description": "Description of the mantra",
  "duration": 300,
  "audioUrl": "https://...",
  "thumbnailUrl": "https://...",
  "deity": "SHIVA",
  "benefit": "ENERGY",
  "difficulty": "BEGINNER",
  "tags": ["Tag1", "Tag2"],
  "color": "bg-purple-500",
  "popularityScore": 0,
  "pointsReward": 50,
  "isPremium": false,
  "position": 0
}
```

**Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Mantra created successfully"
}
```

### 7. Update Mantra

**PUT** `/mantras/:id`

Update an existing mantra.

**Request Body:** Same as Create Mantra (all fields optional)

**Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Mantra updated successfully"
}
```

### 8. Delete Mantra

**DELETE** `/mantras/:id`

Delete a mantra permanently.

**Response:**
```json
{
  "success": true,
  "message": "Mantra deleted successfully"
}
```

### 9. Update Positions (Bulk)

**PATCH** `/mantras/position/update`

Update the display position of multiple mantras at once.

**Request Body:**
```json
{
  "items": [
    { "id": "mantra_id_1", "position": 0 },
    { "id": "mantra_id_2", "position": 1 },
    { "id": "mantra_id_3", "position": 2 }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Positions updated successfully"
}
```

### 10. Toggle Active Status

**PATCH** `/mantras/:id/toggle-active`

Toggle the active status of a mantra (show/hide from public).

**Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Mantra activated successfully"
}
```

## Access Control

The API implements email-based access control using Systeme.io tags:

- Users with tags: `Enrolled_to_Membership` or `Enrolled_Holistic Membership` have full access
- All responses include a `hasAccess` field indicating the user's access level
- Only active mantras (`isActive: true`) are returned in public endpoints

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

Common HTTP status codes:
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `404`: Not Found
- `500`: Internal Server Error

## Implementation Files

- **Model**: `/src/models/mantra.model.js`
- **Controller**: `/src/controllers/mantra.controller.js`
- **Routes**: `/src/routes/mantra.routes.js`
- **Server Config**: `/src/configs/server.js`

## Next Steps

1. Add authentication middleware to admin endpoints
2. Consider adding favorite/bookmark functionality per user
3. Add analytics tracking for mantra plays
4. Consider adding user progress tracking for mantras
5. Migrate existing mantra video data to the new model if needed

## Example Usage from Frontend

```typescript
// Get all mantras with filtering
const response = await axiosInstance.get('/mantras', {
  params: {
    email: user.email,
    deity: 'SHIVA',
    page: 1,
    limit: 10
  }
});

// Get mantras by deity for explorer UI
const deityMantras = await axiosInstance.get('/mantras/explore/by-deity', {
  params: { email: user.email }
});

// Get popular mantras
const popular = await axiosInstance.get('/mantras/popular/list', {
  params: { limit: 5 }
});
```
