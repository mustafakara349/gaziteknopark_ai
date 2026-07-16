# app/application/use_cases/document_use_cases.py
import os
import uuid
import hashlib
from typing import Optional, Dict, Any
from fastapi import HTTPException, status
from app.core.config import settings
from app.domain.models.document import Document, DocumentStatus
from app.domain.models.audit import AuditLog
from app.domain.repositories.document_repository import IDocumentRepository
from app.domain.repositories.collection_repository import ICollectionRepository
from app.domain.repositories.audit_repository import IAuditRepository
from app.infrastructure.services.celery_tasks import process_document_task

class UploadDocumentUseCase:
    def __init__(
        self,
        doc_repo: IDocumentRepository,
        col_repo: ICollectionRepository,
        audit_repo: IAuditRepository
    ):
        self.doc_repo = doc_repo
        self.col_repo = col_repo
        self.audit_repo = audit_repo

    def execute(self, file_bytes: bytes, filename: str, user_id: str, collection_id: Optional[str] = None) -> Dict[str, Any]:
        # 1. Dosya Uzantısı Kontrolü
        ext = filename.split(".")[-1].lower()
        if ext not in settings.ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Geçersiz dosya tipi. İzin verilen uzantılar: {', '.join(settings.ALLOWED_EXTENSIONS)}"
            )
            
        # 2. Koleksiyon ID Geçerlilik Kontrolü
        if collection_id:
            collection = self.col_repo.get_by_id(collection_id)
            if not collection:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Belirtilen koleksiyon bulunamadı."
                )
                
        # 3. Dosya Boyutu Kontrolü (Max 50MB)
        file_size = len(file_bytes)
        if file_size > settings.MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Dosya boyutu sınırı aşıldı (Maksimum 50MB)."
            )
            
        # 4. SHA-256 Checksum Hesaplama
        checksum = hashlib.sha256(file_bytes).hexdigest()
        
        # Mükerrer belge kontrolü
        existing_doc = self.doc_repo.get_by_checksum(checksum)
        if existing_doc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Bu dosya zaten veritabanında mevcut: {existing_doc.title} (Versiyon: {existing_doc.version})"
            )
            
        # 5. Dosyayı Sunucu Diskine Kaydet
        file_uuid = str(uuid.uuid4())
        save_filename = f"{file_uuid}.{ext}"
        save_path = os.path.join(settings.UPLOAD_DIR, save_filename)
        
        try:
            with open(save_path, "wb") as f:
                f.write(file_bytes)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Dosya sunucuya yazılamadı: {str(e)}"
            )

        # 6. Belge Modelini PostgreSQL'e Ekle
        document = Document(
            id=file_uuid,
            title=filename,
            file_path=save_path,
            file_size=file_size,
            file_type=ext,
            checksum=checksum,
            collection_id=collection_id,
            status=DocumentStatus.PENDING,
            created_by=user_id
        )
        self.doc_repo.save(document)
        
        # 7. Asenkron Celery Görevi Tetikle
        task = process_document_task.delay(document.id)
        
        # 8. Audit Log Ekle
        audit_log = AuditLog(
            id="",
            user_id=user_id,
            action="document_upload",
            target_type="document",
            target_id=document.id,
            details=f"Belge yüklendi: {document.title}",
            ip_address="127.0.0.1"
        )
        self.audit_repo.save(audit_log)
        
        return {
            "job_id": task.id,
            "status": "PENDING",
            "document_id": document.id
        }
