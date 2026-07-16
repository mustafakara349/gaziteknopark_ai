import React, { useState } from 'react';
import { 
  Container, Card, Title, Text, TextInput, 
  PasswordInput, Button, Stack, Alert 
} from '@mantine/core';
import { AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../../core/api-client';
import { useAuthStore } from '../../../store/auth-store';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post('/auth/login', {
        email,
        password,
      });
      
      const { access_token, role, user_id, full_name } = response.data;
      
      // Store'a kaydet (Localstorage otomatik güncellenir)
      login(access_token, role, user_id, full_name);
      
      // Dashboard'a yönlendir
      navigate('/dashboard');
    } catch (err: any) {
      setError(
        err.response?.data?.detail || 
        'Giriş yapılamadı. E-posta adresinizi ve şifrenizi kontrol edin.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container size="xs" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Card shadow="md" p="xl" radius="md" withBorder style={{ width: '100%' }}>
        <Title order={2} ta="center">
          <Text component="span" inherit variant="gradient" gradient={{ from: '#1a73e8', to: '#0d47a1', deg: 45 }}>
            Gazi Teknopark AI
          </Text>
        </Title>
        <Text c="dimmed" size="xs" ta="center" mt={5} mb="md" fw={500}>
          Kurumsal Bilgi Asistanı Giriş Paneli
        </Text>

        {error && (
          <Alert variant="light" color="red" title="Giriş Hatası" icon={<AlertCircle size={16} />} mb="md">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Stack>
            <TextInput
              label="E-posta Adresi / Kullanıcı Adı"
              placeholder="admin@gazi.local veya LDAP kullanıcı adı"
              required
              value={email}
              onChange={(e) => setEmail(e.currentTarget.value)}
            />
            <PasswordInput
              label="Şifre"
              placeholder="Şifreniz"
              required
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
            />
            
            <Button type="submit" fullWidth loading={loading} mt="md" color="blue">
              Giriş Yap
            </Button>
          </Stack>
        </form>
      </Card>
    </Container>
  );
};

export default LoginPage;
