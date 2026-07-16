# app/application/interfaces/llm.py
from abc import ABC, abstractmethod
from typing import Generator

class ILLMService(ABC):
    @abstractmethod
    def generate(self, prompt: str) -> str:
        """Synchronously generate a completion for a prompt."""
        pass

    @abstractmethod
    def generate_stream(self, prompt: str) -> Generator[str, None, None]:
        """Synchronously stream a completion for a prompt."""
        pass
