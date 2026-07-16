# app/infrastructure/services/celery_tasks.py
import logging
from celery import Celery
from app.core.config import settings

logger = logging.getLogger("app.infrastructure.celery")

# Celery Uygulaması Yapılandırması
celery = Celery(
    "gazi_tasks",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="Europe/Istanbul",
    enable_utc=True,
    task_track_started=True
)

@celery.task(bind=True, max_retries=3, default_retry_delay=10)
def process_document_task(self, document_id: str):
    """
    Belge işleme, metin ayrıştırma, parçalama ve embedding asenkron Celery görevi.
    """
    logger.info(f"Asenkron belge işleme görevi başladı. Belge ID: {document_id}")
    
    # Döngüsel bağımlılıkları önlemek için importlar burada yapılır
    from app.infrastructure.persistence.postgres.database import SessionLocal
    from app.infrastructure.persistence.postgres.repositories.document_repository import PostgresDocumentRepository
    from app.infrastructure.persistence.qdrant.adapter import QdrantVectorRepository
    from app.application.services.document_processor import DocumentProcessor
    from app.domain.models.document import DocumentStatus
    from app.infrastructure.services.embedding_service import OllamaEmbeddingService

    db = SessionLocal()
    try:
        doc_repo = PostgresDocumentRepository(db)
        vector_repo = QdrantVectorRepository()
        embedding_service = OllamaEmbeddingService()
        
        # İşlemciyi (Processor) başlat
        processor = DocumentProcessor(
            doc_repo=doc_repo, 
            vector_repo=vector_repo,
            embedding_service=embedding_service
        )
        
        # Belgeyi işle
        processor.process(document_id)
        
        logger.info(f"Belge işleme görevi başarıyla tamamlandı. Belge ID: {document_id}")
        return {"status": "completed", "document_id": document_id}
        
    except Exception as exc:
        logger.error(f"Belge işlenirken beklenmedik hata! Hata: {str(exc)}")
        db = SessionLocal()
        # Durumu veritabanında FAILED olarak güncelle
        try:
            from app.infrastructure.persistence.postgres.repositories.document_repository import PostgresDocumentRepository
            PostgresDocumentRepository(db).update_status(document_id, DocumentStatus.FAILED, str(exc))
        except Exception as e:
            logger.error(f"Hata durumu veritabanına yazılamadı: {str(e)}")
        finally:
            db.close()
            
        # Görevi yeniden dene (retry)
        raise self.retry(exc=exc)
        
    finally:
        db.close()
