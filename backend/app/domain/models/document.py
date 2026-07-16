# app/domain/models/document.py
from datetime import datetime
from typing import Optional, Dict, Any
from enum import Enum

class DocumentStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class Document:
    def __init__(
        self,
        id: str,
        title: str,
        file_path: str,
        file_size: int,
        file_type: str,
        checksum: str,
        collection_id: Optional[str] = None,
        status: DocumentStatus = DocumentStatus.PENDING,
        version: int = 1,
        metadata: Optional[Dict[str, Any]] = None,
        error_message: Optional[str] = None,
        created_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None,
        created_by: Optional[str] = None
    ):
        self.id = id
        self.title = title
        self.file_path = file_path
        self.file_size = file_size
        self.file_type = file_type
        self.checksum = checksum
        self.collection_id = collection_id
        self.status = status
        self.version = version
        self.metadata = metadata or {}
        self.error_message = error_message
        self.created_at = created_at or datetime.utcnow()
        self.updated_at = updated_at or datetime.utcnow()
        self.created_by = created_by

    def mark_as_processing(self):
        self.status = DocumentStatus.PROCESSING
        self.error_message = None
        self.updated_at = datetime.utcnow()

    def mark_as_completed(self):
        self.status = DocumentStatus.COMPLETED
        self.error_message = None
        self.updated_at = datetime.utcnow()

    def mark_as_failed(self, error: str):
        self.status = DocumentStatus.FAILED
        self.error_message = error
        self.updated_at = datetime.utcnow()

    def increment_version(self):
        self.version += 1
        self.updated_at = datetime.utcnow()
