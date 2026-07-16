# app/infrastructure/persistence/postgres/repositories/document_repository.py
import uuid
from typing import List, Optional
from sqlalchemy.orm import Session
from app.domain.models.document import Document, DocumentStatus
from app.domain.repositories.document_repository import IDocumentRepository
from app.infrastructure.persistence.postgres.models import DocumentORM

class PostgresDocumentRepository(IDocumentRepository):
    def __init__(self, db: Session):
        self.db = db

    def _to_domain(self, orm: DocumentORM) -> Document:
        return Document(
            id=str(orm.id),
            title=orm.title,
            file_path=orm.file_path,
            file_size=orm.file_size,
            file_type=orm.file_type,
            checksum=orm.checksum,
            collection_id=str(orm.collection_id) if orm.collection_id else None,
            status=orm.status,
            version=orm.version,
            metadata=orm.metadata_json,
            error_message=orm.error_message,
            created_at=orm.created_at,
            updated_at=orm.updated_at,
            created_by=str(orm.created_by) if orm.created_by else None
        )

    def get_by_id(self, doc_id: str) -> Optional[Document]:
        try:
            uid = uuid.UUID(doc_id)
            orm = self.db.query(DocumentORM).filter(DocumentORM.id == uid).first()
            return self._to_domain(orm) if orm else None
        except ValueError:
            return None

    def get_by_checksum(self, checksum: str) -> Optional[Document]:
        orm = self.db.query(DocumentORM).filter(DocumentORM.checksum == checksum).first()
        return self._to_domain(orm) if orm else None

    def get_by_collection(self, collection_id: str, skip: int = 0, limit: int = 100) -> List[Document]:
        try:
            col_id = uuid.UUID(collection_id)
            orms = self.db.query(DocumentORM).filter(DocumentORM.collection_id == col_id).offset(skip).limit(limit).all()
            return [self._to_domain(orm) for orm in orms]
        except ValueError:
            return []

    def get_all(self, skip: int = 0, limit: int = 100) -> List[Document]:
        orms = self.db.query(DocumentORM).offset(skip).limit(limit).all()
        return [self._to_domain(orm) for orm in orms]

    def save(self, document: Document) -> Document:
        orm = None
        if document.id:
            try:
                uid = uuid.UUID(document.id)
                orm = self.db.query(DocumentORM).filter(DocumentORM.id == uid).first()
            except ValueError:
                pass
                
        col_uuid = uuid.UUID(document.collection_id) if document.collection_id else None
        creator_uuid = uuid.UUID(document.created_by) if document.created_by else None
        
        if orm:
            # Güncelle
            orm.title = document.title
            orm.file_path = document.file_path
            orm.file_size = document.file_size
            orm.file_type = document.file_type
            orm.checksum = document.checksum
            orm.collection_id = col_uuid
            orm.status = document.status
            orm.version = document.version
            orm.metadata_json = document.metadata
            orm.error_message = document.error_message
            orm.updated_at = document.updated_at
        else:
            # Yeni Ekle
            orm = DocumentORM(
                id=uuid.UUID(document.id) if document.id else uuid.uuid4(),
                title=document.title,
                file_path=document.file_path,
                file_size=document.file_size,
                file_type=document.file_type,
                checksum=document.checksum,
                collection_id=col_uuid,
                status=document.status,
                version=document.version,
                metadata_json=document.metadata,
                error_message=document.error_message,
                created_at=document.created_at,
                updated_at=document.updated_at,
                created_by=creator_uuid
            )
            self.db.add(orm)
            
        self.db.commit()
        self.db.refresh(orm)
        return self._to_domain(orm)

    def delete(self, doc_id: str) -> bool:
        try:
            uid = uuid.UUID(doc_id)
            orm = self.db.query(DocumentORM).filter(DocumentORM.id == uid).first()
            if orm:
                self.db.delete(orm)
                self.db.commit()
                return True
            return False
        except ValueError:
            return False

    def update_status(self, doc_id: str, status: DocumentStatus, error_message: Optional[str] = None) -> bool:
        try:
            uid = uuid.UUID(doc_id)
            orm = self.db.query(DocumentORM).filter(DocumentORM.id == uid).first()
            if orm:
                orm.status = status
                orm.error_message = error_message
                orm.updated_at = uuid.datetime.utcnow() if hasattr(uuid, 'datetime') else None # let's import and use datetime instead
                from datetime import datetime
                orm.updated_at = datetime.utcnow()
                self.db.commit()
                return True
            return False
        except ValueError:
            return False
