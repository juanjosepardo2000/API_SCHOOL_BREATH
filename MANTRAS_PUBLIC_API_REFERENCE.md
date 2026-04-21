# Mantras Public API Reference

Complete reference for all public-facing mantra endpoints with examples and use cases.

## Base URL

``
Production: https://api-music-iota.vercel.app
Development: https://dev-api-music-iota.vercel.app
Local: http://localhost:3000
```

All endpoints are prefixed with `/mantras`

**Examples:**
- Production: `https://api-music-iota.vercel.app/mantras`
- Development: `https://dev-api-music-iota.vercel.app/mantras`
- Local: `http://localhost:3000/mantras`

---

## 📋 Table of Contents

1. [Category Endpoints](#category-endpoints)
   - [Get All Deities](#1-get-all-deities)
   - [Get All Benefits](#2-get-all-benefits)
   - [Get All Difficulties](#3-get-all-difficulties)
   - [Get All Categories](#4-get-all-categories)
   - [Get Category Statistics](#5-get-category-statistics)

2. [Mantra Endpoints](#mantra-endpoints)
   - [Get All Mantras](#6-get-all-mantras)
   - [Get Single Mantra](#7-get-single-mantra)
   - [Get Mantras by Deity](#8-get-mantras-by-deity)
   - [Get Mantras by Benefit](#9-get-mantras-by-benefit)
   - [Get Popular Mantras](#10-get-popular-mantras)

3. [Common Use Cases](#common-use-cases)
4. [Error Handling](#error-handling)

---

## Category Endpoints

### 1. Get All Deities

Get all deity categories with images, descriptions, and mantra counts.

**Endpoint:** `GET /mantras/categories/deities`

**Use Case:** Build deity explorer/selector UI

**Request:**
```bash
# Production
curl -X GET "https://api-music-iota.vercel.app/mantras/categories/deities"

# Development
curl -X GET "https://dev-api-music-iota.vercel.app/mantras/categories/deities"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "65a1b2c3d4e5f6g7h8i9j0k1",
      "type": "DEITY",
      "identifier": "SHIVA",
      "label": "Shiva",
      "description": "Stillness & Power",
      "longDescription": "Lord Shiva represents the transformative aspect of consciousness. Chanting Shiva mantras helps destroy obstacles, negative patterns, and brings deep inner peace.",
      "image": "https://storage.googleapis.com/schoolbreathvideos/breathinstructionsabhi/Mantras%20/Mantra%20Images/ShivaMantraImage.jpg",
      "icon": "Flame",
      "color": "bg-gradient-to-br from-indigo-900 to-purple-800",
      "keywords": ["transformation", "meditation", "stillness", "power"],
      "order": 0,
      "isActive": true,
      "mantraCount": 8,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    },
    {
      "_id": "65a1b2c3d4e5f6g7h8i9j0k2",
      "type": "DEITY",
      "identifier": "HANUMAN",
      "label": "Hanuman",
      "description": "Strength & Courage",
      "longDescription": "Hanuman represents unwavering devotion, immense strength, and fearless courage.",
      "image": "https://storage.googleapis.com/schoolbreathvideos/breathinstructionsabhi/Mantras%20/Mantra%20Images/HanumanMantraImage1.jpg",
      "icon": "Shield",
      "color": "bg-gradient-to-br from-orange-600 to-red-700",
      "keywords": ["strength", "courage", "protection"],
      "order": 1,
      "isActive": true,
      "mantraCount": 2
    }
  ]
}
```

**Frontend Example:**
```typescript
const API_BASE_URL = 'https://api-music-iota.vercel.app'; // or dev URL

const response = await fetch(`${API_BASE_URL}/mantras/categories/deities`);
const { data } = await response.json();

// Render deity cards
data.forEach(deity => {
  console.log(`${deity.label}: ${deity.mantraCount} mantras`);
  // Use deity.image for card background
  // Use deity.color for gradient
});
```

---

### 2. Get All Benefits

Get all benefit categories with icons, colors, and mantra counts.

**Endpoint:** `GET /mantras/categories/benefits`

**Use Case:** Build benefit selector (mood/intention picker)

**Request:**
```bash
# Production
curl -X GET "https://api-music-iota.vercel.app/mantras/categories/benefits"

# Development
curl -X GET "https://dev-api-music-iota.vercel.app/mantras/categories/benefits"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "65a1b2c3d4e5f6g7h8i9j0k3",
      "type": "BENEFIT",
      "identifier": "ENERGY",
      "label": "Energy & Focus",
      "description": "Boost vitality and sharpen concentration",
      "longDescription": "Mantras for energy activation help awaken dormant prana (life force), increase mental clarity, and enhance focus.",
      "icon": "Zap",
      "color": "bg-gradient-to-br from-orange-400 to-red-500",
      "keywords": ["energy", "focus", "vitality"],
      "order": 0,
      "isActive": true,
      "mantraCount": 9
    },
    {
      "_id": "65a1b2c3d4e5f6g7h8i9j0k4",
      "type": "BENEFIT",
      "identifier": "CALM",
      "label": "Anxiety & Stress",
      "description": "Find peace and reduce anxiety",
      "longDescription": "Calming mantras work by regulating the nervous system, slowing down racing thoughts, and creating inner stillness.",
      "icon": "Smile",
      "color": "bg-gradient-to-br from-teal-400 to-emerald-500",
      "keywords": ["calm", "peace", "anxiety"],
      "order": 1,
      "isActive": true,
      "mantraCount": 5
    }
  ]
}
```

**Frontend Example:**
```typescript
// Map icon names to actual icon components
import * as Icons from 'lucide-react-native';

const getBenefits = async () => {
  const response = await fetch('https://your-api.com/mantras/categories/benefits');
  const { data } = await response.json();

  return data.map(benefit => ({
    ...benefit,
    IconComponent: Icons[benefit.icon] || Icons.Sparkles
  }));
};
```

---

### 3. Get All Difficulties

Get difficulty levels with mantra counts.

**Endpoint:** `GET /mantras/categories/difficulties`

**Use Case:** Filter mantras by experience level

**Request:**
```bash
curl -X GET "https://your-api.com/mantras/categories/difficulties"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "65a1b2c3d4e5f6g7h8i9j0k5",
      "type": "DIFFICULTY",
      "identifier": "BEGINNER",
      "label": "Beginner",
      "description": "Perfect for those new to mantra practice",
      "icon": "BookOpen",
      "color": "bg-gradient-to-br from-green-400 to-emerald-500",
      "order": 0,
      "isActive": true,
      "mantraCount": 15
    },
    {
      "_id": "65a1b2c3d4e5f6g7h8i9j0k6",
      "type": "DIFFICULTY",
      "identifier": "INTERMEDIATE",
      "label": "Intermediate",
      "description": "For practitioners with some experience",
      "icon": "Compass",
      "color": "bg-gradient-to-br from-blue-400 to-indigo-500",
      "order": 1,
      "isActive": true,
      "mantraCount": 4
    }
  ]
}
```

---

### 4. Get All Categories

Get all categories grouped by type in a single request.

**Endpoint:** `GET /mantras/categories/all`

**Use Case:** App initialization - load all metadata at once

**Request:**
```bash
curl -X GET "https://your-api.com/mantras/categories/all"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "deities": [
      {
        "identifier": "SHIVA",
        "label": "Shiva",
        "description": "Stillness & Power",
        "image": "https://...",
        "mantraCount": 8
      }
    ],
    "benefits": [
      {
        "identifier": "ENERGY",
        "label": "Energy & Focus",
        "icon": "Zap",
        "color": "bg-gradient-to-br from-orange-400 to-red-500",
        "mantraCount": 9
      }
    ],
    "difficulties": [
      {
        "identifier": "BEGINNER",
        "label": "Beginner",
        "mantraCount": 15
      }
    ]
  }
}
```

**Frontend Example:**
```typescript
// Load all categories on app start
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://api-music-iota.vercel.app';

const initializeCategories = async () => {
  const response = await fetch(`${API_BASE_URL}/mantras/categories/all`);
  const { data } = await response.json();

  // Store in Redux/Context
  dispatch(setDeities(data.deities));
  dispatch(setBenefits(data.benefits));
  dispatch(setDifficulties(data.difficulties));
};
```

---

### 5. Get Category Statistics

Get overall statistics and analytics.

**Endpoint:** `GET /mantras/categories/stats`

**Use Case:** Dashboard, analytics, admin panel

**Request:**
```bash
curl -X GET "https://your-api.com/mantras/categories/stats"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalMantras": 21,
    "byDeity": [
      { "_id": "SHIVA", "count": 8 },
      { "_id": "UNIVERSAL", "count": 7 },
      { "_id": "KRISHNA", "count": 3 },
      { "_id": "HANUMAN", "count": 2 },
      { "_id": "GANESHA", "count": 1 }
    ],
    "byBenefit": [
      { "_id": "ENERGY", "count": 9 },
      { "_id": "CALM", "count": 5 },
      { "_id": "HEALING", "count": 3 },
      { "_id": "PROTECTION", "count": 2 },
      { "_id": "FORGIVENESS", "count": 1 },
      { "_id": "CONFIDENCE", "count": 1 }
    ],
    "byDifficulty": [
      { "_id": "BEGINNER", "count": 15 },
      { "_id": "INTERMEDIATE", "count": 4 },
      { "_id": "ADVANCED", "count": 2 }
    ],
    "topMantras": [
      {
        "_id": "65a1b2c3d4e5f6g7h8i9j0k7",
        "title": "Gayatri Mantra (Positive Energy)",
        "deity": "UNIVERSAL",
        "benefit": "ENERGY",
        "popularityScore": 45000
      },
      {
        "_id": "65a1b2c3d4e5f6g7h8i9j0k8",
        "title": "Hanuman Chalisa (Life Changing)",
        "deity": "HANUMAN",
        "benefit": "PROTECTION",
        "popularityScore": 32000
      }
    ]
  }
}
```

---

## Mantra Endpoints

### 6. Get All Mantras

Get mantras with filtering, pagination, and access control.

**Endpoint:** `GET /mantras`

**Query Parameters:**
- `email` (optional) - User email for access control
- `deity` (optional) - Filter by deity (SHIVA, KRISHNA, etc.)
- `benefit` (optional) - Filter by benefit (ENERGY, CALM, etc.)
- `difficulty` (optional) - Filter by difficulty (BEGINNER, INTERMEDIATE, ADVANCED)
- `page` (optional, default: 1) - Page number
- `limit` (optional, default: 20) - Items per page

**Use Cases:**
- List all mantras
- Filter by deity/benefit/difficulty
- Paginated mantra library

**Example 1: Get all mantras (paginated)**
```bash
# Production
curl -X GET "https://api-music-iota.vercel.app/mantras?page=1&limit=20"

# Development
curl -X GET "https://dev-api-music-iota.vercel.app/mantras?page=1&limit=20"
```

**Example 2: Filter by deity**
```bash
curl -X GET "https://api-music-iota.vercel.app/mantras?deity=SHIVA&email=user@example.com"
```

**Example 3: Filter by benefit**
```bash
curl -X GET "https://api-music-iota.vercel.app/mantras?benefit=ENERGY"
```

**Example 4: Combined filters**
```bash
curl -X GET "https://api-music-iota.vercel.app/mantras?deity=HANUMAN&benefit=PROTECTION&difficulty=BEGINNER"
```

**Response:**
```json
{
  "success": true,
  "mantras": [
    {
      "_id": "65a1b2c3d4e5f6g7h8i9j0k9",
      "title": "Om Namah Shivaya (Obstacle Destroyer)",
      "description": "An ancient mantra that destroys obstacles and brings success.",
      "duration": 600,
      "audioUrl": "https://storage.googleapis.com/schoolbreathvideos/.../Om%20Namah%20Shivaya.mp3",
      "thumbnailUrl": "",
      "visualUrl": "",
      "category": "SHIVA",
      "tags": ["Success", "Power"],
      "deity": "SHIVA",
      "benefit": "ENERGY",
      "difficulty": "BEGINNER",
      "color": "bg-[#1e1b4b]",
      "popularityScore": 15400,
      "pointsReward": 50,
      "views": 1234,
      "isPremium": false,
      "isActive": true,
      "position": 0,
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z"
    }
  ],
  "hasAccess": true,
  "pagination": {
    "total": 21,
    "page": 1,
    "limit": 20,
    "totalPages": 2,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

**Frontend Example:**
```typescript
// Filter mantras by user selection
const filterMantras = async (deity, benefit, userEmail) => {
  const params = new URLSearchParams({
    deity,
    benefit,
    email: userEmail,
    page: '1',
    limit: '20'
  });

  const response = await fetch(`https://your-api.com/mantras?${params}`);
  const { mantras, hasAccess, pagination } = await response.json();

  return { mantras, hasAccess, pagination };
};
```

---

### 7. Get Single Mantra

Get detailed information about a specific mantra.

**Endpoint:** `GET /mantras/:id`

**Use Case:** Mantra detail page, player screen

**Request:**
```bash
# Production
curl -X GET "https://api-music-iota.vercel.app/mantras/65a1b2c3d4e5f6g7h8i9j0k9"

# Development
curl -X GET "https://dev-api-music-iota.vercel.app/mantras/65a1b2c3d4e5f6g7h8i9j0k9"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "65a1b2c3d4e5f6g7h8i9j0k9",
    "title": "Om Namah Shivaya (Obstacle Destroyer)",
    "description": "An ancient mantra that destroys obstacles and brings success.",
    "duration": 600,
    "audioUrl": "https://storage.googleapis.com/.../Om%20Namah%20Shivaya.mp3",
    "deity": "SHIVA",
    "benefit": "ENERGY",
    "difficulty": "BEGINNER",
    "tags": ["Success", "Power"],
    "color": "bg-[#1e1b4b]",
    "popularityScore": 15400,
    "pointsReward": 50,
    "views": 1235,
    "isPremium": false
  }
}
```

**Note:** View count is automatically incremented when fetched.

---

### 8. Get Mantras by Deity

Get all mantras grouped by deity.

**Endpoint:** `GET /mantras/explore/by-deity`

**Query Parameters:**
- `email` (optional) - User email for access control

**Use Case:** Deity-based exploration UI

**Request:**
```bash
# Production
curl -X GET "https://api-music-iota.vercel.app/mantras/explore/by-deity?email=user@example.com"

# Development
curl -X GET "https://dev-api-music-iota.vercel.app/mantras/explore/by-deity?email=user@example.com"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "SHIVA": [
      {
        "_id": "...",
        "title": "Om Namah Shivaya (Obstacle Destroyer)",
        "duration": 600,
        "deity": "SHIVA",
        "benefit": "ENERGY",
        "popularityScore": 15400
      }
    ],
    "KRISHNA": [
      {
        "_id": "...",
        "title": "Hare Krishna (Peace & Healing)",
        "duration": 600,
        "deity": "KRISHNA",
        "benefit": "HEALING",
        "popularityScore": 19500
      }
    ],
    "HANUMAN": [...],
    "GANESHA": [...],
    "UNIVERSAL": [...]
  },
  "hasAccess": true
}
```

**Frontend Example:**
```typescript
// Build deity-based explorer
const loadDeityMantras = async () => {
  const response = await fetch('https://your-api.com/mantras/explore/by-deity');
  const { data } = await response.json();

  // Render sections per deity
  Object.entries(data).forEach(([deity, mantras]) => {
    renderDeitySection(deity, mantras);
  });
};
```

---

### 9. Get Mantras by Benefit

Get all mantras grouped by benefit.

**Endpoint:** `GET /mantras/explore/by-benefit`

**Query Parameters:**
- `email` (optional) - User email for access control

**Use Case:** Benefit-based exploration UI (mood selector)

**Request:**
```bash
# Production
curl -X GET "https://api-music-iota.vercel.app/mantras/explore/by-benefit?email=user@example.com"

# Development
curl -X GET "https://dev-api-music-iota.vercel.app/mantras/explore/by-benefit?email=user@example.com"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "ENERGY": [
      {
        "_id": "...",
        "title": "Om Namah Shivaya (Obstacle Destroyer)",
        "deity": "SHIVA",
        "benefit": "ENERGY",
        "difficulty": "BEGINNER",
        "popularityScore": 15400
      }
    ],
    "CALM": [...],
    "HEALING": [...],
    "PROTECTION": [...],
    "FORGIVENESS": [...],
    "CONFIDENCE": [...]
  },
  "hasAccess": true
}
```

---

### 10. Get Popular Mantras

Get the most popular mantras sorted by popularity score.

**Endpoint:** `GET /mantras/popular/list`

**Query Parameters:**
- `limit` (optional, default: 20) - Number of mantras to return

**Use Case:** Homepage featured section, "Trending Now"

**Request:**
```bash
# Production
curl -X GET "https://api-music-iota.vercel.app/mantras/popular/list?limit=5"

# Development
curl -X GET "https://dev-api-music-iota.vercel.app/mantras/popular/list?limit=5"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "...",
      "title": "Gayatri Mantra (Positive Energy)",
      "deity": "UNIVERSAL",
      "benefit": "ENERGY",
      "popularityScore": 45000,
      "views": 5000
    },
    {
      "_id": "...",
      "title": "Hanuman Chalisa (Life Changing)",
      "deity": "HANUMAN",
      "benefit": "PROTECTION",
      "popularityScore": 32000,
      "views": 4200
    }
  ]
}
```

---

## Common Use Cases

### Use Case 1: App Initialization

Load all categories on app start:

```typescript
const initializeApp = async () => {
  const API_BASE_URL = 'https://api-music-iota.vercel.app';

  try {
    // Load all categories at once
    const categoriesResponse = await fetch(`${API_BASE_URL}/mantras/categories/all`);
    const { data: categories } = await categoriesResponse.json();

    // Load popular mantras for homepage
    const popularResponse = await fetch(`${API_BASE_URL}/mantras/popular/list?limit=20`);
    const { data: popularMantras } = await popularResponse.json();

    // Store in state
    dispatch({
      type: 'INIT_SUCCESS',
      payload: { categories, popularMantras }
    });
  } catch (error) {
    console.error('App initialization failed:', error);
  }
};
```

### Use Case 2: Deity Explorer

Build a deity-based explorer:

```typescript
const DeityExplorer = () => {
  const [deities, setDeities] = useState([]);

  useEffect(() => {
    const loadDeities = async () => {
      const response = await fetch('https://your-api.com/mantras/categories/deities');
      const { data } = await response.json();
      setDeities(data);
    };
    loadDeities();
  }, []);

  const onDeityPress = async (deity) => {
    // Load mantras for selected deity
    const response = await fetch(`https://your-api.com/mantras?deity=${deity.identifier}`);
    const { mantras } = await response.json();
    navigate('MantraList', { mantras, deity });
  };

  return deities.map(deity => (
    <DeityCard
      key={deity.identifier}
      image={deity.image}
      title={deity.label}
      description={deity.description}
      count={deity.mantraCount}
      onPress={() => onDeityPress(deity)}
    />
  ));
};
```

### Use Case 3: Benefit Mood Selector

Build a mood-based selector:

```typescript
const MoodSelector = () => {
  const [benefits, setBenefits] = useState([]);

  useEffect(() => {
    const loadBenefits = async () => {
      const response = await fetch('https://your-api.com/mantras/categories/benefits');
      const { data } = await response.json();
      setBenefits(data);
    };
    loadBenefits();
  }, []);

  const onBenefitPress = async (benefit) => {
    // Load mantras for selected benefit
    const response = await fetch(`https://your-api.com/mantras?benefit=${benefit.identifier}`);
    const { mantras } = await response.json();
    navigate('MantraList', { mantras, benefit });
  };

  return (
    <View>
      <Text>How do you want to feel?</Text>
      {benefits.map(benefit => (
        <BenefitButton
          key={benefit.identifier}
          label={benefit.label}
          icon={benefit.icon}
          gradient={benefit.color}
          onPress={() => onBenefitPress(benefit)}
        />
      ))}
    </View>
  );
};
```

### Use Case 4: Search & Filter

Implement search with filters:

```typescript
const MantraSearch = () => {
  const [filters, setFilters] = useState({
    deity: null,
    benefit: null,
    difficulty: null,
    search: ''
  });

  const searchMantras = async () => {
    const params = new URLSearchParams();
    if (filters.deity) params.append('deity', filters.deity);
    if (filters.benefit) params.append('benefit', filters.benefit);
    if (filters.difficulty) params.append('difficulty', filters.difficulty);
    params.append('email', userEmail);

    const response = await fetch(`https://your-api.com/mantras?${params}`);
    const { mantras, hasAccess } = await response.json();

    // Filter by search term locally
    const filtered = mantras.filter(m =>
      m.title.toLowerCase().includes(filters.search.toLowerCase())
    );

    return { mantras: filtered, hasAccess };
  };
};
```

### Use Case 5: Caching Strategy

Implement efficient caching:

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

const getCachedCategories = async () => {
  const cached = await AsyncStorage.getItem('mantra_categories');

  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_DURATION) {
      return data;
    }
  }

  // Fetch fresh data
  const response = await fetch('https://your-api.com/mantras/categories/all');
  const { data } = await response.json();

  // Cache it
  await AsyncStorage.setItem('mantra_categories', JSON.stringify({
    data,
    timestamp: Date.now()
  }));

  return data;
};
```

---

## Error Handling

All endpoints return errors in this format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

### Common HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Request completed successfully |
| 201 | Created | Resource created successfully (admin endpoints) |
| 400 | Bad Request | Missing required parameters |
| 404 | Not Found | Mantra or category not found |
| 500 | Server Error | Internal server error |

### Error Handling Example

```typescript
const fetchMantras = async () => {
  try {
    const response = await fetch('https://your-api.com/mantras');

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error('Failed to fetch mantras:', error);

    // Show user-friendly message
    if (error.message.includes('Network')) {
      showToast('No internet connection');
    } else {
      showToast('Failed to load mantras');
    }
  }
};
```

---

## Rate Limiting

Currently no rate limiting on public endpoints. Best practices:

- Cache category data (changes rarely)
- Implement pagination for large lists
- Use query parameters to filter server-side
- Avoid polling - use WebSockets for real-time updates (future)

---

## Access Control

The `email` parameter enables access control via Systeme.io tags:

**Full Access Tags:**
- `Enrolled_to_Membership`
- `Enrolled_Holistic Membership`

**Response includes:**
```json
{
  "hasAccess": true  // or false
}
```

Use this to show/hide premium content in UI.

---

## Performance Tips

1. **Load categories once** on app start, cache them
2. **Use pagination** for mantra lists (default limit: 20)
3. **Filter server-side** using query parameters
4. **Prefetch popular mantras** for better UX
5. **Lazy load images** for deity cards
6. **Cache mantra data** for offline support

---

## Testing

Test all endpoints with:

```bash
# Categories
curl https://your-api.com/mantras/categories/all

# Mantras
curl https://your-api.com/mantras?limit=5

# Popular
curl https://your-api.com/mantras/popular/list?limit=3

# Stats
curl https://your-api.com/mantras/categories/stats
```

---

## Need Help?

- **API Documentation**: `MANTRAS_API_DOCUMENTATION.md`
- **Dynamic System Guide**: `MANTRAS_DYNAMIC_SYSTEM.md`
- **Seed Data**: `MANTRAS_SEED_README.md`
- **Postman Collection**: Import `Mantras_API.postman_collection.json`

---

**Last Updated:** January 2026
**API Version:** 1.0
**Contact:** support@schoolofbreath.com

---

## Quick Reference - API URLs

| Environment | Base URL | Example |
|-------------|----------|---------|
| **Production** | `https://api-music-iota.vercel.app` | `https://api-music-iota.vercel.app/mantras` |
| **Development** | `https://dev-api-music-iota.vercel.app` | `https://dev-api-music-iota.vercel.app/mantras` |
| **Local** | `http://localhost:3000` | `http://localhost:3000/mantras` |

### Environment Configuration

**React/React Native:**
```typescript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://api-music-iota.vercel.app';
```

**Node.js:**
```javascript
const API_BASE_URL = process.env.API_URL || 'https://api-music-iota.vercel.app';
```

**React Native (.env):**
```
REACT_APP_API_URL=https://api-music-iota.vercel.app
```
