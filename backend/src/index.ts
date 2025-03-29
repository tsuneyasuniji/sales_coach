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

// Pineconeをインポート
import { Pinecone } from "@pinecone-database/pinecone";
import { PineconeStore } from "langchain/vectorstores/pinecone";

// Multerの型をインポート
import multer from 'multer';

// ExpressのRequest型を拡張
declare global {
  namespace Express {
    interface Request {
      file?: Express.Multer.File; // multerによって追加されるfileプロパティ
    }
  }
}

// ③ シンプルなロガーの定義（INFO, ERROR レベルでログ出力）
const logger = {
  info: (...args: any[]) => {
    console.log("[INFO]", ...args);
  },
  error: (...args: any[]) => {
    console.error("[ERROR]", ...args);
  },
};

// ④ OpenAI Embeddings のグローバルインスタンスを生成
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPEN_API_KEY,
  // model: "text-embedding-ada-002", // 使用する埋め込みモデルを指定したい場合は有効化
});

class PineconeClientSingleton {
  private static instance: Pinecone | null = null;

  public static getInstance(): Pinecone {
    if (!this.instance) {
      this.instance = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY || "",
      });
    }
    return this.instance;
  }
}

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
    
    // 既存のナレッジを確認してから初期化
    this.checkAndInitializeKnowledge().catch(err => {
      logger.error("Failed to check and initialize knowledge:", err);
    });
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
   * initChain() メソッド
   * LangChainのRetrievalQAChainを初期化します。
   * このメソッドは非同期で実行され、初期化が完了するとPromiseが解決されます。
   */
  private async initChain(): Promise<RetrievalQAChain> {
    try {
      logger.info("Initializing RetrievalQAChain...");

      // Pineconeクライアントの初期化
      const client = PineconeClientSingleton.getInstance();
      const indexName = process.env.PINECONE_INDEX_NAME || "sales-coach";
      const pineconeIndex = client.index(indexName);

      // カスタムレトリーバーを作成
      const retriever = {
        getRelevantDocuments: async (query: string) => {
          try {
            // クエリの埋め込みを生成
            const queryEmbedding = await embeddings.embedQuery(query);
            
            // Pineconeに問い合わせ
            const results = await pineconeIndex.query({
              vector: queryEmbedding,
              topK: 5,
              includeMetadata: true
            });
            
            // 結果をドキュメントに変換
            return results.matches.map(match => {
              return new Document({
                pageContent: match.metadata?.pageContent ? String(match.metadata.pageContent) : "デフォルトのコンテンツ",
                metadata: {
                  source: match.metadata?.source ? String(match.metadata.source) : "不明",
                },
              });
            });
          } catch (error) {
            logger.error("Error in retriever:", error);
            return []; // エラー時は空の配列を返す
          }
        }
      };

      // OpenAIモデルの初期化
      const model = new OpenAI({
        openAIApiKey: process.env.OPEN_API_KEY,
        temperature: 0,
        modelName: "gpt-4o-mini",
      });

      // RetrievalQAChainの作成
      const chain = RetrievalQAChain.fromLLM(model, retriever);

      logger.info("RetrievalQAChain initialized successfully.");
      return chain;
    } catch (error) {
      logger.error("Error initializing RetrievalQAChain:", error);
      throw error;
    }
  }

  /**
   * ask() メソッド
   * ユーザーからの質問に対して回答を生成します。
   * @param question ユーザーからの質問
   * @returns 生成された回答
   */
  public async ask(question: string): Promise<string> {
    try {
      // chainPromiseが解決されるのを待ち、初期化されたchainを取得
      const chain = await this.chainPromise;
      
      // 質問に対する回答を生成
      const response = await chain.call({
        query: question,
      });

      return response.text;
    } catch (error) {
      logger.error("Error in ask method:", error);
      throw error;
    }
  }

  public async retrieveKnowledge(): Promise<Document[]> {
    try {
      const client = PineconeClientSingleton.getInstance();
      const indexName = process.env.PINECONE_INDEX_NAME || "sales-coach";
      const pineconeIndex = client.index(indexName);
      
      // 埋め込みを生成
      const embeddingModel = new OpenAIEmbeddings({
        openAIApiKey: process.env.OPEN_API_KEY,
      });
      
      // ダミークエリの埋め込みを生成
      const queryEmbedding = await embeddingModel.embedQuery("セールスコーチング");
      
      // Pineconeからナレッジを取得
      const queryResponse = await pineconeIndex.query({
        vector: queryEmbedding,
        topK: 5,
        includeMetadata: true
      });

      const docs: Document[] = queryResponse.matches.map(match => {
        return new Document({
          pageContent: match.metadata?.pageContent ? String(match.metadata.pageContent) : "デフォルトのコンテンツ",
          metadata: {
            source: match.metadata?.source ? String(match.metadata.source) : "不明",
          },
        });
      });

      return docs;
    } catch (error) {
      logger.error("Error retrieving knowledge from Pinecone:", error);
      throw error;
    }
  }

  private async initializeWithDefaultKnowledge(): Promise<void> {
    try {
      // 初期ナレッジデータ
      const initialKnowledge = [
        "セールスコーチングとは、営業担当者のスキルと成果を向上させるための指導プロセスです。",
        "効果的な質問技法には、オープンクエスチョンとクローズドクエスチョンがあります。",
        "顧客のニーズを理解することは、成功する営業の基本です。",
        "商談では、顧客の課題を明確にし、その解決策を提案することが重要です。",
        "営業プロセスは通常、見込み客の発掘、アプローチ、ニーズ分析、提案、クロージング、フォローアップの段階で構成されます。"
      ];

      // Pineconeクライアントの初期化
      const client = PineconeClientSingleton.getInstance();
      const indexName = process.env.PINECONE_INDEX_NAME || "sales-coach";
      const pineconeIndex = client.index(indexName);
      
      // 各チャンクを処理
      const records = [];
      
      for (let i = 0; i < initialKnowledge.length; i++) {
        const text = initialKnowledge[i];
        
        // テキストの埋め込みを生成
        const embedding = await embeddings.embedQuery(text);
        
        // レコードを作成
        records.push({
          id: `default-knowledge-${i}`,
          values: embedding,
          metadata: {
            pageContent: text,
            source: `default-knowledge-${i}`,
          }
        });
      }
      
      // バッチサイズを設定（Pineconeの制限に合わせる）
      const BATCH_SIZE = 100;
      
      // バッチ処理でPineconeにデータを挿入
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        await pineconeIndex.upsert(batch);
      }

      logger.info("Default knowledge added to Pinecone successfully.");
    } catch (error) {
      logger.error("Error adding default knowledge:", error);
      // エラーをスローせず、処理を続行
    }
  }

  private async checkAndInitializeKnowledge(): Promise<void> {
    try {
      // 既存のナレッジを確認
      const docs = await this.retrieveKnowledge();
      
      // ナレッジが存在しない場合のみ初期化を実行
      if (!docs || docs.length === 0) {
        logger.info("No existing knowledge found. Initializing default knowledge...");
        await this.initializeWithDefaultKnowledge();
      } else {
        logger.info(`Found ${docs.length} existing knowledge documents. Skipping initialization.`);
      }
    } catch (error) {
      logger.error("Error checking knowledge:", error);
      // エラー時は安全のため初期化を実行
      await this.initializeWithDefaultKnowledge();
    }
  }
}

