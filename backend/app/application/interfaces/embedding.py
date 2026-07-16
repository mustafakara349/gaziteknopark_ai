# app/application/interfaces/embedding.py
from abc import ABC, abstractmethod
from typing import List

class IEmbeddingService(ABC):
    @abstractmethod
    def get_text_embedding(self, text: str) -> List[float]:
        """Generate embedding vector for a single piece of text."""
        pass

    @abstractmethod
    def get_text_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate embedding vectors for a list of texts."""
        pass
