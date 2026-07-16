# app/presentation/api/v1/endpoints/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.config import settings
from app.core.security import verify_password, create_access_token
from app.domain.models.user import User, UserRole
from app.domain.repositories.user_repository import IUserRepository
from app.domain.repositories.audit_repository import IAuditRepository
from app.domain.models.audit import AuditLog
from app.presentation.schemas.auth import LoginRequest, TokenResponse
from app.presentation.api.dependencies import get_user_repository, get_audit_repository
from app.infrastructure.auth.ldap_provider import LDAPAuthProvider

router = APIRouter()

# LDAP Sağlayıcısını başlat
ldap_provider = LDAPAuthProvider()

@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    user_repo: IUserRepository = Depends(get_user_repository),
    audit_repo: IAuditRepository = Depends(get_audit_repository)
):
    user_data = None
    
    # 1. LDAP Aktif ise Önce Oradan Dene
    if settings.LDAP_ENABLED:
        user_data = ldap_provider.authenticate(payload.email, payload.password)
        
    # 2. LDAP Başarılı ise Yerel DB ile Senkronize Et
    if user_data:
        user = user_repo.get_by_email(user_data["email"])
        if not user:
            # Yeni kullanıcı oluştur
            user = User(
                id="",
                email=user_data["email"],
                password_hash="LDAP_EXTERNAL_AUTH", # Parola saklanmaz
                full_name=user_data["full_name"],
                role=user_data["role"]
            )
            user = user_repo.save(user)
        else:
            # Rolü veya ismini güncelle
            user.full_name = user_data["full_name"]
            user.role = user_data["role"]
            user = user_repo.save(user)
    else:
        # 3. Yerel Veritabanından Kullanıcıyı Sorgula
        user = user_repo.get_by_email(payload.email)
        if not user or user.password_hash == "LDAP_EXTERNAL_AUTH":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Hatalı e-posta adresi veya şifre."
            )
            
        # Şifre kontrolü
        if not verify_password(payload.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Hatalı e-posta adresi veya şifre."
            )

    # 4. JWT Access Token Oluştur
    access_token = create_access_token(
        subject=user.id,
        email=user.email,
        role=user.role.value
    )
    
    # 5. Güvenlik Denetim Günlüğü (Audit Log) Yaz
    audit_log = AuditLog(
        id="",
        user_id=user.id,
        action="user_login",
        target_type="user",
        target_id=user.id,
        details=f"Başarılı kullanıcı girişi: {user.email}",
        ip_address="127.0.0.1" # FastAPI IP middleware'den alınacak
    )
    audit_repo.save(audit_log)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "role": user.role,
        "user_id": user.id,
        "full_name": user.full_name
    }
