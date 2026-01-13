import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Copy, Check, Code, ExternalLink } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const EmbedSettings = () => {
  const [primaryColor, setPrimaryColor] = useState('#16a34a');
  const [welcomeMessage, setWelcomeMessage] = useState('Halo! Selamat datang di Help Desk UPT PJJ UIN Siber Syekh Nurjati Cirebon. Ada yang bisa saya bantu?');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const { toast } = useToast();

  const baseUrl = window.location.origin;

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['embed_primary_color', 'embed_welcome_message']);

      if (data) {
        data.forEach(item => {
          if (item.key === 'embed_primary_color' && item.value) {
            setPrimaryColor(item.value);
          }
          if (item.key === 'embed_welcome_message' && item.value) {
            setWelcomeMessage(item.value);
          }
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const settings = [
        { key: 'embed_primary_color', value: primaryColor },
        { key: 'embed_welcome_message', value: welcomeMessage },
      ];

      for (const setting of settings) {
        await supabase
          .from('settings')
          .upsert({ key: setting.key, value: setting.value }, { onConflict: 'key' });
      }

      toast({
        title: 'Berhasil',
        description: 'Pengaturan embed berhasil disimpan.',
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: 'Gagal menyimpan pengaturan.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const iframeCode = `<iframe
  src="${baseUrl}/embed?widget=false"
  width="100%"
  height="600"
  frameborder="0"
  style="border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"
></iframe>`;

  const widgetCode = `<script>
  (function() {
    var iframe = document.createElement('iframe');
    iframe.src = '${baseUrl}/embed?widget=true&autoOpen=false';
    iframe.style.cssText = 'position:fixed;bottom:0;right:0;width:420px;height:550px;border:none;z-index:9999;';
    document.body.appendChild(iframe);
  })();
</script>`;

  const popupCode = `<script>
  (function() {
    var iframe = document.createElement('iframe');
    iframe.src = '${baseUrl}/embed?widget=true&autoOpen=true';
    iframe.style.cssText = 'position:fixed;bottom:0;right:0;width:420px;height:550px;border:none;z-index:9999;';
    document.body.appendChild(iframe);
  })();
</script>`;

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
    toast({
      title: 'Berhasil',
      description: 'Kode berhasil disalin ke clipboard.',
    });
  };

  return (
    <div className="space-y-6">
      {/* Settings Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Pengaturan Embed
          </CardTitle>
          <CardDescription>
            Kustomisasi tampilan chatbot yang akan di-embed di website lain
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Warna Utama</Label>
              <div className="flex gap-2">
                <Input
                  id="primaryColor"
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  placeholder="#16a34a"
                  className="flex-1"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="welcomeMessage">Pesan Sambutan</Label>
            <Textarea
              id="welcomeMessage"
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              placeholder="Masukkan pesan sambutan chatbot..."
              rows={3}
            />
          </div>

          <Button onClick={saveSettings} disabled={saving}>
            {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </Button>
        </CardContent>
      </Card>

      {/* Embed Codes Card */}
      <Card>
        <CardHeader>
          <CardTitle>Kode Embed</CardTitle>
          <CardDescription>
            Salin kode berikut untuk memasang chatbot di website Anda
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="widget" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="widget">Widget</TabsTrigger>
              <TabsTrigger value="popup">Popup Auto</TabsTrigger>
              <TabsTrigger value="iframe">Iframe Full</TabsTrigger>
            </TabsList>

            <TabsContent value="widget" className="space-y-4">
              <div className="space-y-2">
                <Label>Widget Chatbot (Tombol di pojok kanan bawah)</Label>
                <p className="text-sm text-muted-foreground">
                  Menampilkan tombol chat yang bisa diklik untuk membuka chatbot
                </p>
                <div className="relative">
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                    <code>{widgetCode}</code>
                  </pre>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(widgetCode, 'widget')}
                  >
                    {copied === 'widget' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="popup" className="space-y-4">
              <div className="space-y-2">
                <Label>Popup Auto Open</Label>
                <p className="text-sm text-muted-foreground">
                  Chatbot langsung terbuka saat halaman dimuat
                </p>
                <div className="relative">
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                    <code>{popupCode}</code>
                  </pre>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(popupCode, 'popup')}
                  >
                    {copied === 'popup' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="iframe" className="space-y-4">
              <div className="space-y-2">
                <Label>Iframe Full Width</Label>
                <p className="text-sm text-muted-foreground">
                  Embed chatbot sebagai bagian dari halaman (bukan floating)
                </p>
                <div className="relative">
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                    <code>{iframeCode}</code>
                  </pre>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(iframeCode, 'iframe')}
                  >
                    {copied === 'iframe' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Preview Link */}
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>
            Lihat preview chatbot embed
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" asChild>
              <a href="/embed" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Preview Fullscreen
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/embed?widget=true" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                Preview Widget
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmbedSettings;
