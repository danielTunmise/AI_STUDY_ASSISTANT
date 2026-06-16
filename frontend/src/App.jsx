import React, { useState, useCallback, useRef, useEffect } from 'react';
import axios from 'axios';
import { useDropzone } from 'react-dropzone';
import { 
  UploadCloud, MessageSquare, FileText, Layers, Target, Volume2, Pause,
  CheckSquare, Send, Loader2, AlertCircle, CheckCircle2, Square,
  FileCheck2, ChevronRight, BrainCircuit, Speaker, BookOpen
} from 'lucide-react';

import { Button } from "./components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "./components/ui/card";

const API_BASE_URL = 'http://127.0.0.1:8000';

// --- Subcomponents ---

function QuizItem({ question, index }) {
  const [selected, setSelected] = useState(null);
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 mb-6 transition-all duration-300">
      <div className="flex items-start gap-4 mb-6">
        <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm">
          {question.id || index + 1}
        </div>
        <h3 className="text-xl font-semibold text-slate-800 leading-relaxed pt-0.5">
          {question.question}
        </h3>
      </div>
      
      <div className="space-y-3 pl-12">
        {question.options.map((opt, i) => {
          const isCorrect = opt === question.correct_answer;
          let bgClass = "bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-700";
          
          if (revealed) {
            if (isCorrect) bgClass = "bg-emerald-50 border-emerald-500 text-emerald-900";
            else if (selected === opt) bgClass = "bg-rose-50 border-rose-500 text-rose-900";
            else bgClass = "bg-white border-slate-200 opacity-50";
          } else if (selected === opt) {
            bgClass = "bg-indigo-50 border-indigo-500 text-indigo-900 ring-1 ring-indigo-500";
          }

          return (
            <button
              key={i}
              disabled={revealed}
              onClick={() => setSelected(opt)}
              className={`w-full text-left px-5 py-4 rounded-xl border-2 transition-all duration-200 font-medium ${bgClass}`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${selected === opt ? 'border-indigo-500' : 'border-slate-300'}`}>
                  {selected === opt && <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />}
                </div>
                {opt}
              </div>
            </button>
          );
        })}
      </div>
      
      <div className="mt-8 pl-12">
        {!revealed ? (
          <Button
            disabled={!selected}
            onClick={() => setRevealed(true)}
            className="font-semibold shadow-sm flex items-center gap-2"
          >
            Check Answer <ChevronRight className="w-4 h-4" />
          </Button>
        ) : (
          <div className={`p-5 rounded-xl border-2 ${selected === question.correct_answer ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'} animate-in fade-in slide-in-from-top-2`}>
            <div className="flex items-center gap-3 mb-2">
              {selected === question.correct_answer ? (
                <><CheckCircle2 className="w-6 h-6 text-emerald-600" /> <span className="text-emerald-800 font-bold text-lg">Excellent!</span></>
              ) : (
                <><AlertCircle className="w-6 h-6 text-rose-600" /> <span className="text-rose-800 font-bold text-lg">Not quite right.</span></>
              )}
            </div>
            <p className="text-slate-700 mt-2 leading-relaxed ml-9">{question.explanation}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function LikelyQuestionItem({ question }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full text-left p-5 flex justify-between items-center hover:bg-slate-50 transition-colors"
      >
        <span className="font-semibold text-slate-800">{question.question}</span>
        <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
      </button>
      {isOpen && (
        <div className="px-5 pb-5 border-t border-slate-200 animate-in fade-in">
          <div className="pt-4 text-slate-600 leading-relaxed">
            <p className="font-semibold text-slate-700 mb-2">Expected Answer:</p>
            <p className="whitespace-pre-wrap">{question.expected_answer}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main Application ---

const formatText = (text) => {
  if (!text) return null;
  return text.split('\n').map((line, i) => {
    if (!line.trim()) return <div key={i} className="h-4" />;
    
    let isBullet = false;
    let isH2 = false;
    let isH3 = false;
    let isH4 = false;
    let content = line.trim();

    if (content.startsWith('- ') || content.startsWith('* ')) {
      isBullet = true;
      content = content.substring(2);
    } else if (content.startsWith('### ')) {
      isH4 = true;
      content = content.substring(4);
    } else if (content.startsWith('## ')) {
      isH3 = true;
      content = content.substring(3);
    } else if (content.startsWith('# ')) {
      isH2 = true;
      content = content.substring(2);
    }

    // Parse basic markdown: bold text
    const parts = content.split(/(\*\*.*?\*\*)/g);
    const formattedLine = parts.map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={j} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
      }
      return part;
    });

    if (isBullet) {
      return (
        <div key={i} className="flex items-start gap-3 mb-2 ml-4">
          <span className="text-indigo-500 font-bold mt-0.5">•</span>
          <span className="text-slate-700 leading-relaxed flex-1">{formattedLine}</span>
        </div>
      );
    }
    if (isH4) return <h4 key={i} className="text-lg font-bold text-slate-800 mt-6 mb-3">{formattedLine}</h4>;
    if (isH3) return <h3 key={i} className="text-xl font-bold text-slate-900 mt-8 mb-4 border-b pb-2">{formattedLine}</h3>;
    if (isH2) return <h2 key={i} className="text-2xl font-bold text-slate-900 mt-8 mb-4">{formattedLine}</h2>;

    return <p key={i} className="mb-4 text-slate-700 leading-relaxed">{formattedLine}</p>;
  });
};

export default function App() {
  // State: Upload
  const [fileName, setFileName] = useState('');
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle, loading, success, error
  const [uploadMessage, setUploadMessage] = useState('');

  // State: Audio Upload
  const [audioFileName, setAudioFileName] = useState('');
  const [audioUploadStatus, setAudioUploadStatus] = useState('idle');
  const [audioUploadMessage, setAudioUploadMessage] = useState('');
  const [transcript, setTranscript] = useState('');

  // State: Tabs
  const [activeTab, setActiveTab] = useState('chat');

  // State: Chat
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  // State: Summary
  const [summaryMode, setSummaryMode] = useState('');
  const [summaryData, setSummaryData] = useState('');
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  // State: Flashcards
  const [flashcardsData, setFlashcardsData] = useState(null);
  const [isFlashcardsLoading, setIsFlashcardsLoading] = useState(false);

  // State: Quiz
  const [quizData, setQuizData] = useState(null);
  const [isQuizLoading, setIsQuizLoading] = useState(false);

  // State: Exam Prep
  const [examPrepData, setExamPrepData] = useState(null);
  const [isExamPrepLoading, setIsExamPrepLoading] = useState(false);

  // State: Notes
  const [notesData, setNotesData] = useState('');
  const [isNotesLoading, setIsNotesLoading] = useState(false);
  const [rawText, setRawText] = useState('');

  useEffect(() => {
    if (transcript) setRawText(transcript);
  }, [transcript]);

  // State: Audio
  const [audioState, setAudioState] = useState({ playingId: null, isLoading: false });
  const audioRef = useRef(null);

  // Auto-scroll chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatLoading]);

  // Dropzone Handler
  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;
    
    setFileName(file.name);
    setUploadStatus('loading');
    setUploadMessage('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${API_BASE_URL}/upload`, formData);
      setUploadStatus('success');
      setUploadMessage(res.data.message);
    } catch (err) {
      console.error("API Error:", err);
      setUploadStatus('error');
      setUploadMessage(err.response?.data?.detail || err.message);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1
  });

  // Audio Dropzone Handler
  const onAudioDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;
    
    setAudioFileName(file.name);
    setAudioUploadStatus('loading');
    setAudioUploadMessage('');
    setTranscript('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${API_BASE_URL}/api/transcribe`, formData);
      setAudioUploadStatus('success');
      setAudioUploadMessage('Transcription complete!');
      setTranscript(res.data.transcript);
    } catch (err) {
      console.error("API Error:", err);
      setAudioUploadStatus('error');
      setAudioUploadMessage(err.response?.data?.detail || err.message);
    }
  }, []);

  const { getRootProps: getAudioRootProps, getInputProps: getAudioInputProps, isDragActive: isAudioDragActive } = useDropzone({
    onDrop: onAudioDrop,
    accept: { 'audio/*': ['.mp3', '.wav', '.m4a'] },
    maxFiles: 1
  });

  // Handlers
  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatLoading) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    setMessages(prev => [...prev, { sender: 'user', text: userMsg }]);
    setIsChatLoading(true);

    try {
      const res = await axios.post(`${API_BASE_URL}/api/chat`, { 
        message: userMsg,
        document_id: fileName || "default"
      });
      setMessages(prev => [...prev, { sender: 'ai', text: res.data.response }]);
    } catch (err) {
      console.error("API Error:", err);
      setMessages(prev => [...prev, { sender: 'ai', text: `Error: ${err.response?.data?.detail || err.message}` }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleSummaryTabClick = async (type) => {
    setSummaryMode(type);
    setIsSummaryLoading(true);
    setSummaryData('');
    try {
      const res = await axios.post(`${API_BASE_URL}/api/generate-summary`, { 
        summary_type: type,
        document_id: fileName || "default" 
      });
      setSummaryData(res.data.summary);
    } catch (err) {
      console.error("API Error:", err);
      setSummaryData(`Error: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const handleGenerateFlashcards = async () => {
    setIsFlashcardsLoading(true);
    setFlashcardsData(null);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/generate-flashcards`);
      let data = res.data;
      
      if (Array.isArray(data)) {
        data = data.map(card => ({ id: card.id, front: card.question, back: card.answer, isFlipped: false }));
      } else {
        data = [];
      }
      
      setFlashcardsData(data);
    } catch (err) {
      console.error("API Error:", err);
      alert(`Failed to generate flashcards: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsFlashcardsLoading(false);
    }
  };

  const handleGenerateQuiz = async () => {
    setIsQuizLoading(true);
    setQuizData(null);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/generate-quiz`);
      setQuizData(res.data);
    } catch (err) {
      console.error("API Error:", err);
      alert(`Failed to generate quiz: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsQuizLoading(false);
    }
  };

  const handleGenerateExamPrep = async () => {
    setIsExamPrepLoading(true);
    setExamPrepData(null);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/generate-examprep`);
      setExamPrepData(res.data);
    } catch (err) {
      console.error("API Error:", err);
      alert(`Failed to generate exam prep kit: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsExamPrepLoading(false);
    }
  };

  const handleGenerateNotes = async () => {
    if (!rawText.trim()) return;
    setIsNotesLoading(true);
    setNotesData('');
    try {
      const res = await axios.post(`${API_BASE_URL}/api/generate-notes`, { text: rawText });
      setNotesData(res.data.notes);
    } catch (err) {
      console.error("API Error:", err);
      setNotesData(`Error: ${err.response?.data?.detail || err.message}`);
    } finally {
      setIsNotesLoading(false);
    }
  };

  const toggleCardFlip = (index) => {
    setFlashcardsData(prev => 
      prev.map((card, i) => i === index ? { ...card, isFlipped: !card.isFlipped } : card)
    );
  };

  const handleToggleChecklistItem = (id) => {
    setExamPrepData(prev => {
      if (!prev) return null;
      const newChecklist = prev.checklist.map(item => 
        item.id === id ? { ...item, completed: !item.completed } : item
      );
      return { ...prev, checklist: newChecklist };
    });
  };

  const handlePlayAudio = async (text, id) => {
    // If we click the button that is currently playing, stop it.
    if (audioRef.current && audioState.playingId === id && !audioState.isLoading) {
      audioRef.current.pause();
      // Manually trigger the onended event to clean up state and object URL
      if (audioRef.current.onended) {
        audioRef.current.onended();
      }
      return;
    }
  
    // If another audio is playing, stop it first.
    if (audioRef.current) {
      audioRef.current.pause();
      if (audioRef.current.onended) {
        audioRef.current.onended();
      }
    }
  
    setAudioState({ playingId: id, isLoading: true });
  
    try {
      const response = await axios.post(`${API_BASE_URL}/api/tts`, 
        { text },
        { responseType: 'blob' }
      );
  
      const blob = response.data;
      const url = URL.createObjectURL(blob);
      
      const audio = new Audio(url);
      audioRef.current = audio;
  
      audio.onended = () => {
        setAudioState({ playingId: null, isLoading: false });
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };
  
      audio.play();
      setAudioState({ playingId: id, isLoading: false });
    } catch (error) {
      console.error('TTS Error:', error);
      alert('Failed to generate audio.');
      setAudioState({ playingId: null, isLoading: false });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Premium Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg shadow-inner">
              <BrainCircuit className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">AI Study Assistant</h1>
          </div>
          {fileName && (
            <div className="flex items-center gap-2 px-4 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full animate-in fade-in">
              <FileCheck2 className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-700 truncate max-w-[200px]">{fileName}</span>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        
        {/* Upload Section */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Document Upload */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 flex flex-col">
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <FileText className="w-6 h-6 text-indigo-600" />
              Document Upload
            </h2>
            <div
              {...getRootProps()}
              className={`relative flex-1 p-12 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
                isDragActive 
                  ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]' 
                  : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
              }`}
            >
              <input {...getInputProps()} />
              {uploadStatus === 'loading' ? (
                <div className="flex flex-col items-center text-indigo-600">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-75"></div>
                    <Loader2 className="w-12 h-12 animate-spin relative z-10" />
                  </div>
                  <p className="font-semibold text-lg">Processing document...</p>
                  <p className="text-sm text-indigo-400 mt-2">This might take a few seconds</p>
                </div>
              ) : (
                <>
                  <div className={`p-5 rounded-full mb-6 transition-colors duration-300 ${fileName ? 'bg-emerald-100' : 'bg-indigo-50 group-hover:bg-indigo-100'}`}>
                    <UploadCloud className={`w-12 h-12 ${fileName ? 'text-emerald-600' : 'text-indigo-600'}`} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2 text-center">
                    {fileName ? `Uploaded: ${fileName}` : "Upload your study material"}
                  </h3>
                  <p className="text-slate-500 font-medium text-center max-w-md">
                    Drag & drop your PDF file here, or click to browse your computer
                  </p>
                </>
              )}
            </div>
            {/* Upload Error/Success Message */}
            {uploadStatus === 'error' && (
              <div className="mt-4 p-4 bg-rose-50 text-rose-700 rounded-xl text-sm font-medium flex items-center gap-3 border border-rose-100 animate-in fade-in">
                <AlertCircle className="w-5 h-5 shrink-0" /> {uploadMessage}
              </div>
            )}
            {uploadStatus === 'success' && (
              <div className="mt-4 p-4 bg-emerald-50 text-emerald-700 rounded-xl text-sm font-medium flex items-center gap-3 border border-emerald-100 animate-in fade-in">
                <CheckCircle2 className="w-5 h-5 shrink-0" /> {uploadMessage}
              </div>
            )}
          </div>

          {/* Audio Transcription */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-8 flex flex-col">
            <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
              <Speaker className="w-6 h-6 text-indigo-600" />
              Lecture Recording
            </h2>
            <div
              {...getAudioRootProps()}
              className={`relative flex-1 p-12 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all duration-300 ${
                isAudioDragActive 
                  ? 'border-indigo-500 bg-indigo-50/50 scale-[1.01]' 
                  : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
              }`}
            >
              <input {...getAudioInputProps()} />
              {audioUploadStatus === 'loading' ? (
                <div className="flex flex-col items-center text-indigo-600">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-75"></div>
                    <Loader2 className="w-12 h-12 animate-spin relative z-10" />
                  </div>
                  <p className="font-semibold text-lg text-center">Transcribing lecture...</p>
                  <p className="text-sm text-indigo-400 mt-2 text-center">This might take a moment</p>
                </div>
              ) : (
                <>
                  <div className={`p-5 rounded-full mb-6 transition-colors duration-300 ${audioFileName ? 'bg-emerald-100' : 'bg-indigo-50 hover:bg-indigo-100'}`}>
                    <Volume2 className={`w-12 h-12 ${audioFileName ? 'text-emerald-600' : 'text-indigo-600'}`} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2 text-center">
                    {audioFileName ? `Uploaded: ${audioFileName}` : "Upload audio recording"}
                  </h3>
                  <p className="text-slate-500 font-medium text-center max-w-md">
                    Drag & drop your audio file (.mp3, .wav, .m4a)
                  </p>
                </>
              )}
            </div>
            
            {audioUploadStatus === 'error' && (
              <div className="mt-4 p-4 bg-rose-50 text-rose-700 rounded-xl text-sm font-medium flex items-center gap-3 border border-rose-100 animate-in fade-in">
                <AlertCircle className="w-5 h-5 shrink-0" /> {audioUploadMessage}
              </div>
            )}
            
            {transcript && (
              <div className="mt-4 p-5 bg-slate-50 border border-slate-200 rounded-xl max-h-[150px] overflow-y-auto custom-scrollbar animate-in fade-in">
                <h4 className="text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Transcript</h4>
                <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">{transcript}</p>
              </div>
            )}
          </div>
        </section>

        {/* Controls and Active View */}
        <section className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col w-full">
            
            <TabsList>
              <TabsTrigger value="chat"><MessageSquare className="w-5 h-5 mr-2" /> Chat Mode</TabsTrigger>
              <TabsTrigger value="summary"><FileText className="w-5 h-5 mr-2" /> Summaries</TabsTrigger>
              <TabsTrigger value="flashcards"><Layers className="w-5 h-5 mr-2" /> Flashcards</TabsTrigger>
              <TabsTrigger value="quiz"><CheckSquare className="w-5 h-5 mr-2" /> Practice Quiz</TabsTrigger>
              <TabsTrigger value="examprep"><Target className="w-5 h-5 mr-2" /> Exam Prep</TabsTrigger>
              <TabsTrigger value="notes"><BookOpen className="w-5 h-5 mr-2" /> Study Notes</TabsTrigger>
            </TabsList>

            {/* Active View Container */}
            <div className="flex-1 flex flex-col bg-white">
              
              {/* --- Chat View --- */}
              <TabsContent value="chat" className="flex flex-col h-[600px] bg-slate-50/50 rounded-b-3xl">
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                      <MessageSquare className="w-12 h-12 text-slate-300" />
                      <p className="text-lg">Ask a question to start the conversation...</p>
                    </div>
                  )}
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-6 py-4 shadow-sm ${
                        msg.sender === 'user' 
                          ? 'bg-indigo-600 text-white rounded-br-sm' 
                          : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'
                      }`}>
                        <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{msg.text}</p>
                      </div>
                    </div>
                  ))}
                  {isChatLoading && (
                    <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2">
                      <div className="bg-white border border-slate-200 text-slate-500 rounded-2xl rounded-bl-sm px-6 py-4 flex items-center gap-3 shadow-sm">
                        <Loader2 className="w-5 h-5 animate-spin text-indigo-600" /> 
                        <span className="font-medium">Thinking...</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
                <div className="p-4 bg-white border-t border-slate-200">
                  <form onSubmit={handleChatSubmit} className="relative flex items-center">
                    <input 
                      type="text" 
                      value={chatInput} 
                      onChange={(e) => setChatInput(e.target.value)} 
                      placeholder="Ask about the document..." 
                      className="w-full border border-slate-300 rounded-full pl-6 pr-14 py-4 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-slate-50 focus:bg-white transition-all text-slate-700 shadow-sm"
                      disabled={isChatLoading}
                    />
                    <Button 
                      type="submit"
                      size="icon"
                      disabled={isChatLoading || !chatInput.trim()}
                      className="absolute right-2 rounded-full h-10 w-10"
                    >
                      <Send className="w-5 h-5 ml-0.5" />
                    </Button>
                  </form>
                </div>
              </TabsContent>

              {/* --- Study Notes View --- */}
              <TabsContent value="notes" className="flex flex-col h-[600px] p-6 bg-slate-50/50 rounded-b-3xl">
                <div className="flex justify-between items-center mb-8 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="bg-indigo-50 p-2 rounded-lg">
                      <BookOpen className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">Automated Study Notes</h3>
                      <p className="text-sm text-slate-500">Transform raw transcripts or text into structured study guides.</p>
                    </div>
                  </div>
                  <Button onClick={handleGenerateNotes} disabled={isNotesLoading || !rawText.trim()}>
                    {isNotesLoading ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Formatting notes...</>
                    ) : (
                      <><BookOpen className="w-4 h-4 mr-2" /> Generate Formatted Notes</>
                    )}
                  </Button>
                </div>

                <div className="flex-1 flex gap-6 overflow-hidden">
                  <div className="w-1/3 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                      <h4 className="font-semibold text-slate-700 text-sm">Source Text</h4>
                    </div>
                    <textarea
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      placeholder="Paste raw text or upload an audio lecture to automatically load the transcript..."
                      className="flex-1 p-4 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-600 text-sm leading-relaxed"
                      disabled={isNotesLoading}
                    />
                  </div>

                  <div className="w-2/3 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                      <h4 className="font-semibold text-slate-700 text-sm">Formatted Study Guide</h4>
                    </div>
                    <div className="flex-1 p-6 overflow-y-auto">
                      {isNotesLoading ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                          <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                          <p className="text-lg font-medium animate-pulse text-slate-500">Formatting textbook notes...</p>
                        </div>
                      ) : notesData ? (
                        <div className="max-w-3xl mx-auto space-y-2">
                          {formatText(notesData)}
                        </div>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                          <BookOpen className="w-12 h-12 text-slate-300" />
                          <p className="text-lg text-center">Ready to generate notes.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* --- Summary View --- */}
              <TabsContent value="summary" className="flex flex-col h-[600px] p-6">
                <div className="mb-8 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="bg-indigo-50 p-2 rounded-lg">
                      <FileText className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">Generate Summary</h3>
                      <p className="text-sm text-slate-500">Choose the depth of your study guide</p>
                    </div>
                  </div>
                  
                  {/* Summary Type Tabs */}
                  <div className="flex bg-slate-100 p-1.5 rounded-xl shadow-inner">
                    {[
                      { id: '5-min', label: '5-Minute Summary' },
                      { id: '10-min', label: '10-Minute Summary' },
                      { id: 'exam', label: 'Exam Cheat Sheet' }
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => handleSummaryTabClick(tab.id)}
                        disabled={isSummaryLoading}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium text-sm transition-all duration-200 ${
                          summaryMode === tab.id 
                            ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/50' 
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        } ${isSummaryLoading && summaryMode !== tab.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {isSummaryLoading && summaryMode === tab.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                        ) : null}
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto bg-white rounded-2xl border border-slate-200 p-8 shadow-sm">
                  {isSummaryLoading ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                      <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                      <p className="text-lg font-medium animate-pulse text-slate-500">Generating your summary...</p>
                    </div>
                  ) : summaryData ? (
                    <div className="max-w-4xl mx-auto">
                       <div className="flex justify-end mb-4 -mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePlayAudio(summaryData, summaryMode)}
                          disabled={audioState.isLoading && audioState.playingId !== summaryMode}
                          className="flex items-center gap-2"
                        >
                          {audioState.playingId === summaryMode && audioState.isLoading ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Loading...</>
                          ) : audioState.playingId === summaryMode ? (
                            <><Pause className="w-4 h-4" /> Stop</>
                          ) : (
                            <><Volume2 className="w-4 h-4" /> Listen</>
                          )}
                        </Button>
                      </div>
                      {formatText(summaryData)}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                      <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-2">
                        <FileText className="w-8 h-8 text-slate-300" />
                      </div>
                      <p className="text-lg font-medium text-slate-500">Select a summary format above</p>
                      <p className="text-sm text-slate-400 text-center max-w-sm">
                        Whether you have 5 minutes before class or need a deep dive for finals, we've got you covered.
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* --- Flashcards View --- */}
              <TabsContent value="flashcards" className="flex flex-col h-[600px] p-6">
                <div className="flex justify-between items-center mb-8 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="bg-indigo-50 p-2 rounded-lg">
                      <Layers className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">Study Flashcards</h3>
                      <p className="text-sm text-slate-500">Test your memorization of key concepts</p>
                    </div>
                  </div>
                  <Button 
                    onClick={handleGenerateFlashcards} 
                    disabled={isFlashcardsLoading} 
                  >
                    {isFlashcardsLoading ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Generating...</>
                    ) : (
                      <><Layers className="w-4 h-4 mr-2" /> Generate Flashcards</>
                    )}
                  </Button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2">
                  {!flashcardsData && !isFlashcardsLoading && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                      <Layers className="w-12 h-12 text-slate-300" />
                      <p className="text-lg">Generate flashcards to begin studying.</p>
                    </div>
                  )}
                  {flashcardsData && (
                    <>
                      {/* THIS PARENT CONTAINER IS MANDATORY FOR THE GRID */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full mt-8">
                        {flashcardsData.map((card, index) => (
                          <Card
                            key={index}
                            onClick={() => toggleCardFlip(index)}
                            className="relative cursor-pointer min-h-[250px] flex flex-col items-center justify-center text-center hover:border-indigo-500 hover:-translate-y-1 overflow-hidden transition-all duration-200"
                          >
                            <CardContent className="w-full flex flex-col items-center justify-center p-6 h-full mt-4">
                              {card.isFlipped ? (
                                <div className="w-full">
                                   <div className="flex justify-between items-center mb-3">
                                    <span className="text-xs text-emerald-400 uppercase tracking-widest font-bold">Answer</span>
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-8 w-8 text-slate-400 hover:bg-slate-700 hover:text-white"
                                      onClick={(e) => {
                                        e.stopPropagation(); // Prevent card from flipping back
                                        handlePlayAudio(card.back, `flashcard-${index}`);
                                      }}
                                      disabled={audioState.isLoading && audioState.playingId !== `flashcard-${index}`}
                                    >
                                      {audioState.playingId === `flashcard-${index}` && audioState.isLoading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                      ) : audioState.playingId === `flashcard-${index}` ? (
                                        <Pause className="w-4 h-4" />
                                      ) : (
                                        <Volume2 className="w-4 h-4" />
                                      )}
                                    </Button>
                                  </div>
                                  <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{card.back}</p>
                                </div>
                              ) : (
                                <div className="w-full">
                                  <span className="text-xs text-indigo-400 uppercase tracking-widest font-bold mb-3 block">Question</span>
                                  <CardTitle className="text-white text-xl leading-relaxed">{card.front}</CardTitle>
                                </div>
                              )}
                            </CardContent>
                            <div className="absolute bottom-4 opacity-50 text-xs text-slate-400 font-medium">
                              Click to flip
                            </div>
                          </Card>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </TabsContent>

              {/* --- Quiz View --- */}
              <TabsContent value="quiz" className="flex flex-col h-[600px] p-6">
                <div className="flex justify-between items-center mb-8 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="bg-indigo-50 p-2 rounded-lg">
                      <CheckSquare className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">Practice Quiz</h3>
                      <p className="text-sm text-slate-500">Evaluate your understanding of the material</p>
                    </div>
                  </div>
                  <Button 
                    onClick={handleGenerateQuiz} 
                    disabled={isQuizLoading} 
                  >
                    {isQuizLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckSquare className="w-4 h-4 mr-2" />}
                    Generate Quiz
                  </Button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2">
                  {!quizData && !isQuizLoading && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                      <CheckSquare className="w-12 h-12 text-slate-300" />
                      <p className="text-lg">Generate a quiz to test your knowledge.</p>
                    </div>
                  )}
                  {quizData && (
                    <div className="max-w-4xl mx-auto space-y-8">
                      {quizData.map((q, idx) => <QuizItem key={idx} question={q} index={idx} />)}
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* --- Exam Prep View --- */}
              <TabsContent value="examprep" className="flex flex-col h-[600px] p-6 bg-slate-50/50 rounded-b-3xl">
                <div className="flex justify-between items-center mb-8 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-4">
                    <div className="bg-indigo-50 p-2 rounded-lg">
                      <Target className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">Exam Prep Kit</h3>
                      <p className="text-sm text-slate-500">Generate a focused study guide for your exams.</p>
                    </div>
                  </div>
                  <Button onClick={handleGenerateExamPrep} disabled={isExamPrepLoading}>
                    {isExamPrepLoading ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Generating...</>
                    ) : (
                      <><Target className="w-4 h-4 mr-2" /> Generate Exam Prep Kit</>
                    )}
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                  {isExamPrepLoading ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                      <Loader2 className="w-10 h-10 animate-spin text-indigo-500" />
                      <p className="text-lg font-medium animate-pulse text-slate-500">Building your exam kit...</p>
                    </div>
                  ) : !examPrepData ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
                      <Target className="w-12 h-12 text-slate-300" />
                      <p className="text-lg">Generate an exam prep kit to get started.</p>
                    </div>
                  ) : (
                    <div className="space-y-12 max-w-4xl mx-auto">
                      {/* Section 1: Core Topics */}
                      <div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-4">Core Topics</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {examPrepData.important_topics.map((topic, index) => (
                            <div key={index} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
                              <div className="flex justify-between items-start mb-2">
                                <h3 className="font-semibold text-slate-800 flex-1 pr-2">{topic.topic}</h3>
                                <span className={`flex-shrink-0 px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                                  topic.importance === 'High' ? 'bg-rose-100 text-rose-800' :
                                  topic.importance === 'Medium' ? 'bg-amber-100 text-amber-800' :
                                  'bg-sky-100 text-sky-800'
                                }`}>
                                  {topic.importance}
                                </span>
                              </div>
                              <p className="text-sm text-slate-600">{topic.reason}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Section 2: Likely Questions */}
                      <div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-4">Likely Exam Questions</h2>
                        <div className="space-y-3">
                          {examPrepData.likely_questions.map((q) => (
                            <LikelyQuestionItem key={q.id} question={q} />
                          ))}
                        </div>
                      </div>

                      {/* Section 3: Revision Checklist */}
                      <div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-4">Revision Checklist</h2>
                        <div className="bg-white p-6 rounded-lg border border-slate-200 shadow-sm space-y-4">
                          {examPrepData.checklist.map(item => (
                            <div key={item.id} className="flex items-center">
                              <input
                                type="checkbox"
                                id={`checklist-${item.id}`}
                                checked={item.completed}
                                onChange={() => handleToggleChecklistItem(item.id)}
                                className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                              <label
                                htmlFor={`checklist-${item.id}`}
                                className={`ml-3 text-slate-700 font-medium cursor-pointer transition-colors ${item.completed ? 'line-through text-slate-400' : ''}`}
                              >
                                {item.task}
                              </label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

            </div>
          </Tabs>
        </section>
      </main>
    </div>
  );
}