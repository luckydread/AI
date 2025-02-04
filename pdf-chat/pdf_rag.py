from langchain_core.vectorstores import InMemoryVectorStore
from langchain_ollama.embeddings import OllamaEmbeddings
from langchain_ollama.llms import OllamaLLM
from langchain_community.document_loaders import PDFPlumberLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.prompts import ChatPromptTemplate
import streamlit as st
import os
from dotenv import load_dotenv

load_dotenv()

connection_string = os.getenv('DB_URL')

template = """
You are an assistant for question-answering tasks. Use the following pieces of retrieved context to answer the question. If you don't know the answer, just say that you don't know. Use three sentences maximum and keep the answer concise.
Question: {question} 
Context: {context} 
Answer:
"""

pdfs_directory = './pdfs/'

#creates vectors out of text
embeddings = OllamaEmbeddings(model="deepseek-r1:14b")

#stores vectors in memory
vector_store = InMemoryVectorStore(embeddings)

model = OllamaLLM(model="deepseek-r1:14b")

def upload_pdf(file):
    with open(pdfs_directory + file.name, 'wb') as f:
        f.write(file.getbuffer())    

def load_pdf(file_path):
    loader = PDFPlumberLoader(file_path)
    #returns a list of documents
    documents = loader.load()

    return documents

def split_text(documents):
    #splits text into smaller chunks
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        add_start_index=True,
    )

    return text_splitter.split_documents(documents)
    
        
def index_docs(documents):
    #adds the documents to the vector store
    vector_store.add_documents(documents)

def retrieve_docs(query):
    #returns the most similar documents to the query
    return vector_store.similarity_search(query)

def answer_question(question, documents):
    #creates a context by joining the page content of the documents
    context = "\n\n".join([doc.page_content for doc in documents])
    prompt = ChatPromptTemplate.from_template(template)
    chain = prompt | model

    #returns the answer usig the chain and the question and context
    return chain.invoke({"question": question, "context": context})

uploaded_file = st.file_uploader(
    "Upload PDF", 
    type=['pdf'], 
    accept_multiple_files=False
    )



if uploaded_file:
    upload_pdf(uploaded_file)
    documents = load_pdf(pdfs_directory + uploaded_file.name)
    chunked_documents = split_text(documents)
    index_docs(chunked_documents)

    question = st.chat_input()
    
    if question:
        st.chat_message("user").write(question)
        related_docs = retrieve_docs(question)
        answer = answer_question(question, related_docs)
        st.chat_message("assistant").write(answer)


        
   