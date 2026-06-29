# 🎯 InterviewAce

> AI-powered mock interview coach with voice analysis, eye contact tracking, 
> resume-based interviews, and coding interview mode.

🔗 **Live Demo**: https://interviewace-xyz.vercel.app  
📡 **API**: https://interviewace-backend.onrender.com/docs

## Tech Stack
| Layer | Tech |
|---|---|
| Frontend | Next.js 14, Tailwind CSS, Monaco Editor, face-api.js |
| Backend | FastAPI, SQLAlchemy 2.0, Alembic, Pydantic |
| AI | Groq (Llama 3.3 70B + Whisper), RAG |
| Database | Neon Postgres |
| Code Execution | Piston API |
| Hosting | Vercel + Render (100% free) |

## Local Setup
\`\`\`bash
# Backend
cd backend && python -m venv .venv && .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env   # fill in GROQ_API_KEY
alembic upgrade head
uvicorn app.main:app --reload

# Frontend  
cd frontend && npm install
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > .env.local
npm run dev
\`\`\`
