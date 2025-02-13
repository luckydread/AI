import fs from "node:fs/promises";

import { Document } from "@langchain/core/documents";

async function readDoc(path: string) {
  return await fs.readFile(path, "utf-8");
}

/* Reads documents from the assets folder and converts them to langChain Documents */
export async function readDocuments() {
  const folderPath = "./assets/docs";
  const files = await fs.readdir(folderPath);
  const documents: Document[] = [];

  for (const file of files) {
    documents.push(
      new Document({
        pageContent: await readDoc(`${folderPath}/${file}`),
        metadata: { id: file.slice(0, file.lastIndexOf(".")) },
      })
    );
  }

  return documents;
}
