# app/presentation/middleware/exception_handler.py
import logging
from fastapi import Request, FastAPI
from fastapi.responses import JSONResponse
from app.domain.exceptions.base import DomainException

logger = logging.getLogger("app.presentation.middleware.exception")

def register_exception_handlers(app: FastAPI):
    
    @app.exception_handler(DomainException)
    async def domain_exception_handler(request: Request, exc: DomainException):
        """
        Domain katmanından fırlatılan iş mantığı hatalarını yakalar.
        """
        logger.warning(f"Domain hatası yakalandı: {exc.message}")
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": exc.error_code,
                "message": exc.message,
                "details": exc.details or {}
            }
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        """
        Sistem genelinde yakalanamamış 500 hatalarını maskeler ve loglar.
        """
        logger.error("Yakalanamayan sistem hatası oluştu!", exc_info=True)
        return JSONResponse(
            status_code=500,
            content={
                "error": "INTERNAL_SERVER_ERROR",
                "message": "Sistemde beklenmeyen bir hata oluştu. Lütfen sistem yöneticinizle iletişime geçin."
            }
        )
