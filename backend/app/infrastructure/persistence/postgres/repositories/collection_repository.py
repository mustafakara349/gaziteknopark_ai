# app/infrastructure/persistence/postgres/repositories/collection_repository.py
import uuid
from typing import List, Optional
from sqlalchemy.orm import Session
from app.domain.models.collection import Collection
from app.domain.repositories.collection_repository import ICollectionRepository
from app.infrastructure.persistence.postgres.models import CollectionORM

class PostgresCollectionRepository(ICollectionRepository):
    def __init__(self, db: Session):
        self.db = db

    def _to_domain(self, orm: CollectionORM) -> Collection:
        return Collection(
            id=str(orm.id),
            name=orm.name,
            description=orm.description,
            created_at=orm.created_at,
            created_by=str(orm.created_by) if orm.created_by else None
        )

    def get_by_id(self, col_id: str) -> Optional[Collection]:
        try:
            uid = uuid.UUID(col_id)
            orm = self.db.query(CollectionORM).filter(CollectionORM.id == uid).first()
            return self._to_domain(orm) if orm else None
        except ValueError:
            return None

    def get_by_name(self, name: str) -> Optional[Collection]:
        orm = self.db.query(CollectionORM).filter(CollectionORM.name == name).first()
        return self._to_domain(orm) if orm else None

    def get_all(self, skip: int = 0, limit: int = 100) -> List[Collection]:
        orms = self.db.query(CollectionORM).offset(skip).limit(limit).all()
        return [self._to_domain(orm) for orm in orms]

    def save(self, collection: Collection) -> Collection:
        orm = None
        if collection.id:
            try:
                uid = uuid.UUID(collection.id)
                orm = self.db.query(CollectionORM).filter(CollectionORM.id == uid).first()
            except ValueError:
                pass
                
        creator_uuid = uuid.UUID(collection.created_by) if collection.created_by else None
        
        if orm:
            orm.name = collection.name
            orm.description = collection.description
        else:
            orm = CollectionORM(
                id=uuid.UUID(collection.id) if collection.id else uuid.uuid4(),
                name=collection.name,
                description=collection.description,
                created_at=collection.created_at,
                created_by=creator_uuid
            )
            self.db.add(orm)
            
        self.db.commit()
        self.db.refresh(orm)
        return self._to_domain(orm)

    def delete(self, col_id: str) -> bool:
        try:
            uid = uuid.UUID(col_id)
            orm = self.db.query(CollectionORM).filter(CollectionORM.id == uid).first()
            if orm:
                self.db.delete(orm)
                self.db.commit()
                return True
            return False
        except ValueError:
            return False
