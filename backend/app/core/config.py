# app/core/config.py
import os
from typing import List, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    # API Sunucu Ayarları
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Gazi Teknopark Kurumsal Bilgi Asistanı"
    
    # Güvenlik & JWT Ayarları
    JWT_SECRET_KEY: str = Field(default="gazi_tekno_super_secret_key_2026", validation_alias="JWT_SECRET_KEY")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 gün
    
    # Veritabanı Ayarları
    DATABASE_URL: str = Field(
        default="postgresql://gazi_admin:secure_db_password_123@postgres:5432/gazi_assistant",
        validation_alias="DATABASE_URL"
    )
    
    # Cache & Kuyruk Ayarları (Redis)
    REDIS_URL: str = Field(default="redis://redis:6379/0", validation_alias="REDIS_URL")
    
    # Vektör Veritabanı Ayarları (Qdrant)
    QDRANT_URL: str = Field(default="http://qdrant:6333", validation_alias="QDRANT_URL")
    QDRANT_COLLECTION_NAME: str = "gaziteknopark_knowledge"
    
    # LLM Sunucu Ayarları (Ollama)
    OLLAMA_URL: str = Field(default="http://host.docker.internal:11434", validation_alias="OLLAMA_URL")
    LLM_MODEL: str = Field(default="qwen2.5:3b", validation_alias="LLM_MODEL")
    EMBEDDING_MODEL: str = "bge-m3"
    RERANKER_MODEL: str = "BAAI/bge-reranker-v2-m3"
    
    # LDAP / Active Directory Entegrasyon Ayarları
    LDAP_ENABLED: bool = Field(default=False, validation_alias="LDAP_ENABLED")
    LDAP_SERVER_URL: Optional[str] = Field(default=None, validation_alias="LDAP_SERVER_URL")
    LDAP_BASE_DN: Optional[str] = Field(default=None, validation_alias="LDAP_BASE_DN")
    LDAP_USER_DN_PATTERN: Optional[str] = Field(default=None, validation_alias="LDAP_USER_DN_PATTERN")
    LDAP_ADMIN_GROUP: Optional[str] = Field(default="admin-group", validation_alias="LDAP_ADMIN_GROUP")
    
    # Dosya Yükleme Politikası
    UPLOAD_DIR: str = "/tmp/gazi_uploads"
    MAX_FILE_SIZE_BYTES: int = 50 * 1024 * 1024  # 50 MB
    ALLOWED_EXTENSIONS: List[str] = ["pdf", "docx", "xlsx", "pptx", "txt"]
    
    # Pydantic Ayarları
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

# Singleton Settings Nesnesi
settings = Settings()

# Upload dizinini otomatik oluştur
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
