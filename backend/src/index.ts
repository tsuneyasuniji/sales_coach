/**
 * index.ts
 * アプリケーションのエントリーポイントおよび全機能を統合したファイルです。
 */

// ① 環境変数を読み込みます（.envファイルが存在する場合、その内容を process.env に反映）
import "dotenv/config";

// ② 必要なモジュールのインポート
import express, { Router, Request, Response } from "express";
import { Document } from "langchain/document";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { RetrievalQAChain } from "langchain/chains";
import { OpenAI } from "langchain/llms/openai";
import fs from "fs";
import path from "path";
import cors from "cors";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

// ③ シンプルなロガーの定義（INFO, ERROR レベルでログ出力）
const logger = {
  info: (...args: any[]) => {
    console.log("[INFO]", ...args);
  },
  error: (...args: any[]) => {
    console.error("[ERROR]", ...args);
  },
};

// ④ OpenAI Embeddings のグローバルインスタンスを生成（必要に応じて利用）
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPEN_API_KEY,
  // model: "text-embedding-ada-002", // 使用する埋め込みモデルを指定したい場合は有効化
});

/**
 * SalesCoachAgentクラス
 * ユーザーからの質問を受け取り、LangChainを用いて回答を生成するエージェントです。
 */
class SalesCoachAgent {
  // シングルトンインスタンス
  private static instance: SalesCoachAgent;
  
  // RetrievalQAChain の初期化は非同期で行うため、Promiseとして保持
  private chainPromise: Promise<RetrievalQAChain>;

  // コンストラクタをprivateにして外部からの直接インスタンス化を防ぐ
  private constructor() {
    logger.info("SalesCoachAgent constructor called.");
    // 初期化処理（initChain）を開始し、そのPromiseをキャッシュします
    this.chainPromise = this.initChain();
  }

  /**
   * getInstance() メソッド
   * SalesCoachAgentのシングルトンインスタンスを取得します。
   * インスタンスが存在しない場合は新しく作成します。
   */
  public static getInstance(): SalesCoachAgent {
    if (!SalesCoachAgent.instance) {
      SalesCoachAgent.instance = new SalesCoachAgent();
    }
    return SalesCoachAgent.instance;
  }

  /**
   * ask() メソッド
   * ユーザーの質問を受け取り、構築済みのRetrievalQAChainを使用して回答を生成します。
   * @param question ユーザーからの質問テキスト
   * @returns LLM が生成した回答テキスト
   */
  public async ask(question: string): Promise<string> {
    logger.info(`SalesCoachAgent.ask() invoked with question: "${question}"`);
    try {
      // initChain() で作成したRetrievalQAChainのインスタンスを取得
      const chain = await this.chainPromise;
      logger.info("RetrievalQAChain is ready. Calling .call() ...");
      // チェーンに対して質問を渡し、回答結果を取得
      const result = await chain.call({ query: question });
      logger.info("LLM result received:", result);
      return result.text;
    } catch (error) {
      logger.error("Error in SalesCoachAgent.ask():", error);
      throw error;
    }
  }

  /**
   * initChain() メソッド
   * 以下の手順でRetrievalQAChainを初期化します:
   * 1. ローカルのテキストファイル (fake_db.txt) を読み込み
   * 2. ファイル内容を Document オブジェクトに変換
   * 3. OpenAIEmbeddings を初期化し、Document をベクトル化
   * 4. MemoryVectorStore を作成
   * 5. OpenAI の LLM をセットアップし、MemoryVectorStore と組み合わせたRetrievalQAChain を構築
   */
  private async initChain(): Promise<RetrievalQAChain> {
    logger.info("Initializing chain with MemoryVectorStore...");
    try {
      // APIキーの確認
      const apiKey = process.env.OPEN_API_KEY;
      
      if (!apiKey) {
        throw new Error("OPEN_API_KEY is not set in environment variables.");
      }

      // 1. テキストファイル読み込み
      const dbPath = path.join(__dirname, "data", "test_knowledge.txt");
      logger.info("Checking file at:", dbPath);
      if (!fs.existsSync(dbPath)) {
        logger.error(`File not found: ${dbPath}`);
        throw new Error(`File not found: ${dbPath}`);
      }
      const content = fs.readFileSync(dbPath, "utf-8");
      logger.info(`File loaded. content length: ${content.length} chars`);

      // 2. Document配列を作成
      const docs = [new Document({ pageContent: content })];

      // 3. OpenAIEmbeddings の初期化
      const embeddings = new OpenAIEmbeddings({ openAIApiKey: apiKey });

      // 4. MemoryVectorStore の作成（Document群とEmbeddingsから生成）
      logger.info("Creating MemoryVectorStore...");
      const vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);
      logger.info("MemoryVectorStore successfully created.");

      // 5. OpenAI の LLM をセットアップ
      logger.info("Setting up OpenAI for QA chain...");
      const model = new OpenAI({
        openAIApiKey: apiKey,
        modelName: "gpt-4o-mini",
        temperature: 0,
      });
      logger.info("OpenAI model initialized successfully");
      
      // 6. LLM と MemoryVectorStore のレトリーバーを組み合わせた RetrievalQAChain を構築
      const chain = RetrievalQAChain.fromLLM(model, vectorStore.asRetriever());
      logger.info("RetrievalQAChain with MemoryVectorStore is successfully initialized.");
      return chain;
    } catch (error) {
      logger.error("Error in SalesCoachAgent.initChain():", error);
      throw error;
    }
  }
}

