# app/infrastructure/persistence/postgres/database.py
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Veritabanı motorunu oluştur
engine = create_engine(
    settings.DATABASE_URL,
    # PostgreSQL asenkron olmayan normal driver kullandığı için pool ayarları eklenebilir
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20
)

# Oturum fabrikası
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# ORM Sınıflarının türeyeceği taban sınıf
Base = declarative_base()

def get_db():
    """
    FastAPI endpoint'lerinde kullanılmak üzere DB Session bağımlılığı.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
