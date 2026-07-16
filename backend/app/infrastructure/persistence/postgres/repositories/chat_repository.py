# app/infrastructure/persistence/postgres/repositories/chat_repository.py
import uuid
from typing import List, Optional
from sqlalchemy.orm import Session
from app.domain.models.chat import ChatSession, ChatMessage
from app.domain.repositories.chat_repository import IChatRepository
from app.infrastructure.persistence.postgres.models import ChatSessionORM, ChatMessageORM

class PostgresChatRepository(IChatRepository):
    def __init__(self, db: Session):
        self.db = db

    def _session_to_domain(self, orm: ChatSessionORM) -> ChatSession:
        return ChatSession(
            id=str(orm.id),
            user_id=str(orm.user_id),
            title=orm.title,
            collection_id=str(orm.collection_id) if orm.collection_id else None,
            is_favorite=orm.is_favorite,
            created_at=orm.created_at,
            updated_at=orm.updated_at
        )

    def _message_to_domain(self, orm: ChatMessageORM) -> ChatMessage:
        return ChatMessage(
            id=str(orm.id),
            session_id=str(orm.session_id),
            role=orm.role,
            content=orm.content,
            sources=orm.sources,
            created_at=orm.created_at
        )

    def get_session_by_id(self, session_id: str) -> Optional[ChatSession]:
        try:
            uid = uuid.UUID(session_id)
            orm = self.db.query(ChatSessionORM).filter(ChatSessionORM.id == uid).first()
            return self._session_to_domain(orm) if orm else None
        except ValueError:
            return None

    def get_sessions_by_user(self, user_id: str, skip: int = 0, limit: int = 100) -> List[ChatSession]:
        try:
            uid = uuid.UUID(user_id)
            orms = self.db.query(ChatSessionORM).filter(ChatSessionORM.user_id == uid).order_by(ChatSessionORM.updated_at.desc()).offset(skip).limit(limit).all()
            return [self._session_to_domain(orm) for orm in orms]
        except ValueError:
            return []

    def save_session(self, session: ChatSession) -> ChatSession:
        orm = None
        if session.id:
            try:
                uid = uuid.UUID(session.id)
                orm = self.db.query(ChatSessionORM).filter(ChatSessionORM.id == uid).first()
            except ValueError:
                pass
                
        user_uuid = uuid.UUID(session.user_id)
        col_uuid = uuid.UUID(session.collection_id) if session.collection_id else None
        
        if orm:
            orm.title = session.title
            orm.collection_id = col_uuid
            orm.is_favorite = session.is_favorite
            orm.updated_at = session.updated_at
        else:
            orm = ChatSessionORM(
                id=uuid.UUID(session.id) if session.id else uuid.uuid4(),
                user_id=user_uuid,
                title=session.title,
                collection_id=col_uuid,
                is_favorite=session.is_favorite,
                created_at=session.created_at,
                updated_at=session.updated_at
            )
            self.db.add(orm)
            
        self.db.commit()
        self.db.refresh(orm)
        return self._session_to_domain(orm)

    def delete_session(self, session_id: str) -> bool:
        try:
            uid = uuid.UUID(session_id)
            orm = self.db.query(ChatSessionORM).filter(ChatSessionORM.id == uid).first()
            if orm:
                self.db.delete(orm)
                self.db.commit()
                return True
            return False
        except ValueError:
            return False

    def get_messages_by_session(self, session_id: str, limit: int = 50) -> List[ChatMessage]:
        try:
            uid = uuid.UUID(session_id)
            orms = self.db.query(ChatMessageORM).filter(ChatMessageORM.session_id == uid).order_by(ChatMessageORM.created_at.asc()).limit(limit).all()
            return [self._message_to_domain(orm) for orm in orms]
        except ValueError:
            return []

    def save_message(self, message: ChatMessage) -> ChatMessage:
        session_uuid = uuid.UUID(message.session_id)
        orm = ChatMessageORM(
            id=uuid.UUID(message.id) if message.id else uuid.uuid4(),
            session_id=session_uuid,
            role=message.role,
            content=message.content,
            sources=message.sources,
            created_at=message.created_at
        )
        self.db.add(orm)
        self.db.commit()
        self.db.refresh(orm)
        
        # Sohbet oturumunun güncellenme tarihini (updated_at) güncelle
        session_orm = self.db.query(ChatSessionORM).filter(ChatSessionORM.id == session_uuid).first()
        if session_orm:
            from datetime import datetime
            session_orm.updated_at = datetime.utcnow()
            self.db.commit()
            
        return self._message_to_domain(orm)