// ⑥ Express のルーターを生成し、/askエンドポイントを実装
const askRoute = Router();

// POST /ask エンドポイントのハンドラー
askRoute.post("/", async (req: Request, res: Response) => {
  const { question } = req.body;
  if (!question) {
    // リクエストボディにquestionが無い場合は400エラーを返す
    return res.status(400).json({ error: "Missing 'question' in request body" });
  }

  try {
    // シングルトンインスタンスを取得
    const agent = SalesCoachAgent.getInstance();
    const answer = await agent.ask(question);
    // 正常に回答が生成されたらJSON形式で返す
    res.json({ answer });
  } catch (error: any) {
    logger.error("Error in /ask route:", error);
    // エラーメッセージをより詳細に
    res.status(500).json({ 
      error: "Internal Server Error", 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ⑦ サーバー設定と起動
const PORT = process.env.PORT || 3000;

async function main() {
  const app = express();

  // CORSを有効化（クロスオリジンリクエストを許可）
  app.use(cors());

  // JSONリクエストのパースを有効化
  app.use(express.json());

  // /ask エンドポイントに対して、上記のルーターを利用
  app.use("/ask", askRoute);

  // /test エンドポイントの追加
  app.post('/test', async (req: Request, res: Response) => {
    const { question } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: "Missing 'question' in request body" });
    }

    try {
      // SalesCoachAgent のインスタンスを取得
      const agent = SalesCoachAgent.getInstance();
      const answer = await agent.ask(question);
      res.json({ answer });
    } catch (error: any) {
      logger.error("Error in /test route:", error);
      res.status(500).json({ 
        error: "Internal Server Error", 
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // コーチング提案を生成するエンドポイント
  app.post('/coaching', async (req: Request, res: Response) => {
    const { conversation } = req.body;
    
    if (!conversation || !Array.isArray(conversation) || conversation.length === 0) {
      return res.status(400).json({ error: "有効な会話データが必要です" });
    }

    try {
      // 会話内容を文字列に変換
      const conversationText = conversation
        .map(msg => `${msg.speaker}: ${msg.text}`)
        .join('\n\n');
      
      // コーチング提案のためのプロンプト
      const prompt = `
以下は商談の会話です。この会話を分析し、以下の3つのカテゴリに分けて簡潔なアドバイスを提供してください:

1. 質問例:次に尋ねるべき具体的な質問を2-3個
2. 次のステップ:商談を進めるための次のアクションを1-2個
3. その他提案:商談を成功させるためのヒントを1-2個

回答は各カテゴリごとに箇条書きで、説明は必要ありません。具体的な内容だけを書いてください。

会話:
${conversationText}

回答形式：
質問例：
- 
- 

次のステップ：
- 

その他提案：
- 
`;

      // SalesCoachAgent のインスタンスを取得
      const agent = SalesCoachAgent.getInstance();
      const answer = await agent.ask(prompt);
      
      // 回答をパースして配列に変換
      const suggestions = answer
        .split(/\d+\.\s+/)  // 数字とドットで分割
        .filter(item => item.trim().length > 0)  // 空の項目を除外
        .map(item => item.trim());  // 前後の空白を削除
      
      res.json({ suggestions });
    } catch (error: any) {
      logger.error("Error in /coaching route:", error);
      res.status(500).json({ 
        error: "Internal Server Error", 
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // 指定されたポートでサーバーを起動
  app.listen(PORT, () => {
    logger.info(`サーバーがポート${PORT}で起動しました。`);
    logger.info("利用可能なエンドポイント:");
    logger.info("- POST /ask");
    logger.info("- POST /test");
    logger.info("- POST /coaching");
  });
}

// メイン関数を実行し、サーバー起動エラーをキャッチ
main().catch((err) => {
  logger.error("サーバーの起動に失敗しました:", err);
});
