import os
import base64
import uuid
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from groq import Groq
from pydantic import BaseModel
from typing import List
import re
from pypdf import PdfReader

load_dotenv()

app = FastAPI(title="AI Summary Module - Groq Vision Fixed")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

class FAQ(BaseModel):
    question: str
    answer: str

def preprocess_text(text: str) -> str:
    return re.sub(r'\s+', ' ', text.strip())

# ====================== EXTRACT TEXT DARI PDF (text-based) ======================
def extract_text_from_pdf(file_bytes: bytes) -> str:
    try:
        reader = PdfReader(file_bytes)
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
        return text.strip()
    except:
        return ""

# ====================== PROCESS DENGAN VISION (untuk Image) ======================
async def process_with_vision(file_bytes: bytes, mime_type: str, filename: str):
    base64_image = base64.b64encode(file_bytes).decode('utf-8')
    image_url = f"data:{mime_type};base64,{base64_image}"

    prompt = """
You are an expert academic assistant.
Analyze the document/image and do the following in English:

1. Write a concise academic summary (max 180 words).
2. Extract 6-8 high-level conceptual topics.
3. Generate 5 insightful FAQ pairs (question + answer).

Return ONLY valid JSON:
{
  "summary": "...",
  "topics": ["topic1", "topic2", ...],
  "faqs": [
    {"question": "...", "answer": "..."}
  ]
}
"""

    try:
        completion = client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",   # ← GANTI JADI INI
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": image_url}}
                    ]
                }
            ],
            temperature=0.3,
            max_tokens=2000,
            response_format={"type": "json_object"}
        )
        result = completion.choices[0].message.content
        return eval(result) if isinstance(result, str) else result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Vision processing failed: {str(e)}")

# ====================== PROCESS DENGAN TEXT MODEL ======================
async def process_with_text(content: str):
    if len(content.strip()) < 50:
        raise HTTPException(status_code=400, detail="Content too short")

    system_prompt = """
You are an expert academic assistant for university students.

Follow these steps:
1. Write a clear academic summary (max 180 words).
2. Extract 6-8 meaningful conceptual topics.
3. Generate 5 insightful FAQ pairs.

Return ONLY valid JSON with keys: "summary", "topics", "faqs"
"""

    try:
        completion = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": content}
            ],
            temperature=0.25,
            max_tokens=4000,
            response_format={"type": "json_object"}
        )
        result = completion.choices[0].message.content
        return eval(result) if isinstance(result, str) else result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

# ====================== MAIN ENDPOINT ======================
@app.post("/ai-summary")
async def ai_summary(text: str = Form(None), file: UploadFile = File(None)):
    if not text and not file:
        raise HTTPException(status_code=400, detail="Provide text or upload file")

    try:
        if file:
            file_bytes = await file.read()
            filename = file.filename.lower()

            if file.content_type.startswith("image/"):
                # Image → pakai Vision
                result = await process_with_vision(file_bytes, file.content_type, filename)
            elif filename.endswith(".pdf"):
                # PDF → coba extract text dulu
                extracted = extract_text_from_pdf(file_bytes)
                if extracted and len(extracted) > 100:
                    result = await process_with_text(extracted)
                else:
                    raise HTTPException(status_code=400, 
                        detail="Scanned PDF detected. Please convert to image (JPG/PNG) or paste the text manually.")
            else:
                raise HTTPException(status_code=400, detail="Only PDF and images (jpg, png, webp) supported")
        else:
            # Text only
            content = preprocess_text(text)
            result = await process_with_text(content)

        return {
            "status": "success",
            "id": str(uuid.uuid4()),
            "timestamp": datetime.now().isoformat(),
            "summary": result.get("summary", ""),
            "topics": result.get("topics", []),
            "faqs": result.get("faqs", [])
        }

    except Exception as e:
        print("Error:", str(e))
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)