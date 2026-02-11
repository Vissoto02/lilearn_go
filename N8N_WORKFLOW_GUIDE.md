# n8n Workflow Setup Guide (Updated)

## ⚠️ IMPORTANT CHANGE

**The app NO LONGER creates the quiz record upfront.** Your n8n workflow must now:
1. Create the quiz record
2. Insert questions into `quiz_questions`
3. Update the upload record with the `quiz_id`

This prevents empty quizzes from appearing in the quiz list before questions are ready.

---

## Webhook Payload from Your App

When a file is uploaded, your app sends this JSON to n8n:

```json
{
  "upload_id": "abc-123-xyz",
  "user_id": "user-uuid",
  "file_name": "document.pdf",
  "file_path": "user-id/upload-id/file.pdf",
  "mime_type": "application/pdf",
  "signed_url": "https://bkmttsciyftuhdwrwppp.supabase.co/storage/v1/object/sign/...",
  "options": {
    "difficulty": "medium",
    "question_count": 10,
    "question_types": ["mcq"]
  },
  "topic_id": "topic-uuid",
  "topic_name": "Topic 2 DIT1233 NETWORK SECURITY",
  "quiz_id": "",  // ← EMPTY! n8n must create the quiz
  "supabase_url": "https://bkmttsciyftuhdwrwppp.supabase.co",
  "supabase_service_key": "eyJhbG..."
}
```

---

## Required n8n Workflow Steps

### Step 1: Create Quiz Record

**HTTP Request Node**

**Method:** `POST`

**URL:**
```
{{ $json.supabase_url }}/rest/v1/quizzes
```

**Headers:**
```
Authorization: Bearer {{ $json.supabase_service_key }}
apikey: {{ $json.supabase_service_key }}
Content-Type: application/json
Prefer: return=representation
```

**Body (JSON):**
```json
{
  "user_id": "{{ $json.user_id }}",
  "subject": "DIT1233",
  "topic": "{{ $json.topic_name }}",
  "difficulty": "{{ $json.options.difficulty }}",
  "upload_id": "{{ $json.upload_id }}"
}
```

**Important:** Set this node to output `First Item` and save the response as `quiz_data` or similar.

---

### Step 2: Generate Questions with AI

Use your AI node (Gemini, OpenAI, etc.) to generate questions based on the file content.

**Expected AI Output Format:**
```json
{
  "questions": [
    {
      "type": "mcq",
      "prompt": "What is network security?",
      "choices": ["Answer A", "Answer B", "Answer C", "Answer D"],
      "correct_label": "A",
      "hint": "Think about protecting data"
    }
  ]
}
```

---

### Step 3: Insert Questions into Database

**HTTP Request Node (Loop over questions)**

**Method:** `POST`

**URL:**
```
{{ $json.supabase_url }}/rest/v1/quiz_questions
```

**Headers:**
```
Authorization: Bearer {{ $json.supabase_service_key }}
apikey: {{ $json.supabase_service_key }}
Content-Type: application/json
Prefer: return=minimal
```

**Body (JSON):**
```json
{
  "quiz_id": "{{ $node['Create Quiz Record'].json.id }}",
  "type": "{{ $json.type }}",
  "prompt": "{{ $json.prompt }}",
  "choices": {{ $json.choices }},
  "correct_label": "{{ $json.correct_label }}",
  "answer_hash": "{{ $json.correct_label.toLowerCase() }}",
  "hint": "{{ $json.hint }}"
}
```

**Note:** You may need a **Split In Batches** or **Loop** node to insert each question separately.

---

### Step 4: Update Upload Record with Quiz ID

**HTTP Request Node**

**Method:** `PATCH`

**URL:**
```
{{ $json.supabase_url }}/rest/v1/uploads?id=eq.{{ $json.upload_id }}
```

**Headers:**
```
Authorization: Bearer {{ $json.supabase_service_key }}
apikey: {{ $json.supabase_service_key }}
Content-Type: application/json
Prefer: return=minimal
```

**Body (JSON):**
```json
{
  "quiz_id": "{{ $node['Create Quiz Record'].json.id }}",
  "status": "completed"
}
```

---

## Complete Workflow Structure

```
┌─────────────────────┐
│  Webhook Trigger    │
│  (receives payload) │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Create Quiz Record │ ← NEW! Must happen first
│  (POST /quizzes)    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Download File      │
│  (GET signed_url)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Extract Text       │
│  (PDF/DOCX parser)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Generate Questions │
│  (AI/Gemini node)   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Insert Questions   │ ← Loop over each question
│  (POST /quiz_ques)  │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Update Upload      │ ← Link quiz_id + set status=completed
│  (PATCH /uploads)   │
└─────────────────────┘
```

---

## Testing Your Workflow

1. **Delete any existing empty quizzes** from your Supabase `quizzes` table
2. **Upload a file** through your app
3. **Check n8n execution** - verify the quiz is created FIRST
4. **Check Supabase** - quiz should only appear after questions are inserted
5. **Open the quiz page** - quiz should have questions and be playable

---

## Common Errors

### "This quiz has no questions yet"
- **Cause:** The quiz was created but questions weren't inserted
- **Fix:** Check the "Insert Questions" node - make sure it's looping over all questions

### Quiz doesn't appear in the list
- **Cause:** n8n workflow failed before creating the quiz
- **Fix:** Check n8n execution logs and Supabase upload status

### "Cannot read property 'id' of undefined"
- **Cause:** The "Create Quiz Record" node didn't return the quiz ID
- **Fix:** Make sure the node has `Prefer: return=representation` header
