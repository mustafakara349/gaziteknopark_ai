# app/presentation/api/dependencies.py
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from app.core.config import settings
from app.domain.models.user import User, UserRole
from app.domain.repositories.user_repository import IUserRepository
from app.domain.repositories.document_repository import IDocumentRepository
from app.domain.repositories.collection_repository import ICollectionRepository
from app.domain.repositories.chat_repository import IChatRepository
from app.domain.repositories.audit_repository import IAuditRepository
from app.domain.repositories.vector_repository import IVectorStoreRepository
from app.application.use_cases.chat_use_cases import QueryChatSessionUseCase
from app.application.use_cases.document_use_cases import UploadDocumentUseCase

from app.infrastructure.persistence.postgres.database import get_db
from app.infrastructure.persistence.postgres.repositories.user_repository import PostgresUserRepository
from app.infrastructure.persistence.postgres.repositories.document_repository import PostgresDocumentRepository
from app.infrastructure.persistence.postgres.repositories.collection_repository import PostgresCollectionRepository
from app.infrastructure.persistence.postgres.repositories.chat_repository import PostgresChatRepository
from app.infrastructure.persistence.postgres.repositories.audit_repository import PostgresAuditRepository
from app.infrastructure.persistence.qdrant.adapter import QdrantVectorRepository
from app.infrastructure.services.redis_cache import RedisCacheService
from app.infrastructure.services.reranker import BGEReranker
from app.infrastructure.services.llm_service import OllamaLLMService
from app.infrastructure.services.embedding_service import OllamaEmbeddingService
from app.application.interfaces.llm import ILLMService
from app.application.interfaces.embedding import IEmbeddingService

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")

# Singleton Servis Örnekleri
_redis_cache = RedisCacheService()
_reranker = BGEReranker()
_vector_repo = QdrantVectorRepository()
_llm_service = OllamaLLMService()
_embedding_service = OllamaEmbeddingService()

def get_redis_cache() -> RedisCacheService:
    return _redis_cache

def get_reranker() -> BGEReranker:
    return _reranker

def get_vector_repo() -> IVectorStoreRepository:
    return _vector_repo

def get_llm_service() -> ILLMService:
    return _llm_service

def get_embedding_service() -> IEmbeddingService:
    return _embedding_service

# Repository Bağımlılık Enjeksiyonları
def get_user_repository(db: Session = Depends(get_db)) -> IUserRepository:
    return PostgresUserRepository(db)

def get_document_repository(db: Session = Depends(get_db)) -> IDocumentRepository:
    return PostgresDocumentRepository(db)

def get_collection_repository(db: Session = Depends(get_db)) -> ICollectionRepository:
    return PostgresCollectionRepository(db)

def get_chat_repository(db: Session = Depends(get_db)) -> IChatRepository:
    return PostgresChatRepository(db)

def get_audit_repository(db: Session = Depends(get_db)) -> IAuditRepository:
    return PostgresAuditRepository(db)

# Kimlik Doğrulama Bağımlılıkları (Authentication)
def get_current_user(
    token: str = Depends(oauth2_scheme),
    user_repo: IUserRepository = Depends(get_user_repository)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Geçersiz kimlik doğrulama bilgileri veya oturum süresi dolmuş.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    user = user_repo.get_by_id(user_id)
    if user is None:
        raise credentials_exception
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kullanıcı hesabı dondurulmuş."
        )
        
    return user

# Rol Bazlı Yetkilendirme Kontrol Sınıfı (Authorization Guard)
class RoleChecker:
    def __init__(self, allowed_roles: list[UserRole]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bu işlemi gerçekleştirmek için yetkiniz bulunmamaktadır."
            )
        return current_user

# Use Case Bağımlılık Enjeksiyonları
def get_query_chat_session_use_case(
    chat_repo: IChatRepository = Depends(get_chat_repository),
    vector_repo: IVectorStoreRepository = Depends(get_vector_repo),
    reranker: BGEReranker = Depends(get_reranker),
    redis_cache: RedisCacheService = Depends(get_redis_cache),
    llm_service: ILLMService = Depends(get_llm_service),
    embedding_service: IEmbeddingService = Depends(get_embedding_service)
) -> QueryChatSessionUseCase:
    return QueryChatSessionUseCase(
        chat_repo=chat_repo,
        vector_repo=vector_repo,
        reranker=reranker,
        redis_cache=redis_cache,
        llm_service=llm_service,
        embedding_service=embedding_service
    )

def get_upload_document_use_case(
    doc_repo: IDocumentRepository = Depends(get_document_repository),
    col_repo: ICollectionRepository = Depends(get_collection_repository),
    audit_repo: IAuditRepository = Depends(get_audit_repository)
) -> UploadDocumentUseCase:
    return UploadDocumentUseCase(
        doc_repo=doc_repo,
        col_repo=col_repo,
        audit_repo=audit_repo
    )
