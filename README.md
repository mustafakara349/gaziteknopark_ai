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

## ⚡ Kurulum ve Başlatma

### 1. Ön Gereksinimler
* Bilgisayarınızda **Docker** ve **Docker Compose** kurulu olmalıdır.
* Yerel LLM çıkarımı için bilgisayarınızda **Ollama** yüklü olmalı ve arka planda çalışmalıdır.
* **Geliştirici Modu (Seçenek B)** için bilgisayarınızda **Python 3.10+** ve **Node.js 18+** kurulu olmalıdır.

### 2. Yapılandırma (.env)
Ana dizindeki şablon dosyasını kopyalayarak kendi `.env` dosyanızı oluşturun:
```bash
cp .env.example .env
```
Gerekirse `.env` içindeki `OLLAMA_URL` veya veritabanı şifrelerini yerel ortamınıza göre düzenleyin.

---

### 🚀 Seçenek A: Docker Compose ile Hızlı Çalıştırma (Tavsiye Edilen)
Projeyi kod geliştirmesi yapmadan sadece denemek ve çalıştırmak istiyorsanız, tüm servisleri tek bir komutla arka planda ayağa kaldırabilirsiniz:

```bash
docker-compose up --build -d
```
Uygulama başarıyla başladıktan sonra:
* **Web Arayüzü (Nginx):** [http://localhost:8080](http://localhost:8080)
* **Backend API Dokümantasyonu (Swagger):** [http://localhost:8080/api/v1/docs](http://localhost:8080/api/v1/docs)

---

### 🛠️ Seçenek B: Yerel Geliştirici Modu (Hot-Reload & Debug)
Kod üzerinde değişiklik yapacak ve logları anlık takip edecekseniz, altyapıyı Docker üzerinde çalıştırıp, backend ve frontend uygulamalarını yerel makinenizde hot-reload modunda başlatabilirsiniz.

#### Adım 1: Sadece Altyapı Servislerini Başlatın
```bash
docker-compose up -d postgres qdrant redis
```

#### Adım 2: Python Backend API'sini Başlatın
```bash
cd backend

# Sanal ortam oluşturun ve aktif edin
python3 -m venv venv
source venv/bin/activate  # Windows için: venv\Scripts\activate

# Bağımlılıkları yükleyin
pip install -r requirements.txt

# Veritabanı tablolarını oluşturun/senkronize edin (eğer gerekirse)
# Uygulamayı reload modunda başlatın
uvicorn app.main:app --reload --port 8000
```
*Yerelde çalışan backend API'nize [http://localhost:8000/docs](http://localhost:8000/docs) adresinden erişebilirsiniz.*

#### Adım 3: React Frontend Uygulamasını Başlatın
Yeni bir terminal sekmesi açın:
```bash
cd frontend

# Bağımlılıkları yükleyin
npm install

# Geliştirici sunucusunu başlatın
npm run dev
```
*Yerelde çalışan hot-reload destekli web arayüzünüze [http://localhost:5173](http://localhost:5173) adresinden erişebilirsiniz.*


---

## 👥 Ekip Arkadaşları İçin Katkı Sağlama (Contribution) Kuralları

1. **Ortam Değişkenleri:** `.env` dosyasını kesinlikle git'e pushlamayın. Yeni bir değişken eklerseniz bunu `.env.example` dosyasına da ekleyip commit edin.
2. **Mimari Bağımlılıklar:** Backend üzerinde kod yazarken Presentation katmanından doğrudan altyapı (Infrastructure) kütüphanelerine erişmeyin. Her zaman bağımlılıkları `dependencies.py` üzerinden ve Use Case katmanı aracılığıyla enjekte edin (Dependency Inversion).
3. **Frontend Kodlama:** Yeni bir özellik eklerken `src/features/` altında modüler çalışın ve projenin Mantine UI kurumsal renk paleti olan **Gazi Üniversitesi Laciverti (`#1b365d`)** renklerini kullanmaya özen gösterin.

---

## 🌿 Git Branching & Geliştirme İş Akışı

Ana dalımız olan `main` doğrudan kod gönderimine (push) karşı **koruma altındadır**. Tüm yeni özellik geliştirmeleri ve hata çözümleri aşağıdaki iş akışına göre yapılmalıdır:

### 1. Yeni Özellik / Hata Çözümü İçin Branch Açma
Geliştirme yapmadan önce her zaman `main` dalından türeyen yeni bir özellik dalı (feature branch) açın:
```bash
# Ana dala geçin ve en güncel hali çekin
git checkout main
git pull origin main

# Yeni bir geliştirme dalı oluşturup ona geçiş yapın
git checkout -b feature/eklenecek-ozellik-adi
```
*(Branch isimlendirme formatı: `feature/ozellik-adi` veya `bugfix/hata-adi` şeklinde olmalıdır.)*

### 2. Kodlama ve Commit İşlemleri
Değişikliklerinizi yaptıktan sonra anlamlı commit mesajlarıyla kayıt altına alın:
```bash
# Değişiklikleri sahneye ekleyin
git add .

# Değişiklikleri commit edin (Standart commit formatına özen gösterin)
git commit -m "feat: add animated custom loading indicators to chat bubble"
```

### 3. Kendi Dalınızı İlk Kez Pushlama (Upstream Tanımlama)
Yerelde oluşturduğunuz bu yeni branch'i GitHub sunucusuna **ilk kez** gönderirken `-u` (veya `--set-upstream`) parametresini ekleyerek yerel dalınız ile uzak sunucu dalını eşleyin:
```bash
git push -u origin feature/eklenecek-ozellik-adi
```
*Bu komut bir kerelik çalıştırılır ve Git'e bu daldaki varsayılan hedefin neresi olduğunu öğretir.*

### 4. Sonraki Değişiklikleri Pushlama
Aynı dal üzerinde çalışmaya devam edip yeni commit'ler attığınızda, artık her seferinde uzun komut yazmanıza gerek kalmaz. Sadece şunu yazmanız yeterlidir:
```bash
git push
```

### 5. Pull Request (PR) Oluşturma ve Kod İncelemesi
1. GitHub web sitesine girin.
2. Sayfanın üstünde beliren **"Compare & pull request"** butonuna tıklayın.
3. Değişikliklerinizi açıklayan kısa bir PR başlığı ve açıklaması yazarak Pull Request'i oluşturun.
4. Ekipten en az 1 kişinin kodunuzu incelemesini ve onaylamasını (**Approve**) bekleyin.
5. Onay alındıktan sonra PR'ı `main` ile birleştirebilirsiniz (Merge).

### 6. Yerel Bilgisayarı Güncelleme ve Temizlik
Geliştirmeniz başarıyla tamamlanıp `main` ile birleştikten sonra, yerel bilgisayarınızdaki branch'i güncelleyip temizleyin:
```bash
# Ana dala geri dönün
git checkout main

# GitHub'daki son güncel main kodlarını çekin
git pull origin main

# İşiniz biten yerel geliştirme dalını bilgisayarınızdan silin
git branch -d feature/eklenecek-ozellik-adi
```

