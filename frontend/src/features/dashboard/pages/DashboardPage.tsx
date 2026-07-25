import React, { useEffect, useState } from 'react';
import {
  Grid, Card, Text, Group, Paper, RingProgress,
  Stack, SimpleGrid, ThemeIcon, Badge, Table, Tooltip, Select,
  Slider, NumberInput, Textarea, Tabs, Button, Divider
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  LayoutDashboard, FileText, Database, Shield,
  Cpu, HardDrive, Zap, Info, Bot, Sparkles, Sliders, RotateCcw, Save,
  FileCode, MessageSquareCode, HelpCircle, Trash2
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

interface ModelsResponse {
  models: string[];
  current_model: string;
}

export const DashboardPage: React.FC = () => {
  const [metrics, setMetrics] = useState<MetricsInfo | null>(null);
  const [docCount, setDocCount] = useState(0);
  const [colCount, setColCount] = useState(0);

  // AI Model State
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [modelLoading, setModelLoading] = useState<boolean>(false);

  // AI Hiperparametre ve Prompt State'leri
  const [temperature, setTemperature] = useState<number>(0.2);
  const [topP, setTopP] = useState<number>(0.9);
  const [maxTokens, setMaxTokens] = useState<number>(2048);

  const [promptRag, setPromptRag] = useState<string>('');
  const [promptChitchat, setPromptChitchat] = useState<string>('');
  const [promptClassify, setPromptClassify] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('rag');
  const [savingSettings, setSavingSettings] = useState<boolean>(false);

  // Redis Önbellek State'leri
  const [cacheStats, setCacheStats] = useState<{ status: string; total_keys: number; used_memory_human: string } | null>(null);
  const [clearingCache, setClearingCache] = useState<boolean>(false);

  const fetchDashboardData = async () => {
    try {
      const [metricsRes, docsRes, colsRes, modelsRes] = await Promise.all([
        apiClient.get<MetricsInfo>('/system/metrics'),
        apiClient.get<any[]>('/documents'),
        apiClient.get<any[]>('/documents/collections'),
        apiClient.get<ModelsResponse>('/system/models'),
      ]);
      setMetrics(metricsRes.data);
      setDocCount(docsRes.data.length);
      setColCount(colsRes.data.length);

      setAvailableModels(modelsRes.data.models || []);
      setSelectedModel(modelsRes.data.current_model || '');
    } catch (error) {
      console.error('Gösterge paneli verisi çekilemedi', error);
    }
  };

  const fetchAISettings = async () => {
    try {
      const res = await apiClient.get<{
        hyperparameters: { temperature: number; top_p: number; max_tokens: number };
        prompts: { prompt_rag: string; prompt_chitchat: string; prompt_classify: string };
        current_model: string;
      }>('/system/ai-settings');

      if (res.data.hyperparameters) {
        setTemperature(res.data.hyperparameters.temperature ?? 0.2);
        setTopP(res.data.hyperparameters.top_p ?? 0.9);
        setMaxTokens(res.data.hyperparameters.max_tokens ?? 2048);
      }

      if (res.data.prompts) {
        setPromptRag(res.data.prompts.prompt_rag || '');
        setPromptChitchat(res.data.prompts.prompt_chitchat || '');
        setPromptClassify(res.data.prompts.prompt_classify || '');
      }
    } catch (error) {
      console.error('AI ayarları çekilemedi', error);
    }
  };

  const fetchCacheStats = async () => {
    try {
      const res = await apiClient.get<{ status: string; total_keys: number; used_memory_human: string }>('/system/cache-stats');
      setCacheStats(res.data);
    } catch (err) {
      console.error('Redis cache istatistikleri çekilemedi:', err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchAISettings();
    fetchCacheStats();
    const interval = setInterval(() => {
      fetchDashboardData();
      fetchCacheStats();
    }, 10000); // 10 saniyede bir güncelle
    return () => clearInterval(interval);
  }, []);

  const handleModelChange = async (newModel: string) => {
    if (!newModel || newModel === selectedModel) return;
    setModelLoading(true);
    try {
      const response = await apiClient.post<{ status: string; current_model: string; message: string }>('/system/models/select', {
        model_name: newModel
      });
      setSelectedModel(response.data.current_model);
      notifications.show({
        title: 'Yapay Zeka Modeli Güncellendi',
        message: response.data.message || `Aktif LLM modeli '${newModel}' olarak belirlendi.`,
        color: 'green',
        icon: <Sparkles size={16} />,
      });
    } catch (error: any) {
      notifications.show({
        title: 'Model Güncelleme Hatası',
        message: error.response?.data?.detail || 'Model güncellenirken bir hata oluştu.',
        color: 'red',
      });
    } finally {
      setModelLoading(false);
    }
  };

  const handleSaveAISettings = async () => {
    setSavingSettings(true);
    try {
      const response = await apiClient.post<{ status: string; message: string }>('/system/ai-settings', {
        temperature,
        top_p: topP,
        max_tokens: maxTokens,
        prompt_rag: promptRag,
        prompt_chitchat: promptChitchat,
        prompt_classify: promptClassify
      });
      notifications.show({
        title: 'Ayarlar Kaydedildi',
        message: response.data.message || 'Yapay zeka hiperparametreleri ve System Promptlar veritabanına başarıyla kaydedildi.',
        color: 'green',
        icon: <Sparkles size={16} />,
      });
    } catch (error: any) {
      notifications.show({
        title: 'Kaydetme Hatası',
        message: error.response?.data?.detail || 'Ayarlar kaydedilemedi.',
        color: 'red',
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleResetAISettings = async () => {
    setSavingSettings(true);
    try {
      await apiClient.post<any>('/system/ai-settings/reset');
      notifications.show({
        title: 'Varsayılana Döndürüldü',
        message: 'Tüm yapay zeka parametreleri ve System Promptlar orijinal varsayılanlarına sıfırlandı.',
        color: 'blue',
        icon: <RotateCcw size={16} />,
      });
      await fetchAISettings();
    } catch (error: any) {
      notifications.show({
        title: 'Sıfırlama Hatası',
        message: error.response?.data?.detail || 'Varsayılana döndürülemedi.',
        color: 'red',
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleClearCache = async () => {
    setClearingCache(true);
    try {
      const res = await apiClient.post<{ status: string; message: string }>('/system/clear-cache');
      notifications.show({
        title: 'Önbellek Sıfırlandı',
        message: res.data.message || 'Tüm Redis önbellek kayıtları başarıyla temizlendi.',
        color: 'green',
        icon: <Sparkles size={16} />,
      });
      await fetchCacheStats();
    } catch (error: any) {
      notifications.show({
        title: 'Sıfırlama Hatası',
        message: error.response?.data?.detail || 'Önbellek temizlenirken bir hata oluştu.',
        color: 'red',
      });
    } finally {
      setClearingCache(false);
    }
  };

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
              <Table.Td fw={500}>Ollama Yerel LLM Sunucusu ({selectedModel || 'Yerel Model'})</Table.Td>
              <Table.Td style={{ textAlign: 'right' }}>
                <Badge color={metrics?.ollama_status === 'connected' ? 'green' : 'red'}>
                  {metrics?.ollama_status === 'connected' ? 'Bağlandı' : 'Hata'}
                </Badge>
              </Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Card>

      {/* ── Yapay Zeka Model & System Prompt Ayarları (Çift Kart / Double Card Layout) ── */}
      <Stack gap="md" mt="xs">
        {/* Üst Tam Genişlik Başlık & Buton Barı */}
        <Paper
          p="md"
          radius="lg"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid rgba(226, 232, 240, 0.8)',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            borderRadius: 16,
          }}
        >
          <Group justify="space-between" align="center">
            <Group gap="md">
              <div style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                backgroundColor: '#eef2ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #e0e7ff',
              }}>
                <Sliders size={20} color="#4f46e5" />
              </div>
              <div>
                <Text fw={700} size="lg" style={{ color: '#0f172a', letterSpacing: '-0.01em' }}>
                  Yapay Zeka Model & System Prompt Ayarları
                </Text>
                <Text size="xs" style={{ color: '#64748b', marginTop: 2 }}>
                  Model hiperparametrelerini ve System Prompt içeriklerini canlı olarak düzenleyin.
                </Text>
              </div>
            </Group>

            <Group gap="xs">
              <Button
                variant="default"
                onClick={handleResetAISettings}
                loading={savingSettings}
                leftSection={<RotateCcw size={15} />}
                style={{
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontWeight: 500,
                  fontSize: 13,
                  borderRadius: 8,
                  height: 38,
                  transition: 'all 0.2s ease',
                }}
              >
                Varsayılana Dön
              </Button>

              <Button
                onClick={handleSaveAISettings}
                loading={savingSettings}
                leftSection={<Save size={15} />}
                style={{
                  backgroundColor: '#4f46e5',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: 13,
                  borderRadius: 8,
                  height: 38,
                  boxShadow: '0 2px 8px rgba(79, 70, 229, 0.25)',
                  transition: 'all 0.15s ease',
                }}
              >
                Ayarları Kaydet
              </Button>
            </Group>
          </Group>
        </Paper>

        {/* 12-Sütun Grid Düzeni (Sol Kart: 5 Kolon / Sağ Kart: 7 Kolon) */}
        <Grid gutter="lg">
          {/* 1. SOL KART: Model Hiperparametreleri (col-span-5) */}
          <Grid.Col span={{ base: 12, lg: 5 }}>
            <Card
              p="xl"
              radius="lg"
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid rgba(226, 232, 240, 0.8)',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                borderRadius: 16,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <Group justify="space-between" align="center" mb="lg">
                  <Text fw={700} size="md" style={{ color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 12 }}>
                    Model Hiperparametreleri
                  </Text>
                  <Badge variant="light" color="indigo" size="sm" radius="sm">
                    Hyperparams
                  </Badge>
                </Group>

                <Stack gap="lg">
                  {/* Aktif Model Seçici */}
                  <Select
                    label="Aktif Yerel LLM Modeli"
                    description="Ollama üzerinde yüklü olan ve sohbette kullanılan aktif model."
                    placeholder="Model seçin..."
                    data={availableModels}
                    value={selectedModel}
                    onChange={(val) => val && handleModelChange(val)}
                    disabled={modelLoading}
                    leftSection={<Cpu size={16} color="#64748b" />}
                    styles={{
                      input: {
                        borderRadius: 8,
                        borderColor: '#e2e8f0',
                        fontSize: 13,
                        height: 40,
                        backgroundColor: '#ffffff',
                        color: '#0f172a',
                        fontWeight: 500,
                      },
                      label: { fontSize: 13, fontWeight: 600, color: '#1e293b' },
                      description: { fontSize: 11, color: '#64748b', marginBottom: 6 },
                    }}
                  />

                  {/* Temperature Slider */}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <Group justify="space-between" mb={6}>
                      <Text size="xs" fw={600} style={{ color: '#1e293b' }}>
                        Sıcaklık / Yaratıcılık (Temperature)
                      </Text>
                      <span style={{
                        backgroundColor: '#f1f5f9',
                        color: '#334155',
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 6,
                        border: '1px solid #e2e8f0',
                      }}>
                        {temperature}
                      </span>
                    </Group>

                    <Slider
                      value={temperature}
                      onChange={setTemperature}
                      min={0}
                      max={1}
                      step={0.05}
                      label={null}
                      styles={{
                        track: { height: 4, backgroundColor: '#e2e8f0', borderRadius: 2 },
                        bar: { height: 4, backgroundColor: '#4f46e5', borderRadius: 2 },
                        thumb: {
                          height: 16,
                          width: 16,
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#ffffff',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          cursor: 'pointer',
                        },
                      }}
                    />
                    <Text size="xs" style={{ color: '#64748b', marginTop: 8, lineHeight: 1.5 }}>
                      Düşük değerler (0.1 - 0.3) yanıtların belgelere kesin sadık kalmasını sağlar. Yüksek değerler yaratıcılığı artırır.
                    </Text>
                  </div>

                  {/* Top_P Slider */}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <Group justify="space-between" mb={6}>
                      <Text size="xs" fw={600} style={{ color: '#1e293b' }}>
                        Top_P (Nucleus Sampling)
                      </Text>
                      <span style={{
                        backgroundColor: '#f1f5f9',
                        color: '#334155',
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 6,
                        border: '1px solid #e2e8f0',
                      }}>
                        {topP}
                      </span>
                    </Group>

                    <Slider
                      value={topP}
                      onChange={setTopP}
                      min={0}
                      max={1}
                      step={0.05}
                      label={null}
                      styles={{
                        track: { height: 4, backgroundColor: '#e2e8f0', borderRadius: 2 },
                        bar: { height: 4, backgroundColor: '#0284c7', borderRadius: 2 },
                        thumb: {
                          height: 16,
                          width: 16,
                          border: '1px solid #cbd5e1',
                          backgroundColor: '#ffffff',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                          cursor: 'pointer',
                        },
                      }}
                    />
                    <Text size="xs" style={{ color: '#64748b', marginTop: 8, lineHeight: 1.5 }}>
                      Olasılık birikimi örnekleme eşiği. Varsayılan: 0.9
                    </Text>
                  </div>

                  {/* Max Tokens */}
                  <NumberInput
                    label="Maksimum Yanıt Uzunluğu (Max Tokens)"
                    description="Modelin tek seferde üretebileceği maksimum token/kelime sınırı."
                    value={maxTokens}
                    onChange={(val) => setMaxTokens(Number(val) || 2048)}
                    min={256}
                    max={8192}
                    step={256}
                    styles={{
                      input: {
                        borderRadius: 8,
                        borderColor: '#e2e8f0',
                        fontSize: 13,
                        height: 40,
                        backgroundColor: '#ffffff',
                        color: '#0f172a',
                        fontWeight: 500,
                      },
                      label: { fontSize: 13, fontWeight: 600, color: '#1e293b' },
                      description: { fontSize: 11, color: '#64748b', marginBottom: 6 },
                    }}
                  />
                </Stack>
              </div>
            </Card>
          </Grid.Col>

          {/* 2. SAĞ KART: Dinamik Tabs & Sistem Promptları (col-span-7) */}
          <Grid.Col span={{ base: 12, lg: 7 }}>
            <Card
              p="xl"
              radius="lg"
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid rgba(226, 232, 240, 0.8)',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                borderRadius: 16,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <Group justify="space-between" align="center" mb="sm">
                  <Text fw={700} size="md" style={{ color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: 12 }}>
                    Sistem Promptları (System Prompts)
                  </Text>
                  <Badge variant="light" color="cyan" size="sm" radius="sm">
                    Prompt Editor
                  </Badge>
                </Group>

                <Tabs value={activeTab} onChange={(val) => val && setActiveTab(val)} variant="unstyled" radius="md">
                  {/* Segmented Control Tab Bar (Son Derece Belirgin Aktif State) */}
                  <Tabs.List style={{
                    backgroundColor: '#f1f5f9',
                    padding: 5,
                    borderRadius: 12,
                    display: 'flex',
                    gap: 6,
                    marginBottom: 16,
                    border: '1px solid #e2e8f0',
                  }}>
                    <Tabs.Tab
                      value="rag"
                      leftSection={<FileCode size={15} color={activeTab === 'rag' ? '#4f46e5' : '#94a3b8'} />}
                      rightSection={activeTab === 'rag' ? <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#4f46e5' }} /> : null}
                      style={{
                        flex: 1,
                        borderRadius: 8,
                        padding: '9px 14px',
                        fontSize: 12.5,
                        fontWeight: activeTab === 'rag' ? 700 : 500,
                        color: activeTab === 'rag' ? '#4f46e5' : '#64748b',
                        backgroundColor: activeTab === 'rag' ? '#ffffff' : 'transparent',
                        border: activeTab === 'rag' ? '1px solid #c7d2fe' : '1px solid transparent',
                        boxShadow: activeTab === 'rag' ? '0 2px 8px rgba(79, 70, 229, 0.15), 0 1px 2px rgba(0, 0, 0, 0.04)' : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        textAlign: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      RAG Bilgi Asistanı
                    </Tabs.Tab>

                    <Tabs.Tab
                      value="chitchat"
                      leftSection={<MessageSquareCode size={15} color={activeTab === 'chitchat' ? '#4f46e5' : '#94a3b8'} />}
                      rightSection={activeTab === 'chitchat' ? <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#4f46e5' }} /> : null}
                      style={{
                        flex: 1,
                        borderRadius: 8,
                        padding: '9px 14px',
                        fontSize: 12.5,
                        fontWeight: activeTab === 'chitchat' ? 700 : 500,
                        color: activeTab === 'chitchat' ? '#4f46e5' : '#64748b',
                        backgroundColor: activeTab === 'chitchat' ? '#ffffff' : 'transparent',
                        border: activeTab === 'chitchat' ? '1px solid #c7d2fe' : '1px solid transparent',
                        boxShadow: activeTab === 'chitchat' ? '0 2px 8px rgba(79, 70, 229, 0.15), 0 1px 2px rgba(0, 0, 0, 0.04)' : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        textAlign: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      Sohbet & Karşılama
                    </Tabs.Tab>

                    <Tabs.Tab
                      value="classify"
                      leftSection={<HelpCircle size={15} color={activeTab === 'classify' ? '#4f46e5' : '#94a3b8'} />}
                      rightSection={activeTab === 'classify' ? <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#4f46e5' }} /> : null}
                      style={{
                        flex: 1,
                        borderRadius: 8,
                        padding: '9px 14px',
                        fontSize: 12.5,
                        fontWeight: activeTab === 'classify' ? 700 : 500,
                        color: activeTab === 'classify' ? '#4f46e5' : '#64748b',
                        backgroundColor: activeTab === 'classify' ? '#ffffff' : 'transparent',
                        border: activeTab === 'classify' ? '1px solid #c7d2fe' : '1px solid transparent',
                        boxShadow: activeTab === 'classify' ? '0 2px 8px rgba(79, 70, 229, 0.15), 0 1px 2px rgba(0, 0, 0, 0.04)' : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        textAlign: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      Niyet Sınıflandırıcı
                    </Tabs.Tab>
                  </Tabs.List>

                  {/* RAG Panel */}
                  <Tabs.Panel value="rag">
                    <Textarea
                      label="RAG Kurumsal Bilgi Asistanı Promptu"
                      description="Belgeler üzerinden yanıt verirken modele verilen ana yönlendirme talimatı."
                      rows={11}
                      value={promptRag}
                      onChange={(e) => setPromptRag(e.target.value)}
                      styles={{
                        input: {
                          backgroundColor: '#f8fafc',
                          color: '#0f172a',
                          fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, monospace",
                          fontSize: 12.5,
                          lineHeight: 1.7,
                          padding: 16,
                          borderRadius: 12,
                          border: '1px solid #e2e8f0',
                          boxShadow: 'inset 0 1px 3px rgba(15, 23, 42, 0.04)',
                          minHeight: 280,
                          transition: 'all 0.2s ease',
                        },
                        label: { fontSize: 13.5, fontWeight: 600, color: '#0f172a', marginBottom: 4, letterSpacing: '-0.01em' },
                        description: { fontSize: 12, color: '#64748b', marginBottom: 10, lineHeight: 1.4 },
                      }}
                    />
                  </Tabs.Panel>

                  {/* Chitchat Panel */}
                  <Tabs.Panel value="chitchat">
                    <Textarea
                      label="Sohbet & Karşılama (Chitchat) Promptu"
                      description="Kullanıcının selamlaşma, hal-hatır sorma taleplerine verilen kurumsal yanıt talimatı."
                      rows={11}
                      value={promptChitchat}
                      onChange={(e) => setPromptChitchat(e.target.value)}
                      styles={{
                        input: {
                          backgroundColor: '#f8fafc',
                          color: '#0f172a',
                          fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, monospace",
                          fontSize: 12.5,
                          lineHeight: 1.7,
                          padding: 16,
                          borderRadius: 12,
                          border: '1px solid #e2e8f0',
                          boxShadow: 'inset 0 1px 3px rgba(15, 23, 42, 0.04)',
                          minHeight: 280,
                          transition: 'all 0.2s ease',
                        },
                        label: { fontSize: 13.5, fontWeight: 600, color: '#0f172a', marginBottom: 4, letterSpacing: '-0.01em' },
                        description: { fontSize: 12, color: '#64748b', marginBottom: 10, lineHeight: 1.4 },
                      }}
                    />
                  </Tabs.Panel>

                  {/* Classifier Panel */}
                  <Tabs.Panel value="classify">
                    <Textarea
                      label="Niyet Sınıflandırıcı (Query Classifier) Promptu"
                      description="Gelen sorunun RAG mi yoksa genel sohbet mi olduğuna karar veren sınıflandırma talimatı."
                      rows={11}
                      value={promptClassify}
                      onChange={(e) => setPromptClassify(e.target.value)}
                      styles={{
                        input: {
                          backgroundColor: '#f8fafc',
                          color: '#0f172a',
                          fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, monospace",
                          fontSize: 12.5,
                          lineHeight: 1.7,
                          padding: 16,
                          borderRadius: 12,
                          border: '1px solid #e2e8f0',
                          boxShadow: 'inset 0 1px 3px rgba(15, 23, 42, 0.04)',
                          minHeight: 280,
                          transition: 'all 0.2s ease',
                        },
                        label: { fontSize: 13.5, fontWeight: 600, color: '#0f172a', marginBottom: 4, letterSpacing: '-0.01em' },
                        description: { fontSize: 12, color: '#64748b', marginBottom: 10, lineHeight: 1.4 },
                      }}
                    />
                  </Tabs.Panel>
                </Tabs>
              </div>
            </Card>
          </Grid.Col>
        </Grid>
      </Stack>

      {/* ── Redis Önbellek Yönetimi (En Alt Sıra) ── */}
      <Paper
        p="lg"
        radius="lg"
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid rgba(226, 232, 240, 0.8)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          borderRadius: 16,
        }}
      >
        <Group justify="space-between" align="center">
          <Group gap="md">
            <div style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              backgroundColor: '#fee2e2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid #fecaca',
            }}>
              <Zap size={20} color="#dc2626" />
            </div>
            <div>
              <Group gap="xs" align="center">
                <Text fw={700} size="md" style={{ color: '#0f172a', letterSpacing: '-0.01em' }}>
                  Redis Önbellek (Semantic Cache) Yönetimi
                </Text>
                <Badge
                  color={cacheStats?.status === 'connected' ? 'green' : 'red'}
                  variant="light"
                  size="sm"
                >
                  {cacheStats?.status === 'connected' ? 'Redis Bağlandı' : 'Bağlantı Yok'}
                </Badge>
              </Group>
              <Text size="xs" style={{ color: '#64748b', marginTop: 2 }}>
                Sık sorulan soruların semantik yanıt kayıtlarını ve önbellek belleğini anlık görüntüleyin.
              </Text>
            </div>
          </Group>

          {/* Önbelleği Sıfırla Butonu */}
          <Button
            color="red"
            variant="light"
            onClick={handleClearCache}
            loading={clearingCache}
            leftSection={<Trash2 size={15} />}
            style={{
              fontWeight: 600,
              fontSize: 13,
              borderRadius: 8,
              height: 38,
              transition: 'all 0.15s ease',
            }}
          >
            Önbelleği Sıfırla
          </Button>
        </Group>

        <Divider my="md" style={{ borderColor: '#f1f5f9' }} />

        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          <Paper p="sm" radius="md" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <Group justify="space-between" align="center">
              <div>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">Toplam Kayıtlı Anahtar (Keys)</Text>
                <Text size="lg" fw={700} style={{ color: '#0f172a' }} mt={2}>
                  {cacheStats ? `${cacheStats.total_keys} Anahtar` : '—'}
                </Text>
              </div>
              <ThemeIcon color="red" variant="light" size="lg" radius="md">
                <Database size={18} />
              </ThemeIcon>
            </Group>
          </Paper>

          <Paper p="sm" radius="md" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <Group justify="space-between" align="center">
              <div>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">Bellek Kullanımı (RAM)</Text>
                <Text size="lg" fw={700} style={{ color: '#0f172a' }} mt={2}>
                  {cacheStats ? cacheStats.used_memory_human : '—'}
                </Text>
              </div>
              <ThemeIcon color="orange" variant="light" size="lg" radius="md">
                <HardDrive size={18} />
              </ThemeIcon>
            </Group>
          </Paper>

          <Paper p="sm" radius="md" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <Group justify="space-between" align="center">
              <div>
                <Text size="xs" c="dimmed" fw={600} tt="uppercase">Semantik Cache TTL Süresi</Text>
                <Text size="lg" fw={700} style={{ color: '#0f172a' }} mt={2}>
                  24 Saat (Otomatik)
                </Text>
              </div>
              <ThemeIcon color="blue" variant="light" size="lg" radius="md">
                <RotateCcw size={18} />
              </ThemeIcon>
            </Group>
          </Paper>
        </SimpleGrid>
      </Paper>
    </Stack>
  );
};

export default DashboardPage;
