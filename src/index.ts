import fs from "fs/promises";
import path from "path";
import { config } from "./config.js";
import { getPdfFiles, convertPdfToImages } from "./pdfProcessor.js";
import { analyzeFirstPage, analyzeInnerPage, calculateCost, aggregateTokenUsage } from "./imageAnalyzer.js";
import { loadSchema, SchemaDefinition } from "./schemaLoader.js";
import { Report, ProcessingResult, InnerPageParagraph, TokenUsage, Author, SummaryParagraph } from "./types.js";

/**
 * Generate markdown from first page data dynamically based on schema
 */
function generateFirstPageMarkdown(firstPage: Record<string, unknown>): string[] {
  const lines: string[] = [];

  // Try to find a title field
  const title = firstPage.reportTitle || firstPage.title || "Report";
  lines.push(`# ${title}`);
  lines.push("");

  // Add subtitle if exists
  if (firstPage.reportSubTitle) {
    lines.push(`## ${firstPage.reportSubTitle}`);
    lines.push("");
  }

  // Collect metadata fields for a table
  const metadataFields = [
    "reportType",
    "reportDate",
    "companyName",
    "sectorName",
    "bloombergCode",
    "rating",
    "previousRating",
    "targetPrice",
    "marketPrice",
    "upsideDownside",
  ];

  const displayMetadata: [string, string][] = [];
  for (const field of metadataFields) {
    if (firstPage[field] !== undefined && firstPage[field] !== null) {
      const label = field
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase())
        .trim();
      let value = String(firstPage[field]);
      if (field === "upsideDownside") {
        value = `${value}%`;
      }
      displayMetadata.push([label, value]);
    }
  }

  if (displayMetadata.length > 0) {
    lines.push("| Field | Value |");
    lines.push("|-------|-------|");
    for (const [label, value] of displayMetadata) {
      lines.push(`| ${label} | ${value} |`);
    }
    lines.push("");
  }

  // Authors
  const authors = firstPage.authors as Author[] | undefined;
  if (authors && authors.length > 0) {
    lines.push("## Authors");
    lines.push("");
    for (const author of authors) {
      lines.push(`- **${author.name}**`);
      if (author.email) lines.push(`  - Email: ${author.email}`);
      if (author.phone) lines.push(`  - Phone: ${author.phone}`);
    }
    lines.push("");
  }

  // Bullet points
  const bulletPoints = firstPage.bulletPoints as string[] | undefined;
  if (bulletPoints && bulletPoints.length > 0) {
    lines.push("## Key Highlights");
    lines.push("");
    for (const point of bulletPoints) {
      lines.push(`- ${point}`);
    }
    lines.push("");
  }

  // Summary paragraphs
  const summaryParagraphs = firstPage.summaryParagraphs as SummaryParagraph[] | undefined;
  if (summaryParagraphs && summaryParagraphs.length > 0) {
    lines.push("## Summary");
    lines.push("");
    for (const para of summaryParagraphs) {
      if (para.heading) {
        lines.push(`### ${para.heading}`);
        lines.push("");
      }
      lines.push(para.content);
      lines.push("");
    }
  }

  return lines;
}

/**
 * Generate inner pages content markdown
 */
function generateInnerPagesMarkdown(innerPagesParagraphs: InnerPageParagraph[]): string[] {
  const lines: string[] = [];

  if (innerPagesParagraphs && innerPagesParagraphs.length > 0) {
    let currentPage: number | undefined = undefined;

    for (const para of innerPagesParagraphs) {
      // Add page header when page number changes
      if (para.pageNumber !== undefined && para.pageNumber !== currentPage) {
        currentPage = para.pageNumber;
        lines.push("");
        lines.push(`Page ${currentPage}`);
        lines.push("-----------------------------------------");
        lines.push("");
      }
      const text = para.text || "";
      switch (para.style) {
        case "page header":
          // Skip page headers in markdown
          break;
        case "chapter heading":
          lines.push(`## ${text}`);
          lines.push("");
          break;
        case "subheading 1":
          lines.push(`### ${text}`);
          lines.push("");
          break;
        case "subheading 2":
          lines.push(`#### ${text}`);
          lines.push("");
          break;
        case "body text":
          lines.push(text);
          lines.push("");
          break;
        case "callout":
          lines.push(`> **${text}**`);
          lines.push("");
          break;
        case "exhibit title":
          lines.push(`**${text}**`);
          lines.push("");
          break;
        case "exhibit source":
          lines.push(`*${text}*`);
          lines.push("");
          break;
        case "bullet level 1":
          lines.push(`- ${text}`);
          break;
        case "bullet level 2":
          lines.push(`  - ${text}`);
          break;
        case "bullet level 3":
          lines.push(`    - ${text}`);
          break;
        case "page footer":
          // Skip page footers
          break;
        case "footnote":
          lines.push(`<sup>${text}</sup>`);
          lines.push("");
          break;
        case "table":
          if (para.table) {
            const { headers, rows } = para.table;
            if (headers && headers.length > 0) {
              lines.push(`| ${headers.join(" | ")} |`);
              lines.push(`| ${headers.map(() => "---").join(" | ")} |`);
              for (const row of rows) {
                lines.push(`| ${row.join(" | ")} |`);
              }
              lines.push("");
            }
          }
          break;
        default:
          if (text) {
            lines.push(text);
            lines.push("");
          }
      }
    }
  }

  return lines;
}

