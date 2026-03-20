import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

export async function writeOutputFile(
  sourceFileName: string,
  buffer: Buffer,
): Promise<{ outputPath: string; outputFileName: string }> {
  const outputDirectory = path.resolve(process.cwd(), "storage", "outputs");
  await fs.mkdir(outputDirectory, { recursive: true });

  const extension = path.extname(sourceFileName);
  const baseName = path.basename(sourceFileName, extension);
  const outputFileName = `${baseName}.translated.${randomUUID()}${extension}`;
  const outputPath = path.join(outputDirectory, outputFileName);

  await fs.writeFile(outputPath, buffer);

  return { outputPath, outputFileName };
}
