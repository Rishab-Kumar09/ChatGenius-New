declare module 'langchain/embeddings/openai' {
  export class OpenAIEmbeddings {
    constructor(config: { openAIApiKey: string });
    embedQuery(text: string): Promise<number[]>;
    embedDocuments(documents: string[]): Promise<number[][]>;
  }
}

declare module 'langchain/vectorstores/pinecone' {
  import { Pinecone } from '@pinecone-database/pinecone';
  import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
  import { Document } from 'langchain/document';
  
  export class PineconeStore {
    static fromExistingIndex(
      embeddings: OpenAIEmbeddings,
      args: { pineconeIndex: Pinecone }
    ): Promise<PineconeStore>;
    
    addDocuments(documents: Array<{ pageContent: string; metadata: any }>): Promise<void>;
    similaritySearch(query: string, k?: number): Promise<Document[]>;
  }
}

declare module 'langchain/document' {
  export interface Document {
    pageContent: string;
    metadata: Record<string, any>;
  }
} 