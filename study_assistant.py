import os
from pydantic import BaseModel, Field
from langchain_community.document_loaders import PyPDFLoader, Docx2txtLoader, UnstructuredWordDocumentLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_huggingface import HuggingFaceEndpointEmbeddings
from langchain_groq import ChatGroq
from langchain_community.vectorstores import Chroma
from langchain_core.prompts import ChatPromptTemplate
from dotenv import load_dotenv
from openai import OpenAI

load_dotenv()
embeddings = HuggingFaceEndpointEmbeddings(
    repo_id="sentence-transformers/all-MiniLM-L6-v2",
    huggingfacehub_api_token=os.environ.get("HF_TOKEN"),
    task="feature-extraction"
)
CHROMA_PATH = "chroma_db"
LLM_MODEL = "llama-3.3-70b-versatile"

def process_document(file_path: str):
    file_path_lower = file_path.lower()
    if file_path_lower.endswith(".pdf"):
        loader = PyPDFLoader(file_path)
    elif file_path_lower.endswith(".docx"):
        loader = Docx2txtLoader(file_path)
    elif file_path_lower.endswith(".doc"):
        loader = UnstructuredWordDocumentLoader(file_path)
    else:
        raise ValueError(f"Unsupported file format: {file_path}")
    documents = loader.load()
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200, length_function=len)
    chunks = text_splitter.split_documents(documents)
    # This automatically persists the vector db to the specified directory
    db = Chroma.from_documents(chunks, embeddings, persist_directory=CHROMA_PATH)
    return True

def _get_db():
    """Helper method to initialize and return the existing local Chroma vector database."""
    return Chroma(persist_directory=CHROMA_PATH, embedding_function=embeddings)

def query_document(question: str) -> str:
    db = _get_db()
    # Retrieve top 4 most relevant chunks
    docs = db.similarity_search(question, k=4)
    context = "\n\n".join([doc.page_content for doc in docs])
    
    llm = ChatGroq(model=LLM_MODEL, temperature=0)
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an expert AI Study Assistant. Answer the question strictly using the provided context. If the context does not contain the answer, politely state that you do not have enough information based on the uploaded document.\n\nContext:\n{context}"),
        ("human", "{question}")
    ])
    
    chain = prompt | llm
    response = chain.invoke({"context": context, "question": question})
    return response.content

def generate_summary(summary_type: str) -> str:
    db = _get_db()
    # Retrieve a larger set of overarching context for a comprehensive summary
    docs = db.similarity_search("main concepts, essential themes, overall summary, conclusions", k=10)
    context = "\n\n".join([doc.page_content for doc in docs])
    
    llm = ChatGroq(model=LLM_MODEL, temperature=0.3)
    
    mode_instructions = {
        "5-min": "Generate a brief, high-level bulleted overview of the core concepts.",
        "10-min": "Generate a deeper, comprehensive summary with sections breaking down important mechanics and methodologies.",
        "exam": "Focus heavily on key definitions, potential test formulas, and core takeaways explicitly highlighted for testing."
    }
    instruction = mode_instructions.get(summary_type, mode_instructions["5-min"])
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an expert AI Study Assistant. Based on the following document excerpts, generate a summary following the given instruction. Output the result in standard Markdown format with bold text and bullet points where appropriate.\n\nContext:\n{context}\n\nInstruction:\n{instruction}"),
        ("human", "Please generate the summary.")
    ])
    
    chain = prompt | llm
    response = chain.invoke({"context": context, "instruction": instruction})
    return response.content

# --- Pydantic Schemas for Structured Outputs ---

class Flashcard(BaseModel):
    id: int = Field(description="A unique integer ID for the flashcard")
    question: str = Field(description="The term, concept, or question for the front of the flashcard")
    answer: str = Field(description="The detailed definition, explanation, or answer for the back of the flashcard")

class FlashcardList(BaseModel):
    flashcards: list[Flashcard] = Field(description="A list of generated flashcards")

def generate_flashcards() -> dict:
    db = _get_db()
    docs = db.similarity_search("key terms, definitions, important facts, glossary", k=8)
    context = "\n\n".join([doc.page_content for doc in docs])
    
    llm = ChatGroq(model=LLM_MODEL, temperature=0.3).with_structured_output(FlashcardList)
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an expert AI Study Assistant. Create 10 highly effective study flashcards based on the most important terms and concepts in the provided context.\n\nContext:\n{context}"),
        ("human", "Generate the flashcards.")
    ])
    
    chain = prompt | llm
    response = chain.invoke({"context": context})
    return response.model_dump()

