# app/infrastructure/services/llm_service.py
from typing import Generator
from llama_index.llms.ollama import Ollama
from app.application.interfaces.llm import ILLMService
from app.core.config import settings

class OllamaLLMService(ILLMService):
    def __init__(self):
        self.llm = Ollama(
            model=settings.LLM_MODEL,
            base_url=settings.OLLAMA_URL,
            request_timeout=60.0
        )

    def generate(self, prompt: str) -> str:
        response = self.llm.complete(prompt)
        return str(response).strip()

    def generate_stream(self, prompt: str) -> Generator[str, None, None]:
        response_gen = self.llm.stream_complete(prompt)
        for response_chunk in response_gen:
            yield response_chunk.delta
