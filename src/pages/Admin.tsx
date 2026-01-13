import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogOut, Settings, Info, Home, Image, Upload, FileText, Globe, Video, ChevronDown, Phone, Code } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import EmbedSettings from '@/components/admin/EmbedSettings';

const Admin = () => {
  const [loading, setLoading] = useState(false);
  const [helpdeskInfo, setHelpdeskInfo] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoHeader, setLogoHeader] = useState('');
  const [logoChatbot, setLogoChatbot] = useState('');
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [faviconUrl, setFaviconUrl] = useState('');
  
  // Knowledge base states
  const [knowledgeBase, setKnowledgeBase] = useState<any[]>([]);
  const [isLoadingKnowledge, setIsLoadingKnowledge] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [selectedKnowledge, setSelectedKnowledge] = useState<any>(null);
  const [editingSummary, setEditingSummary] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [isProcessingUrl, setIsProcessingUrl] = useState(false);
  
  // Contact states
  const [contactWhatsapp, setContactWhatsapp] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactHours, setContactHours] = useState("");
  const [savingContacts, setSavingContacts] = useState(false);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
    loadSettings();
    loadKnowledgeBase();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
    }
  };

  const loadSettings = async () => {
    try {
      // Load logo URLs
      const { data: logoHeaderData } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'logo_header')
        .maybeSingle();

      if (logoHeaderData) {
        setLogoHeader(logoHeaderData.value || '');
      }

      const { data: logoChatbotData } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'logo_chatbot')
        .maybeSingle();

      if (logoChatbotData) {
        setLogoChatbot(logoChatbotData.value || '');
      }

      // Load favicon URL
      const { data: faviconData } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'favicon_url')
        .maybeSingle();

      if (faviconData) {
        setFaviconUrl(faviconData.value || '');
      }

      // Load helpdesk info
      const { data: helpdeskData } = await supabase
        .from('helpdesk_info')
        .select('content')
        .single();

      if (helpdeskData) {
        setHelpdeskInfo(helpdeskData.content || '');
      }

      // Load contact settings
      const { data: contactData } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['contact_whatsapp', 'contact_email', 'contact_phone', 'contact_hours']);

      if (contactData) {
        contactData.forEach(item => {
          if (item.key === 'contact_whatsapp') setContactWhatsapp(item.value || '');
          if (item.key === 'contact_email') setContactEmail(item.value || '');
          if (item.key === 'contact_phone') setContactPhone(item.value || '');
          if (item.key === 'contact_hours') setContactHours(item.value || '');
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const loadKnowledgeBase = async () => {
    setIsLoadingKnowledge(true);
    try {
      const { data, error } = await supabase
        .from('knowledge_base')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setKnowledgeBase(data || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Gagal memuat knowledge base: ' + error.message,
        variant: 'destructive',
      });
    } finally {
      setIsLoadingKnowledge(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      toast({
        title: 'Error',
        description: 'Hanya file PDF yang diperbolehkan',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'Error',
        description: 'Ukuran file maksimal 10MB',
        variant: 'destructive',
      });
      return;
    }

    setIsUploadingPdf(true);
    try {
      const fileName = `${Date.now()}-${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: functionData, error: functionError } = await supabase.functions.invoke('process-document', {
        body: { filePath: fileName, title: file.name.replace('.pdf', '') }
      });

      if (functionError) throw functionError;

      toast({
        title: 'Berhasil',
        description: 'PDF berhasil diupload dan diproses!',
      });
      loadKnowledgeBase();
      e.target.value = '';
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: 'Error',
        description: 'Gagal mengupload PDF: ' + error.message,
        variant: 'destructive',
      });
    } finally {
      setIsUploadingPdf(false);
    }
  };

  const handleUrlSubmit = async (type: 'website' | 'video') => {
    const url = type === 'website' ? websiteUrl : videoUrl;
    if (!url) {
      toast({
        title: "Error",
        description: "Masukkan URL yang valid",
        variant: "destructive",
      });
      return;
    }

    setIsProcessingUrl(true);
    try {
      const { data: functionData, error: functionError } = await supabase.functions.invoke(
        'process-url',
        {
          body: { url, type }
        }
      );

      if (functionError) throw functionError;

      toast({
        title: "Berhasil",
        description: `${type === 'website' ? 'Website' : 'Video'} berhasil diproses!`,
      });

      if (type === 'website') {
        setWebsiteUrl('');
      } else {
        setVideoUrl('');
      }
      loadKnowledgeBase();
    } catch (error: any) {
      console.error(`Error processing ${type}:`, error);
      toast({
        title: "Error",
        description: `Gagal memproses ${type}: ` + error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessingUrl(false);
    }
  };

  const handleDeleteKnowledge = async (id: string, filePath?: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus item ini?')) return;

    try {
      const { error: dbError } = await supabase
        .from('knowledge_base')
        .delete()
        .eq('id', id);

      if (dbError) throw dbError;

      if (filePath) {
        await supabase.storage.from('documents').remove([filePath]);
      }

      toast({
        title: 'Berhasil',
        description: 'Item berhasil dihapus',
      });
      loadKnowledgeBase();
      setSelectedKnowledge(null);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Gagal menghapus item: ' + error.message,
        variant: 'destructive',
      });
    }
  };

  const handleUpdateSummary = async () => {
    if (!selectedKnowledge) return;

    try {
      const { error } = await supabase
        .from('knowledge_base')
        .update({ summary: editingSummary })
        .eq('id', selectedKnowledge.id);

      if (error) throw error;

      toast({
        title: 'Berhasil',
        description: 'Rangkuman berhasil diupdate',
      });
      loadKnowledgeBase();
      setSelectedKnowledge(null);
      setEditingSummary('');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Gagal mengupdate rangkuman: ' + error.message,
        variant: 'destructive',
      });
    }
  };

  const handleLogoUpload = async (file: File, type: 'header' | 'chatbot') => {
    setUploadingLogo(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${type}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('logos')
        .getPublicUrl(filePath);

      // Save URL to settings
      const settingKey = type === 'header' ? 'logo_header' : 'logo_chatbot';
      const { error: settingsError } = await supabase
        .from('settings')
        .upsert({
          key: settingKey,
          value: publicUrl,
        });

      if (settingsError) throw settingsError;

      if (type === 'header') {
        setLogoHeader(publicUrl);
      } else {
        setLogoChatbot(publicUrl);
      }

      toast({
        title: 'Berhasil',
        description: `Logo ${type === 'header' ? 'header' : 'chatbot'} berhasil diupload`,
      });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: 'Error',
        description: 'Gagal mengupload logo',
        variant: 'destructive',
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const saveHelpdeskInfo = async () => {
    setLoading(true);

    try {
      // Check if record exists
      const { data: existing } = await supabase
        .from('helpdesk_info')
        .select('id')
        .single();

      if (existing) {
        // Update existing record
        const { error } = await supabase
          .from('helpdesk_info')
          .update({ content: helpdeskInfo })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insert new record
        const { error } = await supabase
          .from('helpdesk_info')
          .insert({ content: helpdeskInfo });

        if (error) throw error;
      }

      toast({
        title: 'Berhasil',
        description: 'Informasi Help Desk berhasil disimpan',
      });
    } catch (error) {
      console.error('Error saving helpdesk info:', error);
      toast({
        title: 'Error',
        description: 'Gagal menyimpan informasi Help Desk',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const saveContacts = async () => {
    setSavingContacts(true);

    try {
      const contactSettings = [
        { key: 'contact_whatsapp', value: contactWhatsapp },
        { key: 'contact_email', value: contactEmail },
        { key: 'contact_phone', value: contactPhone },
        { key: 'contact_hours', value: contactHours },
      ];

      for (const setting of contactSettings) {
        const { error } = await supabase
          .from('settings')
          .upsert(setting);

        if (error) throw error;
      }

      toast({
        title: 'Berhasil',
        description: 'Informasi kontak berhasil disimpan',
      });
    } catch (error) {
      console.error('Error saving contacts:', error);
      toast({
        title: 'Error',
        description: 'Gagal menyimpan informasi kontak',
        variant: 'destructive',
      });
    } finally {
      setSavingContacts(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary to-background p-4">
      <div className="max-w-4xl mx-auto space-y-6 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Admin Panel</h1>
            <p className="text-muted-foreground">Kelola Help Desk UPT PJJ</p>
          </div>
          <div className="flex gap-2">
            <Link to="/">
              <Button variant="outline">
                <Home className="mr-2 h-4 w-4" />
                Home
              </Button>
            </Link>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Keluar
            </Button>
          </div>
        </div>

        <Tabs defaultValue="api" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="api">
              <Settings className="mr-2 h-4 w-4" />
              API
            </TabsTrigger>
            <TabsTrigger value="knowledge">
              <FileText className="mr-2 h-4 w-4" />
              Knowledge
            </TabsTrigger>
            <TabsTrigger value="logos">
              <Image className="mr-2 h-4 w-4" />
              Logo
            </TabsTrigger>
            <TabsTrigger value="favicon">
              <Upload className="mr-2 h-4 w-4" />
              Favicon
            </TabsTrigger>
            <TabsTrigger value="info">
              <Info className="mr-2 h-4 w-4" />
              Info
            </TabsTrigger>
            <TabsTrigger value="embed">
              <Code className="mr-2 h-4 w-4" />
              Embed
            </TabsTrigger>
          </TabsList>

          <TabsContent value="api">
            <Card className="shadow-medium">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-primary" />
                  Status AI
                </CardTitle>
                <CardDescription>
                  Konfigurasi AI untuk chatbot Help Desk
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="font-medium">AI Aktif</span>
                  </div>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                    Chatbot menggunakan Lovable AI dan tidak memerlukan konfigurasi API key manual.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="knowledge">
            <Card className="shadow-medium">
              <CardHeader>
                <CardTitle>Tambah ke Knowledge Base</CardTitle>
                <CardDescription>
                  Upload PDF, tambahkan URL website, atau URL video YouTube
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* PDF Upload */}
                <div className="space-y-2">
                  <Label htmlFor="pdf-upload">Upload PDF (Max 10MB)</Label>
                  <Input
                    id="pdf-upload"
                    type="file"
                    accept=".pdf"
                    onChange={handlePdfUpload}
                    disabled={isUploadingPdf}
                  />
                  {isUploadingPdf && (
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Memproses dokumen...
                    </p>
                  )}
                </div>

                <Separator />

                {/* Website URL */}
                <div className="space-y-2">
                  <Label htmlFor="website-url">URL Website</Label>
                  <div className="flex gap-2">
                    <Input
                      id="website-url"
                      type="url"
                      placeholder="https://example.com"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      disabled={isProcessingUrl}
                    />
                    <Button
                      onClick={() => handleUrlSubmit('website')}
                      disabled={isProcessingUrl || !websiteUrl}
                    >
                      {isProcessingUrl ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Proses
                        </>
                      ) : (
                        'Tambah'
                      )}
                    </Button>
                  </div>
                </div>

                <Separator />

                {/* Video URL */}
                <div className="space-y-2">
                  <Label htmlFor="video-url">URL Video YouTube</Label>
                  <div className="flex gap-2">
                    <Input
                      id="video-url"
                      type="url"
                      placeholder="https://youtube.com/watch?v=..."
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      disabled={isProcessingUrl}
                    />
                    <Button
                      onClick={() => handleUrlSubmit('video')}
                      disabled={isProcessingUrl || !videoUrl}
                    >
                      {isProcessingUrl ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Proses
                        </>
                      ) : (
                        'Tambah'
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-medium mt-6">
              <CardHeader>
                <CardTitle>Daftar Knowledge Base</CardTitle>
                <CardDescription>
                  Rangkuman informasi yang telah diproses oleh AI
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingKnowledge ? (
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Memuat...
                  </p>
                ) : knowledgeBase.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada knowledge base</p>
                ) : (
                  <div className="space-y-2">
                    {knowledgeBase.map((kb) => (
                      <Collapsible key={kb.id}>
                        <div className="border rounded-lg">
                          <div className="flex items-center justify-between p-4">
                            <CollapsibleTrigger className="flex items-center gap-2 flex-1 hover:opacity-80 transition-opacity text-left">
                              {kb.source_type === 'pdf' && <FileText className="h-5 w-5 text-blue-500 flex-shrink-0" />}
                              {kb.source_type === 'website' && <Globe className="h-5 w-5 text-green-500 flex-shrink-0" />}
                              {kb.source_type === 'video' && <Video className="h-5 w-5 text-red-500 flex-shrink-0" />}
                              <div className="flex-1 min-w-0">
                                <h4 className="font-medium break-words">{kb.title}</h4>
                                <p className="text-sm text-muted-foreground">
                                  {new Date(kb.created_at).toLocaleDateString('id-ID')}
                                </p>
                              </div>
                              <ChevronDown className="h-5 w-5 transition-transform duration-200 flex-shrink-0" />
                            </CollapsibleTrigger>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleDeleteKnowledge(kb.id, kb.file_path)}
                              className="ml-2"
                            >
                              Hapus
                            </Button>
                          </div>
                          
                          <CollapsibleContent>
                            <div className="px-4 pb-4 border-t pt-4">
                              <div className="flex items-center justify-between mb-2">
                                <Label className="text-sm font-medium">Ringkasan AI:</Label>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedKnowledge(kb);
                                    setEditingSummary(kb.summary || '');
                                  }}
                                >
                                  Edit
                                </Button>
                              </div>
                              <div className="bg-muted p-3 rounded-md text-sm whitespace-pre-wrap">
                                {kb.summary}
                              </div>
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {selectedKnowledge && (
              <Card className="shadow-medium mt-6">
                <CardHeader>
                  <CardTitle>Edit Rangkuman: {selectedKnowledge.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Textarea
                    value={editingSummary}
                    onChange={(e) => setEditingSummary(e.target.value)}
                    rows={10}
                    placeholder="Edit rangkuman..."
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleUpdateSummary}>
                      Simpan Perubahan
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSelectedKnowledge(null);
                        setEditingSummary('');
                      }}
                    >
                      Batal
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="logos">
            <Card className="shadow-medium">
              <CardHeader>
                <CardTitle>Kelola Logo</CardTitle>
                <CardDescription>
                  Upload logo untuk header dan chatbot
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Logo Header */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base">Logo Header</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        Logo yang ditampilkan di header halaman utama
                      </p>
                    </div>
                  </div>
                  {logoHeader && (
                    <div className="border rounded-lg p-4 bg-muted/20">
                      <img 
                        src={logoHeader} 
                        alt="Logo Header" 
                        className="h-16 w-16 object-contain"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleLogoUpload(file, 'header');
                      }}
                      disabled={uploadingLogo}
                      className="flex-1"
                    />
                    {uploadingLogo && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                  </div>
                </div>

                <div className="border-t pt-6">
                  {/* Logo Chatbot */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base">Logo Chatbot</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          Logo yang ditampilkan sebagai avatar chatbot
                        </p>
                      </div>
                    </div>
                    {logoChatbot && (
                      <div className="border rounded-lg p-4 bg-muted/20">
                        <img 
                          src={logoChatbot} 
                          alt="Logo Chatbot" 
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleLogoUpload(file, 'chatbot');
                        }}
                        disabled={uploadingLogo}
                        className="flex-1"
                      />
                      {uploadingLogo && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="favicon">
            <Card className="shadow-medium">
              <CardHeader>
                <CardTitle>Pengaturan Favicon</CardTitle>
                <CardDescription>
                  Upload favicon untuk aplikasi (format: ICO, PNG, atau SVG)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {faviconUrl && (
                  <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50">
                    <img 
                      src={faviconUrl} 
                      alt="Current Favicon" 
                      className="h-8 w-8 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Favicon Saat Ini</p>
                      <p className="text-xs text-muted-foreground truncate">{faviconUrl}</p>
                    </div>
                  </div>
                )}
                
                <div>
                  <Label htmlFor="favicon-upload">Upload Favicon Baru</Label>
                  <Input
                    id="favicon-upload"
                    type="file"
                    accept=".ico,.png,.svg"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      if (file.size > 1024 * 1024) {
                        toast({
                          title: 'Error',
                          description: 'Ukuran file maksimal 1MB',
                          variant: 'destructive',
                        });
                        return;
                      }

                      setUploadingFavicon(true);

                      try {
                        const fileExt = file.name.split('.').pop();
                        const fileName = `favicon-${Date.now()}.${fileExt}`;
                        const filePath = `${fileName}`;

                        const { error: uploadError } = await supabase.storage
                          .from('logos')
                          .upload(filePath, file, { upsert: true });

                        if (uploadError) throw uploadError;

                        const { data: { publicUrl } } = supabase.storage
                          .from('logos')
                          .getPublicUrl(filePath);

                        const { error: saveError } = await supabase
                          .from('settings')
                          .upsert({
                            key: 'favicon_url',
                            value: publicUrl,
                          });

                        if (saveError) throw saveError;

                        setFaviconUrl(publicUrl);

                        const link = document.querySelector("link[rel*='icon']") as HTMLLinkElement || document.createElement('link');
                        link.type = file.type;
                        link.rel = 'icon';
                        link.href = publicUrl;
                        document.getElementsByTagName('head')[0].appendChild(link);

                        toast({
                          title: 'Berhasil',
                          description: 'Favicon berhasil diupload dan diperbarui',
                        });

                        e.target.value = '';
                      } catch (error) {
                        console.error('Error uploading favicon:', error);
                        toast({
                          title: 'Error',
                          description: 'Gagal mengupload favicon',
                          variant: 'destructive',
                        });
                      } finally {
                        setUploadingFavicon(false);
                      }
                    }}
                    disabled={uploadingFavicon}
                  />
                  {uploadingFavicon && (
                    <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Mengupload favicon...
                    </p>
                  )}
                </div>

                <div className="text-sm text-muted-foreground space-y-1">
                  <p className="font-medium">Tips:</p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>Ukuran yang direkomendasikan: 16x16, 32x32, atau 48x48 pixels</li>
                    <li>Format ICO untuk kompatibilitas terbaik</li>
                    <li>PNG atau SVG juga didukung oleh browser modern</li>
                    <li>Favicon akan diperbarui otomatis setelah upload</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="info">
            <Card className="shadow-medium">
              <CardHeader>
                <CardTitle>Informasi Help Desk</CardTitle>
                <CardDescription>
                  Masukkan informasi yang akan digunakan chatbot untuk menjawab pertanyaan
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="helpdesk">Konten Informasi</Label>
                  <Textarea
                    id="helpdesk"
                    placeholder="Masukkan informasi lengkap tentang Help Desk UPT PJJ..."
                    value={helpdeskInfo}
                    onChange={(e) => setHelpdeskInfo(e.target.value)}
                    disabled={loading}
                    rows={15}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    Chatbot akan menggunakan informasi ini untuk menjawab pertanyaan pengguna
                  </p>
                </div>
                <Button 
                  onClick={saveHelpdeskInfo}
                  disabled={loading || !helpdeskInfo.trim()}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    'Simpan Informasi'
                  )}
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-medium mt-6">
              <CardHeader>
                <CardTitle>Kontak Bantuan</CardTitle>
                <CardDescription>
                  Informasi kontak yang ditampilkan jika chatbot tidak bisa menjawab pertanyaan
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact-whatsapp">WhatsApp</Label>
                    <Input
                      id="contact-whatsapp"
                      placeholder="0812-3456-7890"
                      value={contactWhatsapp}
                      onChange={(e) => setContactWhatsapp(e.target.value)}
                      disabled={savingContacts}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-email">Email</Label>
                    <Input
                      id="contact-email"
                      type="email"
                      placeholder="uptpjj@uinssc.ac.id"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      disabled={savingContacts}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-phone">Telepon</Label>
                    <Input
                      id="contact-phone"
                      placeholder="(0231) 123456"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      disabled={savingContacts}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-hours">Jam Operasional</Label>
                    <Input
                      id="contact-hours"
                      placeholder="Senin-Jumat, 08.00-16.00 WIB"
                      value={contactHours}
                      onChange={(e) => setContactHours(e.target.value)}
                      disabled={savingContacts}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Kontak ini akan ditampilkan oleh chatbot saat tidak dapat menjawab pertanyaan pengguna
                </p>
                <Button 
                  onClick={saveContacts}
                  disabled={savingContacts}
                >
                  {savingContacts ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Menyimpan...
                    </>
                  ) : (
                    'Simpan Kontak'
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="embed">
            <EmbedSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;