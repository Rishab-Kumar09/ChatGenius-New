
import { OpenAI } from "langchain/llms/openai";
import { RetrievalQAChain } from "langchain/chains";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { MemoryVectorStore } from "langchain/vectorstores/memory";

// Initialize OpenAI embeddings
const embeddings = new OpenAIEmbeddings();
let vectorStore: MemoryVectorStore;

// Document loader and processor
export async function loadDocuments(directory: string) {
  const loader = new TextLoader(directory);
  const docs = await loader.load();
  
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  
  const splitDocs = await splitter.splitDocuments(docs);
  vectorStore = await MemoryVectorStore.fromDocuments(splitDocs, embeddings);
  return vectorStore;
}

// RAG Chain setup
const model = new OpenAI({
  modelName: "gpt-3.5-turbo",
  temperature: 0.7,
});

// Query function
export async function queryRAG(question: string) {
  if (!vectorStore) {
    throw new Error("Documents not loaded. Call loadDocuments first.");
  }

  const chain = RetrievalQAChain.fromLLM(model, vectorStore.asRetriever());

  try {
    const response = await chain.call({
      query: question,
    });
    return response.text;
  } catch (error) {
    console.error("Error querying RAG:", error);
    throw error;
  }
}
