# app/application/interfaces/llm.py
from abc import ABC, abstractmethod
from typing import Generator, List

class ILLMService(ABC):
    @abstractmethod
    def generate(self, prompt: str) -> str:
        """Synchronously generate a completion for a prompt."""
        pass

    @abstractmethod
    def generate_stream(self, prompt: str) -> Generator[str, None, None]:
        """Synchronously stream a completion for a prompt."""
        pass

    @abstractmethod
    def get_current_model(self) -> str:
        """Get current active model name."""
        pass

    @abstractmethod
    def set_current_model(self, model_name: str) -> str:
        """Set active model name at runtime."""
        pass

    @abstractmethod
    def list_available_models(self) -> List[str]:
        """List locally installed Ollama models."""
        pass

    @abstractmethod
    def get_hyperparameters(self) -> dict:
        """Get current LLM hyperparameters (temperature, top_p, max_tokens)."""
        pass

    @abstractmethod
    def set_hyperparameters(self, temperature: float, top_p: float, max_tokens: int) -> dict:
        """Set LLM hyperparameters at runtime."""
        pass

    @abstractmethod
    def get_prompts(self) -> dict:
        """Get current System Prompts."""
        pass

    @abstractmethod
    def set_prompts(self, prompt_rag: str, prompt_chitchat: str, prompt_classify: str) -> dict:
        """Set System Prompts at runtime."""
        pass


