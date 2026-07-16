import React, { useEffect, useState } from 'react';
import { Card, Text, Table, ScrollArea, Stack, Badge, Group, Button } from '@mantine/core';
import { ShieldCheck, RefreshCw, FileCode } from 'lucide-react';
import { notifications } from '@mantine/notifications';
import apiClient from '../../../core/api-client';

interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  details: string;
  ip_address: string;
  created_at: string;
}

export const SystemPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAuditLogs = async () => {
    setLoading(false);
    try {
      const response = await apiClient.get<AuditLog[]>('/system/audit-logs');
      setLogs(response.data);
    } catch (error) {
      notifications.show({
        title: 'Hata',
        message: 'Denetim günlükleri (Audit Logs) yüklenemedi.',
        color: 'red'
      });
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'user_login':
        return <Badge color="green">Giriş Başarılı</Badge>;
      case 'document_upload':
        return <Badge color="blue">Belge Yüklendi</Badge>;
      case 'document_delete':
        return <Badge color="red">Belge Silindi</Badge>;
      case 'collection_create':
        return <Badge color="gray">Koleksiyon Ekleme</Badge>;
      default:
        return <Badge color="dark">{action}</Badge>;
    }
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="xl" fw={700}>Sistem Durumu & Güvenlik Denetim Günlüğü</Text>
        <Button 
          variant="light" 
          leftSection={<RefreshCw size={16} />}
          onClick={fetchAuditLogs}
        >
          Yenile
        </Button>
      </Group>

      <Card shadow="xs" p="md" radius="md" withBorder>
        <Group gap="xs" mb="md">
          <ShieldCheck size={20} color="#1a73e8" />
          <Text fw={600}>Audit Logs (Güvenlik Kayıtları)</Text>
        </Group>

        <Text size="sm" c="dimmed" mb="md">
          Bu tablo, kurum içerisindeki hassas yönetici işlemlerini (belge silme, yükleme, giriş denemeleri vb.) değiştirilemez (append-only) olarak takip eder.
        </Text>

        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Zaman Damgası</Table.Th>
                <Table.Th>Kullanıcı ID</Table.Th>
                <Table.Th>İşlem</Table.Th>
                <Table.Th>Hedef</Table.Th>
                <Table.Th>Detaylar</Table.Th>
                <Table.Th>IP Adresi</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {logs.length === 0 ? (
                <Table.Tr>
                  <Table.Td colSpan={6} style={{ textAlign: 'center', color: '#868e96' }}>
                    Henüz hiç denetim logu oluşmamış.
                  </Table.Td>
                </Table.Tr>
              ) : (
                logs.map((log) => (
                  <Table.Tr key={log.id}>
                    <Table.Td>{new Date(log.created_at).toLocaleString('tr-TR')}</Table.Td>
                    <Table.Td>
                      <Text size="xs" style={{ fontFamily: 'monospace' }}>
                        {log.user_id || 'Sistem / LDAP'}
                      </Text>
                    </Table.Td>
                    <Table.Td>{getActionBadge(log.action)}</Table.Td>
                    <Table.Td>
                      <Badge variant="outline" color="gray">
                        {log.target_type.toUpperCase()}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{log.details}</Table.Td>
                    <Table.Td>
                      <Badge color="cyan" variant="light">
                        {log.ip_address}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Card>
    </Stack>
  );
};

export default SystemPage;
