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
import { Loader2, LogOut, Settings, Info, Home, Image, Upload } from 'lucide-react';

const Admin = () => {
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [helpdeskInfo, setHelpdeskInfo] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoHeader, setLogoHeader] = useState('');
  const [logoChatbot, setLogoChatbot] = useState('');
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [faviconUrl, setFaviconUrl] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
    loadSettings();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/auth');
    }
  };

  const loadSettings = async () => {
    try {
      // Load API key
      const { data: apiKeyData } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'gemini_api_key')
        .single();

      if (apiKeyData) {
        setApiKey(apiKeyData.value || '');
      }

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
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const testConnection = async () => {
    if (!apiKey.trim()) {
      toast({
        title: 'Error',
        description: 'Masukkan API key terlebih dahulu',
        variant: 'destructive',
      });
      return;
    }

    setTestingConnection(true);

    try {
      const { data, error } = await supabase.functions.invoke('test-gemini', {
        body: { apiKey }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: 'Berhasil',
          description: data.message,
        });
      } else {
        toast({
          title: 'Gagal',
          description: data.error || 'Koneksi gagal',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Test connection error:', error);
      toast({
        title: 'Error',
        description: 'Terjadi kesalahan saat menguji koneksi',
        variant: 'destructive',
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const saveApiKey = async () => {
    setLoading(true);

    try {
      const { error } = await supabase
        .from('settings')
        .upsert({
          key: 'gemini_api_key',
          value: apiKey,
        });

      if (error) throw error;

      toast({
        title: 'Berhasil',
        description: 'API key berhasil disimpan',
      });
    } catch (error) {
      console.error('Error saving API key:', error);
      toast({
        title: 'Error',
        description: 'Gagal menyimpan API key',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
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
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="api">
              <Settings className="mr-2 h-4 w-4" />
              Pengaturan API
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
              Info Help Desk
            </TabsTrigger>
          </TabsList>

          <TabsContent value="api">
            <Card className="shadow-medium">
              <CardHeader>
                <CardTitle>Gemini API Key</CardTitle>
                <CardDescription>
                  Konfigurasi API key untuk menggunakan Gemini AI
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="apikey">API Key</Label>
                  <Input
                    id="apikey"
                    type="password"
                    placeholder="Masukkan Gemini API key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Dapatkan API key dari{' '}
                    <a 
                      href="https://makersuite.google.com/app/apikey" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      Google AI Studio
                    </a>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    onClick={testConnection} 
                    variant="outline"
                    disabled={testingConnection || !apiKey.trim()}
                  >
                    {testingConnection ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Menguji...
                      </>
                    ) : (
                      'Cek Koneksi'
                    )}
                  </Button>
                  <Button 
                    onClick={saveApiKey}
                    disabled={loading || !apiKey.trim()}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      'Simpan API Key'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;