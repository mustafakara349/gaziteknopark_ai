# app/application/interfaces/auth_provider.py
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

class IAuthProvider(ABC):
    @abstractmethod
    def authenticate(self, username: str, password: str) -> Optional[Dict[str, Any]]:
        """
        Kullanıcı adı ve parolasını dış dizin servisi (LDAP/Active Directory vb.)
        veya yerel veritabanı üzerinden doğrular.
        """
        pass
