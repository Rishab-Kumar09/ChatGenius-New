
import { OpenAI } from "langchain/llms/openai";
import { RetrievalQAChain } from "langchain/chains";
import { ChromaClient } from "chromadb";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { ChromaVectorStore } from "langchain/vectorstores/chroma";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";

// Initialize ChromaDB
const client = new ChromaClient();
const embeddings = new OpenAIEmbeddings();

// Initialize vector store
const vectorStore = new ChromaVectorStore(embeddings, {
  collectionName: "chat_documents",
  client,
});

// Document loader and processor
export async function loadDocuments(directory: string) {
  const loader = new DirectoryLoader(directory, {
    ".txt": (path) => new TextLoader(path),
  });
  
  const docs = await loader.load();
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  
  const splitDocs = await splitter.splitDocuments(docs);
  await vectorStore.addDocuments(splitDocs);
}

// RAG Chain setup
const model = new OpenAI({
  modelName: "gpt-3.5-turbo",
  temperature: 0.7,
});

const chain = RetrievalQAChain.fromLLM(model, vectorStore.asRetriever());

// Query function
export async function queryRAG(question: string) {
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
