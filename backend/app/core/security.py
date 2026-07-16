# app/core/security.py
from datetime import datetime, timedelta
from typing import Any, Union
from jose import jwt
from passlib.context import CryptContext
from app.core.config import settings

# Şifreleme bağlamı (bcrypt algoritması ile)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Girilen düz şifre ile veritabanındaki hash'i karşılaştırır.
    """
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """
    Şifreyi bcrypt algoritmasıyla hash'ler.
    """
    return pwd_context.hash(password)

def create_access_token(subject: Union[str, Any], email: str, role: str, expires_delta: timedelta = None) -> str:
    """
    Kullanıcı bilgileriyle (ID, e-posta, rol claims) JWT Token üretir.
    """
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "email": email,
        "role": role
    }
    
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt
