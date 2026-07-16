# app/presentation/api/v1/endpoints/documents.py
import os
import uuid
import hashlib
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.domain.models.user import User, UserRole
from app.domain.models.document import Document, DocumentStatus
from app.domain.models.collection import Collection
from app.domain.models.audit import AuditLog
from app.domain.repositories.document_repository import IDocumentRepository
from app.domain.repositories.collection_repository import ICollectionRepository
from app.domain.repositories.audit_repository import IAuditRepository
from app.domain.repositories.vector_repository import IVectorStoreRepository

from app.presentation.api.dependencies import (
    RoleChecker, get_current_user, get_document_repository, 
    get_collection_repository, get_audit_repository, get_vector_repo,
    get_upload_document_use_case
)
from app.presentation.schemas.document import (
    DocumentResponse, CollectionResponse, CollectionCreate, JobStatusResponse
)
from app.application.use_cases.document_use_cases import UploadDocumentUseCase

router = APIRouter()

# Yetki filtreleri
require_editor_or_admin = RoleChecker([UserRole.ADMIN, UserRole.EDITOR])
require_admin = RoleChecker([UserRole.ADMIN])

@router.post("/upload", response_model=JobStatusResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    file: UploadFile = File(...),
    collection_id: Optional[str] = Form(None),
    current_user: User = Depends(require_editor_or_admin),
    use_case: UploadDocumentUseCase = Depends(get_upload_document_use_case)
):
    file_bytes = await file.read()
    return use_case.execute(file_bytes, file.filename, current_user.id, collection_id)

@router.get("", response_model=List[DocumentResponse])
async def list_documents(
    skip: int = 0,
    limit: int = 100,
    collection_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    doc_repo: IDocumentRepository = Depends(get_document_repository)
):
    if collection_id:
        return doc_repo.get_by_collection(collection_id, skip=skip, limit=limit)
    return doc_repo.get_all(skip=skip, limit=limit)

@router.delete("/{document_id}", status_code=status.HTTP_200_OK)
async def delete_document(
    document_id: str,
    current_user: User = Depends(require_admin),
    doc_repo: IDocumentRepository = Depends(get_document_repository),
    vector_repo: IVectorStoreRepository = Depends(get_vector_repo),
    audit_repo: IAuditRepository = Depends(get_audit_repository)
):
    doc = doc_repo.get_by_id(document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Silinmek istenen belge bulunamadı."
        )
        
    # 1. Fiziksel Dosyayı Sil
    if os.path.exists(doc.file_path):
        try:
            os.remove(doc.file_path)
        except Exception as e:
            pass # Hata durumunda da veritabanından temizlemeye devam et
            
    # 2. Qdrant'tan İlgili Vektörleri (Chunkları) Sil
    vector_repo.delete_vectors_by_doc_id(document_id)
    
    # 3. PostgreSQL'den Belgeyi Sil
    doc_repo.delete(document_id)
    
    # 4. Audit Log
    audit_log = AuditLog(
        id="",
        user_id=current_user.id,
        action="document_delete",
        target_type="document",
        target_id=document_id,
        details=f"Belge silindi: {doc.title}",
        ip_address="127.0.0.1"
    )
    audit_repo.save(audit_log)
    
    return {"status": "deleted"}

@router.get("/status/{job_id}", response_model=JobStatusResponse)
async def get_job_status(
    job_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Celery asenkron görevinin durumunu sorgular.
    """
    result = celery.AsyncResult(job_id)
    status_info = {
        "job_id": job_id,
        "status": result.status
    }
    
    if result.status == "SUCCESS" and result.result:
        status_info["document_id"] = result.result.get("document_id")
        
    return status_info

# KOLEKSİYON ENDPOINT'LERİ

@router.post("/collections", response_model=CollectionResponse, status_code=status.HTTP_201_CREATED)
async def create_collection(
    payload: CollectionCreate,
    current_user: User = Depends(require_admin),
    col_repo: ICollectionRepository = Depends(get_collection_repository),
    audit_repo: IAuditRepository = Depends(get_audit_repository)
):
    existing = col_repo.get_by_name(payload.name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bu isimde bir koleksiyon zaten mevcut."
        )
        
    col = Collection(
        id="",
        name=payload.name,
        description=payload.description,
        created_by=current_user.id
    )
    col = col_repo.save(col)
    
    audit_log = AuditLog(
        id="",
        user_id=current_user.id,
        action="collection_create",
        target_type="collection",
        target_id=col.id,
        details=f"Koleksiyon oluşturuldu: {col.name}",
        ip_address="127.0.0.1"
    )
    audit_repo.save(audit_log)
    
    return col

@router.get("/collections", response_model=List[CollectionResponse])
async def list_collections(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    col_repo: ICollectionRepository = Depends(get_collection_repository)
):
    # doc_count alanı SQL Query ile orm.py içinde de hesaplanabilir
    # Basitlik için get_all üzerinden listelenir
    cols = col_repo.get_all(skip=skip, limit=limit)
    return cols
