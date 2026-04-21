# School of Breath - Mantras API URLs

Quick reference for all API environments.

## 🌐 API Endpoints

### Production (Live)
```
https://api-music-iota.vercel.app
```

**Full Endpoint Example:**
```
https://api-music-iota.vercel.app/mantras
https://api-music-iota.vercel.app/mantras/categories/deities
https://api-music-iota.vercel.app/mantras/popular/list
```

---

### Development (Testing)
```
https://dev-api-music-iota.vercel.app
```

**Full Endpoint Example:**
```
https://dev-api-music-iota.vercel.app/mantras
https://dev-api-music-iota.vercel.app/mantras/categories/benefits
https://dev-api-music-iota.vercel.app/mantras/explore/by-deity
```

---

### Local Development
```
http://localhost:3000
```

**Full Endpoint Example:**
```
http://localhost:3000/mantras
http://localhost:3000/mantras/categories/all
http://localhost:3000/mantras/popular/list
```

---

## 🧪 Quick Tests

### Test Production
```bash
# Get all deities
curl https://api-music-iota.vercel.app/mantras/categories/deities

# Get all mantras
curl https://api-music-iota.vercel.app/mantras?limit=5

# Get popular mantras
curl https://api-music-iota.vercel.app/mantras/popular/list?limit=3

# Get category stats
curl https://api-music-iota.vercel.app/mantras/categories/stats
```

### Test Development
```bash
# Get all benefits
curl https://dev-api-music-iota.vercel.app/mantras/categories/benefits

# Get SHIVA mantras
curl https://dev-api-music-iota.vercel.app/mantras?deity=SHIVA

# Get mantras by deity
curl https://dev-api-music-iota.vercel.app/mantras/explore/by-deity
```

### Test Local
```bash
# Start your local server first: npm run dev

# Then test
curl http://localhost:3000/mantras/categories/all
curl http://localhost:3000/mantras?limit=10
```

---

## 💻 Frontend Configuration

### React / React Native

**Option 1: Environment Variables**
```typescript
// .env.production
REACT_APP_API_URL=https://api-music-iota.vercel.app

// .env.development
REACT_APP_API_URL=https://dev-api-music-iota.vercel.app

// .env.local
REACT_APP_API_URL=http://localhost:3000
```

**Option 2: Config File**
```typescript
// config/api.ts
const API_URLS = {
  production: 'https://api-music-iota.vercel.app',
  development: 'https://dev-api-music-iota.vercel.app',
  local: 'http://localhost:3000'
};

const getApiUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return API_URLS.production;
  }
  if (process.env.NODE_ENV === 'development') {
    return API_URLS.development;
  }
  return API_URLS.local;
};

export const API_BASE_URL = getApiUrl();
```

**Usage:**
```typescript
import { API_BASE_URL } from './config/api';

// Fetch mantras
const response = await fetch(`${API_BASE_URL}/mantras`);
const data = await response.json();
```

### Axios Configuration

```typescript
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://api-music-iota.vercel.app';

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Usage
axiosInstance.get('/mantras').then(response => {
  console.log(response.data);
});
```

---

## 📱 Mobile App Configuration

### React Native (.env)

```bash
# .env.production
REACT_APP_API_URL=https://api-music-iota.vercel.app

# .env.development
REACT_APP_API_URL=https://dev-api-music-iota.vercel.app

# .env.local
REACT_APP_API_URL=http://localhost:3000
```

### Using react-native-config

```typescript
import Config from 'react-native-config';

export const API_BASE_URL = Config.REACT_APP_API_URL || 'https://api-music-iota.vercel.app';

// API Service
export const mantrasAPI = {
  getDeities: () => fetch(`${API_BASE_URL}/mantras/categories/deities`),
  getMantras: (params) => fetch(`${API_BASE_URL}/mantras?${new URLSearchParams(params)}`),
  getPopular: (limit = 20) => fetch(`${API_BASE_URL}/mantras/popular/list?limit=${limit}`)
};
```

---

## 🔧 Postman Configuration

### Import Collection
1. Import `Mantras_API.postman_collection.json`
2. The collection defaults to **Production URL**
3. Edit `base_url` variable to switch environments

### Postman Environments

**Create 3 environments:**

**1. Production**
```
base_url: https://api-music-iota.vercel.app
user_email: your-email@example.com
```

**2. Development**
```
base_url: https://dev-api-music-iota.vercel.app
user_email: test@example.com
```

**3. Local**
```
base_url: http://localhost:3000
user_email: test@example.com
```

---

## 🔐 Authentication

All endpoints support optional email-based access control:

```bash
# With user email (checks access)
curl "https://api-music-iota.vercel.app/mantras?email=user@example.com"

# Without email (no access check)
curl "https://api-music-iota.vercel.app/mantras"
```

**Access Control:**
- Users with tags `Enrolled_to_Membership` or `Enrolled_Holistic Membership` get full access
- Response includes `hasAccess: true/false` field
- Frontend can show/hide premium content based on this flag

---

## 📊 Health Check

Test if API is running:

```bash
# Production
curl https://api-music-iota.vercel.app/health

# Development
curl https://dev-api-music-iota.vercel.app/health

# Local
curl http://localhost:3000/health
```

---

## 🚨 Troubleshooting

### CORS Issues
If you encounter CORS errors:
- Verify the origin is allowed in backend CORS config
- Check if you're using the correct protocol (http vs https)
- Ensure no trailing slashes in base URL

### Connection Refused
If `curl` returns connection refused:
- **Production/Dev**: Check Vercel deployment status
- **Local**: Ensure server is running (`npm run dev`)
- Verify the port number for local (default: 3000)

### 404 Not Found
- Double-check the endpoint path
- Ensure `/mantras` prefix is included
- Verify the API is deployed on Vercel

---

## 📚 Related Documentation

- **Complete API Reference**: `MANTRAS_PUBLIC_API_REFERENCE.md`
- **Technical Documentation**: `MANTRAS_API_DOCUMENTATION.md`
- **Dynamic System Guide**: `MANTRAS_DYNAMIC_SYSTEM.md`
- **Postman Collection**: `Mantras_API.postman_collection.json`
- **Seeding Guide**: `MANTRAS_SEED_README.md`

---

## 🆘 Support

For API issues:
- Check documentation files
- Test with Postman collection
- Verify environment variables
- Contact: support@schoolofbreath.com

---

**Last Updated:** January 2026
**Maintained by:** School of Breath Development Team
