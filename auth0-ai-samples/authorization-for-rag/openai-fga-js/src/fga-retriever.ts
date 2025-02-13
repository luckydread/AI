import {
  ClientBatchCheckItem,
  ConsistencyPreference,
  CredentialsMethod,
  OpenFgaClient,
} from "@openfga/sdk";

import { Document, DocumentWithScore } from "./helpers";

export type FGARetrieverCheckerFn = (doc: Document) => ClientBatchCheckItem;

export interface FGARetrieverArgs {
  buildQuery: FGARetrieverCheckerFn;
  documents: DocumentWithScore[];
}

export class FGARetriever {
  private buildQuery: FGARetrieverCheckerFn;
  private fgaClient: OpenFgaClient;
  private documents: DocumentWithScore[];

  private constructor(
    { buildQuery, documents }: FGARetrieverArgs,
    fgaClient?: OpenFgaClient
  ) {
    this.documents = documents;
    this.buildQuery = buildQuery;
    this.fgaClient =
      fgaClient ||
      new OpenFgaClient({
        apiUrl: process.env.FGA_API_URL || "https://api.us1.fga.dev",
        storeId: process.env.FGA_STORE_ID!,
        credentials: {
          method: CredentialsMethod.ClientCredentials,
          config: {
            apiTokenIssuer: process.env.FGA_API_TOKEN_ISSUER || "auth.fga.dev",
            apiAudience:
              process.env.FGA_API_AUDIENCE || "https://api.us1.fga.dev/",
            clientId: process.env.FGA_CLIENT_ID!,
            clientSecret: process.env.FGA_CLIENT_SECRET!,
          },
        },
      });
  }

  static create(
    { buildQuery, documents }: FGARetrieverArgs,
    fgaClient?: OpenFgaClient
  ) {
    return new FGARetriever({ buildQuery, documents }, fgaClient);
  }

  private async checkPermissions(
    checks: ClientBatchCheckItem[]
  ): Promise<Map<string, boolean>> {
    const response = await this.fgaClient.batchCheck(
      { checks },
      {
        consistency: ConsistencyPreference.HigherConsistency,
      }
    );

    return response.result.reduce(
      (permissionMap: Map<string, boolean>, result) => {
        permissionMap.set(result.request.object, result.allowed || false);
        return permissionMap;
      },
      new Map<string, boolean>()
    );
  }

  async retrieve(): Promise<DocumentWithScore[]> {
    const retrievedNodes = this.documents;

    const { checks, documentToObjectMap } = retrievedNodes.reduce(
      (acc, documentWithScore: DocumentWithScore) => {
        const check = this.buildQuery(documentWithScore.document);
        acc.checks.push(check);
        acc.documentToObjectMap.set(documentWithScore.document, check.object);
        return acc;
      },
      {
        checks: [] as ClientBatchCheckItem[],
        documentToObjectMap: new Map<Document, string>(),
      }
    );

    const permissionsMap = await this.checkPermissions(checks);

    return retrievedNodes.filter(
      (documentWithScore) =>
        permissionsMap.get(
          documentToObjectMap.get(documentWithScore.document) || ""
        ) === true
    );
  }
}
