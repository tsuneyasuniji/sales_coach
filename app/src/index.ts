/**
 * index.ts
 * アプリケーションのメインエントリーポイント。
 * Expressサーバを起動して、/ask エンドポイントでLangChainの処理を提供。
 */

// 環境変数を読み込む（.env）
import "dotenv/config";
import express from "express";
import { askRoute } from "./ask";
import { logger } from "./logger";

const PORT = process.env.PORT || 3000;  // デフォルトで3000番ポート

async function main() {
  const app = express();
  app.use(express.json());  // JSONボディをパース

  // /ask へのルーティング
  app.use("/ask", askRoute);

  app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
  });
}

// 実行
main().catch((err) => {
  logger.error("Failed to start server:", err);
});
