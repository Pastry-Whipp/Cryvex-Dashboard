# CRYVEX Backend - Project Structure

```
cryvex-backend/
│
├── 📄 .env                          # Environment variables (DO NOT commit)
├── 📄 .env.example                  # Example environment file
├── 📄 .gitignore                    # Git ignore rules
├── 📄 README.md                     # Project documentation
├── 📄 SETUP_GUIDE.md               # Detailed setup instructions
├── 📄 API_REFERENCE.md             # API quick reference
├── 📄 requirements.txt              # Python dependencies
├── 📄 run.py                        # Server startup script
├── 📄 setup_db.py                   # Database setup script
│
└── app/                             # Main application package
    ├── 📄 __init__.py              # Package initializer
    ├── 📄 main.py                  # FastAPI application entry point
    ├── 📄 config.py                # Application configuration
    ├── 📄 database.py              # Database connection setup
    ├── 📄 dependencies.py          # Authentication dependencies
    │
    ├── models/                      # SQLAlchemy database models
    │   ├── 📄 __init__.py
    │   └── 📄 user.py              # User model
    │
    ├── schemas/                     # Pydantic validation schemas
    │   ├── 📄 __init__.py
    │   └── 📄 user.py              # User schemas
    │
    ├── routes/                      # API endpoints
    │   ├── 📄 __init__.py
    │   ├── 📄 auth.py              # Authentication routes
    │   └── 📄 users.py             # User profile routes
    │
    └── utils/                       # Utility functions
        ├── 📄 __init__.py
        └── 📄 auth.py              # Auth utilities (JWT, password hashing)
```

## 📦 File Descriptions

### Root Files

- **`.env`** - Contains environment variables (database URL, secret key, etc.)
- **`.env.example`** - Template for environment variables
- **`.gitignore`** - Specifies files Git should ignore
- **`requirements.txt`** - Lists all Python package dependencies
- **`run.py`** - Quick script to start the server
- **`setup_db.py`** - Script to create PostgreSQL database

### Documentation Files

- **`README.md`** - Complete project overview and documentation
- **`SETUP_GUIDE.md`** - Step-by-step setup instructions
- **`API_REFERENCE.md`** - Quick API endpoint reference

### App Directory

#### Core Files
- **`main.py`** - FastAPI app initialization, CORS, route inclusion
- **`config.py`** - Settings management using Pydantic
- **`database.py`** - SQLAlchemy engine and session setup
- **`dependencies.py`** - Reusable dependencies (auth, DB session)

#### Models Package
- **`user.py`** - User database model with SQLAlchemy

#### Schemas Package
- **`user.py`** - Pydantic models for request/response validation

#### Routes Package
- **`auth.py`** - Signup and login endpoints
- **`users.py`** - User profile management endpoints

#### Utils Package
- **`auth.py`** - Password hashing and JWT token functions

## 🎯 Key Features Implemented

✅ User registration with validation
✅ JWT-based authentication
✅ Password hashing with bcrypt
✅ Protected endpoints
✅ Profile management
✅ PostgreSQL database integration
✅ Input validation with Pydantic
✅ Automatic API documentation
✅ CORS configuration
✅ Health check endpoints

## 🚀 Next Steps

This structure is ready to extend with:
- ETL pipeline models
- Schema management
- Blockchain integration
- Data processing endpoints
- Dashboard APIs
- Merkle tree implementation

## 📊 Technology Stack

- **Framework**: FastAPI
- **Database**: PostgreSQL
- **ORM**: SQLAlchemy
- **Validation**: Pydantic
- **Authentication**: JWT (python-jose)
- **Password Hashing**: bcrypt (passlib)
- **Server**: Uvicorn

## 🔒 Security Features

- Passwords hashed with bcrypt
- JWT tokens for authentication
- Token expiration (30 min default)
- Input validation on all endpoints
- SQL injection prevention (ORM)
- CORS protection

Total Files: 23
Lines of Code: ~800+
