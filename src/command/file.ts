import { config } from "../config.js";
import { BatchProcessor } from "../processor.js";
import { formatDate, logger } from "../utils.js";

export async function handleFileList(options: {
  limit: number;
}): Promise<void> {
  await config.load();
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
  await config.load();
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
