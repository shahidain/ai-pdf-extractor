import { pdf } from "pdf-to-img";
import fs from "fs/promises";
import path from "path";
import { config } from "./config.js";

export interface ConversionResult {
  pdfName: string;
  pagesDirectory: string;
  totalPages: number;
  imagePaths: string[];
}

/**
 * Convert all pages of a PDF to images
 */
export async function convertPdfToImages(pdfPath: string): Promise<ConversionResult> {
  const pdfName = path.basename(pdfPath, ".pdf");
  const outputDir = path.join(config.outputBaseDirectory, pdfName, "pages");

  // Create output directory
  await fs.mkdir(outputDir, { recursive: true });

  console.log(`Converting PDF: ${pdfName}`);
  console.log(`Output directory: ${outputDir}`);

  const imagePaths: string[] = [];
  let pageNumber = 1;

  // Convert PDF to images using pdf-to-img
  const document = await pdf(pdfPath, { scale: config.imageDensity / 72 }); // scale relative to 72 DPI

  for await (const image of document) {
    const imagePath = path.join(outputDir, `${pageNumber}.png`);
    await fs.writeFile(imagePath, image);
    imagePaths.push(imagePath);
    console.log(`  Page ${pageNumber} saved: ${imagePath}`);
    pageNumber++;
  }

  return {
    pdfName,
    pagesDirectory: outputDir,
    totalPages: imagePaths.length,
    imagePaths,
  };
}

/**
 * Get list of PDF files in the pdfs directory
 */
export async function getPdfFiles(): Promise<string[]> {
  try {
    const files = await fs.readdir(config.pdfsDirectory);
    const pdfFiles = files
      .filter(file => file.toLowerCase().endsWith(".pdf"))
      .map(file => path.join(config.pdfsDirectory, file));

    console.log(`Found ${pdfFiles.length} PDF file(s) in ${config.pdfsDirectory}`);
    return pdfFiles;
  } catch (error) {
    console.error(`Error reading pdfs directory: ${error}`);
    return [];
  }
}
