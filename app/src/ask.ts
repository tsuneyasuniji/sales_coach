/**
 * ask.ts
 * "POST /ask" エンドポイント:
 * ボディ: { question: string }
 * レスポンス: { answer: string }
 */

import { Router, Request, Response } from "express";
import { SalesCoachAgent } from "./sales_coach_agent";
import { logger } from "./logger";

export const askRoute = Router();

// POST /ask
askRoute.post("/", async (req: Request, res: Response) => {
  const { question } = req.body;
  if (!question) {
    return res.status(400).json({ error: "Missing 'question' in request body" });
  }

  try {
    const agent = new SalesCoachAgent();
    const answer = await agent.ask(question);
    res.json({ answer });
  } catch (error) {
    logger.error("Error in /ask route:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
