# LiLearn — AI Adaptive Study Planner

AI-powered study planner with adaptive quizzes, personalized study plans, and habit tracking. Study smarter, not harder.

## Tech Stack

- **Framework**: Next.js 14+ (App Router, TypeScript)
- **Styling**: Tailwind CSS + shadcn/ui
- **Database**: Supabase (Postgres + Auth + RLS)
- **Deployment**: Vercel

## Features

- 📚 **Upload Topics**: Add your syllabus/topics manually or via bulk import
- 🧠 **AI Quiz Generator**: Generate practice quizzes with MCQ and short-answer questions
- 📊 **Weakness Analysis**: Track performance and identify areas needing improvement
- 📅 **Adaptive Planner**: Generate personalized weekly study plans based on weakness + availability
- 🔥 **Habit Tracking**: Daily check-ins, streak tracking, and progress visualization
- ⚙️ **Settings**: Profile management, data export, and account deletion

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)
- Supabase account

### Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_anon_key
N8N_WEBHOOK_URL=optional_n8n_webhook_url
```

### Supabase Setup

1. Create a new Supabase project
2. Go to SQL Editor and run:
   - `db/schema.sql` - Creates all tables
   - `db/rls.sql` - Enables Row Level Security policies
3. (Optional) Run `db/seed.sql` after creating a test user

### Installation

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

### Running Tests

```bash
pnpm add -D vitest
npx vitest run
```

## Project Structure

```
app/
├── page.tsx                    # Landing page
├── (auth)/
│   ├── login/page.tsx
│   └── signup/page.tsx
├── (app)/
│   ├── layout.tsx              # Protected app shell
│   ├── page.tsx                # Dashboard
│   ├── upload/page.tsx         # Topic management
│   ├── quiz/page.tsx           # Quiz generation
│   ├── planner/page.tsx        # Weekly planner
│   ├── habits/page.tsx         # Habit tracking
│   └── settings/page.tsx       # Profile settings

components/
├── app/                        # App-specific components
│   ├── sidebar.tsx
│   ├── topbar.tsx
│   ├── quiz-player.tsx
│   ├── weekly-calendar.tsx
│   └── ...
└── ui/                         # shadcn components

lib/
├── types.ts                    # TypeScript types
├── quiz-generator.ts           # Mock AI quiz generation
├── plan-generator.ts           # Study plan algorithm
├── streak-calculator.ts        # Streak calculation
└── weakness-calculator.ts      # Weakness analysis

db/
├── schema.sql                  # Database tables
├── rls.sql                     # Row Level Security
└── seed.sql                    # Demo data
```

## Database Schema

| Table | Description |
|-------|-------------|
| `profiles` | User profiles (linked to auth.users) |
| `topics` | Study topics by subject |
| `availability` | Weekly study availability |
| `quizzes` | Generated quizzes |
| `quiz_questions` | Questions within quizzes |
| `quiz_attempts` | User answers and results |
| `plans` | Weekly study plans |
| `plan_tasks` | Individual study tasks |
| `habits` | Daily check-ins |
| `notifications` | Reminder queue |

## Row Level Security

All tables have RLS enabled with policies ensuring users can only access their own data:

```sql
CREATE POLICY "Users can view own data" ON table_name
  FOR SELECT USING (auth.uid() = user_id);
```

## Deployment

### Vercel

1. Push to GitHub
2. Import to Vercel
3. Add environment variables
4. Deploy

## License

MIT
