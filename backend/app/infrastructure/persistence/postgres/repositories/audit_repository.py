# app/infrastructure/persistence/postgres/repositories/audit_repository.py
import uuid
from typing import List, Optional
from sqlalchemy.orm import Session
from app.domain.models.audit import AuditLog
from app.domain.repositories.audit_repository import IAuditRepository
from app.infrastructure.persistence.postgres.models import AuditLogORM

class PostgresAuditRepository(IAuditRepository):
    def __init__(self, db: Session):
        self.db = db

    def _to_domain(self, orm: AuditLogORM) -> AuditLog:
        return AuditLog(
            id=str(orm.id),
            user_id=str(orm.user_id) if orm.user_id else None,
            action=orm.action,
            target_type=orm.target_type,
            target_id=orm.target_id,
            details=orm.details,
            ip_address=orm.ip_address,
            created_at=orm.created_at
        )

    def save(self, log: AuditLog) -> AuditLog:
        user_uuid = uuid.UUID(log.user_id) if log.user_id else None
        orm = AuditLogORM(
            id=uuid.UUID(log.id) if log.id else uuid.uuid4(),
            user_id=user_uuid,
            action=log.action,
            target_type=log.target_type,
            target_id=log.target_id,
            details=log.details,
            ip_address=log.ip_address,
            created_at=log.created_at
        )
        self.db.add(orm)
        self.db.commit()
        self.db.refresh(orm)
        return self._to_domain(orm)

    def get_all(self, skip: int = 0, limit: int = 100) -> List[AuditLog]:
        orms = self.db.query(AuditLogORM).order_by(AuditLogORM.created_at.desc()).offset(skip).limit(limit).all()
        return [self._to_domain(orm) for orm in orms]

    def get_by_user(self, user_id: str, skip: int = 0, limit: int = 100) -> List[AuditLog]:
        try:
            uid = uuid.UUID(user_id)
            orms = self.db.query(AuditLogORM).filter(AuditLogORM.user_id == uid).order_by(AuditLogORM.created_at.desc()).offset(skip).limit(limit).all()
            return [self._to_domain(orm) for orm in orms]
        except ValueError:
            return []

    def get_by_action(self, action: str, skip: int = 0, limit: int = 100) -> List[AuditLog]:
        orms = self.db.query(AuditLogORM).filter(AuditLogORM.action == action).order_by(AuditLogORM.created_at.desc()).offset(skip).limit(limit).all()
        return [self._to_domain(orm) for orm in orms]
