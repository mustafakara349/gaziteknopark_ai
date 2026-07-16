# app/infrastructure/auth/ldap_provider.py
import logging
from typing import Dict, Any, Optional
from app.core.config import settings
from app.application.interfaces.auth_provider import IAuthProvider
from app.domain.models.user import UserRole

logger = logging.getLogger("app.infrastructure.auth.ldap")

class LDAPAuthProvider(IAuthProvider):
    def __init__(self):
        self.enabled = settings.LDAP_ENABLED
        self.server_url = settings.LDAP_SERVER_URL
        self.base_dn = settings.LDAP_BASE_DN
        self.user_dn_pattern = settings.LDAP_USER_DN_PATTERN # e.g. "uid={username},ou=users,dc=gazi,dc=local"
        self.admin_group = settings.LDAP_ADMIN_GROUP

    def authenticate(self, username: str, password: str) -> Optional[Dict[str, Any]]:
        """
        Active Directory / LDAP sunucusuna bağlanarak kullanıcıyı doğrular.
        Eğer doğrulama başarılıysa kullanıcı profili bilgilerini döner.
        """
        if not self.enabled:
            logger.debug("LDAP kimlik doğrulama pasif durumda.")
            return None

        # ldap3 kütüphanesini dinamik olarak yükle
        try:
            from ldap3 import Server, Connection, SIMPLE, ALL
        except ImportError:
            logger.error("LDAP aktif edildi fakat 'ldap3' kütüphanesi yüklü değil! 'pip install ldap3' çalıştırılmalı.")
            return None

        try:
            server = Server(self.server_url, get_info=ALL)
            user_dn = self.user_dn_pattern.format(username=username)
            
            # Bağlantı ve doğrulama denemesi (Bind)
            conn = Connection(server, user=user_dn, password=password, authentication=SIMPLE)
            
            if not conn.bind():
                logger.warning(f"LDAP kimlik doğrulama başarısız. Kullanıcı: {username}")
                return None
                
            logger.info(f"LDAP kimlik doğrulama başarılı. Kullanıcı: {username}")
            
            # Kullanıcı bilgilerini (isim, e-posta, gruplar) ara
            # Basitlik için e-posta adresi ve tam ad attribute araması
            email = f"{username}@gaziteknopark.com.tr" # Varsayılan fallback
            full_name = username
            role = UserRole.VIEWER
            
            # Kullanıcı arama (Search)
            conn.search(
                search_base=self.base_dn,
                search_filter=f"(uid={username})",
                attributes=["mail", "cn", "memberOf"]
            )
            
            if conn.entries:
                entry = conn.entries[0]
                if hasattr(entry, "mail") and entry.mail:
                    email = entry.mail.value
                if hasattr(entry, "cn") and entry.cn:
                    full_name = entry.cn.value
                
                # Grup bazlı yetkilendirme kontrolü (RBAC)
                if hasattr(entry, "memberOf") and entry.memberOf:
                    groups = entry.memberOf.values
                    # Eğer admin grubuna üye ise
                    if any(self.admin_group in g for g in groups):
                        role = UserRole.ADMIN
                    # Editor grubu kontrolü de yapılabilir
            
            conn.unbind()
            
            return {
                "username": username,
                "email": email,
                "full_name": full_name,
                "role": role
            }
            
        except Exception as e:
            logger.error(f"LDAP kimlik doğrulama işlemi sırasında beklenmedik hata: {str(e)}")
            return None
