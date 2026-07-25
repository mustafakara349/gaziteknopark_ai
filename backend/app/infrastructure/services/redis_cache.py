# app/infrastructure/services/redis_cache.py
import time
import logging
import redis
from typing import Optional
from app.core.config import settings

logger = logging.getLogger("app.infrastructure.redis")

class RedisCacheService:
    def __init__(self):
        # Decode_responses=True ile verileri string olarak çekeriz
        self.client = redis.from_url(settings.REDIS_URL, decode_responses=True)

    def get(self, key: str) -> Optional[str]:
        try:
            return self.client.get(key)
        except Exception as e:
            logger.error(f"Redis get hatası: {str(e)}")
            return None

    def set(self, key: str, value: str, expire_seconds: Optional[int] = None) -> bool:
        try:
            if expire_seconds:
                self.client.set(key, value, ex=expire_seconds)
            else:
                self.client.set(key, value)
            return True
        except Exception as e:
            logger.error(f"Redis set hatası: {str(e)}")
            return False

    def delete(self, key: str) -> bool:
        try:
            self.client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Redis delete hatası: {str(e)}")
            return False

    def check_rate_limit(self, key: str, limit: int, window_seconds: int = 60) -> bool:
        """
        Sliding Window algoritmasıyla rate limit kontrolü yapar.
        Limit aşıldıysa False, aşılmadıysa True döner.
        """
        try:
            now = time.time()
            pipe = self.client.pipeline()
            
            # Eski zaman damgalarını temizle
            pipe.zremrangebyscore(key, 0, now - window_seconds)
            # Yeni zaman damgasını ekle
            pipe.zadd(key, {str(now): now})
            # Son zaman penceresindeki istek sayısını al
            pipe.zcard(key)
            # TTL (Expiry) güncelle
            pipe.expire(key, window_seconds)
            
            _, _, count, _ = pipe.execute()
            
            return count <= limit
        except Exception as e:
            logger.error(f"Redis rate limit hatası: {str(e)}")
            return True # Hata durumunda servisi kilitlememek için True dönüyoruz

    def acquire_lock(self, lock_name: str, expire_seconds: int = 30) -> bool:
        """
        Dağıtık kilit (Distributed Lock) edinir. Mükerrer işlemleri önlemek için kullanılır.
        """
        try:
            # nx=True ile kilit yoksa ekler
            return bool(self.client.set(lock_name, "locked", ex=expire_seconds, nx=True))
        except Exception as e:
            logger.error(f"Redis kilit edinme hatası: {str(e)}")
            return False

    def release_lock(self, lock_name: str) -> bool:
        """
        Kilidi serbest bırakır.
        """
        try:
            self.client.delete(lock_name)
            return True
        except Exception as e:
            logger.error(f"Redis kilit bırakma hatası: {str(e)}")
            return False

    def get_stats(self) -> dict:
        """
        Redis sunucu metriklerini ve önbellekteki anahtar sayısını döner.
        """
        try:
            dbsize = self.client.dbsize()
            memory_info = self.client.info("memory")
            used_memory_human = memory_info.get("used_memory_human", "N/A")
            return {
                "status": "connected",
                "total_keys": dbsize,
                "used_memory_human": used_memory_human
            }
        except Exception as e:
            logger.error(f"Redis get_stats hatası: {str(e)}")
            return {
                "status": "disconnected",
                "total_keys": 0,
                "used_memory_human": "N/A"
            }

    def flush_cache(self) -> bool:
        """
        Mevcut Redis veritabanındaki tüm önbellek anahtarlarını siler.
        """
        try:
            self.client.flushdb()
            logger.info("Redis önbelleği (flushdb) başarıyla sıfırlandı.")
            return True
        except Exception as e:
            logger.error(f"Redis flush_cache hatası: {str(e)}")
            return False

