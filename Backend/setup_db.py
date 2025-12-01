"""
Database Setup Script
Creates the PostgreSQL database for CRYVEX
"""
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

def create_database():
    """Create the CRYVEX database if it doesn't exist"""
    try:
        # Connect to PostgreSQL server
        connection = psycopg2.connect(
            user="postgres",
            password="saibi",
            host="localhost",
            port="5433"
        )
        connection.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        
        cursor = connection.cursor()
        
        # Check if database exists
        cursor.execute("SELECT 1 FROM pg_catalog.pg_database WHERE datname = 'cryvex_db'")
        exists = cursor.fetchone()
        
        if not exists:
            cursor.execute("CREATE DATABASE cryvex_db")
            print("✅ Database 'cryvex_db' created successfully!")
        else:
            print("ℹ️  Database 'cryvex_db' already exists.")
        
        cursor.close()
        connection.close()
        
    except Exception as error:
        print(f"❌ Error creating database: {error}")
        print("\n💡 Make sure PostgreSQL is running and credentials are correct.")
        print("   Default credentials: user=postgres, password=postgres")

if __name__ == "__main__":
    create_database()
