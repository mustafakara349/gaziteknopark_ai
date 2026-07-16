# app/presentation/main.py
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logging import setup_logging
from app.core.security import get_password_hash
from app.infrastructure.persistence.postgres.database import engine, Base, SessionLocal
from app.infrastructure.persistence.postgres.models import UserORM
from app.domain.models.user import UserRole
from app.presentation.api.v1.router import api_router
from app.presentation.middleware.rate_limit import RateLimitMiddleware
from app.presentation.middleware.exception_handler import register_exception_handlers

# 1. Loglama Sistemini Başlat
setup_logging()
logger = logging.getLogger("app.main")

# 2. Veritabanı Tablolarını Otomatik Oluştur (On-Premise Kolay Kurulum)
try:
    Base.metadata.create_all(bind=engine)
    logger.info("PostgreSQL tabloları başarıyla kontrol edildi/oluşturuldu.")
    
    # 3. Varsayılan Admin Kullanıcısı Oluştur (Seeding)
    db = SessionLocal()
    try:
        admin_exists = db.query(UserORM).filter(UserORM.role == UserRole.ADMIN).first()
        if not admin_exists:
            default_admin = UserORM(
                email="admin@gazi.local",
                password_hash=get_password_hash("admin123"),
                full_name="Sistem Yöneticisi",
                role=UserRole.ADMIN,
                is_active=True
            )
            db.add(default_admin)
            db.commit()
            logger.info("Varsayılan Admin kullanıcısı oluşturuldu: admin@gazi.local / admin123")
    finally:
        db.close()
except Exception as e:
    logger.critical(f"Veritabanı başlatılırken hata oluştu: {str(e)}")

# 4. FastAPI Uygulamasını Başlat
app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Gazi Teknopark tamamen yerel (on-premise) çalışan Kurumsal Bilgi Asistanı REST API",
    version="1.0.0",
    docs_url=f"{settings.API_V1_STR}/docs",
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# 5. CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Kurum içi ağda kısıtlanabilir
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 6. Rate Limiting Middleware
app.add_middleware(RateLimitMiddleware)

# 7. Global Hata Yakalayıcıları (Exception Handlers) Kaydet
register_exception_handlers(app)

# 8. Ana API Router'ı Bağla
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health", tags=["System"])
async def health_check():
    """
    Sistem sağlık kontrolü endpoint'i.
    """
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "version": "1.0.0"
    }
