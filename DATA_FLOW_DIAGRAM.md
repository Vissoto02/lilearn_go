# Data Flow Diagram - n8n Quiz Generation

## 📊 Complete Flow: Upload → Quiz Creation

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER UPLOADS FILE                            │
│                    (PDF, DOCX, PPTX)                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND (Next.js)                                             │
│  • Creates upload record in Supabase                            │
│  • Uploads file to Supabase Storage                             │
│  • Sends webhook to n8n with upload_id                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  n8n WORKFLOW - Step 1: Extract Text                            │
│  • Downloads file from Supabase Storage                         │
│  • Extracts text content (PDF/DOCX/PPTX parsers)                │
│  • Normalizes and trims text                                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  n8n WORKFLOW - Step 2: Generate with Gemini                    │
│                                                                  │
│  INPUT (from previous step):                                    │
│  • trimmed_text: "Cryptography is..."                           │
│  • difficulty: "medium"                                          │
│  • question_count: 10                                            │
│                                                                  │
│  GEMINI PROMPT:                                                  │
│  "Generate EXACTLY 10 questions... return JSON with:            │
│   { questions: [...] }"                                         │
│                                                                  │
│  ✅ GEMINI OUTPUT (what you saw in screenshot):                 │
│  {                                                               │
│    "questions": [                                                │
│      {                                                           │
│        "prompt": "What is public-key cryptography?",            │
│        "choices": [                                              │
│          "The use of two separate keys",                        │
│          "The generation of a 128-bit digest",                  │
│          "The requirement of private key",                      │
│          "The running time of decryption"                       │
│        ],                                                        │
│        "correct_choice": "The use of two separate keys",        │
│        "hint": "Asymmetric encryption uses key pairs"           │
│      },                                                          │
│      ... 9 more questions ...                                   │
│    ]                                                             │
│  }                                                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  n8n WORKFLOW - Step 3: Parse and Validate JSON                 │
│  • Removes markdown code blocks if present                      │
│  • Validates JSON structure                                      │
│  • Passes through the same data ✅                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  n8n WORKFLOW - Step 4: POST Quiz to Supabase                   │
│                                                                  │
│  INSERT INTO quizzes:                                            │
│  {                                                               │
│    user_id: "...",                                               │
│    upload_id: "...",                                             │
│    subject: "Cryptography and Encryption",                      │
│    topic: "Asymmetric Encryption",                              │
│    difficulty: "medium"                                          │
│  }                                                               │
│                                                                  │
│  ✅ RETURNS: { id: "abc-123-quiz-id" }                          │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  n8n WORKFLOW - Step 5: POST Questions to Supabase              │
│  ⚠️  THIS IS WHERE YOUR ERROR WAS! NOW FIXED:                   │
│                                                                  │
│  ❌ OLD CODE (caused [object Object] error):                    │
│  {                                                               │
│    choices: q.choices,  // Array sent as object reference       │
│    answer_hash: q.correct_choice  // Full text (too long!)      │
│  }                                                               │
│                                                                  │
│  ✅ NEW CODE (works perfectly):                                 │
│  {                                                               │
│    quiz_id: "abc-123-quiz-id",                                  │
│    type: "mcq",                                                  │
│    prompt: "What is public-key cryptography?",                  │
│    choices: [                           ← Simple array!         │
│      "The use of two separate keys",                            │
│      "The generation of a 128-bit digest",                      │
│      "The requirement of private key",                          │
│      "The running time of decryption"                           │
│    ],                                                            │
│    answer_hash: "a",                    ← Just the letter!      │
│    correct_label: "A",                  ← For display!          │
│    hint: "Asymmetric encryption uses key pairs"                 │
│  }                                                               │
│                                                                  │
│  DATABASE RECEIVES (JSONB auto-converts):                        │
│  choices column = ["text1", "text2", "text3", "text4"] ✅       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  n8n WORKFLOW - Step 6: Update Upload Status                    │
│  • Sets upload.status = "completed"                             │
│  • Sets upload.quiz_id = "abc-123-quiz-id"                      │
│  ✅ DONE!                                                        │
└─────────────────────────────────────────────────────────────────┘


