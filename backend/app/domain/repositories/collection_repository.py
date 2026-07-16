# app/domain/repositories/collection_repository.py
from abc import ABC, abstractmethod
from typing import List, Optional
from app.domain.models.collection import Collection

class ICollectionRepository(ABC):
    @abstractmethod
    def get_by_id(self, col_id: str) -> Optional[Collection]:
        pass

    @abstractmethod
    def get_by_name(self, name: str) -> Optional[Collection]:
        pass

    @abstractmethod
    def get_all(self, skip: int = 0, limit: int = 100) -> List[Collection]:
        pass

    @abstractmethod
    def save(self, collection: Collection) -> Collection:
        pass

    @abstractmethod
    def delete(self, col_id: str) -> bool:
        pass
