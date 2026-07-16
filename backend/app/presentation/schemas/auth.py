# app/presentation/schemas/auth.py
from pydantic import BaseModel, EmailStr
from app.domain.models.user import UserRole

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: UserRole
    user_id: str
    full_name: str
