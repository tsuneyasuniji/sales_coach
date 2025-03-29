import axios from 'axios';

interface ApiResponse {
  answer: string;
  error?: string;
}

// 環境変数からAPIのベースURLを取得するか、デフォルト値を使用
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3000';

export const askApi = async (question: string): Promise<ApiResponse> => {
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
      const errorData = await response.json().catch(() => ({}));
      console.error("API Error Response:", errorData);
      throw new Error(`API request failed with status ${response.status}: ${errorData.message || ''}`);
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

// コーチング提案を取得する関数
export const getCoachingSuggestions = async (conversation: any[]): Promise<any> => {
  try {
    console.log(`Sending request to: ${API_BASE_URL}/coaching`);
    const response = await fetch(`${API_BASE_URL}/coaching`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ conversation }),
    });

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`);
    }

    const data = await response.json();
    
    // レスポンスをパースしてカテゴリ分け
    const result: {
      questions: string[];
      nextSteps: string[];
      tips: string[];
    } = {
      questions: [],
      nextSteps: [],
      tips: []
    };
    
    // suggestions が配列の場合
    if (Array.isArray(data.suggestions)) {
      // テキストからカテゴリを抽出
      data.suggestions.forEach((suggestion: string) => {
        if (suggestion.includes('質問') || suggestion.includes('聞く') || suggestion.includes('ヒアリング')) {
          result.questions.push(suggestion);
        } else if (suggestion.includes('次') || suggestion.includes('ステップ') || suggestion.includes('進める')) {
          result.nextSteps.push(suggestion);
        } else {
          result.tips.push(suggestion);
        }
      });
      
      // 均等に分配されていない場合は調整
      if (result.questions.length === 0) {
        const third = Math.ceil(data.suggestions.length / 3);
        result.questions = data.suggestions.slice(0, third);
        result.nextSteps = data.suggestions.slice(third, third * 2);
        result.tips = data.suggestions.slice(third * 2);
      }
    }
    
    return result;
  } catch (error: any) {
    console.error('Error getting coaching suggestions:', error);
    return {
      questions: ["コーチング提案の取得中にエラーが発生しました。"],
      nextSteps: [],
      tips: []
    };
  }
};
