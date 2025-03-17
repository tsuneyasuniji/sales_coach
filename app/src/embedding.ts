/**
 * embedding.ts
 * Embeddingsの初期化をまとめたい場合のサンプル
 */

import { OpenAIEmbeddings } from "langchain/embeddings/openai";

export const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPEN_API_KEY,
  // その他パラメータを必要に応じて設定
});
