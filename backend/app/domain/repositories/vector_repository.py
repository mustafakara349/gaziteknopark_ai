# app/domain/repositories/vector_repository.py
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

class IVectorStoreRepository(ABC):
    @abstractmethod
    def search_vectors(
        self,
        query_vector: List[float],
        limit: int = 4,
        collection_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Vektör benzerlik araması gerçekleştirir ve ilişkili payload ve skorları döner.
        """
        pass

    @abstractmethod
    def insert_vectors(
        self,
        vectors: List[List[float]],
        payloads: List[Dict[str, Any]],
        ids: Optional[List[str]] = None
    ) -> bool:
        """
        Vektörleri ve ilişkili payload verilerini vektör veritabanına ekler.
        """
        pass

    @abstractmethod
    def delete_vectors_by_doc_id(self, document_id: str) -> bool:
        """
        İlgili belge ID'sine ait tüm vektörleri temizler.
        """
        pass
