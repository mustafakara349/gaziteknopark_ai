# app/domain/models/audit.py
from datetime import datetime
from typing import Optional

class AuditLog:
    def __init__(
        self,
        id: str,
        user_id: Optional[str],
        action: str,            # "document_upload", "document_delete", "user_login", "settings_update"
        target_type: str,       # "document", "user", "collection", "system"
        target_id: Optional[str],
        details: str,           # İşlem detayı (JSON formatında)
        ip_address: str,
        created_at: Optional[datetime] = None
    ):
        self.id = id
        self.user_id = user_id
        self.action = action
        self.target_type = target_type
        self.target_id = target_id
        self.details = details
        self.ip_address = ip_address
        self.created_at = created_at or datetime.utcnow()
