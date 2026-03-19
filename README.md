
### **Empowering Students with AI-Driven Learning**

LiLearn is a cutting-edge, AI-powered study platform designed to help students organize, automate, and excel in their academic journey. By bridging the gap between static study materials and active learning, LiLearn transforms the way you prepare for success.

[![Next.js]](https://nextjs.org/)
[![TypeScript]](https://www.typescriptlang.org/)
[![Tailwind CSS]](https://tailwindcss.com/)
[![Supabase]](https://supabase.com/)
[![n8n]](https://n8n.io/)

---

## 🚀 Live Demo
Experience LiLearn today: **[lilearn.vercel.app](https://lilearn-b5p6mb41n-vissoto02s-projects.vercel.app/)**

---

## ✨ Key Features

### 🧠 AI-Powered Quiz Generation
Stop spending hours manually creating flashcards. Upload your study materials (PDF, DOCX, PPTX) and let our **n8n + Gemini AI** engine automatically generate high-quality multiple-choice quizzes tailored to your content.

### 📅 Smart AI Study Planner
Stay organized with an intelligent planner that understands your curriculum. Manage subjects, topics, and sessions with ease, all powered by AI insights to keep you on track.

### 🏆 Gamified Leaderboard
Stay motivated by competing with your peers. Earn points by completing quizzes and sessions, climb the daily, weekly, and all-time rankings, and unlock prestigious titles as you progress.

### 🔔 Real-time Study Notifications
Never miss a study session again. LiLearn provides timely notifications for upcoming sessions, ensuring you stay committed to your learning goals.

### 📊 Personal Learning Dashboard
Get a bird's-eye view of your progress. Our dashboard provides daily AI-generated insights, recent activity tracking, and upcoming tasks in a beautiful, intuitive interface.

---

## 🛠️ How it Works: The n8n Engine

LiLearn uses a sophisticated automation backend powered by **n8n** and **Google Gemini 2.0 Flash**.
n8n:Webgook and Extract Text from file
<img width="2119" height="649" alt="image" src="https://github.com/user-attachments/assets/8f43fd08-025b-4f28-8748-8940bd57cbea" />

n8n: Generate quiz
<img width="2195" height="574" alt="image" src="https://github.com/user-attachments/assets/a49d617e-33ec-4d6e-af85-04313195a0fc" />

n8n:parse time tabile
<img width="2168" height="576" alt="image" src="https://github.com/user-attachments/assets/35c0f971-22b6-4615-911c-523d5e8d493f" />


1. **Upload:** User uploads a document (PDF/DOCX/PPTX) via the Next.js frontend.
2. **Webhook:** The frontend triggers an n8n webhook with the file metadata.
3. **Extraction:** n8n downloads the file from Supabase Storage and extracts the text content.
4. **AI Generation:** The content is sent to Google Gemini with a specialized prompt to generate pedagogical questions.
5. **Persistence:** The generated quiz and questions are automatically synced back to the Supabase database.
6. **Result:** The user is instantly notified that their personalized quiz is ready to play!

---

## 💻 Tech Stack

- **Framework:** [Next.js 15 (App Router)](https://nextjs.org/)
- **Language:** [TypeScript](https://www.typescriptlang.org/)
- **Styling:** [Tailwind CSS](https://tailwindcss.com/) + [Radix UI](https://www.radix-ui.com/)
- **Database & Auth:** [Supabase](https://supabase.com/) (PostgreSQL)
- **Workflow Automation:** [n8n](https://n8n.io/)
- **AI Engine:** [Google Gemini AI](https://deepmind.google/technologies/gemini/)
- **Icons:** [Lucide React](https://lucide.dev/)
- **Deployment:** [Vercel](https://vercel.com/)

---

## 🛠️ Development Setup

### Prerequisites
- Node.js (v18+)
- npm / pnpm / yarn
- Supabase Project
- n8n instance (optional for local dev)

## 📄 License
This project is licensed under the MIT License 


Built with ❤️ by [Vissoto02](https://github.com/vissoto02)
