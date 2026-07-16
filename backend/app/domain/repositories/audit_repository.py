# app/domain/repositories/audit_repository.py
from abc import ABC, abstractmethod
from typing import List, Optional
from app.domain.models.audit import AuditLog

class IAuditRepository(ABC):
    @abstractmethod
    def save(self, log: AuditLog) -> AuditLog:
        pass

    @abstractmethod
    def get_all(self, skip: int = 0, limit: int = 100) -> List[AuditLog]:
        pass

    @abstractmethod
    def get_by_user(self, user_id: str, skip: int = 0, limit: int = 100) -> List[AuditLog]:
        pass

    @abstractmethod
    def get_by_action(self, action: str, skip: int = 0, limit: int = 100) -> List[AuditLog]:
        pass
