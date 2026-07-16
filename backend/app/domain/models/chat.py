# app/domain/models/chat.py
from datetime import datetime
from typing import List, Dict, Any, Optional

class ChatMessage:
    def __init__(
        self,
        id: str,
        session_id: str,
        role: str,              # "user" veya "assistant"
        content: str,
        sources: Optional[List[Dict[str, Any]]] = None, # Kullanılan kaynak chunk listesi ve skorları
        created_at: Optional[datetime] = None
    ):
        self.id = id
        self.session_id = session_id
        self.role = role
        self.content = content
        self.sources = sources or []
        self.created_at = created_at or datetime.utcnow()

class ChatSession:
    def __init__(
        self,
        id: str,
        user_id: str,
        title: str,
        collection_id: Optional[str] = None, # Sorgu yapılan koleksiyon filtresi
        is_favorite: bool = False,
        created_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None
    ):
        self.id = id
        self.user_id = user_id
        self.title = title
        self.collection_id = collection_id
        self.is_favorite = is_favorite
        self.created_at = created_at or datetime.utcnow()
        self.updated_at = updated_at or datetime.utcnow()

    def toggle_favorite(self) -> bool:
        self.is_favorite = not self.is_favorite
        self.updated_at = datetime.utcnow()
        return self.is_favorite

    def update_title(self, new_title: str):
        self.title = new_title
        self.updated_at = datetime.utcnow()
