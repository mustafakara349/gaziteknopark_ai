import React, { useEffect, useState } from 'react';
import { 
  Card, Text, Group, Button, Table, FileInput, 
  Select, Badge, Progress, ActionIcon, Stack, Grid, 
  TextInput, Paper, LoadingOverlay
} from '@mantine/core';
import { 
  Upload, Trash2, FolderPlus, RefreshCw, FileText, 
  CheckCircle, AlertTriangle, Loader2 
} from 'lucide-react';
import { notifications } from '@mantine/notifications';
import apiClient from '../../../core/api-client';
import { useAuthStore } from '../../../store/auth-store';

interface DocumentInfo {
  id: string;
  title: string;
  file_size: number;
  file_type: string;
  collection_id: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  version: number;
  metadata: Record<string, any>;
  error_message: string | null;
  created_at: string;
}

interface CollectionInfo {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export const DocumentPage: React.FC = () => {
  const { role } = useAuthStore();
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [selectedCol, setSelectedCol] = useState<string | null>(null);
  
  // Yükleme form state'leri
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [targetCollectionId, setTargetCollectionId] = useState<string | null>(null);
  
  // Koleksiyon oluşturma form state'leri
  const [newColName, setNewColName] = useState('');
  const [newColDesc, setNewColDesc] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [docsRes, colsRes] = await Promise.all([
        apiClient.get<DocumentInfo[]>('/documents'),
        apiClient.get<CollectionInfo[]>('/documents/collections')
      ]);
      setDocuments(docsRes.data);
      setCollections(colsRes.data);
    } catch (error) {
      notifications.show({
        title: 'Veri Çekme Hatası',
        message: 'Belgeler ve koleksiyonlar yüklenemedi.',
        color: 'red',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim()) return;

    try {
      await apiClient.post('/documents/collections', {
        name: newColName,
        description: newColDesc
      });
      setNewColName('');
      setNewColDesc('');
      notifications.show({
        title: 'Başarılı',
        message: 'Koleksiyon başarıyla oluşturuldu.',
        color: 'green',
      });
      fetchData();
    } catch (error) {
      notifications.show({
        title: 'Hata',
        message: 'Koleksiyon oluşturulamadı.',
        color: 'red',
      });
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileToUpload) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', fileToUpload);
    if (targetCollectionId) {
      formData.append('collection_id', targetCollectionId);
    }

    try {
      await apiClient.post('/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      setFileToUpload(null);
      notifications.show({
        title: 'Yükleme Tetiklendi',
        message: 'Belge asenkron işleme kuyruğuna alındı.',
        color: 'blue',
      });
      fetchData();
    } catch (error: any) {
      notifications.show({
        title: 'Yükleme Hatası',
        message: error.response?.data?.detail || 'Belge yüklenemedi.',
        color: 'red',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm('Bu belgeyi silmek istediğinize emin misiniz? Tüm vektör kayıtları temizlenecektir.')) return;

    try {
      await apiClient.delete(`/documents/${docId}`);
      notifications.show({
        title: 'Belge Silindi',
        message: 'Belge ve ilişkili vektör chunkları kaldırıldı.',
        color: 'green',
      });
      fetchData();
    } catch (error) {
      notifications.show({
        title: 'Hata',
        message: 'Belge silinemedi.',
        color: 'red',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge color="green" leftSection={<CheckCircle size={12} />}>İndekslendi</Badge>;
      case 'processing':
        return <Badge color="blue" leftSection={<Loader2 size={12} className="spin-animation" />} className="pulse-animation">İşleniyor</Badge>;
      case 'failed':
        return <Badge color="red" leftSection={<AlertTriangle size={12} />}>Başarısız</Badge>;
      default:
        return <Badge color="gray">Kuyrukta</Badge>;
    }
  };

  return (
    <Stack gap="md" style={{ position: 'relative' }}>
      <LoadingOverlay visible={loading} zIndex={1000} overlayProps={{ blur: 1 }} />
      
      {/* Üst Başlık ve Yenile */}
      <Group justify="space-between">
        <Text size="xl" fw={700}>
          Belge ve Koleksiyon Yönetimi
        </Text>
        <Button 
          variant="subtle" 
          leftSection={<RefreshCw size={16} />}
          onClick={fetchData}
          style={{ color: '#1b365d' }}
        >
          Yenile
        </Button>
      </Group>

      <Grid gutter="md">
        {/* Sol Sütun: Belge Listesi */}
        <Grid.Col span={{ base: 12, md: 8 }}>
          <Card shadow="xs" p="md" radius="md" withBorder>
            <Text fw={600} mb="md">İndekslenmiş Belgeler</Text>
            
            <Table.ScrollContainer minWidth={600}>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th style={{ width: '320px', minWidth: '240px' }}>Belge Adı</Table.Th>
                    <Table.Th>Dosya Tipi</Table.Th>
                    <Table.Th>Boyut</Table.Th>
                    <Table.Th>Koleksiyon</Table.Th>
                    <Table.Th>İşlem Durumu</Table.Th>
                    {role === 'admin' && <Table.Th style={{ width: 80 }}></Table.Th>}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {documents.length === 0 ? (
                    <Table.Tr>
                      <Table.Td colSpan={role === 'admin' ? 6 : 5} style={{ textAlign: 'center', color: '#868e96' }}>
                        Henüz hiç belge yüklenmemiş.
                      </Table.Td>
                    </Table.Tr>
                  ) : (
                    documents.map((doc) => {
                      const colName = collections.find(c => c.id === doc.collection_id)?.name || 'Genel';
                      return (
                        <Table.Tr key={doc.id}>
                          <Table.Td style={{ maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <Group gap="xs" style={{ flexWrap: 'nowrap' }}>
                              <FileText size={16} color="#1b365d" style={{ flexShrink: 0 }} />
                              <Text size="sm" fw={500} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</Text>
                            </Group>
                          </Table.Td>
                          <Table.Td>{doc.file_type.toUpperCase()}</Table.Td>
                          <Table.Td>{(doc.file_size / (1024 * 1024)).toFixed(2)} MB</Table.Td>
                          <Table.Td>
                            <Badge variant="outline" color="gray">
                              {colName}
                            </Badge>
                          </Table.Td>
                          <Table.Td>{getStatusBadge(doc.status)}</Table.Td>
                          {role === 'admin' && (
                            <Table.Td>
                              <ActionIcon 
                                color="red" 
                                variant="light" 
                                onClick={() => handleDelete(doc.id)}
                              >
                                <Trash2 size={16} />
                              </ActionIcon>
                            </Table.Td>
                          )}
                        </Table.Tr>
                      );
                    })
                  )}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Card>
        </Grid.Col>

        {/* Sağ Sütun: Belge Yükleme ve Koleksiyon Oluşturma */}
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Stack gap="md">
            {/* Belge Yükleme Kartı */}
            <Card shadow="xs" p="md" radius="md" withBorder>
              <Text fw={600} mb="md">Yeni Belge İndeksle</Text>
              
              <form onSubmit={handleUpload}>
                <FileInput
                  placeholder="Dosya seçin veya sürükleyin"
                  label="Belge Seç (PDF, Word, Excel, PPTX, TXT)"
                  description="Maksimum 50MB boyuta kadar"
                  required
                  value={fileToUpload}
                  onChange={setFileToUpload}
                  mb="md"
                />
                
                <Select
                  label="Hedef Koleksiyon (Opsiyonel)"
                  placeholder="Seçiniz..."
                  data={collections.map(c => ({ value: c.id, label: c.name }))}
                  value={targetCollectionId}
                  onChange={setTargetCollectionId}
                  mb="md"
                  clearable
                />
                
                <Button 
                  type="submit" 
                  fullWidth 
                  loading={uploading}
                  leftSection={<Upload size={16} />}
                >
                  Yükle ve İndekslemeyi Başlat
                </Button>
              </form>
            </Card>

            {/* Koleksiyon Ekleme Kartı (Yalnızca Admin) */}
            {role === 'admin' && (
              <Card shadow="xs" p="md" radius="md" withBorder>
                <Text fw={600} mb="md">Koleksiyon (Departman) Oluştur</Text>
                
                <form onSubmit={handleCreateCollection}>
                  <TextInput
                    label="Koleksiyon Adı"
                    placeholder="Örn: İnsan Kaynakları"
                    required
                    value={newColName}
                    onChange={(e) => setNewColName(e.currentTarget.value)}
                    mb="md"
                  />
                  
                  <TextInput
                    label="Açıklama"
                    placeholder="Departman açıklaması veya kapsamı"
                    value={newColDesc}
                    onChange={(e) => setNewColDesc(e.currentTarget.value)}
                    mb="md"
                  />
                  
                  <Button 
                    type="submit" 
                    fullWidth 
                    color="gray"
                    leftSection={<FolderPlus size={16} />}
                  >
                    Koleksiyon Oluştur
                  </Button>
                </form>
              </Card>
            )}
          </Stack>
        </Grid.Col>
      </Grid>
    </Stack>
  );
};

export default DocumentPage;
