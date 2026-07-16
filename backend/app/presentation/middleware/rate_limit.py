# app/presentation/middleware/rate_limit.py
import logging
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from app.presentation.api.dependencies import get_redis_cache

logger = logging.getLogger("app.presentation.middleware.rate_limit")

class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # API yollarını filtrele
        if request.url.path.startswith("/api/v1/chat/sessions") and request.method == "POST":
            # İstek atan istemci IP adresini al
            client_ip = request.client.host if request.client else "127.0.0.1"
            
            # Redis cache servisini al
            redis_cache = get_redis_cache()
            
            # Hız sınırı: Dakikada en fazla 20 istek (sliding window)
            limit = 20
            window = 60
            key = f"rate_limit:{client_ip}"
            
            is_allowed = redis_cache.check_rate_limit(key, limit, window)
            
            if not is_allowed:
                logger.warning(f"Rate limit aşıldı! IP: {client_ip}")
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Çok fazla istek gönderildi. Lütfen bir süre bekleyin."
                )
                
        response = await call_next(request)
        return response
