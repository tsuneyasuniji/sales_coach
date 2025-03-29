import React, { useState, useEffect } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { askApi, getCoachingSuggestions } from './api/askApi';
import './styles/App.css';
import { BrowserRouter as Router, Route, Switch, Link } from 'react-router-dom';
import MinutesCreator from './components/MinutesCreator';
import KnowledgeManager from './components/KnowledgeManager';


// APIとの通信を行う関数
const askApiFunction = async (question: string) => {
  try {
    console.log(`Sending request to: ${process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000'}/ask`);
    const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000'}/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ question }),
    });
    
    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error("Error during API call:", error);
    return { 
      answer: "", 
      error: `APIリクエストに失敗しました: ${error.message}` 
    };
  }
};

// メッセージの型定義
interface Message {
  speaker: string;
  text: string;
  timestamp: Date;
}

// 音声認識コンポーネント
const SpeechRecognitionComponent: React.FC<{ onMessage: (speaker: string, message: string) => void }> = ({ onMessage }) => {
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition
  } = useSpeechRecognition();
  
  // ブラウザがSpeechRecognitionをサポートしていない場合
  if (!browserSupportsSpeechRecognition) {
    return <div>ブラウザはこの機能をサポートしていません。</div>;
  }
  
  const [isListening, setIsListening] = useState(listening);
  const [editableText, setEditableText] = useState('');

  useEffect(() => {
    setIsListening(listening);
    if (transcript) {
      setEditableText(transcript);
    }
  }, [listening, transcript]);

  const handleStartListening = () => {
    resetTranscript();
    setEditableText('');
    SpeechRecognition.startListening({ continuous: true, language: 'ja-JP' });
  };

  const handleStopListening = () => {
    SpeechRecognition.stopListening();
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditableText(e.target.value);
  };

  const handleSubmit = async () => {
    if (editableText.trim()) {
      try {
        const res = await askApi(editableText);
        if (res.error) {
          onMessage('Error', `エラーが発生しました: ${res.error}`);
        } else {
          onMessage('user', editableText);
          onMessage('AI', res.answer);
        }
      } catch (error) {
        onMessage('Error', `エラーが発生しました: ${error}`);
        console.error("Error during API call:", error);
      }
    } else {
      onMessage('Error', "認識されたテキストがありません。");
    }
    resetTranscript();
    setEditableText('');
  };

  return (
    <div className="speech-recognition">
      <p>認識中: {isListening ? 'はい' : 'いいえ'}</p>
      <div className="editable-text-container">
        <textarea
          value={editableText}
          onChange={handleTextChange}
          placeholder="音声認識結果がここに表示されます。テキストを編集できます。"
          rows={4}
          className="editable-text"
        />
      </div>
      <div className="button-group">
        <button onClick={handleStartListening} disabled={isListening}>認識開始</button>
        <button onClick={handleStopListening} disabled={!isListening}>認識停止</button>
        <button onClick={handleSubmit} disabled={!editableText.trim()}>送信</button>
      </div>
    </div>
  );
};

