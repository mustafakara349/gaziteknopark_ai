# app/presentation/schemas/chat.py
from pydantic import BaseModel
from datetime import datetime
from typing import List, Dict, Any, Optional

class ChatSessionCreate(BaseModel):
    title: str
    collection_id: Optional[str] = None

class ChatSessionRename(BaseModel):
    title: str

class ChatSessionResponse(BaseModel):
    id: str
    title: str
    collection_id: Optional[str]
    is_favorite: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class QueryRequest(BaseModel):
    query: str

class ChatMessageResponse(BaseModel):
    id: str
    role: str
    content: str
    sources: List[Dict[str, Any]]
    created_at: datetime

    class Config:
        from_attributes = True
