import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogOut, Settings, Info } from 'lucide-react';

const Admin = () => {
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [helpdeskInfo, setHelpdeskInfo] = useState('');
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
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Keluar
          </Button>
        </div>

        <Tabs defaultValue="api" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="api">
              <Settings className="mr-2 h-4 w-4" />
              Pengaturan API
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