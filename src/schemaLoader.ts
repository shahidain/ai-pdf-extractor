import fs from "fs/promises";
import path from "path";

export interface SchemaDefinition {
  name: string;
  firstPageSchema: Record<string, unknown>;
  innerPagesSchema: Record<string, unknown>;
  firstPagePrompt: string;
}

/**
 * Load and parse a schema JSON file dynamically
 */
export async function loadSchema(schemaFileName: string): Promise<SchemaDefinition> {
  // Schema files are stored in the 'schemas' folder
  const schemaPath = path.join(process.cwd(), "schemas", schemaFileName);
  
  try {
    const schemaContent = await fs.readFile(schemaPath, "utf-8");
    const schema = JSON.parse(schemaContent);
    
    // Extract the schema name from filename (e.g., "stock_report.json" -> "stock_report")
    const name = path.basename(schemaFileName, ".json");
    
    // Get the first page schema
    const firstPageSchema = schema.properties?.firstPage || {};
    
    // Get the inner pages schema
    const innerPagesSchema = schema.properties?.innerPagesParagraphs || {};
    
    // Generate a dynamic prompt based on the first page schema properties
    const firstPagePrompt = generateFirstPagePrompt(firstPageSchema, name);
    
    return {
      name,
      firstPageSchema,
      innerPagesSchema,
      firstPagePrompt,
    };
  } catch (error) {
    throw new Error(`Failed to load schema from ${schemaFileName}: ${error}`);
  }
}

/**
 * Generate a dynamic prompt based on the schema properties
 */
function generateFirstPagePrompt(schema: Record<string, unknown>, schemaName: string): string {
  const properties = (schema as { properties?: Record<string, unknown> }).properties || {};
  const fieldsList = Object.keys(properties).map(key => `- ${key}`).join("\n");
  
  const reportType = schemaName.includes("sector") ? "sector" : "stock research";
  
  return `You are analyzing the first page of a ${reportType} report. Extract all information from this image.

Extract the following fields:
${fieldsList}

Instructions:
- Extract all text exactly as shown
- For dates, format as YYYY-MM-DD
- For numbers, extract as numeric values
- For arrays (like authors, bulletPoints), extract all items
- If a field is not visible, use an appropriate default value`;
}

/**
 * Build a JSON schema suitable for OpenAI structured outputs
 */
export function buildFirstPageJsonSchema(schema: SchemaDefinition): Record<string, unknown> {
  const properties = (schema.firstPageSchema as { properties?: Record<string, unknown> }).properties || {};
  
  // Add additionalProperties: false to make it strict
  const strictProperties: Record<string, unknown> = {};
  const required: string[] = [];
  
  for (const [key, value] of Object.entries(properties)) {
    const prop = value as Record<string, unknown>;
    
    // Handle nested objects (like authors array items)
    if (prop.type === "array" && prop.items) {
      const items = prop.items as Record<string, unknown>;
      if (items.type === "object" && items.properties) {
        const nestedProps: Record<string, unknown> = {};
        const nestedRequired: string[] = [];
        for (const [nestedKey, nestedValue] of Object.entries(items.properties as Record<string, unknown>)) {
          const nestedProp = { ...(nestedValue as Record<string, unknown>) };
          delete nestedProp.format; // Remove format as it's not supported in strict mode
          nestedProps[nestedKey] = nestedProp;
          nestedRequired.push(nestedKey);
        }
        strictProperties[key] = {
          type: "array",
          items: {
            type: "object",
            properties: nestedProps,
            required: nestedRequired,
            additionalProperties: false,
          },
        };
      } else {
        strictProperties[key] = { ...prop };
      }
    } else if (prop.type === "object" && prop.properties) {
      // Handle nested objects
      const nestedProps: Record<string, unknown> = {};
      const nestedRequired: string[] = [];
      for (const [nestedKey, nestedValue] of Object.entries(prop.properties as Record<string, unknown>)) {
        const nestedProp = { ...(nestedValue as Record<string, unknown>) };
        delete nestedProp.format;
        nestedProps[nestedKey] = nestedProp;
        nestedRequired.push(nestedKey);
      }
      strictProperties[key] = {
        type: "object",
        properties: nestedProps,
        required: nestedRequired,
        additionalProperties: false,
      };
    } else {
      const cleanProp = { ...prop };
      delete cleanProp.format; // Remove format as it's not supported in strict mode
      strictProperties[key] = cleanProp;
    }
    required.push(key);
  }
  
  return {
    type: "json_schema",
    json_schema: {
      name: "first_page_response",
      strict: true,
      schema: {
        type: "object",
        properties: strictProperties,
        required,
        additionalProperties: false,
      },
    },
  };
}

/**
 * Build the inner pages JSON schema for structured output
 */
export function buildInnerPagesJsonSchema(): Record<string, unknown> {
  return {
    type: "json_schema",
    json_schema: {
      name: "inner_page_response",
      strict: true,
      schema: {
        type: "object",
        properties: {
          paragraphs: {
            type: "array",
            items: {
              type: "object",
              properties: {
                style: {
                  type: "string",
                  enum: [
                    "page header",
                    "chapter heading",
                    "subheading 1",
                    "subheading 2",
                    "body text",
                    "callout",
                    "exhibit title",
                    "exhibit source",
                    "bullet level 1",
                    "bullet level 2",
                    "bullet level 3",
                    "page footer",
                    "footnote",
                    "table",
                  ],
                },
                text: {
                  type: ["string", "null"],
                },
                table: {
                  type: ["object", "null"],
                  properties: {
                    headers: {
                      type: "array",
                      items: { type: "string" },
                    },
                    rows: {
                      type: "array",
                      items: {
                        type: "array",
                        items: { type: "string" },
                      },
                    },
                  },
                  required: ["headers", "rows"],
                  additionalProperties: false,
                },
              },
              required: ["style", "text", "table"],
              additionalProperties: false,
            },
          },
        },
        required: ["paragraphs"],
        additionalProperties: false,
      },
    },
  };
}
