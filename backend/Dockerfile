# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Sistem kütüphanelerini kur (Bazı python modülleri derleme için C compiler isteyebilir)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Bağımlılıkları kopyala ve kur
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Uygulama dosyalarını kopyala
COPY . .

# Çalışma dizinini python modül aramasına ekle
ENV PYTHONPATH=/app

EXPOSE 8000

# Varsayılan başlangıç komutu (FastAPI API sunucusu)
CMD ["uvicorn", "app.presentation.main:app", "--host", "0.0.0.0", "--port", "8000"]
