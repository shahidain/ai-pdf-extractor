# Document Extractor

A TypeScript application that extracts structured data from research report PDFs using GPT-4.1 vision capabilities.

## Features

- Converts PDF pages to high-quality images
- Analyzes images using OpenAI's GPT-4.1 model
- Extracts structured data according to configurable JSON schemas
- Handles first page (summary) and inner pages differently
- Outputs JSON and Markdown files with extracted data
- Supports multiple schema types (stock reports, sector reports, etc.)

## Prerequisites

- Node.js 18+
- npm or yarn
- OpenAI API key with access to GPT-4.1

## Installation

1. Clone or navigate to the project directory

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
# Create a .env file and add your configuration
touch .env
```

## Environment Variables

Create a `.env` file in the project root with the following keys:

```env
# Required
OPENAI_API_KEY=your_openai_api_key_here

# Processing Configuration
PDFS_DIRECTORY=./pdfs              # Directory containing PDF files to process
OUTPUT_BASE_DIRECTORY=./extraction # Directory where results will be saved

# Image Conversion Settings
IMAGE_DENSITY=300                  # DPI for PDF to image conversion (higher = better quality)
IMAGE_FORMAT=png                   # Output image format (png recommended)
IMAGE_QUALITY=100                  # Image quality (1-100)

# GPT Model Configuration
GPT_MODEL=gpt-4.1                  # OpenAI model to use
MAX_TOKENS=4096                    # Maximum tokens per API request

# Schema Configuration
SCHEMA_FILE=sector_report.json     # Schema file to use (from schemas/ directory)
```

### Available Schema Files

- `stock_report.json` - For individual stock research reports
- `sector_report.json` - For sector/industry analysis reports

## How to Run

### Step 1: Set up your environment
```bash
# Install dependencies
npm install

# Create and configure your .env file with your OpenAI API key
```

### Step 2: Add your PDF files
```bash
# Place your PDF files in the pdfs directory
cp /path/to/your/report.pdf ./pdfs/
```

### Step 3: Build and run
```bash
# Build the TypeScript project
npm run build

# Run the extractor
npm start
```

### Alternative: Run in development mode
```bash
npm run dev
```

## Output Structure

For each PDF (e.g., `report_1.pdf`), the output will be:

```
extraction/
└── report_1/
    ├── pages/
    │   ├── 1.png
    │   ├── 2.png
    │   └── ...
    ├── report_1.json
    └── REPORT_1.md
```

## Output Files

### JSON Output
The extracted JSON contains structured data from the PDF:

```json
{
  "firstPage": {
    "reportType": "Company Update",
    "reportDate": "2024-01-15",
    "reportTitle": "...",
    "bloombergCode": "AAPL US",
    "companyName": "Apple Inc.",
    "targetPrice": 200,
    "marketPrice": 185,
    "rating": "Buy",
    "previousRating": "Hold",
    "upsideDownside": 8.1,
    "authors": [...],
    "bulletPoints": [...],
    "summaryParagraphs": [...]
  },
  "innerPagesParagraphs": [
    {
      "style": "chapter heading",
      "text": "Financial Analysis",
      "pageNumber": 2
    },
    ...
  ]
}
```

### Markdown Output
A formatted Markdown file is also generated with the extracted content for easy reading.

## NPM Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `build` | `npm run build` | Compile TypeScript to JavaScript |
| `start` | `npm start` | Run the compiled application |
| `dev` | `npm run dev` | Run directly with ts-node (development) |

## Troubleshooting

### API Rate Limits
If you hit OpenAI rate limits, consider adding delays between page processing or reducing the number of concurrent requests.

### Large PDFs
For PDFs with many pages, processing may take a while due to API calls for each page. Monitor progress in the console output.

### Missing API Key
Ensure your `OPENAI_API_KEY` is set correctly in the `.env` file.

## License

MIT
