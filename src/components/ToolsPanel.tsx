import { useState, useEffect } from 'react';
import { 
  Wrench, 
  Image, 
  Link, 
  Copy, 
  Download, 
  Loader2, 
  Check,
  AlertCircle,
  X
} from 'lucide-react';

interface ScreenTemplate {
  id: string;
  name: string;
  placeholder_url: string;
}

export default function ToolsPanel() {
  const [templates, setTemplates] = useState<ScreenTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [targetUrl, setTargetUrl] = useState('');
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Load templates
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const res = await fetch('/api/screen-templates');
      const data = await res.json();
      setTemplates(data.templates || []);
      
      if (data.templates?.length > 0) {
        setSelectedTemplate(data.templates[0].id);
      }
    } catch (e) {
      console.error('Failed to load templates:', e);
    }
  };

  const handleGenerateScreenshot = async () => {
    if (!selectedTemplate || !targetUrl) {
      setError('Выберите шаблон и введите ссылку');
      return;
    }
    
    setError('');
    setSuccess('');
    setLoading(true);
    setGeneratedImage(null);
    
    try {
      const res = await fetch('/api/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate,
          targetUrl,
        }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setGeneratedImage(data.base64);
        setShowPreview(true);
        setSuccess('Скриншот создан!');
      } else {
        setError(data.error || 'Ошибка генерации');
      }
    } catch (e) {
      setError('Ошибка сети');
    }
    
    setLoading(false);
  };

  const handleCopyImage = async () => {
    if (!generatedImage) return;
    
    try {
      // Convert base64 to blob
      const response = await fetch(generatedImage);
      const blob = await response.blob();
      
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]);
      
      setSuccess('Изображение скопировано в буфер обмена!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (e) {
      // Fallback: copy as data URL
      try {
        await navigator.clipboard.writeText(generatedImage);
        setSuccess('Ссылка на изображение скопирована!');
      } catch (e2) {
        setError('Не удалось скопировать');
      }
    }
  };

  const handleDownloadImage = () => {
    if (!generatedImage) return;
    
    const link = document.createElement('a');
    link.href = generatedImage;
    link.download = `screenshot_${Date.now()}.png`;
    link.click();
  };



  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
          <Wrench size={24} />
          Тулка
        </h1>
        <p className="text-white/50 text-sm mt-1">Инструменты для работы</p>
      </div>

      {/* Screenshot Generator */}
      <div className="glass-card rounded-2xl p-5 space-y-4">
        <h2 className="text-white font-medium flex items-center gap-2">
          <Image size={18} />
          Скрин-линки
        </h2>
        
        <p className="text-xs text-white/40">
          Создайте скриншот страницы с вашей ссылкой. Выберите шаблон, введите вашу ссылку и получите готовое изображение.
        </p>

        {templates.length === 0 ? (
          <div className="text-center py-8 text-white/30">
            <Image size={32} className="mx-auto mb-2" />
            <p>Нет доступных шаблонов</p>
            <p className="text-xs mt-1">Администратор должен загрузить HTML шаблоны</p>
          </div>
        ) : (
          <>
            <div>
              <label className="text-xs text-white/50 block mb-2">Шаблон</label>
              <select
                value={selectedTemplate}
                onChange={e => setSelectedTemplate(e.target.value)}
                className="w-full glass-input text-sm text-white px-4 py-3 rounded-xl outline-none"
              >
                {templates.map(t => (
                  <option key={t.id} value={t.id} className="bg-gray-900">
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="text-xs text-white/50 block mb-2 flex items-center gap-1">
                <Link size={12} />
                Ваша ссылка
              </label>
              <input
                type="text"
                value={targetUrl}
                onChange={e => setTargetUrl(e.target.value)}
                placeholder="https://your-link.com/invite"
                className="w-full glass-input text-sm text-white px-4 py-3 rounded-xl outline-none font-mono"
              />
              <p className="text-xs text-white/30 mt-1">
                Эта ссылка заменит плейсхолдер в шаблоне
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-xs p-3 rounded-xl glass border border-red-500/30">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 text-green-400 text-xs p-3 rounded-xl glass border border-green-500/30">
                <Check size={14} />
                {success}
              </div>
            )}

            <button
              onClick={handleGenerateScreenshot}
              disabled={loading || !selectedTemplate || !targetUrl}
              className="w-full py-3 glass-accent rounded-xl text-white font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Генерация...
                </>
              ) : (
                <>
                  <Image size={18} />
                  Создать скриншот
                </>
              )}
            </button>
          </>
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && generatedImage && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="glass-card rounded-3xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Готовый скриншот</h2>
              <button
                onClick={() => setShowPreview(false)}
                className="p-2 glass-button rounded-lg text-white/50 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="rounded-xl overflow-hidden mb-4 border border-white/10">
              <img 
                src={generatedImage} 
                alt="Generated screenshot" 
                className="w-full"
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={handleCopyImage}
                className="flex-1 py-3 glass-accent rounded-xl text-white flex items-center justify-center gap-2"
              >
                <Copy size={18} />
                Копировать
              </button>
              <button
                onClick={handleDownloadImage}
                className="flex-1 py-3 glass-button rounded-xl text-white flex items-center justify-center gap-2"
              >
                <Download size={18} />
                Скачать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Other Tools Placeholder */}
      <div className="glass-card rounded-2xl p-5">
        <h2 className="text-white font-medium mb-4">Другие инструменты</h2>
        <p className="text-white/30 text-sm">
          Дополнительные инструменты будут добавлены в следующих обновлениях
        </p>
      </div>
    </div>
  );
}
