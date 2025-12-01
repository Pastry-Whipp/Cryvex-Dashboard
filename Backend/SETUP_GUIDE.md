# CRYVEX Backend Setup Guide

Complete step-by-step guide to set up the CRYVEX backend locally.

## 📋 Prerequisites Checklist

Before starting, make sure you have:
- [ ] Python 3.9 or higher installed
- [ ] PostgreSQL 12 or higher installed
- [ ] Git installed (optional)
- [ ] Text editor or IDE (VS Code recommended)

---

## 🔧 Step 1: Install PostgreSQL

### Windows

1. Download PostgreSQL from: https://www.postgresql.org/download/windows/
2. Run the installer
3. During installation:
   - Set password for postgres user (remember this!)
   - Default port: 5432
   - Install pgAdmin 4 (recommended for GUI management)
4. After installation, PostgreSQL should start automatically

### macOS

```bash
# Install using Homebrew
brew install postgresql@14

# Start PostgreSQL service
brew services start postgresql@14

# Create postgres user (if needed)
createdb
```

### Linux (Ubuntu/Debian)

```bash
# Update package list
sudo apt update

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL service
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Check status
sudo systemctl status postgresql
```

---

## 🗄️ Step 2: Set Up Database

### Option A: Using Command Line

```bash
# Login to PostgreSQL
sudo -u postgres psql

# OR on Windows (in Command Prompt):
psql -U postgres

# Create the database
CREATE DATABASE cryvex_db;

# Check if created
\l

# Exit
\q
```

### Option B: Using Python Script

```bash
cd cryvex-backend
python setup_db.py
```

### Option C: Using pgAdmin (Windows)

1. Open pgAdmin 4
2. Connect to PostgreSQL server
3. Right-click on "Databases" → Create → Database
4. Name: `cryvex_db`
5. Click "Save"

---

## 🐍 Step 3: Set Up Python Environment

### 1. Navigate to Project Directory

```bash
cd cryvex-backend
```

### 2. Create Virtual Environment

**Windows:**
```bash
python -m venv venv
```

**macOS/Linux:**
```bash
python3 -m venv venv
```

### 3. Activate Virtual Environment

**Windows (Command Prompt):**
```bash
venv\Scripts\activate
```

**Windows (PowerShell):**
```bash
venv\Scripts\Activate.ps1
```

**macOS/Linux:**
```bash
source venv/bin/activate
```

You should see `(venv)` at the start of your command prompt.

### 4. Install Dependencies

```bash
pip install -r requirements.txt
```

Wait for all packages to install (this may take a few minutes).

---

## ⚙️ Step 4: Configure Environment Variables

### 1. Create .env File

The `.env` file should already exist. If not, create it:

**Windows (Command Prompt):**
```bash
copy .env.example .env
```

**macOS/Linux:**
```bash
cp .env.example .env
```

### 2. Edit .env File

Open `.env` in your text editor and update if needed:

```env
# Database Configuration
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/cryvex_db

# JWT Configuration
SECRET_KEY=09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Application Configuration
APP_NAME=CRYVEX
DEBUG=True
```

**Important:** Replace `YOUR_PASSWORD` with your PostgreSQL password!

---

## 🚀 Step 5: Run the Application

### Method 1: Using run.py

```bash
python run.py
```

### Method 2: Using uvicorn directly

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     Started reloader process
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Application startup complete.
```

---

## ✅ Step 6: Test the API

### 1. Open Browser

Navigate to: http://localhost:8000/docs

You should see the Swagger UI documentation.

### 2. Test Health Check

Open: http://localhost:8000/health

You should see:
```json
{
  "status": "healthy"
}
```

### 3. Test Sign Up

In Swagger UI:
1. Click on `POST /api/v1/auth/signup`
2. Click "Try it out"
3. Enter test data:
```json
{
  "email": "test@example.com",
  "username": "testuser",
  "password": "password123",
  "full_name": "Test User"
}
```
4. Click "Execute"
5. You should get a 201 response with user data

### 4. Test Login

1. Click on `POST /api/v1/auth/login`
2. Click "Try it out"
3. Enter:
   - username: `testuser`
   - password: `password123`
4. Click "Execute"
5. Copy the `access_token` from response

### 5. Test Protected Endpoint

1. Click on `GET /api/v1/users/me`
2. Click "Try it out"
3. Click the "Authorize" button (🔒 icon at top)
4. Paste your token in the format: `Bearer YOUR_TOKEN`
5. Click "Authorize"
6. Click "Execute"
7. You should see your user profile

---

## 🐛 Troubleshooting

### Database Connection Error

**Error:** `could not connect to server`

**Solution:**
- Check if PostgreSQL is running
- Windows: Check Services
- macOS: `brew services list`
- Linux: `sudo systemctl status postgresql`

### Port Already in Use

**Error:** `Address already in use`

**Solution:**
- Change port in run command: `uvicorn app.main:app --reload --port 8001`
- Or kill the process using port 8000

### Module Not Found Error

**Error:** `ModuleNotFoundError: No module named 'fastapi'`

**Solution:**
- Make sure virtual environment is activated
- Run `pip install -r requirements.txt` again

### Password Authentication Failed

**Error:** `password authentication failed for user "postgres"`

**Solution:**
- Update `.env` file with correct password
- Reset PostgreSQL password if needed

### Import Error

**Error:** `cannot import name 'app' from 'app.main'`

**Solution:**
- Make sure you're in the `cryvex-backend` directory
- Check all `__init__.py` files exist

---

## 📊 Check Database Tables

### Using psql

```bash
# Login
psql -U postgres -d cryvex_db

# List tables
\dt

# View users table
SELECT * FROM users;

# Exit
\q
```

### Using pgAdmin

1. Open pgAdmin
2. Navigate to: Servers → PostgreSQL → Databases → cryvex_db → Schemas → public → Tables
3. Right-click on "users" → View/Edit Data → All Rows

---

## 🎯 Next Steps

Now that your backend is running:

1. ✅ Test all authentication endpoints
2. ✅ Create multiple test users
3. ✅ Test profile updates
4. 📝 Start building ETL pipeline models
5. 📝 Implement blockchain integration
6. 📝 Create schema management system

---

## 📱 API Testing Tools

### Recommended Tools:
- **Swagger UI**: http://localhost:8000/docs (built-in)
- **Postman**: Download from https://www.postman.com/
- **Insomnia**: Download from https://insomnia.rest/
- **cURL**: Command line (already installed)

---

## 🆘 Getting Help

If you encounter issues:

1. Check the error message carefully
2. Review this setup guide
3. Check PostgreSQL is running
4. Verify virtual environment is activated
5. Check `.env` file configuration
6. Look at the terminal logs

Common log locations:
- Application logs: Terminal output
- PostgreSQL logs: `/var/log/postgresql/` (Linux)

---

## 🎉 Success!

If you can see the Swagger UI and create/login users, congratulations! Your CRYVEX backend is set up successfully!

Ready to build the ETL pipeline features! 🚀
