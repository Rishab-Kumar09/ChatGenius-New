import { OpenAIEmbeddings } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { PineconeStore } from "@langchain/pinecone";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { Pinecone } from '@pinecone-database/pinecone';
import path from 'path';
import fs from 'fs';

// Validate environment variables
if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX_NAME) {
  throw new Error('PINECONE_API_KEY and PINECONE_INDEX_NAME must be set in environment variables');
}

// Initialize Pinecone client
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY
});

const index = pinecone.index(process.env.PINECONE_INDEX_NAME);

export async function processDocument(filePath: string) {
  try {
    // Load the PDF
    const loader = new PDFLoader(filePath);
    const docs = await loader.load();

    // Split text into chunks
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 100,
    });
    const documents = await textSplitter.splitDocuments(docs);
    console.log(`Going to add ${documents.length} chunks to Pinecone`);

    // Create embeddings and store in Pinecone
    const embeddings = new OpenAIEmbeddings({
      modelName: "text-embedding-3-large"
    });

    await PineconeStore.fromDocuments(documents, embeddings, {
      pineconeIndex: index
    });

    console.log("Loading to vectorstore done");
    return true;
  } catch (error) {
    console.error("Error processing document:", error);
    throw error;
  }
}

export async function processAllDocuments() {
  try {
    const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
    const files = fs.readdirSync(uploadsDir);
    
    for (const file of files) {
      if (file.toLowerCase().endsWith('.pdf')) {
        const filePath = path.join(uploadsDir, file);
        await processDocument(filePath);
      }
    }

    console.log("All documents processed successfully");
    return true;
  } catch (error) {
    console.error("Error processing documents:", error);
    throw error;
  }
}

export async function queryDocument(question: string) {
  try {
    const embeddings = new OpenAIEmbeddings({
      modelName: "text-embedding-3-large"
    });
    
    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex: index
    });

    const results = await vectorStore.similaritySearch(question, 5);
    return results;
  } catch (error) {
    console.error("Error querying document:", error);
    throw error;
  }
} 