# app/application/interfaces/file_parser.py
from abc import ABC, abstractmethod
from typing import List, Dict, Any

class IFileParserStrategy(ABC):
    @abstractmethod
    def parse(self, file_path: str) -> List[Dict[str, Any]]:
        """
        Belgeyi ayrıştırır ve her bir sayfa/bölüm için metin ve sayfa numarası içeren
        bir sözlük listesi döner: [{"text": str, "page_number": int}]
        """
        pass
