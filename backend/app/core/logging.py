# app/core/logging.py
import json
import logging
import sys
from datetime import datetime
from typing import Any, Dict

class JSONFormatter(logging.Formatter):
    def __init__(self, **kwargs):
        super().__init__()
        self.sensitive_keys = {"password", "password_hash", "access_token", "token", "secret", "secret_key"}

    def format(self, record: logging.LogRecord) -> str:
        log_data: Dict[str, Any] = {
            "timestamp": datetime.utcfromtimestamp(record.created).isoformat() + "Z",
            "level": record.levelname,
            "module": record.name,
            "message": record.getMessage(),
        }
        
        # Hata bilgisi varsa ekle
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
            
        # Ekstraları maskeleyerek ekle
        for key, val in record.__dict__.items():
            if key not in {"args", "asctime", "created", "exc_info", "exc_text", "filename",
                           "funcName", "levelname", "levelno", "lineno", "module", "msecs",
                           "msg", "name", "pathname", "process", "processName", "relativeCreated",
                           "stack_info", "thread", "threadName"}:
                if key in self.sensitive_keys:
                    log_data[key] = "********"
                else:
                    log_data[key] = val
                    
        return json.dumps(log_data)

def setup_logging():
    # Kök (root) loglayıcıyı temizle ve ayarla
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.INFO)
    
    # Mevcut handler'ları temizle
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)
        
    # JSON Handler
    stdout_handler = logging.StreamHandler(sys.stdout)
    stdout_handler.setFormatter(JSONFormatter())
    root_logger.addHandler(stdout_handler)
    
    # FastAPI, Uvicorn, SQLAlchemy loglayıcılarını sarmala
    for logger_name in ["uvicorn", "uvicorn.access", "uvicorn.error", "sqlalchemy.engine"]:
        logger = logging.getLogger(logger_name)
        logger.handlers = []
        logger.propagate = True
