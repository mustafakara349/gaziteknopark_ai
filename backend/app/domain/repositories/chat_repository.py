# app/domain/repositories/chat_repository.py
from abc import ABC, abstractmethod
from typing import List, Optional
from app.domain.models.chat import ChatSession, ChatMessage

class IChatRepository(ABC):
    @abstractmethod
    def get_session_by_id(self, session_id: str) -> Optional[ChatSession]:
        pass

    @abstractmethod
    def get_sessions_by_user(self, user_id: str, skip: int = 0, limit: int = 100) -> List[ChatSession]:
        pass

    @abstractmethod
    def save_session(self, session: ChatSession) -> ChatSession:
        pass

    @abstractmethod
    def delete_session(self, session_id: str) -> bool:
        pass

    @abstractmethod
    def get_messages_by_session(self, session_id: str, limit: int = 50) -> List[ChatMessage]:
        pass

    @abstractmethod
    def save_message(self, message: ChatMessage) -> ChatMessage:
        pass
