import OpenAI from "openai";
import fs from "fs/promises";
import { config } from "./config.js";
import { InnerPageParagraph, TokenUsage } from "./types.js";
import { SchemaDefinition, buildFirstPageJsonSchema, buildInnerPagesJsonSchema } from "./schemaLoader.js";

const openai = new OpenAI({
  apiKey: config.openaiApiKey,
});

// GPT-4.1 Pricing (per 1M tokens) - from OpenAI API pricing page
const PRICING = {
  inputPer1M: 2.0,   // $2.00 per 1M input tokens
  outputPer1M: 8.0,  // $8.00 per 1M output tokens
};

/**
 * Calculate cost from token usage
 */
export function calculateCost(tokenUsage: TokenUsage): number {
  const inputCost = (tokenUsage.inputTokens / 1_000_000) * PRICING.inputPer1M;
  const outputCost = (tokenUsage.outputTokens / 1_000_000) * PRICING.outputPer1M;
  return inputCost + outputCost;
}

/**
 * Aggregate multiple token usages
 */
export function aggregateTokenUsage(usages: TokenUsage[]): TokenUsage {
  return usages.reduce(
    (acc, usage) => ({
      inputTokens: acc.inputTokens + usage.inputTokens,
      outputTokens: acc.outputTokens + usage.outputTokens,
      totalTokens: acc.totalTokens + usage.totalTokens,
    }),
    { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
  );
}

export interface FirstPageResult {
  data: Record<string, unknown>;
  tokenUsage: TokenUsage;
}

/**
 * Analyze first page of PDF using GPT-4.1 with dynamic schema
 */
export async function analyzeFirstPage(
  imagePath: string,
  schema: SchemaDefinition
): Promise<FirstPageResult> {
  console.log(`Analyzing first page: ${imagePath}`);

  const imageBuffer = await fs.readFile(imagePath);
  const base64Image = imageBuffer.toString("base64");
  const mimeType = `image/${config.imageFormat}`;

  const responseFormat = buildFirstPageJsonSchema(schema);

  const response = await openai.chat.completions.create({
    model: config.gptModel,
    max_tokens: config.maxTokens,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: schema.firstPagePrompt },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
              detail: "high",
            },
          },
        ],
      },
    ],
    response_format: responseFormat as unknown as OpenAI.ResponseFormatJSONSchema,
  });

  // Extract token usage
  const tokenUsage: TokenUsage = {
    inputTokens: response.usage?.prompt_tokens || 0,
    outputTokens: response.usage?.completion_tokens || 0,
    totalTokens: response.usage?.total_tokens || 0,
  };

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from GPT for first page analysis");
  }

  const data = JSON.parse(content) as Record<string, unknown>;

  return {
    data,
    tokenUsage,
  };
}

export interface InnerPageResult {
  paragraphs: InnerPageParagraph[];
  tokenUsage: TokenUsage;
}

/**
 * Analyze inner page of PDF using GPT-4.1
 */
export async function analyzeInnerPage(
  imagePath: string,
  pageNumber: number
): Promise<InnerPageResult> {
  console.log(`Analyzing page ${pageNumber}: ${imagePath}`);

  const imageBuffer = await fs.readFile(imagePath);
  const base64Image = imageBuffer.toString("base64");
  const mimeType = `image/${config.imageFormat}`;

  const prompt = `You are analyzing page ${pageNumber} of a research report. Extract all content as structured paragraphs.

Instructions:
- Extract EVERY piece of text visible on the page in reading order (top to bottom, left to right)
- For each text block, classify its style from these options:
  - "page header": Header text at the top of the page (company name, report title, page indicators)
  - "chapter heading": Main section titles (large, bold text introducing a major section)
  - "subheading 1": First level subheading
  - "subheading 2": Second level subheading (smaller than subheading 1)
  - "body text": Regular paragraph text
  - "callout": Highlighted boxes, key takeaways, or special callout text
  - "exhibit title": Titles of figures, charts, tables (e.g., "Figure 1:", "Exhibit 2:")
  - "exhibit source": Source citations for exhibits (e.g., "Source: Company Reports")
  - "bullet level 1": First level bullet point
  - "bullet level 2": Second level (indented) bullet point
  - "bullet level 3": Third level (further indented) bullet point
  - "page footer": Footer text at the bottom of the page
  - "footnote": Footnote text (usually smaller, at bottom)
  - "table": For tables/data grids - extract as structured data

IMPORTANT FOR TABLES:
- When you encounter a table, use style: "table"
- Set "text" to null
- Provide a "table" object with:
  - "headers": array of column header strings
  - "rows": array of arrays, each inner array representing a row's cell values
- Extract ALL data from tables including numbers, percentages, dates, and text

For non-table content:
- The "text" field should contain the EXACT text as it appears - do not summarize or modify
- Set "table" to null for non-table content
- Maintain the exact order of content as it appears on the page`;

  const responseFormat = buildInnerPagesJsonSchema();

  const response = await openai.chat.completions.create({
    model: config.gptModel,
    max_tokens: config.maxTokens,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
              detail: "high",
            },
          },
        ],
      },
    ],
    response_format: responseFormat as unknown as OpenAI.ResponseFormatJSONSchema,
  });

  // Extract token usage
  const tokenUsage: TokenUsage = {
    inputTokens: response.usage?.prompt_tokens || 0,
    outputTokens: response.usage?.completion_tokens || 0,
    totalTokens: response.usage?.total_tokens || 0,
  };

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error(`No response from GPT for page ${pageNumber} analysis`);
  }

  const parsed = JSON.parse(content) as { paragraphs: InnerPageParagraph[] };

  return {
    paragraphs: parsed.paragraphs,
    tokenUsage,
  };
}
