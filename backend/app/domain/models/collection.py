# app/domain/models/collection.py
from datetime import datetime
from typing import Optional

class Collection:
    def __init__(
        self,
        id: str,
        name: str,
        description: Optional[str] = None,
        created_at: Optional[datetime] = None,
        created_by: Optional[str] = None
    ):
        self.id = id
        self.name = name
        self.description = description
        self.created_at = created_at or datetime.utcnow()
        self.created_by = created_by
