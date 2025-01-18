"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processDocument = processDocument;
exports.processAllDocuments = processAllDocuments;
exports.queryDocument = queryDocument;
const openai_1 = require("@langchain/openai");
const text_splitter_1 = require("langchain/text_splitter");
const pinecone_1 = require("@langchain/pinecone");
const pdf_1 = require("@langchain/community/document_loaders/fs/pdf");
const pinecone_2 = require("@pinecone-database/pinecone");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Validate environment variables
if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX) {
    throw new Error('PINECONE_API_KEY and PINECONE_INDEX must be set in environment variables');
}
// Initialize Pinecone client
const pinecone = new pinecone_2.Pinecone({
    apiKey: process.env.PINECONE_API_KEY
});
const index = pinecone.index(process.env.PINECONE_INDEX);
async function processDocument(filePath) {
    try {
        // Load the PDF
        const loader = new pdf_1.PDFLoader(filePath);
        const docs = await loader.load();
        // Split text into chunks
        const textSplitter = new text_splitter_1.RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 100,
        });
        const documents = await textSplitter.splitDocuments(docs);
        console.log(`Going to add ${documents.length} chunks to Pinecone`);
        // Create embeddings and store in Pinecone
        const embeddings = new openai_1.OpenAIEmbeddings({
            modelName: "text-embedding-3-large"
        });
        await pinecone_1.PineconeStore.fromDocuments(documents, embeddings, {
            pineconeIndex: index
        });
        console.log("Loading to vectorstore done");
        return true;
    }
    catch (error) {
        console.error("Error processing document:", error);
        throw error;
    }
}
async function processAllDocuments() {
    try {
        const uploadsDir = path_1.default.join(process.cwd(), 'data', 'uploads');
        const files = fs_1.default.readdirSync(uploadsDir);
        for (const file of files) {
            // Only process files that match the pattern YYYYltr.pdf (Berkshire letters)
            if (file.match(/^\d{4}ltr\.pdf$/)) {
                const filePath = path_1.default.join(uploadsDir, file);
                await processDocument(filePath);
            }
        }
        console.log("All Berkshire Hathaway letters processed successfully");
        return true;
    }
    catch (error) {
        console.error("Error processing documents:", error);
        throw error;
    }
}
async function queryDocument(question) {
    try {
        const embeddings = new openai_1.OpenAIEmbeddings({
            modelName: "text-embedding-3-large"
        });
        const vectorStore = await pinecone_1.PineconeStore.fromExistingIndex(embeddings, {
            pineconeIndex: index
        });
        const results = await vectorStore.similaritySearch(question, 5);
        return results;
    }
    catch (error) {
        console.error("Error querying document:", error);
        throw error;
    }
}
