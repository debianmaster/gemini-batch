import fs from "node:fs";
import path from "node:path";
import { glob } from "glob";
import { BatchProcessor } from "../processor.js";
import { formatDate, logger } from "../utils.js";

export async function handleFileList(options: {
  limit: number;
}): Promise<void> {
  const processor = new BatchProcessor();

  try {
    logger.createSpinner("Fetching files from Gemini...");
    logger.startSpinner();

    const files = await processor.listFiles(options.limit);
    logger.stopSpinner();

    if (files.length === 0) {
      logger.warn("No files found");
      return;
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
        file.sizeBytes ? `${Math.round(file.sizeBytes / 1024)}KB` : "-",
        file.mimeType || "-",
        file.createTime ? formatDate(file.createTime) : "-",
      ]);
    }

    logger.log(table.toString());
  } catch (error) {
    logger.stopSpinner();
    logger.error(
      `Failed to fetch files: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    await processor.close();
  }
}

export async function handleFileGet(fileName: string): Promise<void> {
  const processor = new BatchProcessor();

  try {
    logger.createSpinner(`Fetching file details for ${fileName}...`);
    logger.startSpinner();

    const files = await processor.listFiles();
    logger.stopSpinner();

    const file = files.find(
      (f) => f.name === fileName || f.displayName === fileName,
    );

    if (!file) {
      logger.error(`File not found: ${fileName}`);
      logger.info("");
      logger.info("Use 'gemini-batch file list' to see available files");
      process.exit(1);
    }

    logger.info(`File Details:`);
    logger.log("");
    logger.log(`Name: ${file.name || "Unknown"}`);
    logger.log(`Display Name: ${file.displayName || "-"}`);
    logger.log(
      `Size: ${file.sizeBytes ? `${Math.round(file.sizeBytes / 1024)}KB` : "-"}`,
    );
    logger.log(`MIME Type: ${file.mimeType || "-"}`);
    logger.log(
      `Created: ${file.createTime ? formatDate(file.createTime) : "-"}`,
    );
    logger.log(`State: ${file.state || "-"}`);
    if (file.uri) {
      logger.log(`URI: ${file.uri}`);
    }
  } catch (error) {
    logger.stopSpinner();
    logger.error(
      `Failed to fetch file details: ${error instanceof Error ? error.message : String(error)}`,
    );
  } finally {
    await processor.close();
  }
}

interface CreateOptions {
  prompt: string;
  input: string;
  output: string;
}

export async function handleFileCreate(options: CreateOptions): Promise<void> {
  try {
    if (!options.prompt) {
      logger.error(
        "Prompt is required. Use --prompt to specify a prompt or path to a prompt file.",
      );
      return;
    }

    if (!options.input) {
      logger.error(
        "Input is required. Use --input to specify file patterns or JSON data.",
      );
      return;
    }

    if (!options.output) {
      logger.error(
        "Output path is required. Use --output to specify the output JSONL file path.",
      );
      return;
    }

    logger.info("Creating JSONL file for batch processing...");

    let promptText = options.prompt;
    if (fs.existsSync(options.prompt)) {
      logger.info(`Reading prompt from file: ${options.prompt}`);
      promptText = fs.readFileSync(options.prompt, "utf-8").trim();
    }

    let inputData: string[] = [];

    const jsonArrayMatch = options.input.match(/^(.+\.json):(.+)$/);
    if (jsonArrayMatch) {
      const jsonPath = jsonArrayMatch[1];
      const arrayField = jsonArrayMatch[2];

      if (!jsonPath || !arrayField) {
        logger.error(
          "Invalid JSON input format. Use: path/to/file.json:fieldName",
        );
        return;
      }

      if (!fs.existsSync(jsonPath)) {
        logger.error(`JSON file not found: ${jsonPath}`);
        return;
      }

      logger.info(
        `Reading data from JSON file: ${jsonPath}, field: ${arrayField}`,
      );
      const jsonContent = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
      const arrayData = jsonContent[arrayField];

      if (!Array.isArray(arrayData)) {
        logger.error(`Field "${arrayField}" is not an array in ${jsonPath}`);
        return;
      }

      inputData = arrayData.map((item) =>
        typeof item === "string" ? item : JSON.stringify(item),
      );
    } else {
      logger.info(`Matching files with pattern: ${options.input}`);
      const matchedFiles = await glob(options.input);

      if (matchedFiles.length === 0) {
        logger.warn(`No files matched pattern: ${options.input}`);
        return;
      }

      logger.info(`Found ${matchedFiles.length} files`);

      for (const filePath of matchedFiles) {
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, "utf-8");
          inputData.push(content.trim());
        }
      }
    }

    if (inputData.length === 0) {
      logger.warn("No input data found");
      return;
    }

    const jsonlLines = inputData.map((input, index) => {
      const request = {
        key: `request-${index + 1}`,
        request: {
          contents: [
            {
              parts: [
                {
                  text: `${promptText}\n\n${input}`,
                },
              ],
            },
          ],
        },
      };
      return JSON.stringify(request);
    });

    const outputDir = path.dirname(options.output);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(options.output, jsonlLines.join("\n") + "\n");

    logger.success(
      `Successfully created JSONL file with ${inputData.length} requests: ${options.output}`,
    );
  } catch (error) {
    logger.error(
      `Failed to create JSONL file: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
