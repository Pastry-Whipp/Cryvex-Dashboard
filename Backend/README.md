# CRYVEX Backend API

**Generic ETL Pipelines with Blockchain Integrity**

A FastAPI-based backend for CRYVEX - a schema-driven, no-code, multi-domain ETL engine that ensures data integrity using blockchain hashing.

## 🚀 Features

- ✅ User Authentication (JWT-based)
- ✅ User Registration & Login
- ✅ User Profile Management
- ✅ PostgreSQL Database
- ✅ RESTful API
- ✅ Input Validation
- ✅ Secure Password Hashing

## 📁 Project Structure

```
cryvex-backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application
│   ├── config.py            # Configuration settings
│   ├── database.py          # Database connection
│   ├── dependencies.py      # Authentication dependencies
│   ├── models/              # SQLAlchemy models
│   │   ├── __init__.py
│   │   └── user.py
│   ├── schemas/             # Pydantic schemas
│   │   ├── __init__.py
│   │   └── user.py
│   ├── routes/              # API routes
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   └── users.py
│   └── utils/               # Utility functions
│       ├── __init__.py
│       └── auth.py
├── .env                     # Environment variables
├── .env.example             # Example environment file
├── .gitignore
├── requirements.txt         # Python dependencies
└── README.md
```

## 🛠️ Setup Instructions

### 1. Prerequisites

- Python 3.9+
- PostgreSQL 12+

### 2. Install PostgreSQL (if not installed)

**Windows:**
Download from: https://www.postgresql.org/download/windows/

**macOS:**
```bash
brew install postgresql
brew services start postgresql
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### 3. Create Database

```bash
# Login to PostgreSQL
sudo -u postgres psql

# Create database
CREATE DATABASE cryvex_db;

# Create user (optional, if not using default postgres user)
CREATE USER cryvex_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE cryvex_db TO cryvex_user;

# Exit
\q
```

### 4. Clone and Setup Project

```bash
# Navigate to project directory
cd cryvex-backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 5. Configure Environment Variables

Copy `.env.example` to `.env` and update if needed:

```bash
cp .env.example .env
```

Edit `.env` file:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cryvex_db
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
APP_NAME=CRYVEX
DEBUG=True
```

### 6. Run the Application

```bash
# Make sure you're in the cryvex-backend directory
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at:
- **API:** http://localhost:8000
- **Interactive Docs:** http://localhost:8000/docs
- **Alternative Docs:** http://localhost:8000/redoc

## 📚 API Endpoints

### Authentication

#### Sign Up
```http
POST /api/v1/auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "strongpassword123",
  "full_name": "John Doe"
}
```

#### Login
```http
POST /api/v1/auth/login
Content-Type: application/x-www-form-urlencoded

username=johndoe&password=strongpassword123
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

### User Profile

#### Get My Profile
```http
GET /api/v1/users/me
Authorization: Bearer <token>
```

#### Update My Profile
```http
PUT /api/v1/users/me
Authorization: Bearer <token>
Content-Type: application/json

{
  "full_name": "John Updated Doe",
  "email": "newemail@example.com"
}
```

#### Get User by Username
```http
GET /api/v1/users/{username}
Authorization: Bearer <token>
```

## 🧪 Testing the API

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
  -H "Authorization: Bearer <your_token_here>"
```

### Using Python Requests

```python
import requests

BASE_URL = "http://localhost:8000/api/v1"

# Sign up
response = requests.post(
    f"{BASE_URL}/auth/signup",
    json={
        "email": "test@example.com",
        "username": "testuser",
        "password": "password123",
        "full_name": "Test User"
    }
)
print(response.json())

# Login
response = requests.post(
    f"{BASE_URL}/auth/login",
    data={
        "username": "testuser",
        "password": "password123"
    }
)
token = response.json()["access_token"]

# Get profile
response = requests.get(
    f"{BASE_URL}/users/me",
    headers={"Authorization": f"Bearer {token}"}
)
print(response.json())
```

## 🔒 Security Notes

- Change `SECRET_KEY` in production
- Use HTTPS in production
- Update CORS settings for specific origins
- Never commit `.env` file
- Use strong passwords (min 8 characters)

## 📝 Database Schema

### Users Table
| Column | Type | Description |
|--------|------|-------------|
| id | Integer | Primary key |
| email | String | Unique email |
| username | String | Unique username |
| full_name | String | User's full name |
| hashed_password | String | Bcrypt hashed password |
| is_active | Boolean | Account status |
| is_verified | Boolean | Email verification status |
| created_at | DateTime | Account creation time |
| updated_at | DateTime | Last update time |

## 🚧 Next Steps

- [ ] Add ETL pipeline models
- [ ] Implement blockchain integration
- [ ] Add schema management
- [ ] Create pipeline execution endpoints
- [ ] Add dashboard APIs
- [ ] Implement Merkle tree hashing
- [ ] Add data validation rules

## 🤝 Contributing

This is a Final Year Project (FYP) for NUML University.

## 📄 License

Private - Academic Project

## 👥 Team

- Hussnain Ul - Backend & Blockchain Development
- [Team Member 2] - [Role]
- [Team Member 3] - [Role]

## 📧 Contact

For questions or issues, contact: [your-email@example.com]
