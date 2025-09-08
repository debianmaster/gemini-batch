import fs from "node:fs";
import path from "node:path";
import type { File } from "@google/genai";
import { glob } from "glob";
import prettyBytes from "pretty-bytes";
import { BatchProcessor } from "../processor.js";
import { formatDate, logger } from "../utils.js";

export async function handleFileList(options: {
  limit: number;
}): Promise<File[]> {
  const processor = new BatchProcessor();

  try {
    logger.createSpinner("Fetching files from Gemini...");
    logger.startSpinner();

    const files = await processor.listFiles(options.limit);
    logger.stopSpinner();

    if (files.length === 0) {
      logger.warn("No files found");
      return [];
    }

    const Table = (await import("cli-table3")).default;
    const table = new Table({
      head: ["File Name", "Display Name", "Size", "MIME Type", "Created"],
      style: {
        head: [],
        border: [],
      },
    });

    for (const file of files) {
      table.push([
        file.name || "Unknown",
        file.displayName || "-",
        file.sizeBytes ? `${prettyBytes(Number(file.sizeBytes))}` : "-",
        file.mimeType || "-",
        file.createTime ? formatDate(file.createTime) : "-",
      ]);
    }

    logger.log(table.toString());

    return files;
  } catch (error) {
    logger.stopSpinner();
    logger.error(
      `Failed to fetch files: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  } finally {
    await processor.close();
  }
}

export async function handleFileGet(fileName: string): Promise<File | null> {
  const processor = new BatchProcessor();

  try {
    logger.createSpinner(`Fetching file details for ${fileName}...`);
    logger.startSpinner();

    const file = await processor.getFile(fileName);
    logger.stopSpinner();

    if (!file) {
      logger.error(`File not found: ${fileName}`);
      logger.info("");
      logger.info("Use 'gemini-batch file list' to see available files");
      return null;
    }

    logger.info(`File Details:`);
    logger.log("");
    logger.log(`Name: ${file.name || "Unknown"}`);
    logger.log(`Display Name: ${file.displayName || "-"}`);
    logger.log(
      `Size: ${file.sizeBytes ? `${prettyBytes(Number(file.sizeBytes))}` : "-"}`,
    );
    logger.log(`MIME Type: ${file.mimeType || "-"}`);
    logger.log(
      `Created: ${file.createTime ? formatDate(file.createTime) : "-"}`,
    );
    logger.log(`State: ${file.state || "-"}`);
    if (file.uri) {
      logger.log(`URI: ${file.uri}`);
    }
    return file;
  } catch (error) {
    logger.stopSpinner();
    logger.error(
      `Failed to fetch file details: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  } finally {
    await processor.close();
  }
}

export async function handleFileCreate(options: {
  prompt: string;
  input: string;
  output: string;
  model: string;
}): Promise<boolean> {
  try {
    logger.info("Creating JSONL file for batch processing...");

    let promptText = options.prompt;
    if (fs.existsSync(options.prompt)) {
      logger.info(`Reading prompt from file: ${options.prompt}`);
      promptText = fs.readFileSync(options.prompt, "utf-8").trim();
    }

    // Collect all input data
    let inputData: { key: string; value: string }[] = [];

    const jsonArrayMatch = options.input.match(/^(.+\.json):(.+)$/);
    if (jsonArrayMatch) {
      const jsonPath = jsonArrayMatch[1];
      const arrayField = jsonArrayMatch[2];

      if (!jsonPath || !arrayField) {
        logger.error(
          "Invalid JSON input format. Use: path/to/file.json:fieldName",
        );
        return false;
      }

      if (!fs.existsSync(jsonPath)) {
        logger.error(`JSON file not found: ${jsonPath}`);
        return false;
      }

      logger.info(
        `Reading data from JSON file: ${jsonPath}, field: ${arrayField}`,
      );
      const jsonContent = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
      const arrayData = jsonContent[arrayField];

      if (!Array.isArray(arrayData)) {
        logger.error(`Field "${arrayField}" is not an array in ${jsonPath}`);
        return false;
      }

      inputData = arrayData.map((item, index) => {
        return {
          key: `options.input_${index}`,
          value: typeof item === "string" ? item : JSON.stringify(item),
        };
      });
    } else {
      logger.info(`Matching files with pattern: ${options.input}`);
      const matchedFiles = await glob(options.input);

      if (matchedFiles.length === 0) {
        logger.warn(`No files matched pattern: ${options.input}`);
        return false;
      }

      logger.info(`Found ${matchedFiles.length} files`);

      matchedFiles.sort((a, b) => {
        const aBasename = path.basename(a);
        const bBasename = path.basename(b);
        return aBasename.localeCompare(bBasename, undefined, {
          numeric: true,
          sensitivity: "base",
        });
      });

      for (const filePath of matchedFiles) {
        if (fs.existsSync(filePath)) {
          try {
            const content = await fs.promises.readFile(filePath, "utf-8");
            inputData.push({
              key: path.basename(filePath),
              value: content.trim(),
            });
          } catch (error) {
            logger.warn(
              `Failed to read file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }
      }
    }

    if (inputData.length === 0) {
      logger.warn("No input data found");
      return false;
    }

    logger.info(`Processing ${inputData.length} items...`);

    const outputDir = path.dirname(options.output);
    if (!fs.existsSync(outputDir)) {
      await fs.promises.mkdir(outputDir, { recursive: true });
    }

    // Clear the output file first
    await fs.promises.writeFile(options.output, "");

    // Process and append each item
    for (let index = 0; index < inputData.length; index++) {
      const input = inputData[index]!;
      const request = {
        key: input.key,
        model: options.model,
        generation_config: {
          temperature: 0, // more predictable and stable
          // fuck google
          // this is also not working according to https://news.ycombinator.com/item?id=44528356
          // so just drop it, use prompt instead
          // response_mime_type: responseSchema ? "application/json" : undefined,
          // response_schema: responseSchema,
        },
        request: {
          system_instruction: {
            parts: [
              {
                text: promptText,
              },
            ],
          },
          contents: [
            {
              parts: [
                {
                  text: input.value,
                },
              ],
            },
          ],
        },
      };

      const jsonLine = JSON.stringify(request) + "\n";
      await fs.promises.appendFile(options.output, jsonLine);
    }

    logger.success(
      `Successfully created JSONL file with ${inputData.length} requests: ${options.output}`,
    );

    return true;
  } catch (error) {
    logger.error(
      `Failed to create JSONL file: ${error instanceof Error ? error.message : String(error)}`,
    );
    return false;
  }
}