## 🎯 Frontend Display Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  USER NAVIGATES TO QUIZ PAGE                                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND FETCHES QUESTIONS FROM DATABASE                        │
│                                                                  │
│  SELECT * FROM quiz_questions WHERE quiz_id = "abc-123"         │
│                                                                  │
│  RETURNS (from Supabase):                                        │
│  {                                                               │
│    choices: ["text A", "text B", "text C", "text D"],           │
│    answer_hash: "a",                                             │
│    correct_label: "A"                                            │
│  }                                                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  QUIZ-PLAYER.TSX - getNormalizedChoices()                       │
│                                                                  │
│  INPUT: ["text A", "text B", "text C", "text D"]                │
│                                                                  │
│  PROCESSING:                                                     │
│  • Checks if choices[0] is string or object                     │
│  • If string → convert to QuizChoice[] format                   │
│  • If object → already correct, return as-is                    │
│                                                                  │
│  OUTPUT (consistent format):                                     │
│  [                                                               │
│    { label: "A", text: "text A" },                              │
│    { label: "B", text: "text B" },                              │
│    { label: "C", text: "text C" },                              │
│    { label: "D", text: "text D" }                               │
│  ]                                                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  DISPLAYED TO USER:                                              │
│                                                                  │
│  ○ A  text A                                                    │
│  ○ B  text B                                                    │
│  ○ C  text C                                                    │
│  ○ D  text D                                                    │
│                                                                  │
│  When user selects C and submits:                               │
│  • Frontend checks if "c" === answer_hash ("a")                 │
│  • Result: Incorrect! ❌                                         │
│  • Correct answer shown: correct_label = "A" ✅                 │
└─────────────────────────────────────────────────────────────────┘


## 🔄 Data Format at Each Stage

┌──────────────────┬────────────────────────────────────────────┐
│ STAGE            │ choices FORMAT                             │
├──────────────────┼────────────────────────────────────────────┤
│ Gemini Output    │ ["text1", "text2", "text3", "text4"]       │
│ Parse JSON       │ ["text1", "text2", "text3", "text4"]       │
│ n8n Mapping      │ ["text1", "text2", "text3", "text4"]       │
│ Database (JSONB) │ ["text1", "text2", "text3", "text4"]       │
│ Frontend Fetch   │ ["text1", "text2", "text3", "text4"]       │
│ getNormalized()  │ [{label: "A", text: "text1"}, ...]         │
│ Display          │ ○ A  text1                                 │
│                  │ ○ B  text2                                 │
│                  │ ○ C  text3                                 │
│                  │ ○ D  text4                                 │
└──────────────────┴────────────────────────────────────────────┘


## 🎯 The Key Insight

The magic of Option A is that we:
1. ✅ Accept the EXACT format Gemini returns (no transformation!)
2. ✅ Store it as-is in database (JSONB handles it!)
3. ✅ Convert it ONLY when displaying (getNormalizedChoices!)

This means:
• Less code in n8n ✅
• No format conversion errors ✅
• Easier debugging ✅
• Backwards compatible ✅
```

---

## 💡 Why Your Old Code Failed

```
OLD n8n CODE:
{
  choices: q.choices,           ← This is an array reference
  answer_hash: q.correct_choice ← This is "The use of two separate keys"
}

When n8n tried to display this in the preview:
• Array reference shows as "[object Object]"
• answer_hash is way too long for database

When inserting to Supabase:
• Supabase expected proper JSONB format
• Got array reference instead
• Error: "JSON parameter needs to be valid JSON"
```

## ✅ Why New Code Works

```
NEW n8n CODE:
{
  choices: q.choices,              ← Same array, but...
  answer_hash: label.toLowerCase() ← Just "a" instead of full text!
  correct_label: label             ← "A" for display
}

Why it works now:
1. choices is already in correct format from Gemini
2. answer_hash is now short and simple
3. Supabase auto-converts array to JSONB
4. Frontend handles both old and new format!
```

---

Made with ❤️ for debugging n8n workflows!
