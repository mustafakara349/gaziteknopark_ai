# app/presentation/api/v1/endpoints/chat.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from typing import List
from app.domain.models.user import User
from app.domain.models.chat import ChatSession, ChatMessage
from app.domain.repositories.chat_repository import IChatRepository
from app.domain.repositories.vector_repository import IVectorStoreRepository
from app.presentation.api.dependencies import (
    get_current_user, get_chat_repository, get_query_chat_session_use_case
)
from app.presentation.schemas.chat import (
    ChatSessionCreate, ChatSessionResponse, QueryRequest, ChatMessageResponse, ChatSessionRename
)
from app.application.use_cases.chat_use_cases import QueryChatSessionUseCase

router = APIRouter()

@router.post("/sessions", response_model=ChatSessionResponse, status_code=status.HTTP_201_CREATED)
async def create_chat_session(
    payload: ChatSessionCreate,
    current_user: User = Depends(get_current_user),
    chat_repo: IChatRepository = Depends(get_chat_repository)
):
    session = ChatSession(
        id="",
        user_id=current_user.id,
        title=payload.title,
        collection_id=payload.collection_id
    )
    return chat_repo.save_session(session)

@router.get("/sessions", response_model=List[ChatSessionResponse])
async def list_chat_sessions(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    chat_repo: IChatRepository = Depends(get_chat_repository)
):
    return chat_repo.get_sessions_by_user(current_user.id, skip=skip, limit=limit)

@router.get("/sessions/{session_id}/messages", response_model=List[ChatMessageResponse])
async def get_chat_messages(
    session_id: str,
    current_user: User = Depends(get_current_user),
    chat_repo: IChatRepository = Depends(get_chat_repository)
):
    session = chat_repo.get_session_by_id(session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sohbet oturumu bulunamadı."
        )
    return chat_repo.get_messages_by_session(session_id)

@router.post("/sessions/{session_id}/query")
async def query_chat_session(
    session_id: str,
    payload: QueryRequest,
    current_user: User = Depends(get_current_user),
    use_case: QueryChatSessionUseCase = Depends(get_query_chat_session_use_case)
):
    return StreamingResponse(
        use_case.execute(session_id, payload.query, current_user.id),
        media_type="text/event-stream"
    )

@router.post("/sessions/{session_id}/favorite", response_model=ChatSessionResponse)
async def toggle_favorite(
    session_id: str,
    current_user: User = Depends(get_current_user),
    chat_repo: IChatRepository = Depends(get_chat_repository)
):
    session = chat_repo.get_session_by_id(session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sohbet oturumu bulunamadı."
        )
    session.toggle_favorite()
    return chat_repo.save_session(session)

@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    chat_repo: IChatRepository = Depends(get_chat_repository)
):
    session = chat_repo.get_session_by_id(session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sohbet oturumu bulunamadı."
        )
    chat_repo.delete_session(session_id)

@router.patch("/sessions/{session_id}", response_model=ChatSessionResponse)
async def rename_chat_session(
    session_id: str,
    payload: ChatSessionRename,
    current_user: User = Depends(get_current_user),
    chat_repo: IChatRepository = Depends(get_chat_repository)
):
    session = chat_repo.get_session_by_id(session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sohbet oturumu bulunamadı."
        )
    new_title = payload.title.strip()
    if not new_title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Başlık boş olamaz.")
    session.update_title(new_title)
    return chat_repo.save_session(session)