def text_to_speech(text: str) -> bytes:
    """Converts text to speech using OpenAI's TTS API and returns audio bytes."""
    client = OpenAI()  # API key is read from OPENAI_API_KEY env var
    response = client.audio.speech.create(
        model="tts-1",
        voice="alloy",
        input=text
    )
    # The response object has a `read()` method with the audio bytes
    return response.read()

class Question(BaseModel):
    id: int = Field(description="A unique integer ID for the question, starting from 1.")
    question: str = Field(description="The multiple-choice question")
    options: list[str] = Field(description="Exactly 4 possible options for the answer")
    correct_answer: str = Field(description="The exact text of the correct option")
    explanation: str = Field(description="Explanation of why the answer is correct strictly based on the context")

class Quiz(BaseModel):
    questions: list[Question] = Field(description="A list of 5 multiple-choice questions.")

def generate_quiz() -> dict:
    db = _get_db()
    docs = db.similarity_search("important facts, testable material, main concepts", k=10)
    context = "\n\n".join([doc.page_content for doc in docs])
    
    llm = ChatGroq(model=LLM_MODEL, temperature=0.3).with_structured_output(Quiz)
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an expert AI Study Assistant. Create a 5-question multiple-choice quiz based on the provided context. Make the questions challenging but fair. Provide exactly 4 options per question, specify the correct answer with the 'correct_answer' field, and include a brief explanation. Each question must have a unique integer 'id' starting from 1.\n\nContext:\n{context}"),
        ("human", "Generate the quiz.")
    ])
    
    chain = prompt | llm
    response = chain.invoke({"context": context})
    return response.model_dump()

# --- Pydantic Schemas for Exam Prep ---
class ImportantTopic(BaseModel):
    topic: str = Field(description="A key topic or concept identified from the document.")
    importance: str = Field(description="The estimated importance for an exam (e.g., 'High', 'Medium', 'Low').")
    reason: str = Field(description="A brief justification for why this topic is important.")

class LikelyQuestion(BaseModel):
    id: int = Field(description="A unique integer ID for the question, starting from 1.")
    question: str = Field(description="A likely exam question based on the context.")
    expected_answer: str = Field(description="A concise, correct answer or key points for the answer.")

class ChecklistItem(BaseModel):
    id: int = Field(description="A unique integer ID for the checklist item, starting from 1.")
    task: str = Field(description="A specific, actionable study task or revision point.")
    completed: bool = Field(default=False, description="Whether the task has been completed. Defaults to false.")

class ExamPrepKit(BaseModel):
    important_topics: list[ImportantTopic] = Field(description="A list of 3-5 most important topics for exam preparation.")
    likely_questions: list[LikelyQuestion] = Field(description="A list of 5 likely exam questions.")
    checklist: list[ChecklistItem] = Field(description="A list of 5-7 actionable checklist items for revision.")

def generate_exam_prep() -> dict:
    db = _get_db()
    # Retrieve a broad context for comprehensive exam prep material
    docs = db.similarity_search("exam topics, potential questions, study guide, key concepts for testing, important definitions, core principles", k=12)
    context = "\n\n".join([doc.page_content for doc in docs])
    
    llm = ChatGroq(model=LLM_MODEL, temperature=0.4).with_structured_output(ExamPrepKit)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", """You are an expert AI Study Assistant specializing in exam preparation.
Based on the provided document context, generate a comprehensive exam preparation kit.
The kit must contain three sections:
1.  'important_topics': Identify 3-5 core topics. For each, specify its importance ('High', 'Medium', or 'Low') and a brief reason.
2.  'likely_questions': Formulate 5 potential exam questions that test understanding of key concepts. Provide a concise, ideal answer for each.
3.  'checklist': Create a list of 5-7 actionable revision tasks for a student to complete.

Ensure the output strictly adheres to the required JSON structure.

Context:
{context}"""),
        ("human", "Generate the exam preparation kit.")
    ])
    
    chain = prompt | llm
    response = chain.invoke({"context": context})
    return response.model_dump()

def generate_notes(text: str) -> str:
    """Takes raw text or transcript and formats it into a structured Markdown study guide."""
    safe_text = text[:30000]
    llm = ChatGroq(model="llama-3.1-8b-instant", temperature=0.3)
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an expert AI Study Assistant. Convert the following raw text or transcript into a beautifully formatted Markdown study guide.\n\nEnsure the output contains:\n- A clear title and high-level overview.\n- Structured sections with ## Headings and ### Subheadings.\n- Key terms in **bold** with clear definitions.\n- Important takeaways or code blocks organized cleanly."),
        ("human", "{text}")
    ])
    
    chain = prompt | llm
    response = chain.invoke({"text": safe_text})
    return response.content