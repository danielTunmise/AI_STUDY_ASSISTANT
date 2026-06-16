import os
import tempfile
import uuid
import io
import re
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from groq import Groq
from gtts import gTTS

import study_assistant

app = FastAPI(
    title="AI Study Assistant API",
    description="Backend for the AI Study Assistant combining FastAPI, LangChain, ChromaDB, and OpenAI.",
    redirect_slashes=False  # Prevents 307 redirects on POST requests which often strip CORS headers
)

@app.get("/")
@app.head("/")
async def health_check():
    return {"status": "awake", "message": "Service is running 24/7"}

# Ensure proper CORS Handling
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://ai-study-assistant-cvarvx0x6-tunmise-s-projects360.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the Groq client
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

# --- Request Schemas ---

class ChatRequest(BaseModel):
    message: str = Field(..., description="The user's chat message.")
    document_id: str | None = Field(default=None, description="Optional reference to the active document.")

class SummaryRequest(BaseModel):
    summary_type: str = Field(..., description="Mode of the summary. Expected: '5-min', '10-min', 'exam'")
    document_id: str | None = Field(default="default", description="Optional reference to the active document.")

class TTSRequest(BaseModel):
    text: str = Field(..., description="The text to be converted to speech.")

class NotesRequest(BaseModel):
    text: str = Field(..., description="The raw text or transcript to generate notes from.")

# --- Endpoints ---

@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")
    
    # Use a unique temp file to avoid collisions if multiple requests happen
    temp_dir = tempfile.gettempdir()
    temp_file_path = os.path.join(temp_dir, f"{uuid.uuid4()}_{file.filename}")
    
    try:
        with open(temp_file_path, "wb") as f:
            content = await file.read()
            f.write(content)
            
        study_assistant.process_document(temp_file_path)
        
        return {"status": "success", "message": f"Document '{file.filename}' processed and stored in database successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

@app.post("/api/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    if not file.filename.lower().endswith((".mp3", ".wav", ".m4a")):
        raise HTTPException(status_code=400, detail="Only MP3, WAV, and M4A files are supported.")
    
    try:
        # Read the file content bytes
        content = await file.read()
        
        # Use Groq client to transcribe
        transcription = client.audio.transcriptions.create(
            file=(file.filename, content),
            model="whisper-large-v3"
        )
        return {"transcript": transcription.text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/chat")
async def chat_endpoint(request: ChatRequest):
    try:
        # Using the active ChromaDB, retrieve chunks and answer the question 
        answer = study_assistant.query_document(request.message)
        return {"response": answer}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-summary")
async def summary(request: SummaryRequest):
    valid_modes = ["5-min", "10-min", "exam"]
    if request.summary_type not in valid_modes:
        raise HTTPException(status_code=400, detail=f"Invalid mode. Must be one of: {valid_modes}")
        
    try:
        result = study_assistant.generate_summary(request.summary_type)
        return {"summary": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-flashcards")
async def api_generate_flashcards():
    try:
        result = study_assistant.generate_flashcards()
        # The frontend expects a JSON array directly, so we extract it.
        return result.get("flashcards", [])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-quiz")
async def api_generate_quiz():
    try:
        result = study_assistant.generate_quiz()
        # The frontend expects a JSON array directly.
        return result.get("questions", [])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-examprep")
async def api_generate_examprep():
    try:
        result = study_assistant.generate_exam_prep()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/generate-notes")
async def api_generate_notes(request: NotesRequest):
    try:
        result = study_assistant.generate_notes(request.text)
        return {"notes": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/tts")
async def text_to_speech(request: TTSRequest): # match existing request schema
    try:
        # 1. Clean the text to remove markdown symbols (*, #, _, ~, `)
        clean_text = re.sub(r'[*#_~`]', '', request.text)
        
        # 2. Generate speech using the free gTTS library
        tts = gTTS(text=clean_text, lang='en', slow=False)
        
        # 3. Save the audio data directly into a memory buffer
        audio_stream = io.BytesIO()
        tts.write_to_fp(audio_stream)
        audio_stream.seek(0)
        
        # 4. Return the audio stream directly to the frontend
        return StreamingResponse(audio_stream, media_type="audio/mpeg")
    except Exception as e:
        print(f"Error in TTS endpoint: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))