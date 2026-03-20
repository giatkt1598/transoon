import { promises as fs } from "fs";
import path from "path";
import { Router } from "express";

export function createDownloadRouter() {
  const router = Router();
  const outputDirectory = path.resolve(process.cwd(), "storage", "outputs");

  router.get("/api/downloads/:fileName", async (req, res) => {
    const fileName = path.basename(req.params.fileName);
    const filePath = path.join(outputDirectory, fileName);

    try {
      await fs.access(filePath);
      res.download(filePath, fileName);
    } catch {
      res.status(404).json({ error: "Output file not found." });
    }
  });

  return router;
}
