import * as faiss from "faiss-node";
import fs from "fs";
import OpenAI from "openai";

const EMBEDDING_MODEL = "text-embedding-3-large";
const MODEL = "gpt-4o-mini";

export type Document = {
  id: string;
  text: string;
};

export type DocumentWithScore = {
  document: Document;
  score: number;
};

export function readDocuments() {
  function readDoc(path: string) {
    return fs.readFileSync(path, "utf-8");
  }

  const document1 = {
    id: "public-doc",
    text: readDoc("./assets/docs/public-doc.md"),
  };
  const document2 = {
    id: "private-doc",
    text: readDoc("./assets/docs/private-doc.md"),
  };

  return [document1, document2];
}

export const LocalVectorStore = {
  fromDocuments: async (documents: Document[]) => {
    const openai = new OpenAI();
    const indexFilename = "faiss_index.index";
    let index: faiss.IndexFlatIP;

    if (fs.existsSync(indexFilename)) {
      index = faiss.IndexFlatIP.read(indexFilename);
    } else {
      const documentEmbeddings = await Promise.all(
        documents.map(async (document) => {
          const embeddingResponse = await openai.embeddings.create({
            model: EMBEDDING_MODEL,
            input: document.text,
            encoding_format: "float",
          });

          return embeddingResponse.data[0].embedding;
        })
      );

      const dimension = documentEmbeddings[0].length;
      index = new faiss.IndexFlatIP(dimension);

      documentEmbeddings.forEach((embedding) => {
        index.add(embedding);
      });

      index.write(indexFilename);
    }

    return {
      search: async (query: string, k: number = 2) => {
        const queryEmbeddingResponse = await openai.embeddings.create({
          model: EMBEDDING_MODEL,
          input: query,
          encoding_format: "float",
        });
        const { labels, distances } = index.search(
          queryEmbeddingResponse.data[0].embedding,
          k
        );

        const threshold = 0.2;
        const retrievedDocuments = labels
          .map((label: number, index: number) => ({
            label,
            distance: distances[index],
          }))
          .filter(({ distance }) => distance >= threshold)
          .map(({ label, distance }) => ({
            document: documents[label],
            score: distance,
          }));

        return retrievedDocuments;
      },
    };
  },
};

export async function generate(query: string, context: DocumentWithScore[]) {
  const openai = new OpenAI();
  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content: `
    Context: ${context.map((d) => d.document.text).join("\n\n")}.
    Use only the context provided to answer the question.
    If you don't know, do not make up an answer.
  `,
      },
      { role: "user", content: query },
    ],
  });

  return response.choices[0].message.content;
}
