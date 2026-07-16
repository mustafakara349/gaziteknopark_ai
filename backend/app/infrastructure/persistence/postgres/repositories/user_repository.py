# app/infrastructure/persistence/postgres/repositories/user_repository.py
import uuid
from typing import List, Optional
from sqlalchemy.orm import Session
from app.domain.models.user import User
from app.domain.repositories.user_repository import IUserRepository
from app.infrastructure.persistence.postgres.models import UserORM

class PostgresUserRepository(IUserRepository):
    def __init__(self, db: Session):
        self.db = db

    def _to_domain(self, orm: UserORM) -> User:
        return User(
            id=str(orm.id),
            email=orm.email,
            password_hash=orm.password_hash,
            full_name=orm.full_name,
            role=orm.role,
            is_active=orm.is_active,
            created_at=orm.created_at,
            updated_at=orm.updated_at
        )

    def get_by_id(self, user_id: str) -> Optional[User]:
        try:
            uid = uuid.UUID(user_id)
            orm = self.db.query(UserORM).filter(UserORM.id == uid).first()
            return self._to_domain(orm) if orm else None
        except ValueError:
            return None

    def get_by_email(self, email: str) -> Optional[User]:
        orm = self.db.query(UserORM).filter(UserORM.email == email).first()
        return self._to_domain(orm) if orm else None

    def get_all(self, skip: int = 0, limit: int = 100) -> List[User]:
        orms = self.db.query(UserORM).offset(skip).limit(limit).all()
        return [self._to_domain(orm) for orm in orms]

    def save(self, user: User) -> User:
        orm = None
        if user.id:
            try:
                uid = uuid.UUID(user.id)
                orm = self.db.query(UserORM).filter(UserORM.id == uid).first()
            except ValueError:
                pass
                
        if orm:
            # Güncelle
            orm.email = user.email
            orm.password_hash = user.password_hash
            orm.full_name = user.full_name
            orm.role = user.role
            orm.is_active = user.is_active
            orm.updated_at = user.updated_at
        else:
            # Yeni Ekle
            orm = UserORM(
                id=uuid.UUID(user.id) if user.id else uuid.uuid4(),
                email=user.email,
                password_hash=user.password_hash,
                full_name=user.full_name,
                role=user.role,
                is_active=user.is_active,
                created_at=user.created_at,
                updated_at=user.updated_at
            )
            self.db.add(orm)
            
        self.db.commit()
        self.db.refresh(orm)
        return self._to_domain(orm)

    def delete(self, user_id: str) -> bool:
        try:
            uid = uuid.UUID(user_id)
            orm = self.db.query(UserORM).filter(UserORM.id == uid).first()
            if orm:
                self.db.delete(orm)
                self.db.commit()
                return True
            return False
        except ValueError:
            return False
