
import { OpenAI } from "openai";
import { Pinecone } from "@pinecone-database/pinecone";
import * as fs from 'fs';
import * as path from 'path';
import * as pdfParse from 'pdf-parse';
const pdf = (buffer: Buffer) => pdfParse.default(buffer);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const pinecone = new Pinecone();

let initialized = false;

async function loadDocuments(filePath: string) {
  try {
    const pdfText = await loadPDFs('training_data/pdf/docs');
    const text = fs.readFileSync(filePath, 'utf8');
    const combinedText = `${text}\n\n${pdfText}`;

    const chunks = splitIntoChunks(combinedText);

    await pinecone.init({
      environment: "gcp-starter",
      apiKey: process.env.PINECONE_API_KEY!,
    });

    const index = pinecone.Index(process.env.PINECONE_INDEX!);

    for (const chunk of chunks) {
      const embedding = await openai.embeddings.create({
        input: chunk,
        model: "text-embedding-ada-002"
      });

      await index.upsert({
        upsertRequest: {
          vectors: [{
            id: `doc-${Math.random()}`,
            values: embedding.data[0].embedding,
            metadata: { text: chunk }
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

async function loadPDFs(directory: string): Promise<string> {
  try {
    const pdfFiles = fs.readdirSync(directory).filter(file => file.endsWith('.pdf'));
    let allText = '';

    for (const file of pdfFiles) {
      try {
        const dataBuffer = fs.readFileSync(path.join(directory, file));
        const data = await pdf(dataBuffer);
        allText += `[Document: ${file}]\n${data.text}\n\n`;
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

function splitIntoChunks(text: string, chunkSize = 1000, overlap = 200): string[] {
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    const chunk = text.slice(i, i + chunkSize);
    chunks.push(chunk);
    i += chunkSize - overlap;
  }
  return chunks;
}

export async function queryRAG(question: string): Promise<string> {
  if (!initialized) {
    console.log('Attempting to initialize RAG system...');
    try {
      if (!process.env.OPENAI_API_KEY || !process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX) {
        throw new Error('Missing required environment variables');
      }
      await loadDocuments('./training_data/knowledge.txt');
    } catch (error) {
      console.error('Failed to initialize:', error);
      return "I'm having trouble accessing my knowledge base. Please check API configurations.";
    }
  }

  try {
    const index = pinecone.Index(process.env.PINECONE_INDEX!);

    const questionEmbedding = await openai.embeddings.create({
      input: question,
      model: "text-embedding-ada-002"
    });

    const queryResponse = await index.query({
      queryRequest: {
        vector: questionEmbedding.data[0].embedding,
        topK: 5,
        includeMetadata: true
      }
    });

    const context = queryResponse.matches
      ?.map(match => match.metadata?.text)
      .join('\n\n');

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant. Answer based on this context: ${context}`
        },
        { role: "user", content: question }
      ]
    });

    return completion.choices[0].message.content || "I couldn't generate a relevant answer.";
  } catch (error) {
    console.error('Error querying RAG:', error);
    return "Sorry, I encountered an error while processing your question.";
  }
}

export { loadDocuments };
