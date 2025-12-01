# CRYVEX API Quick Reference

## 🌐 Base URL
```
http://localhost:8000
```

## 📚 Interactive Documentation
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

---

## 🔐 Authentication Endpoints

### 1. Sign Up (Register New User)

**Endpoint:** `POST /api/v1/auth/signup`

**Request Body:**
```json
{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "securepass123",
  "full_name": "John Doe"
}
```

**Success Response (201):**
```json
{
  "id": 1,
  "email": "user@example.com",
  "username": "johndoe",
  "full_name": "John Doe",
  "is_active": true,
  "is_verified": false,
  "created_at": "2024-01-15T10:30:00"
}
```

**Validation Rules:**
- Email: Valid email format
- Username: 3-50 characters, unique
- Password: Minimum 8 characters
- Full name: Optional

**Error Responses:**
```json
// 400 - Email already exists
{
  "detail": "Email already registered"
}

// 400 - Username already exists
{
  "detail": "Username already taken"
}
```

---

### 2. Login

**Endpoint:** `POST /api/v1/auth/login`

**Request Body (Form Data):**
```
username=johndoe
password=securepass123
```

**Success Response (200):**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJqb2huZG9lIiwiZXhwIjoxNzA1MzE3MDAwfQ.xyz",
  "token_type": "bearer"
}
```

**Error Responses:**
```json
// 401 - Invalid credentials
{
  "detail": "Incorrect username or password"
}

// 400 - Inactive user
{
  "detail": "Inactive user"
}
```

---

## 👤 User Profile Endpoints

### 3. Get My Profile

**Endpoint:** `GET /api/v1/users/me`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Success Response (200):**
```json
{
  "id": 1,
  "email": "user@example.com",
  "username": "johndoe",
  "full_name": "John Doe",
  "is_active": true,
  "is_verified": false,
  "created_at": "2024-01-15T10:30:00"
}
```

**Error Response:**
```json
// 401 - Invalid or expired token
{
  "detail": "Could not validate credentials"
}
```

---

### 4. Update My Profile

**Endpoint:** `PUT /api/v1/users/me`

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "full_name": "John Updated Doe",
  "email": "newemail@example.com"
}
```

**Note:** All fields are optional. Only send fields you want to update.

**Success Response (200):**
```json
{
  "id": 1,
  "email": "newemail@example.com",
  "username": "johndoe",
  "full_name": "John Updated Doe",
  "is_active": true,
  "is_verified": false,
  "created_at": "2024-01-15T10:30:00"
}
```

**Error Responses:**
```json
// 400 - Email already taken
{
  "detail": "Email already registered"
}

// 401 - Invalid token
{
  "detail": "Could not validate credentials"
}
```

---

### 5. Get User by Username

**Endpoint:** `GET /api/v1/users/{username}`

**Headers:**
```
Authorization: Bearer <access_token>
```

**Example:** `GET /api/v1/users/johndoe`

**Success Response (200):**
```json
{
  "id": 1,
  "email": "user@example.com",
  "username": "johndoe",
  "full_name": "John Doe",
  "is_active": true,
  "is_verified": false,
  "created_at": "2024-01-15T10:30:00"
}
```

**Error Response:**
```json
// 404 - User not found
{
  "detail": "User not found"
}
```

---

## 🔍 Health Check

### 6. Health Status

**Endpoint:** `GET /health`

**No authentication required**

**Success Response (200):**
```json
{
  "status": "healthy"
}
```

---

### 7. Root Endpoint

**Endpoint:** `GET /`

**No authentication required**

**Success Response (200):**
```json
{
  "message": "Welcome to CRYVEX API",
  "version": "1.0.0",
  "docs": "/docs"
}
```

---

## 📝 Common HTTP Status Codes

| Code | Meaning | When You'll See It |
|------|---------|-------------------|
| 200 | OK | Successful GET, PUT requests |
| 201 | Created | Successful POST (signup) |
| 400 | Bad Request | Validation errors, duplicate data |
| 401 | Unauthorized | Invalid/missing token |
| 404 | Not Found | Resource doesn't exist |
| 422 | Unprocessable Entity | Invalid request format |

---

## 🔐 Authentication Flow

1. **Sign Up** → Get user data
2. **Login** → Get access token
3. **Use Token** → Access protected endpoints

**Token Format:**
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Token Expiry:** 30 minutes (default)

---

## 💡 Testing Examples

### Using cURL

**Sign Up:**
```bash
curl -X POST "http://localhost:8000/api/v1/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "username": "testuser",
    "password": "password123",
    "full_name": "Test User"
  }'
```

**Login:**
```bash
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=testuser&password=password123"
```

**Get Profile:**
```bash
curl -X GET "http://localhost:8000/api/v1/users/me" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Using Python

```python
import requests

BASE_URL = "http://localhost:8000/api/v1"

# Sign up
signup_data = {
    "email": "test@example.com",
    "username": "testuser",
    "password": "password123",
    "full_name": "Test User"
}
response = requests.post(f"{BASE_URL}/auth/signup", json=signup_data)
print(response.json())

# Login
login_data = {
    "username": "testuser",
    "password": "password123"
}
response = requests.post(f"{BASE_URL}/auth/login", data=login_data)
token = response.json()["access_token"]
print(f"Token: {token}")

# Get profile
headers = {"Authorization": f"Bearer {token}"}
response = requests.get(f"{BASE_URL}/users/me", headers=headers)
print(response.json())

# Update profile
update_data = {"full_name": "Updated Name"}
response = requests.put(f"{BASE_URL}/users/me", json=update_data, headers=headers)
print(response.json())
```

### Using JavaScript (Fetch)

```javascript
const BASE_URL = "http://localhost:8000/api/v1";

// Sign up
async function signup() {
  const response = await fetch(`${BASE_URL}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "test@example.com",
      username: "testuser",
      password: "password123",
      full_name: "Test User"
    })
  });
  const data = await response.json();
  console.log(data);
}

// Login
async function login() {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "username=testuser&password=password123"
  });
  const data = await response.json();
  return data.access_token;
}

// Get profile
async function getProfile(token) {
  const response = await fetch(`${BASE_URL}/users/me`, {
    headers: { "Authorization": `Bearer ${token}` }
  });
  const data = await response.json();
  console.log(data);
}

// Usage
const token = await login();
await getProfile(token);
```

---

## 🎯 Quick Start Checklist

- [ ] Server running on http://localhost:8000
- [ ] PostgreSQL database created
- [ ] Environment variables configured
- [ ] Swagger UI accessible at /docs
- [ ] Successfully created test user
- [ ] Successfully logged in and got token
- [ ] Successfully accessed protected endpoint

---

## 🔗 Useful Links

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health
- **Root**: http://localhost:8000/

---

## 📞 Support

For issues or questions, refer to:
- `SETUP_GUIDE.md` - Detailed setup instructions
- `README.md` - Project overview
- Swagger UI - Interactive API testing
