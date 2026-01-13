import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Send, Loader2, Bot, User, X, MessageCircle } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const EmbedChat = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Halo! Selamat datang di Help Desk UPT PJJ UIN Siber Syekh Nurjati Cirebon. Ada yang bisa saya bantu?',
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoChatbot, setLogoChatbot] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [primaryColor, setPrimaryColor] = useState('#16a34a');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check if we're in widget mode (via URL param)
  const urlParams = new URLSearchParams(window.location.search);
  const isWidget = urlParams.get('widget') === 'true';
  const autoOpen = urlParams.get('autoOpen') === 'true';

  useEffect(() => {
    if (autoOpen || !isWidget) {
      setIsOpen(true);
    }
  }, [autoOpen, isWidget]);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const { data } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['logo_chatbot', 'embed_primary_color', 'embed_welcome_message']);

      if (data) {
        data.forEach(item => {
          if (item.key === 'logo_chatbot' && item.value) {
            setLogoChatbot(item.value);
          }
          if (item.key === 'embed_primary_color' && item.value) {
            setPrimaryColor(item.value);
          }
          if (item.key === 'embed_welcome_message' && item.value) {
            setWelcomeMessage(item.value);
            setMessages([{
              id: '1',
              role: 'assistant',
              content: item.value,
              timestamp: new Date(),
            }]);
          }
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('chat', {
        body: { message: input }
      });

      if (error) throw error;

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply || 'Maaf, terjadi kesalahan.',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Maaf, terjadi kesalahan. Silakan coba lagi.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  // Widget mode: show only floating button when closed, chat window when open
  if (isWidget) {
    if (!isOpen) {
      return (
        <button
          onClick={() => setIsOpen(true)}
          style={{ backgroundColor: primaryColor }}
          className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white hover:opacity-90 transition-opacity"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      );
    }

    // Widget open state
    return (
      <div className="w-96 h-[500px] flex flex-col bg-white rounded-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <header 
          style={{ backgroundColor: primaryColor }}
          className="px-4 py-3 flex items-center justify-between text-white"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
              {logoChatbot ? (
                <img src={logoChatbot} alt="Chatbot" className="w-full h-full object-cover" />
              ) : (
                <Bot className="h-5 w-5" />
              )}
            </div>
            <div>
              <h1 className="font-semibold text-sm">Help Desk UPT PJJ</h1>
              <p className="text-xs opacity-80">Online</p>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-white/20 rounded transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* Chat Area */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div 
                  style={{ backgroundColor: primaryColor }}
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
                >
                  {logoChatbot ? (
                    <img src={logoChatbot} alt="Bot" className="w-full h-full object-cover" />
                  ) : (
                    <Bot className="h-3 w-3 text-white" />
                  )}
                </div>
              )}
              <Card
                className={`max-w-[80%] p-3 ${
                  message.role === 'user'
                    ? 'text-white'
                    : 'bg-white'
                }`}
                style={message.role === 'user' ? { backgroundColor: primaryColor } : {}}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <p className="text-xs opacity-60 mt-1">
                  {message.timestamp.toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </Card>
              {message.role === 'user' && (
                <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                  <User className="h-3 w-3 text-gray-600" />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-2 justify-start">
              <div 
                style={{ backgroundColor: primaryColor }}
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
              >
                <Bot className="h-3 w-3 text-white" />
              </div>
              <Card className="max-w-[80%] p-3 bg-white">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <p className="text-xs text-gray-500">Mengetik...</p>
                </div>
              </Card>
            </div>
          )}
          <div ref={messagesEndRef} />
        </main>

        {/* Input Area */}
        <footer className="bg-white border-t p-3">
          <form onSubmit={sendMessage} className="flex gap-2">
            <Input
              placeholder="Ketik pesan..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              className="flex-1 text-sm"
            />
            <Button 
              type="submit" 
              disabled={loading || !input.trim()}
              style={{ backgroundColor: primaryColor }}
              className="hover:opacity-90"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </footer>
      </div>
    );
  }

  // Full page mode (non-widget)
  return (
    <div className="w-full h-screen flex flex-col bg-white overflow-hidden">
      {/* Header */}
      <header 
        style={{ backgroundColor: primaryColor }}
        className="px-4 py-3 flex items-center text-white"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
            {logoChatbot ? (
              <img src={logoChatbot} alt="Chatbot" className="w-full h-full object-cover" />
            ) : (
              <Bot className="h-5 w-5" />
            )}
          </div>
          <div>
            <h1 className="font-semibold text-sm">Help Desk UPT PJJ</h1>
            <p className="text-xs opacity-80">Online</p>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto bg-gray-50 p-4 space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <div 
                style={{ backgroundColor: primaryColor }}
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
              >
                {logoChatbot ? (
                  <img src={logoChatbot} alt="Bot" className="w-full h-full object-cover" />
                ) : (
                  <Bot className="h-3 w-3 text-white" />
                )}
              </div>
            )}
            <Card
              className={`max-w-[80%] p-3 ${
                message.role === 'user'
                  ? 'text-white'
                  : 'bg-white'
              }`}
              style={message.role === 'user' ? { backgroundColor: primaryColor } : {}}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <p className="text-xs opacity-60 mt-1">
                {message.timestamp.toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </Card>
            {message.role === 'user' && (
              <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                <User className="h-3 w-3 text-gray-600" />
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex gap-2 justify-start">
            <div 
              style={{ backgroundColor: primaryColor }}
              className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
            >
              <Bot className="h-3 w-3 text-white" />
            </div>
            <Card className="max-w-[80%] p-3 bg-white">
              <div className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                <p className="text-xs text-gray-500">Mengetik...</p>
              </div>
            </Card>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Input Area */}
      <footer className="bg-white border-t p-3">
        <form onSubmit={sendMessage} className="flex gap-2">
          <Input
            placeholder="Ketik pesan..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="flex-1 text-sm"
          />
          <Button 
            type="submit" 
            disabled={loading || !input.trim()}
            style={{ backgroundColor: primaryColor }}
            className="hover:opacity-90"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
      </footer>
    </div>
  );
};

export default EmbedChat;
