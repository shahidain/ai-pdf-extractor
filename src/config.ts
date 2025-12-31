import dotenv from "dotenv";
import path from "path";
import { Config } from "./types.js";

// Load environment variables
dotenv.config();

export function loadConfig(): Config {
  const requiredEnvVars = ["OPENAI_API_KEY"];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  // Get schema file from command line argument (skip flags starting with -) or environment variable
  const nonFlagArgs = process.argv.slice(2).filter((arg) => !arg.startsWith("-"));
  const schemaFile = nonFlagArgs[0] || process.env.SCHEMA_FILE;

  return {
    openaiApiKey: process.env.OPENAI_API_KEY!,
    pdfsDirectory: path.resolve(process.env.PDFS_DIRECTORY || "./pdfs"),
    outputBaseDirectory: path.resolve(process.env.OUTPUT_BASE_DIRECTORY || "./extraction"),
    imageDensity: parseInt(process.env.IMAGE_DENSITY || "300", 10),
    imageFormat: process.env.IMAGE_FORMAT || "png",
    imageQuality: parseInt(process.env.IMAGE_QUALITY || "100", 10),
    gptModel: process.env.GPT_MODEL || "gpt-4.1",
    maxTokens: parseInt(process.env.MAX_TOKENS || "4096", 10),
    schemaFile,
  };
}

export const config = loadConfig();
