# app/domain/repositories/document_repository.py
from abc import ABC, abstractmethod
from typing import List, Optional
from app.domain.models.document import Document, DocumentStatus

class IDocumentRepository(ABC):
    @abstractmethod
    def get_by_id(self, doc_id: str) -> Optional[Document]:
        pass

    @abstractmethod
    def get_by_checksum(self, checksum: str) -> Optional[Document]:
        pass

    @abstractmethod
    def get_by_collection(self, collection_id: str, skip: int = 0, limit: int = 100) -> List[Document]:
        pass

    @abstractmethod
    def get_all(self, skip: int = 0, limit: int = 100) -> List[Document]:
        pass

    @abstractmethod
    def save(self, document: Document) -> Document:
        pass

    @abstractmethod
    def delete(self, doc_id: str) -> bool:
        pass

    @abstractmethod
    def update_status(self, doc_id: str, status: DocumentStatus, error_message: Optional[str] = None) -> bool:
        pass
