import React, { useState } from 'react';
import '../styles/KnowledgeManager.css';

const KnowledgeManager: React.FC = () => {
  const [text, setText] = useState('');
  const [source, setSource] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'text' | 'file'>('text');

  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) {
      setError('テキストを入力してください');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000'}/knowledge/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, source }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessage(data.message);
        setText('');
        setSource('');
      } else {
        setError(data.error || 'エラーが発生しました');
      }
    } catch (err) {
      setError('サーバーとの通信に失敗しました');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('ファイルを選択してください');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000'}/knowledge/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessage(data.message);
        setFile(null);
        // ファイル入力をリセット
        const fileInput = document.getElementById('file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        setError(data.error || 'エラーが発生しました');
      }
    } catch (err) {
      setError('サーバーとの通信に失敗しました');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  return (
    <div className="knowledge-manager">
      <h1>ナレッジベース管理</h1>
      
      <div className="tabs">
        <button 
          className={activeTab === 'text' ? 'active' : ''} 
          onClick={() => setActiveTab('text')}
        >
          テキスト入力
        </button>
        <button 
          className={activeTab === 'file' ? 'active' : ''} 
          onClick={() => setActiveTab('file')}
        >
          ファイルアップロード
        </button>
      </div>

      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}

      {activeTab === 'text' ? (
        <div className="text-input-panel">
          <form onSubmit={handleTextSubmit}>
            <div className="form-group">
              <label htmlFor="source">ソース名 (任意):</label>
              <input
                type="text"
                id="source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="例: 営業マニュアル2023"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="text">テキスト:</label>
              <textarea
                id="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="ここにナレッジベースに追加するテキストを入力してください。段落ごとに処理されます。"
                rows={10}
                required
              />
            </div>
            
            <button type="submit" disabled={loading} className="submit-button">
              {loading ? '処理中...' : 'ナレッジベースに追加'}
            </button>
          </form>
        </div>
      ) : (
        <div className="file-upload-panel">
          <form onSubmit={handleFileSubmit}>
            <div className="form-group">
              <label htmlFor="file-input">ファイル選択:</label>
              <input
                type="file"
                id="file-input"
                onChange={handleFileChange}
                accept=".txt,.md,.csv"
              />
              <p className="file-info">
                {file ? `選択されたファイル: ${file.name} (${(file.size / 1024).toFixed(2)} KB)` : ''}
              </p>
            </div>
            
            <button type="submit" disabled={loading} className="submit-button">
              {loading ? '処理中...' : 'ファイルをアップロード'}
            </button>
          </form>
        </div>
      )}

      <div className="knowledge-info">
        <h2>ナレッジベースについて</h2>
        <p>
          ここで追加したテキストやファイルの内容は、AIの回答生成に使用されます。
          テキストは段落ごとに分割され、それぞれが独立したナレッジとして保存されます。
        </p>
        <p>
          <strong>注意:</strong> 機密情報や個人情報を含むテキストは追加しないでください。
        </p>
      </div>
    </div>
  );
};

export default KnowledgeManager; 