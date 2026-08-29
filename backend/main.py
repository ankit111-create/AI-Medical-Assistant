from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
from sqlalchemy import create_engine, Column, Integer, Text, String, ForeignKey
from sqlalchemy.orm import declarative_base, sessionmaker
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta

app = FastAPI(
    title="AI Medical Assistant",
    description="AI-powered medical assistance system",
    version="1.0.0"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        "https://ai-medical-assistant-82y8.onrender.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================
# DATABASE
# =========================

DATABASE_URL = "sqlite:///./medical_assistant.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()


# =========================
# PASSWORD SECURITY
# =========================

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)

SECRET_KEY = "change-this-secret-key-later"
ALGORITHM = "HS256"


# =========================
# USER TABLE
# =========================

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False)


# =========================
# CHAT TABLE
# =========================

class Chat(Base):
    __tablename__ = "chats"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)
    user_message = Column(Text, nullable=False)
    assistant_message = Column(Text, nullable=False)


# Create tables without deleting existing data
Base.metadata.create_all(bind=engine)


# =========================
# REQUEST MODELS
# =========================

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class ChatRequest(BaseModel):
    message: str


# =========================
# EMERGENCY KEYWORDS
# =========================

EMERGENCY_KEYWORDS = [
    "chest pain",
    "difficulty breathing",
    "can't breathe",
    "cannot breathe",
    "severe bleeding",
    "unconscious",
    "stroke",
    "seizure",
    "suicide",
    "self harm",
    "severe burn",
    "heart attack"
]


# =========================
# HOME
# =========================

@app.get("/")
def home():
    return {
        "message": "AI Medical Assistant API is running!",
        "status": "success"
    }


# =========================
# HEALTH
# =========================

@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }


# =========================
# REGISTER
# =========================

@app.post("/register")
def register(request: RegisterRequest):

    db = SessionLocal()

    existing_user = (
        db.query(User)
        .filter(User.email == request.email)
        .first()
    )

    if existing_user:
        db.close()
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    hashed_password = pwd_context.hash(request.password)

    new_user = User(
        name=request.name,
        email=request.email,
        password=hashed_password
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    user_id = new_user.id

    db.close()

    return {
        "message": "User registered successfully",
        "user_id": user_id,
        "name": request.name,
        "email": request.email
    }


# =========================
# LOGIN
# =========================

@app.post("/login")
def login(request: LoginRequest):

    db = SessionLocal()

    user = (
        db.query(User)
        .filter(User.email == request.email)
        .first()
    )

    if not user:
        db.close()
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if not pwd_context.verify(request.password, user.password):
        db.close()
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    token_data = {
        "user_id": user.id,
        "email": user.email,
        "exp": datetime.utcnow() + timedelta(hours=24)
    }

    token = jwt.encode(
        token_data,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    db.close()

    return {
        "message": "Login successful",
        "access_token": token,
        "token_type": "bearer",
        "user_id": user.id,
        "name": user.name
    }


# =========================
# CHAT HISTORY
# =========================

@app.get("/history/{user_id}")
def get_history(user_id: int):

    db = SessionLocal()

    chats = (
        db.query(Chat)
        .filter(Chat.user_id == user_id)
        .order_by(Chat.id.asc())
        .all()
    )

    history = []

    for chat in chats:
        history.append({
            "user": chat.user_message,
            "assistant": chat.assistant_message
        })

    db.close()

    return {
        "user_id": user_id,
        "history": history
    }


# =========================
# CLEAR HISTORY
# =========================

@app.delete("/history/{user_id}")
def clear_history(user_id: int):

    db = SessionLocal()

    deleted_count = (
        db.query(Chat)
        .filter(Chat.user_id == user_id)
        .delete(synchronize_session=False)
    )

    db.commit()
    db.close()

    return {
        "user_id": user_id,
        "message": "Chat history cleared successfully",
        "deleted_count": deleted_count
    }

# =========================
# CHAT
# =========================


def chat(request: ChatRequest):

    user_message = request.message.strip()
    message_lower = user_message.lower()

    emergency_detected = any(
        keyword in message_lower
        for keyword in EMERGENCY_KEYWORDS
    )

    if emergency_detected:

        assistant_message = (
            "This may be a medical emergency. "
            "Please seek urgent medical attention or contact "
            "your local emergency medical service immediately. "
            "Do not rely on this AI for emergency diagnosis or treatment."
        )

        db = SessionLocal()

        new_chat = Chat(
            user_message=user_message,
            assistant_message=assistant_message
        )

        db.add(new_chat)
        db.commit()
        db.close()

        return {
            "user_message": user_message,
            "emergency": True,
            "assistant_message": assistant_message
        }

@app.post("/chat/{user_id}")
def chat(user_id: int, request: ChatRequest):
    db = SessionLocal()

    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        db.close()
        raise HTTPException(status_code=404, detail="User not found")

    user_message = request.message.strip()
    message_lower = user_message.lower()

    emergency_detected = any(
        keyword in message_lower
        for keyword in EMERGENCY_KEYWORDS
    )

    if emergency_detected:
        assistant_message = (
            "This may be a medical emergency. "
            "Please seek urgent medical attention or contact "
            "your local emergency medical service immediately. "
            "Do not rely on this AI for emergency diagnosis or treatment."
        )

    else:
        previous_chats = (
            db.query(Chat)
            .filter(Chat.user_id == user_id)
            .order_by(Chat.id.desc())
            .limit(10)
            .all()
        )

        previous_chats.reverse()

        conversation = ""

        for chat in previous_chats:
            conversation += "User: " + chat.user_message + "\n"
            conversation += "Assistant: " + chat.assistant_message + "\n\n"

        prompt = (
            "You are an AI Medical Assistant.\n\n"
            "Previous conversation:\n"
            + conversation
            + "\nCurrent user question:\n"
            + user_message
            + "\n\n"
            "Analyze the user's symptoms and question carefully.\n\n"
            "Respond using these sections:\n\n"
            "Symptoms mentioned:\n"
            "- List symptoms mentioned by the user.\n\n"
            "Possible causes:\n"
            "- Give a few possible general causes.\n"
            "- Clearly state that these are possibilities, not a diagnosis.\n\n"
            "What you can do:\n"
            "- Give general, low-risk guidance.\n\n"
            "When to see a doctor:\n"
            "- Mention warning signs or situations where professional medical care is appropriate.\n\n"
            "Important:\n"
            "- Do not diagnose the user.\n"
            "- Do not prescribe medication.\n"
            "- Do not give personalized medication dosages.\n"
            "- If symptoms may be serious, recommend medical attention.\n"
            "- Use simple language."
        )

        response = requests.post(
            "http://localhost:11434/api/generate",
            json={
                "model": "llama3.2:3b",
                "prompt": prompt,
                "stream": False
            },
            timeout=120
        )

        response.raise_for_status()

        data = response.json()
        assistant_message = data["response"]

    new_chat = Chat(
        user_id=user_id,
        user_message=user_message,
        assistant_message=assistant_message
    )

    db.add(new_chat)
    db.commit()
    db.close()

    return {
        "user_id": user_id,
        "user_message": user_message,
        "emergency": emergency_detected,
        "assistant_message": assistant_message
    }  