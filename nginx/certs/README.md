# SSL/TLS Sertifikaları

Nginx'in HTTPS protokolü üzerinden hizmet verebilmesi için bu dizin altında aşağıdaki dosyalar bulunmalıdır:

1. `gazi_teknopark.crt` (Sertifika Dosyası)
2. `gazi_teknopark.key` (Sertifika Özel Anahtarı - Private Key)

## Test Ortamı İçin Geçici Sertifika Oluşturma (Self-Signed)

Eğer yerel geliştirme veya test ortamında çalışıyorsanız, aşağıdaki OpenSSL komutu ile hızlıca geçici bir sertifika oluşturabilirsiniz:

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout gazi_teknopark.key \
  -out gazi_teknopark.crt \
  -subj "/C=TR/ST=Ankara/L=Cankaya/O=Gazi Teknopark/OU=Arge/CN=localhost"
```

Oluşturulan dosyaları bu klasör altında saklayın. Docker Compose ayağa kalkarken bu dizini Nginx konteynerı içerisine bağlayacaktır.
