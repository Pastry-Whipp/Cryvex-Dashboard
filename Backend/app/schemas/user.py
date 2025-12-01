from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional


# Base schema for User
class UserBase(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    full_name: Optional[str] = None


# Schema for user registration
class UserCreate(UserBase):
    password: str = Field(..., min_length=8, max_length=100)


# Schema for user login
class UserLogin(BaseModel):
    username: str
    password: str


# Schema for user response
class UserResponse(UserBase):
    id: int
    is_active: bool
    is_verified: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# Schema for user profile update
class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None


# Schema for token response
class Token(BaseModel):
    access_token: str
    token_type: str


# Schema for token data
class TokenData(BaseModel):
    username: Optional[str] = None







