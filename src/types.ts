// Dynamic types for schema-based extraction

export interface Author {
  name: string;
  email: string;
  phone: string;
}

export interface SummaryParagraph {
  heading: string;
  content: string;
}

export type ParagraphStyle =
  | "page header"
  | "chapter heading"
  | "subheading 1"
  | "subheading 2"
  | "body text"
  | "callout"
  | "exhibit title"
  | "exhibit source"
  | "bullet level 1"
  | "bullet level 2"
  | "bullet level 3"
  | "page footer"
  | "footnote"
  | "table";

export interface TableData {
  headers: string[];
  rows: string[][];
}

export interface InnerPageParagraph {
  style: ParagraphStyle;
  text?: string | null;
  table?: TableData | null;
  pageNumber?: number;
}

// Generic report structure that works with any schema
export interface Report {
  firstPage: Record<string, unknown>;
  innerPagesParagraphs: InnerPageParagraph[];
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ProcessingResult {
  pdfName: string;
  success: boolean;
  outputPath?: string;
  error?: string;
  tokenUsage?: TokenUsage;
  estimatedCostUSD?: number;
}

export interface Config {
  openaiApiKey: string;
  pdfsDirectory: string;
  outputBaseDirectory: string;
  imageDensity: number;
  imageFormat: string;
  imageQuality: number;
  gptModel: string;
  maxTokens: number;
  schemaFile: string | undefined;
}
