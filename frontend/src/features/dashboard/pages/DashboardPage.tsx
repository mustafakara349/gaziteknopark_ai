import React, { useEffect, useState } from 'react';
import { 
  Grid, Card, Text, Group, Paper, RingProgress, 
  Stack, SimpleGrid, ThemeIcon, Badge, Table, Tooltip
} from '@mantine/core';
import { 
  LayoutDashboard, FileText, Database, Shield, 
  Cpu, HardDrive, Zap, Info 
} from 'lucide-react';
import apiClient from '../../../core/api-client';

interface MetricsInfo {
  system: {
    cpu_percent: number;
    memory_percent: number;
    disk_percent: number;
  };
  gpu: {
    name: string;
    utilization_gpu: number;
    memory_used_mb: number;
    memory_total_mb: number;
    temperature_celsius: number;
  } | null;
  qdrant_status: string;
  ollama_status: string;
}

export const DashboardPage: React.FC = () => {
  const [metrics, setMetrics] = useState<MetricsInfo | null>(null);
  const [docCount, setDocCount] = useState(0);
  const [colCount, setColCount] = useState(0);

  const fetchDashboardData = async () => {
    try {
      const [metricsRes, docsRes, colsRes] = await Promise.all([
        apiClient.get<MetricsInfo>('/system/metrics'),
        apiClient.get<any[]>('/documents'),
        apiClient.get<any[]>('/documents/collections'),
      ]);
      setMetrics(metricsRes.data);
      setDocCount(docsRes.data.length);
      setColCount(colsRes.data.length);
    } catch (error) {
      console.error('Gösterge paneli verisi çekilemedi', error);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 10000); // 10 saniyede bir güncelle
    return () => clearInterval(interval);
  }, []);

  return (
    <Stack gap="md">
      <Text size="xl" fw={700}>Gösterge Paneli (Dashboard)</Text>

      {/* İstatistik Özet Kartları */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" fw={700} tt="uppercase">Toplam Belge</Text>
              <Text size="xl" fw={700} mt={4}>{docCount}</Text>
            </div>
            <ThemeIcon color="blue" variant="light" size="xl" radius="md">
              <FileText size={24} />
            </ThemeIcon>
          </Group>
        </Paper>

        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" fw={700} tt="uppercase">Koleksiyon Sayısı</Text>
              <Text size="xl" fw={700} mt={4}>{colCount}</Text>
            </div>
            <ThemeIcon color="cyan" variant="light" size="xl" radius="md">
              <Database size={24} />
            </ThemeIcon>
          </Group>
        </Paper>

        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" fw={700} tt="uppercase">Güvenlik Durumu</Text>
              <Text size="xl" fw={700} mt={4} c="green">Aktif</Text>
            </div>
            <ThemeIcon color="green" variant="light" size="xl" radius="md">
              <Shield size={24} />
            </ThemeIcon>
          </Group>
        </Paper>
      </SimpleGrid>

      {/* Sistem Kaynakları ve GPU */}
      <Grid gutter="md">
        {/* Sistem Yükü (CPU/Memory/Disk) */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card shadow="xs" p="md" radius="md" withBorder style={{ height: '100%' }}>
            <Group justify="space-between" mb="md">
              <Text fw={600}>Sunucu Kaynak Kullanımı</Text>
              <Tooltip label="Bu değerler, yapay zeka asistanı ve veritabanı servislerinin çalıştığı ana sunucunun (Docker Host) anlık değerleridir. Kendi bilgisayarınızın donanım kullanımını yansıtmaz." withArrow position="top" multiline w={260}>
                <Info size={14} color="#8a94a6" style={{ cursor: 'help' }} />
              </Tooltip>
            </Group>
            
            <SimpleGrid cols={3} spacing="xs">
              <Stack align="center" gap="xs">
                <RingProgress
                  sections={[{ value: metrics?.system.cpu_percent || 0, color: 'blue' }]}
                  label={
                    <Text size="xs" ta="center" fw={700}>
                      {metrics?.system.cpu_percent.toFixed(0) || 0}%
                    </Text>
                  }
                />
                <Text size="sm" fw={500}><Cpu size={14} style={{ display: 'inline', marginRight: 4 }} />CPU</Text>
              </Stack>

              <Stack align="center" gap="xs">
                <RingProgress
                  sections={[{ value: metrics?.system.memory_percent || 0, color: 'teal' }]}
                  label={
                    <Text size="xs" ta="center" fw={700}>
                      {metrics?.system.memory_percent.toFixed(0) || 0}%
                    </Text>
                  }
                />
                <Text size="sm" fw={500}><HardDrive size={14} style={{ display: 'inline', marginRight: 4 }} />Bellek</Text>
              </Stack>

              <Stack align="center" gap="xs">
                <RingProgress
                  sections={[{ value: metrics?.system.disk_percent || 0, color: 'orange' }]}
                  label={
                    <Text size="xs" ta="center" fw={700}>
                      {metrics?.system.disk_percent.toFixed(0) || 0}%
                    </Text>
                  }
                />
                <Text size="sm" fw={500}><HardDrive size={14} style={{ display: 'inline', marginRight: 4 }} />Disk</Text>
              </Stack>
            </SimpleGrid>
          </Card>
        </Grid.Col>

        {/* Yerel GPU Durumu */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card shadow="xs" p="md" radius="md" withBorder style={{ height: '100%' }}>
            <Group justify="space-between" mb="md">
              <Text fw={600}>NVIDIA GPU Durumu (Ollama Engine)</Text>
              <Tooltip label="AI modelinin çıkarım (inference) yaptığı sunucu grafik kartının anlık yük durumudur." withArrow position="top" multiline w={220}>
                <Info size={14} color="#8a94a6" style={{ cursor: 'help' }} />
              </Tooltip>
            </Group>
            
            {metrics && metrics.gpu ? (
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Kart Adı:</Text>
                  <Text size="sm" fw={600}>{metrics.gpu.name}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Grafik İşlemci Yükü:</Text>
                  <Badge color="blue">{metrics.gpu.utilization_gpu}%</Badge>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Ekran Kartı Belleği (VRAM):</Text>
                  <Text size="sm" fw={600}>
                    {metrics.gpu.memory_used_mb} MB / {metrics.gpu.memory_total_mb} MB
                  </Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm" c="dimmed">Sıcaklık:</Text>
                  <Badge color={metrics.gpu.temperature_celsius > 75 ? 'red' : 'green'}>
                    {metrics.gpu.temperature_celsius} °C
                  </Badge>
                </Group>
              </Stack>
            ) : (
              <Stack align="center" justify="center" gap="xs" style={{ minHeight: 120 }}>
                <Zap size={28} color="#8a94a6" style={{ opacity: 0.6 }} />
                <Text size="sm" c="dimmed" ta="center">
                  Uyumlu bir NVIDIA ekran kartı (GPU) tespit edilemedi.<br />
                  Sistem CPU tabanlı modda çalışıyor.
                </Text>
              </Stack>
            )}
          </Card>
        </Grid.Col>
      </Grid>

      {/* Veritabanı ve AI Servisleri Bağlantı Durumu */}
      <Card shadow="xs" p="md" radius="md" withBorder>
        <Text fw={600} mb="md">Servis Bağlantı Durumları</Text>
        
        <Table>
          <Table.Tbody>
            <Table.Tr>
              <Table.Td fw={500}>FastAPI Backend Gateway</Table.Td>
              <Table.Td style={{ textAlign: 'right' }}><Badge color="green">Çevrimiçi</Badge></Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td fw={500}>PostgreSQL Database (ACID)</Table.Td>
              <Table.Td style={{ textAlign: 'right' }}><Badge color="green">Bağlandı</Badge></Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td fw={500}>Qdrant Vector Database</Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>
                <Badge color={metrics?.qdrant_status === 'connected' ? 'green' : 'red'}>
                  {metrics?.qdrant_status === 'connected' ? 'Bağlandı' : 'Hata'}
                </Badge>
              </Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td fw={500}>Ollama Yerel LLM Sunucusu (Qwen 2B)</Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>
                <Badge color={metrics?.ollama_status === 'connected' ? 'green' : 'red'}>
                  {metrics?.ollama_status === 'connected' ? 'Bağlandı' : 'Hata'}
                </Badge>
              </Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Card>
    </Stack>
  );
};

export default DashboardPage;
