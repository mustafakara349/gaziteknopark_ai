# Gazi Teknopark AI - Kurumsal Bilgi Asistanı (RAG)

Bu proje, Gazi Teknopark bünyesindeki kurumsal dokümanların (PDF, Word, Excel, PPTX vb.) güvenli bir şekilde indekslenmesi, vektör tabanlı saklanması ve yerel yapay zeka modelleriyle (RAG - Retrieval Augmented Generation) sorgulanması amacıyla geliştirilmiş kurumsal bir bilgi asistanıdır.

Proje, **Domain-Driven Design (DDD)** prensiplerine uygun, **SOLID** kurallarını takip eden ve **Clean Architecture** mimarisi üzerine kurulu bir FastAPI (Backend) ve React (Frontend) monoreposudur.

---

## 🏗️ Teknoloji Yığını (Tech Stack)

* **Backend:** FastAPI (Python 3.10+), Celery (Asenkron Belge İşleme), Redis, PostgreSQL (Kullanıcı & Sohbet Kaydı).
* **Vektör Veritabanı:** Qdrant (Doküman Chunking & Embedding Arama).
* **Yapay Zeka & LLM:** Ollama (Qwen 2.5 vb. yerel modeller), LlamaIndex / Custom Embeddings (BGE-M3).
* **Frontend:** React (Vite), Mantine UI, Lucide Icons, Zustand (State Management).
* **Proxy & Gateway:** Nginx (Ters Proxy & Statik Dosya Sunumu).

---

## 📂 Proje Klasör Yapısı

```text
├── backend/                  # FastAPI & Python Backend Uygulaması
│   ├── app/
│   │   ├── domain/           # DDD - Domain Modelleri ve Repository Arayüzleri
│   │   ├── application/      # DDD - Use Case'ler, Servisler ve Workflow Yapıları
│   │   ├── infrastructure/   # DDD - Veritabanı somut sınıfları, Parserlar, Celery
│   │   └── presentation/     # DDD - FastAPI Endpoint'leri ve Pydantic Şemaları
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                 # React & Vite Frontend Uygulaması
│   ├── src/
│   │   ├── components/       # Genel Arayüz Bileşenleri (Layout vb.)
│   │   ├── features/         # Özellik bazlı sayfalar (Chat, Documents, System)
│   │   ├── store/            # Zustand State Store'ları
│   │   └── App.tsx
│   ├── Dockerfile
│   └── package.json
├── nginx/                    # Nginx Sunucu ve SSL Sertifika Yapılandırması
├── docker-compose.yml        # Tüm Servisleri Ayağa Kaldıran Docker Yapılandırması
├── .env.example              # Ortam Değişkenleri Şablonu
└── .gitignore                # Git Dışında Tutulacak Dosyalar Listesi
```

---

## ⚡ Hızlı Kurulum ve Başlatma

### 1. Ön Gereksinimler
* Bilgisayarınızda **Docker** ve **Docker Compose** kurulu olmalıdır.
* Yerel LLM çıkarımı için bilgisayarınızda **Ollama** yüklü olmalı ve arka planda çalışmalıdır.

### 2. Yapılandırma (.env)
Ana dizindeki şablon dosyasını kopyalayarak kendi `.env` dosyanızı oluşturun:
```bash
cp .env.example .env
```
Gerekirse `.env` içindeki `OLLAMA_URL` veya veritabanı şifrelerini yerel ortamınıza göre düzenleyin.

### 3. Uygulamayı Başlatma
Tüm servisleri (PostgreSQL, Redis, Qdrant, Backend, Celery ve Nginx) Docker Compose ile tek komutla ayağa kaldırın:
```bash
docker-compose up --build -d
```

Uygulama başarıyla başladıktan sonra:
* **Web Arayüzü:** [http://localhost:8080](http://localhost:8080) adresinden erişilebilir.
* **Backend API Dokümantasyonu (Swagger):** [http://localhost:8080/api/v1/docs](http://localhost:8080/api/v1/docs) (Nginx üzerinden proxy edilir).

---

## 👥 Ekip Arkadaşları İçin Katkı Sağlama (Contribution) Kuralları

1. **Ortam Değişkenleri:** `.env` dosyasını kesinlikle git'e pushlamayın. Yeni bir değişken eklerseniz bunu `.env.example` dosyasına da ekleyip commit edin.
2. **Mimari Bağımlılıklar:** Backend üzerinde kod yazarken Presentation katmanından doğrudan altyapı (Infrastructure) kütüphanelerine erişmeyin. Her zaman bağımlılıkları `dependencies.py` üzerinden ve Use Case katmanı aracılığıyla enjekte edin (Dependency Inversion).
3. **Frontend Kodlama:** Yeni bir özellik eklerken `src/features/` altında modüler çalışın ve projenin Mantine UI kurumsal renk paleti olan **Gazi Üniversitesi Laciverti (`#1b365d`)** renklerini kullanmaya özen gösterin.