/**
 * Generate complete markdown from the extracted report
 */
function generateMarkdown(
  report: Report,
  schemaName: string,
  tokenUsage: TokenUsage,
  estimatedCostUSD: number
): string {
  const lines: string[] = [];

  // Add processing cost information at the beginning
  lines.push("## 📊 Processing Statistics");
  lines.push("");
  lines.push("| Metric | Value |");
  lines.push("|--------|-------|");
  lines.push(`| Schema | ${schemaName} |`);
  lines.push(`| Input Tokens | ${tokenUsage.inputTokens.toLocaleString()} |`);
  lines.push(`| Output Tokens | ${tokenUsage.outputTokens.toLocaleString()} |`);
  lines.push(`| Total Tokens | ${tokenUsage.totalTokens.toLocaleString()} |`);
  lines.push(`| **Estimated Cost (USD)** | **$${estimatedCostUSD.toFixed(4)}** |`);
  lines.push("");
  lines.push("---");
  lines.push("");

  // Generate first page markdown dynamically with page header
  lines.push("Page 1");
  lines.push("-----------------------------------------");
  lines.push("");
  lines.push(...generateFirstPageMarkdown(report.firstPage));

  // Generate inner pages markdown
  lines.push(...generateInnerPagesMarkdown(report.innerPagesParagraphs));

  return lines.join("\n");
}

/**
 * Check if a PDF has already been processed (markdown file exists)
 */
