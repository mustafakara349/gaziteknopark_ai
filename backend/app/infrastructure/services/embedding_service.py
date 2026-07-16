# app/infrastructure/services/embedding_service.py
from typing import List
from llama_index.embeddings.ollama import OllamaEmbedding
from app.application.interfaces.embedding import IEmbeddingService
from app.core.config import settings

class OllamaEmbeddingService(IEmbeddingService):
    def __init__(self):
        self.embed_model = OllamaEmbedding(
            model_name=settings.EMBEDDING_MODEL,
            base_url=settings.OLLAMA_URL
        )

    def get_text_embedding(self, text: str) -> List[float]:
        return self.embed_model.get_query_embedding(text)

    def get_text_embeddings(self, texts: List[str]) -> List[List[float]]:
        return self.embed_model.get_text_embedding_batch(texts)