// チャットエリアコンポーネント
const ChatArea: React.FC<{ messages: Message[] }> = ({ messages }) => {
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  
  // 新しいメッセージが追加されたら自動スクロール
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="chat-area">
      <h2>ナレッジ検索</h2>
      <div className="messages-container">
        <div className="messages">
          {messages.map((msg, index) => (
            <div key={index} className={`message ${msg.speaker.toLowerCase()}`}>
              <div className="message-header">
                <span className="speaker">{msg.speaker}</span>
                <span className="timestamp">{msg.timestamp.toLocaleTimeString()}</span>
              </div>
              <div className="message-body">{msg.text}</div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );
};

// 議事録と分析結果の切り替え表示コンポーネント
const MinutesAndResultsPanel: React.FC<{ 
  messages: Message[], 
  result: string, 
  onGenerateSummary: () => void 
}> = ({ messages, result, onGenerateSummary }) => {
  const [activeTab, setActiveTab] = useState<'minutes' | 'results'>('minutes');
  
  // ユーザーの発言のみを議事録に含める
  const minutes = messages
    .filter(msg => msg.speaker === 'user')
    .map(msg => `${msg.timestamp.toLocaleTimeString()} [${msg.speaker}] ${msg.text}`)
    .join('\n\n');

  return (
    <div className="panel-container">
      <div className="panel-tabs">
        <button 
          className={activeTab === 'minutes' ? 'active' : ''} 
          onClick={() => setActiveTab('minutes')}
        >
          議事録
        </button>
        <button 
          className={activeTab === 'results' ? 'active' : ''} 
          onClick={() => setActiveTab('results')}
        >
          分析結果
        </button>
      </div>
      
      <div className="panel-content">
        {activeTab === 'minutes' ? (
          <div className="minutes-area">
            <textarea readOnly value={minutes} />
            <button onClick={onGenerateSummary} className="summary-button">議事録を要約</button>
          </div>
        ) : (
          <div className="result-display">
            <div className="result-content">{result}</div>
          </div>
        )}
      </div>
    </div>
  );
};

// コーチング提案コンポーネント
const CoachingSuggestions: React.FC<{ suggestions: any, onRefresh: () => void }> = ({ suggestions, onRefresh }) => {
  return (
    <div className="coaching-suggestions">
      <div className="coaching-header">
        <h2>コーチング・提案</h2>
        <button onClick={onRefresh} className="refresh-button">
          更新
        </button>
      </div>
      <div className="suggestions-container">
        <div className="suggestion-category">
          <h3>質問例</h3>
          <ul>
            {suggestions.questions?.map((q: string, index: number) => (
              <li key={`q-${index}`}>{q}</li>
            )) || <li>会話を開始すると、質問例が表示されます。</li>}
          </ul>
        </div>
        <div className="suggestion-category">
          <h3>次のステップ</h3>
          <ul>
            {suggestions.nextSteps?.map((step: string, index: number) => (
              <li key={`s-${index}`}>{step}</li>
            )) || <li>会話を開始すると、次のステップが表示されます。</li>}
          </ul>
        </div>
        <div className="suggestion-category">
          <h3>その他提案</h3>
          <ul>
            {suggestions.tips?.map((tip: string, index: number) => (
              <li key={`t-${index}`}>{tip}</li>
            )) || <li>会話を開始すると、提案が表示されます。</li>}
          </ul>
        </div>
      </div>
    </div>
  );
};

// メインのSalesCoachUIコンポーネント
const SalesCoachUI: React.FC<{ isTestMode: boolean }> = ({ isTestMode }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [suggestions, setSuggestions] = useState<{
    questions: string[];
    nextSteps: string[];
    tips: string[];
  }>({
    questions: ["会話を開始すると、質問例が表示されます。"],
    nextSteps: ["商談の進行に合わせたステップが提供されます。"],
    tips: ["会話の内容に基づいて提案は自動的に更新されます。"]
  });
  const [result, setResult] = useState<string>("会話の分析結果がここに表示されます。");

  const handleNewMessage = (speaker: string, text: string) => {
    const newMessage: Message = {
      speaker,
      text,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMessage]);
    
    // 新しいメッセージが追加されたら、一定数のメッセージが溜まったらコーチング提案を更新
    if (messages.length > 3) {
      refreshCoachingSuggestions();
    }
  };

  // コーチング提案を更新する関数
  const refreshCoachingSuggestions = async () => {
    if (messages.length === 0) return;
    
    try {
      const response = await getCoachingSuggestions(messages);
      
      // レスポンスをパースしてカテゴリ分けする
      const parsedSuggestions: {
        questions: string[];
        nextSteps: string[];
        tips: string[];
      } = {
        questions: [],
        nextSteps: [],
        tips: []
      };
      
      // レスポンスの形式に応じて適切に処理
      if (Array.isArray(response)) {
        // 配列の場合は均等に分配
        const chunkSize = Math.ceil(response.length / 3);
        parsedSuggestions.questions = response.slice(0, chunkSize);
        parsedSuggestions.nextSteps = response.slice(chunkSize, chunkSize * 2);
        parsedSuggestions.tips = response.slice(chunkSize * 2);
      } else if (response.questions && response.nextSteps && response.tips) {
        // すでにカテゴリ分けされている場合はそのまま使用
        parsedSuggestions.questions = response.questions;
        parsedSuggestions.nextSteps = response.nextSteps;
        parsedSuggestions.tips = response.tips;
      }
      
      setSuggestions(parsedSuggestions);
    } catch (error) {
      console.error("Error refreshing coaching suggestions:", error);
    }
  };

  const generateSummary = async () => {
    // ユーザーの発言のみを抽出
    const userMessages = messages
      .filter(msg => msg.speaker === 'user')
      .map(msg => msg.text);
    
    if (userMessages.length === 0) {
      setResult("要約するメッセージがありません。");
      return;
    }

    // メッセージを適切なサイズに分割（例: 5メッセージずつ）
    const chunkSize = 5;
    const messageChunks = [];
    for (let i = 0; i < userMessages.length; i += chunkSize) {
      messageChunks.push(userMessages.slice(i, i + chunkSize));
    }

    try {
      // 各チャンクを要約
      const summaries = [];
      for (const chunk of messageChunks) {
        const prompt = `以下の会話を簡潔に要約してください:\n\n${chunk.join('\n')}`;
        const response = await askApi(prompt);
        if (!response.error) {
          summaries.push(response.answer);
        }
      }

      // 全体の要約を生成
      if (summaries.length > 1) {
        const finalPrompt = `以下の要約をまとめて、全体の議事録を作成してください:\n\n${summaries.join('\n\n')}`;
        const finalResponse = await askApi(finalPrompt);
        if (!finalResponse.error) {
          setResult(finalResponse.answer);
        }
      } else if (summaries.length === 1) {
        setResult(summaries[0]);
      }
    } catch (error) {
      console.error("Error generating summary:", error);
      setResult("要約の生成中にエラーが発生しました。");
    }
  };

  return (
    <div className="sales-coach-ui">
      <h1>Sales-Coach</h1>
      <div className="main-content">
        <div className="left-panel">
          <SpeechRecognitionComponent onMessage={handleNewMessage} />
          <ChatArea messages={messages} />
        </div>
        <div className="right-panel">
          <MinutesAndResultsPanel 
            messages={messages} 
            result={result} 
            onGenerateSummary={generateSummary} 
          />
          <CoachingSuggestions suggestions={suggestions} onRefresh={refreshCoachingSuggestions} />
        </div>
      </div>
    </div>
  );
};

// アプリケーションのルートコンポーネント
const App: React.FC = () => {
  const [messages, setMessages] = useState<any[]>([]);

  return (
    <Router>
      <div className="app-container">
        <div className="sidebar">
          <h2>商談AI</h2>
          <nav>
            <ul>
              <li>
                <Link to="/">Sales Coach</Link>
              </li>
              <li>
                <Link to="/minutes">議事録作成</Link>
              </li>
              <li>
                <Link to="/knowledge">ナレッジベース管理</Link>
              </li>
            </ul>
          </nav>
        </div>
        <div className="app-content">
          <Switch>
            <Route exact path="/">
              <SalesCoachUI isTestMode={false} />
            </Route>
            <Route path="/minutes">
              <MinutesCreator messages={messages} />
            </Route>
            <Route path="/knowledge">
              <KnowledgeManager />
            </Route>
          </Switch>
        </div>
      </div>
    </Router>
  );
};

export default App;