async function isAlreadyProcessed(pdfPath: string): Promise<boolean> {
  const pdfName = path.basename(pdfPath, ".pdf");
  const outputDir = path.join(config.outputBaseDirectory, pdfName);
  const mdOutputPath = path.join(outputDir, `${pdfName.toUpperCase()}.md`);

  try {
    await fs.access(mdOutputPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Regenerate markdown files from existing JSON files
 * This is useful when JSON files are manually updated
 */
async function regenerateMarkdownFiles(schema: SchemaDefinition): Promise<void> {
  console.log("\n🔄 Regenerating markdown files from existing JSON...");

  const outputDir = config.outputBaseDirectory;

  try {
    const entries = await fs.readdir(outputDir, { withFileTypes: true });
    const reportDirs = entries.filter((e) => e.isDirectory());

    let regenerated = 0;

    for (const dir of reportDirs) {
      const reportName = dir.name;
      const jsonPath = path.join(outputDir, reportName, `${reportName}.json`);
      const mdPath = path.join(outputDir, reportName, `${reportName.toUpperCase()}.md`);

      try {
        // Check if JSON file exists
        await fs.access(jsonPath);

        // Read and parse JSON
        const jsonContent = await fs.readFile(jsonPath, "utf-8");
        const report = JSON.parse(jsonContent) as Report;

        // Read existing markdown to extract token usage if available
        let tokenUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
        let estimatedCostUSD = 0;

        try {
          const existingMd = await fs.readFile(mdPath, "utf-8");
          // Try to extract token usage from existing markdown
          const inputMatch = existingMd.match(/Input Tokens \| ([\d,]+)/);
          const outputMatch = existingMd.match(/Output Tokens \| ([\d,]+)/);
          const totalMatch = existingMd.match(/Total Tokens \| ([\d,]+)/);
          const costMatch = existingMd.match(/Estimated Cost \(USD\)\*\* \| \*\*\$([\d.]+)/);

          if (inputMatch) tokenUsage.inputTokens = parseInt(inputMatch[1].replace(/,/g, ""));
          if (outputMatch) tokenUsage.outputTokens = parseInt(outputMatch[1].replace(/,/g, ""));
          if (totalMatch) tokenUsage.totalTokens = parseInt(totalMatch[1].replace(/,/g, ""));
          if (costMatch) estimatedCostUSD = parseFloat(costMatch[1]);
        } catch {
          // Markdown doesn't exist or couldn't parse, use defaults
        }

        // Generate new markdown
        const markdown = generateMarkdown(report, schema.name, tokenUsage, estimatedCostUSD);
        await fs.writeFile(mdPath, markdown, "utf-8");

        console.log(`   ✅ Regenerated: ${mdPath}`);
        regenerated++;
      } catch {
        // JSON file doesn't exist for this directory, skip
      }
    }

    console.log(`\n✅ Regenerated ${regenerated} markdown file(s)`);
  } catch (error) {
    console.error(`❌ Error regenerating markdown files: ${error}`);
  }
}

/**
 * Process a single PDF file with the given schema
 */
async function processPdf(pdfPath: string, schema: SchemaDefinition): Promise<ProcessingResult> {
  const pdfName = path.basename(pdfPath, ".pdf");
  const allTokenUsages: TokenUsage[] = [];

  try {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Processing: ${pdfName}`);
    console.log(`Schema: ${schema.name}`);
    console.log("=".repeat(60));

    // Step 1: Convert PDF to images
    console.log("\n📄 Step 1: Converting PDF to images...");
    const conversionResult = await convertPdfToImages(pdfPath);
    console.log(`✅ Converted ${conversionResult.totalPages} pages to images`);

    if (conversionResult.totalPages === 0) {
      throw new Error("No pages were converted from PDF");
    }

    // Step 2: Analyze first page with schema
    console.log("\n🔍 Step 2: Analyzing first page...");
    const firstPageImage = conversionResult.imagePaths[0];
    const firstPageResult = await analyzeFirstPage(firstPageImage, schema);
    allTokenUsages.push(firstPageResult.tokenUsage);
    console.log(`✅ First page analyzed (tokens: ${firstPageResult.tokenUsage.totalTokens})`);

    // Step 3: Analyze inner pages
    console.log("\n🔍 Step 3: Analyzing inner pages...");
    const innerPagesParagraphs: Report["innerPagesParagraphs"] = [];

    for (let i = 1; i < conversionResult.imagePaths.length; i++) {
      const imagePath = conversionResult.imagePaths[i];
      const pageNumber = i + 1;

      try {
        const result = await analyzeInnerPage(imagePath, pageNumber);
        // Add page number to each paragraph
        const paragraphsWithPageNumber = result.paragraphs.map(p => ({ ...p, pageNumber }));
        innerPagesParagraphs.push(...paragraphsWithPageNumber);
        allTokenUsages.push(result.tokenUsage);
        console.log(`✅ Page ${pageNumber} analyzed: ${result.paragraphs.length} content blocks (tokens: ${result.tokenUsage.totalTokens})`);
      } catch (error) {
        console.error(`⚠️ Error analyzing page ${pageNumber}: ${error}`);
      }
    }

    console.log(`✅ Total inner page content blocks: ${innerPagesParagraphs.length}`);

    // Calculate total token usage and cost
    const totalTokenUsage = aggregateTokenUsage(allTokenUsages);
    const estimatedCostUSD = calculateCost(totalTokenUsage);

    console.log(`\n💰 Token Usage Summary:`);
    console.log(`   Input tokens: ${totalTokenUsage.inputTokens.toLocaleString()}`);
    console.log(`   Output tokens: ${totalTokenUsage.outputTokens.toLocaleString()}`);
    console.log(`   Total tokens: ${totalTokenUsage.totalTokens.toLocaleString()}`);
    console.log(`   Estimated cost: $${estimatedCostUSD.toFixed(4)} USD`);

    // Step 4: Compile and save the report
    console.log("\n💾 Step 4: Saving extracted data...");
    const report: Report = {
      firstPage: firstPageResult.data,
      innerPagesParagraphs,
    };

    const outputDir = path.join(config.outputBaseDirectory, pdfName);
    const jsonOutputPath = path.join(outputDir, `${pdfName}.json`);
    const mdOutputPath = path.join(outputDir, `${pdfName.toUpperCase()}.md`);

    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(jsonOutputPath, JSON.stringify(report, null, 2), "utf-8");
    console.log(`✅ JSON saved to: ${jsonOutputPath}`);

    // Step 5: Generate markdown
    console.log("\n📝 Step 5: Generating markdown...");
    const markdown = generateMarkdown(report, schema.name, totalTokenUsage, estimatedCostUSD);
    await fs.writeFile(mdOutputPath, markdown, "utf-8");
    console.log(`✅ Markdown saved to: ${mdOutputPath}`);

    return {
      pdfName,
      success: true,
      outputPath: jsonOutputPath,
      tokenUsage: totalTokenUsage,
      estimatedCostUSD,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`❌ Error processing ${pdfName}: ${errorMessage}`);

    return {
      pdfName,
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const regenerateOnly = args.includes("--regenerate-md") || args.includes("-r");

  console.log("🚀 Document Extractor Started");
  console.log(`📁 PDFs Directory: ${config.pdfsDirectory}`);
  console.log(`📁 Output Directory: ${config.outputBaseDirectory}`);
  console.log(`🤖 GPT Model: ${config.gptModel}`);
  console.log(`📋 Schema File: ${config.schemaFile}`);

  // Load the schema
  let schema: SchemaDefinition;
  if (!config.schemaFile) {
    console.error("❌ Schema file is not configured. Please set SCHEMA_FILE in your environment.");
    process.exit(1);
  }
  try {
    schema = await loadSchema(config.schemaFile);
    console.log(`✅ Schema loaded: ${schema.name}`);
  } catch (error) {
    console.error(`❌ Failed to load schema: ${error}`);
    process.exit(1);
  }

  // If regenerate-only mode, just regenerate markdown files and exit
  if (regenerateOnly) {
    await regenerateMarkdownFiles(schema);
    console.log("\n🏁 Document Extractor Finished (Markdown Regeneration Mode)");
    return;
  }

  // Ensure directories exist
  await fs.mkdir(config.pdfsDirectory, { recursive: true });
  await fs.mkdir(config.outputBaseDirectory, { recursive: true });

  // Get all PDF files
  const pdfFiles = await getPdfFiles();

  if (pdfFiles.length === 0) {
    console.log("\n⚠️ No PDF files found in the pdfs directory.");
    console.log("Please add PDF files to process.");
    return;
  }

  // Filter out already processed PDFs
  const toProcess: string[] = [];
  const skipped: string[] = [];

  for (const pdfPath of pdfFiles) {
    const alreadyProcessed = await isAlreadyProcessed(pdfPath);
    if (alreadyProcessed) {
      skipped.push(path.basename(pdfPath, ".pdf"));
    } else {
      toProcess.push(pdfPath);
    }
  }

  if (skipped.length > 0) {
    console.log(`\n⏭️ Skipping ${skipped.length} already processed PDF(s):`);
    for (const name of skipped) {
      console.log(`   - ${name}`);
    }
  }

  if (toProcess.length === 0) {
    console.log("\n✅ All PDFs have already been processed.");
    return;
  }

  console.log(`\n📄 Processing ${toProcess.length} PDF(s)...`);

  // Process each PDF
  const results: ProcessingResult[] = [];

  for (const pdfPath of toProcess) {
    const result = await processPdf(pdfPath, schema);
    results.push(result);
  }

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 PROCESSING SUMMARY");
  console.log("=".repeat(60));

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  // Calculate total costs
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCost = 0;

  for (const result of successful) {
    if (result.tokenUsage) {
      totalInputTokens += result.tokenUsage.inputTokens;
      totalOutputTokens += result.tokenUsage.outputTokens;
    }
    if (result.estimatedCostUSD) {
      totalCost += result.estimatedCostUSD;
    }
  }

  console.log(`\n✅ Successful: ${successful.length}`);
  for (const result of successful) {
    const costStr = result.estimatedCostUSD ? ` ($${result.estimatedCostUSD.toFixed(4)})` : "";
    console.log(`   - ${result.pdfName}: ${result.outputPath}${costStr}`);
  }

  if (failed.length > 0) {
    console.log(`\n❌ Failed: ${failed.length}`);
    for (const result of failed) {
      console.log(`   - ${result.pdfName}: ${result.error}`);
    }
  }

  console.log(`\n💰 TOTAL COST SUMMARY:`);
  console.log(`   Input tokens: ${totalInputTokens.toLocaleString()}`);
  console.log(`   Output tokens: ${totalOutputTokens.toLocaleString()}`);
  console.log(`   Total tokens: ${(totalInputTokens + totalOutputTokens).toLocaleString()}`);
  console.log(`   Total estimated cost: $${totalCost.toFixed(4)} USD`);

  console.log("\n🏁 Document Extractor Finished");
}

// Run the main function
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
