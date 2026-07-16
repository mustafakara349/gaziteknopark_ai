# app/presentation/api/v1/router.py
from fastapi import APIRouter
from app.presentation.api.v1.endpoints import auth, documents, chat, system

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Auth"])
api_router.include_router(documents.router, prefix="/documents", tags=["Documents"])
api_router.include_router(chat.router, prefix="/chat", tags=["Chat"])
api_router.include_router(system.router, prefix="/system", tags=["System"])
