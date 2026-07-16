# app/infrastructure/parser/txt_parser.py
import os
import logging
from typing import List, Dict, Any
from app.application.interfaces.file_parser import IFileParserStrategy

logger = logging.getLogger("app.infrastructure.parser.txt")

class TxtParserStrategy(IFileParserStrategy):
    def parse(self, file_path: str) -> List[Dict[str, Any]]:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Dosya bulunamadı: {file_path}")
            
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
            return [{
                "text": content,
                "page_number": 1
            }]
        except Exception as e:
            logger.error(f"Düz metin (TXT) dosyası ayrıştırılırken hata oluştu: {str(e)}")
            raise e
