
import { OpenAI } from "openai";
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { PineconeClient } from "@pinecone-database/pinecone";
import { Document } from 'langchain/document';
import * as fs from 'fs';
import * as path from 'path';
import pdf from 'pdf-parse';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pinecone = new PineconeClient();

let initialized = false;

async function loadPDFs(directory: string) {
  try {
    const pdfFiles = fs.readdirSync(directory).filter(file => file.endsWith('.pdf'));
    let allText = '';
    
    console.log(`Loading ${pdfFiles.length} PDF files from ${directory}`);
    
    for (const file of pdfFiles) {
      try {
        const dataBuffer = fs.readFileSync(path.join(directory, file));
        const data = await pdf(dataBuffer);
        allText += `[Document: ${file}]\n${data.text}\n\n`;
        console.log(`Successfully loaded ${file}`);
      } catch (error) {
        console.error(`Error loading PDF ${file}:`, error);
      }
    }
    
    return allText;
  } catch (error) {
    console.error('Error accessing PDF directory:', error);
    return '';
  }
}

export async function loadDocuments(filePath: string) {
  // Load PDF documents first
  const pdfText = await loadPDFs('training_data/pdf/docs');
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    
    await pinecone.init({
      environment: "gcp-starter",
      apiKey: process.env.PINECONE_API_KEY!,
    });
    
    const index = pinecone.Index(process.env.PINECONE_INDEX!);
    const docs = await splitter.createDocuments([text]);
    
    // Convert documents to vectors and store in Pinecone
    for (const doc of docs) {
      const embedding = await openai.embeddings.create({
        input: doc.pageContent,
        model: "text-embedding-ada-002"
      });
      
      await index.upsert({
        upsertRequest: {
          vectors: [{
            id: `doc-${Math.random()}`,
            values: embedding.data[0].embedding,
            metadata: { text: doc.pageContent }
          }]
        }
      });
    }
    
    initialized = true;
  } catch (error) {
    console.error('Error loading documents:', error);
    throw error;
  }
}

export async function queryRAG(question: string): Promise<string> {
  if (!initialized) {
    return "RAG system not initialized. Please load documents first.";
  }

  try {
    const index = pinecone.Index(process.env.PINECONE_INDEX!);
    
    // Get question embedding
    const questionEmbedding = await openai.embeddings.create({
      input: question,
      model: "text-embedding-ada-002"
    });

    // Query Pinecone
    const queryResponse = await index.query({
      queryRequest: {
        vector: questionEmbedding.data[0].embedding,
        topK: 3,
        includeMetadata: true
      }
    });

    // Construct context from relevant documents
    const context = queryResponse.matches
      ?.map(match => match.metadata?.text)
      .join('\n');

    // Generate answer using context
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant for ChatGenius. Answer based on this context: ${context}`
        },
        { role: "user", content: question }
      ]
    });

    return completion.choices[0].message.content || "Sorry, I couldn't generate an answer.";
  } catch (error) {
    console.error('Error querying RAG:', error);
    return "Sorry, an error occurred while processing your question.";
  }
}
