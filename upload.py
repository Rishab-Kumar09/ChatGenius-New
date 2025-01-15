
from langchain_openai import OpenAIEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_pinecone import PineconeVectorStore
from langchain_community.document_loaders.pdf import PyPDFLoader
from langchain_community.document_loaders import DirectoryLoader
import os
from dotenv import load_dotenv

load_dotenv()

os.environ["PINECONE_API_KEY"] = os.getenv("PINECONE_API_KEY")
os.environ["OPENAI_API_KEY"] = os.getenv("OPENAI_API_KEY")
os.environ["LANGCHAIN_API_KEY"] = os.getenv("LANGCHAIN_API_KEY")
os.environ["LANGCHAIN_TRACING_V2"] = os.getenv("LANGCHAIN_TRACING_V2")
os.environ["LANGCHAIN_PROJECT"] = os.getenv("LANGCHAIN_PROJECT")
PINECONE_INDEX = os.getenv("PINECONE_INDEX")

# Prep documents to be uploaded to the vector database (Pinecone)
loader = DirectoryLoader('./training_data/pdf/docs', glob="**/*.pdf", loader_cls=PyPDFLoader)
raw_docs = loader.load()

# Split documents into smaller chunks
text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
documents = text_splitter.split_documents(raw_docs)
print(f"Going to add {len(documents)} chunks to Pinecone")

# Initialize embeddings and vector store
embeddings = OpenAIEmbeddings(model="text-embedding-3-large")
vector_store = PineconeVectorStore.from_documents(documents, embeddings, index_name=PINECONE_INDEX)

print("Documents successfully uploaded to Pinecone")
