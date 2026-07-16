# app/application/use_cases/chat_use_cases.py
import json
from typing import Generator
from fastapi import HTTPException, status
from app.domain.models.chat import ChatMessage
from app.domain.repositories.chat_repository import IChatRepository
from app.domain.repositories.vector_repository import IVectorStoreRepository
from app.infrastructure.services.redis_cache import RedisCacheService
from app.infrastructure.services.reranker import BGEReranker
from app.application.interfaces.llm import ILLMService
from app.application.interfaces.embedding import IEmbeddingService
from app.application.services.chat_workflow import ChatWorkflow

class QueryChatSessionUseCase:
    def __init__(
        self,
        chat_repo: IChatRepository,
        vector_repo: IVectorStoreRepository,
        reranker: BGEReranker,
        redis_cache: RedisCacheService,
        llm_service: ILLMService,
        embedding_service: IEmbeddingService
    ):
        self.chat_repo = chat_repo
        self.vector_repo = vector_repo
        self.reranker = reranker
        self.redis_cache = redis_cache
        self.llm_service = llm_service
        self.embedding_service = embedding_service

    def execute(self, session_id: str, query: str, user_id: str) -> Generator[str, None, None]:
        # 1. Oturum Kontrolü
        session = self.chat_repo.get_session_by_id(session_id)
        if not session or session.user_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Sohbet oturumu bulunamadı."
            )
            
        # 1.1 Sohbet Geçmişini Çek (En son 10 mesaj)
        history_messages = self.chat_repo.get_messages_by_session(session_id, limit=10)
        chat_history = [
            {"role": msg.role, "content": msg.content}
            for msg in history_messages
        ]

        # 2. Kullanıcı Sorusunu Veritabanına Kaydet
        user_message = ChatMessage(
            id="",
            session_id=session_id,
            role="user",
            content=query
        )
        self.chat_repo.save_message(user_message)
        
        # 3. ChatWorkflow'u Başlat
        workflow = ChatWorkflow(
            vector_repo=self.vector_repo,
            reranker=self.reranker,
            redis_cache=self.redis_cache,
            llm_service=self.llm_service,
            embedding_service=self.embedding_service
        )
        
        # 4. SSE Stream'i döndür ve asistan cevabını asenkron olarak kaydet
        def event_generator():
            full_response = ""
            try:
                for token in workflow.stream_run(query, chat_history=chat_history, collection_id=session.collection_id):
                    full_response += token
                    yield f"data: {token}\n\n"
            except Exception as e:
                yield f"data: [HATA] {str(e)}\n\n"
            finally:
                # Elde edilen kaynakları al (varsa)
                sources = getattr(workflow, "last_sources", [])
                if sources:
                    # Kaynakları frontend'e anlık göndermek için event: sources bloğu gönder
                    sources_json = json.dumps(sources, ensure_ascii=False)
                    yield f"event: sources\ndata: {sources_json}\n\n"

                # Asistan yanıtını veritabanına kaydet
                assistant_message = ChatMessage(
                    id="",
                    session_id=session_id,
                    role="assistant",
                    content=full_response,
                    sources=sources
                )
                self.chat_repo.save_message(assistant_message)

        return event_generator()
