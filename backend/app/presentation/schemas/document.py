# app/presentation/schemas/document.py
from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Dict, Any
from app.domain.models.document import DocumentStatus

class CollectionCreate(BaseModel):
    name: str
    description: Optional[str] = None

class CollectionResponse(BaseModel):
    id: str
    name: str
    description: Optional[str]
    created_at: datetime
    doc_count: int = 0

    class Config:
        from_attributes = True

class DocumentResponse(BaseModel):
    id: str
    title: str
    file_size: int
    file_type: str
    collection_id: Optional[str]
    status: DocumentStatus
    version: int
    metadata: Dict[str, Any]
    error_message: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class JobStatusResponse(BaseModel):
    job_id: str
    status: str # "PENDING", "STARTED", "SUCCESS", "FAILURE"
    document_id: Optional[str] = None