// ⑥ Express のルーターを生成し、/askエンドポイントを実装
const askRoute = Router();

// POST /ask エンドポイントのハンドラー
askRoute.post("/", async (req: Request, res: Response) => {
  const { question } = req.body;
  
  logger.info(`Received question: ${question}`);
  
  if (!question) {
    return res.status(400).json({ error: "Missing 'question' in request body" });
  }

  try {
    logger.info("Getting SalesCoachAgent instance...");
    const agent = SalesCoachAgent.getInstance();
    
    logger.info("Asking question to agent...");
    const answer = await agent.ask(question);
    
    logger.info(`Got answer: ${answer.substring(0, 50)}...`);
    res.json({ answer });
  } catch (error: any) {
    logger.error("Error in /ask route:", error);
    logger.error("Error stack:", error.stack);
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
  app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:8080'], // フロントエンドのURLを指定
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true // クッキーを含むリクエストを許可
  }));

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

  // ナレッジベース管理用のエンドポイント
  app.post('/knowledge/add', async (req: Request, res: Response) => {
    const { text, source } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: "テキストが必要です" });
    }

    try {
      // テキストをチャンクに分割
      const chunks = text.split("\n\n");
      
      // Pineconeクライアントの初期化
      const client = PineconeClientSingleton.getInstance();
      const indexName = process.env.PINECONE_INDEX_NAME || "sales-coach";
      const pineconeIndex = client.index(indexName);
      
      // 各チャンクを処理
      const records = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (!chunk.trim()) continue; // 空のチャンクをスキップ
        
        // テキストの埋め込みを生成
        const embedding = await embeddings.embedQuery(chunk);
        
        // レコードを作成
        records.push({
          id: `manual-${Date.now()}-${i}`,
          values: embedding,
          metadata: {
            pageContent: chunk,
            source: source || `manual-${Date.now()}-${i}`,
          }
        });
      }
      
      // バッチサイズを設定（Pineconeの制限に合わせる）
      const BATCH_SIZE = 100;
      
      // バッチ処理でPineconeにデータを挿入
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        await pineconeIndex.upsert(batch);
      }
      
      res.json({ success: true, message: `${records.length}件のドキュメントが追加されました` });
    } catch (error: any) {
      logger.error("Pinecone error details:", {
        message: error.message,
        stack: error.stack,
        cause: error.cause,
        name: error.name,
        code: error.code
      });
      res.status(500).json({ 
        error: "Internal Server Error", 
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // ファイルアップロード用のミドルウェア設定
  const upload = multer({ dest: 'uploads/' });

  // ファイルアップロード用のエンドポイント
  app.post('/knowledge/upload', upload.single('file'), async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ error: "ファイルが必要です" });
    }

    try {
      // アップロードされたファイルのパス
      const filePath = req.file.path;
      const text = fs.readFileSync(filePath, "utf8");
      
      // ファイル削除
      fs.unlinkSync(filePath); // 処理が終わったらファイルを削除

      // テキストをチャンクに分割
      const chunks = text.split("\n\n");
      
      // Pineconeクライアントの初期化
      const client = PineconeClientSingleton.getInstance();
      const indexName = process.env.PINECONE_INDEX_NAME || "sales-coach";
      const pineconeIndex = client.index(indexName);
      
      // 各チャンクを処理
      const records = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (!chunk.trim()) continue; // 空のチャンクをスキップ
        
        // テキストの埋め込みを生成
        const embedding = await embeddings.embedQuery(chunk);
        
        // レコードを作成
        records.push({
          id: `file-${Date.now()}-${i}`,
          values: embedding,
          metadata: {
            pageContent: chunk,
            source: req.file?.originalname || `file-${Date.now()}-${i}`,
          }
        });
      }
      
      // バッチサイズを設定（Pineconeの制限に合わせる）
      const BATCH_SIZE = 100;
      
      // バッチ処理でPineconeにデータを挿入
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        await pineconeIndex.upsert(batch);
      }
      
      res.json({ success: true, message: `${records.length}件のドキュメントが追加されました` });
    } catch (error: any) {
      logger.error("Pinecone error details:", {
        message: error.message,
        stack: error.stack,
        cause: error.cause,
        name: error.name,
        code: error.code
      });
      res.status(500).json({ 
        error: "Internal Server Error", 
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // 指定されたポートでサーバーを起動
  const server = app.listen(PORT, () => {
    logger.info(`サーバーがポート${PORT}で起動しました。`);
    logger.info("利用可能なエンドポイント:");
    logger.info("- POST /ask");
    logger.info("- POST /test");
    logger.info("- POST /coaching");
    logger.info("- POST /knowledge/add");
    logger.info("- POST /knowledge/upload");
  });
}

// メイン関数を実行し、サーバー起動エラーをキャッチ
main().catch((err) => {
  logger.error("サーバーの起動に失敗しました:", err);
});
