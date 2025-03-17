// sales_coach_agent.ts (抜粋例)
import { Document } from "langchain/document";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { RetrievalQAChain } from "langchain/chains";
import { OpenAI } from "langchain/llms/openai";
import fs from "fs";
import path from "path";
import { logger } from "./logger";

export class SalesCoachAgent {
  private chainPromise: Promise<RetrievalQAChain>;

  constructor() {
    logger.info("SalesCoachAgent constructor called.");
    this.chainPromise = this.initChain();
  }

  public async ask(question: string): Promise<string> {
    logger.info(`SalesCoachAgent.ask() invoked with question: "${question}"`);
    try {
      const chain = await this.chainPromise;
      logger.info("RetrievalQAChain is ready. Calling .call() ...");
      const result = await chain.call({ query: question });
      logger.info("LLM result received:", result);
      return result.text;
    } catch (error) {
      logger.error("Error in SalesCoachAgent.ask():", error);
      throw error;
    }
  }

  private async initChain(): Promise<RetrievalQAChain> {
    logger.info("Initializing chain...");
    try {
      // 1. テキストファイル読み込み
      const dbPath = path.join(__dirname, "data", "fake_db.txt");
      logger.info("Reading file from:", dbPath);
      const content = fs.readFileSync(dbPath, "utf-8");
      logger.info(`File loaded. content length: ${content.length} chars`);

      // 2. Document配列を作成
      const docs = [new Document({ pageContent: content })];

      // 3. Embeddings + MemoryVectorStoreでインメモリ検索
      const apiKey = process.env.OPEN_API_KEY;
      if (!apiKey) {
        throw new Error("OPEN_API_KEY is not set in environment variables.");
      }
      const embeddings = new OpenAIEmbeddings({ openAIApiKey: apiKey });

      // 4. MemoryVectorStoreに docs を追加し、RetrievalQAChain で利用
      logger.info("Creating MemoryVectorStore...");
      const vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);
      logger.info("MemoryVectorStore successfully created.");

      // 5. LLM + VectorStore で RetrievalQAChain
      logger.info("Setting up OpenAI for QA chain...");
      const model = new OpenAI({
        openAIApiKey: apiKey,
        modelName: "gpt-4o-mini",
        temperature: 0,
      });
      const chain = RetrievalQAChain.fromLLM(model, vectorStore.asRetriever());

      logger.info("RetrievalQAChain is successfully initialized.");
      return chain;
    } catch (error) {
      logger.error("Error in SalesCoachAgent.initChain():", error);
      throw error;
    }
  }
}
