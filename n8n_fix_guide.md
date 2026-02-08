# n8n Workflow Fix Guide
## Simplified Quiz Choices Format

## 🎯 Problem Solved
- **Error**: "JSON parameter needs to be valid JSON" and `[object Object]` display
- **Cause**: Mismatch between n8n output format and database expectations
- **Solution**: Simplified database to accept string arrays directly from Gemini/n8n

---

## 📝 What Changed in Your Database

### Before (Legacy Format):
```json
{
  "choices": [
    {"label": "A", "text": "The use of two separate keys"},
    {"label": "B", "text": "The generation of a 128-bit digest"},
    {"label": "C", "text": "The requirement of private key"},
    {"label": "D", "text": "The running time of decryption"}
  ]
}
```

### After (New Simplified Format):
```json
{
  "choices": [
    "The use of two separate keys",
    "The generation of a 128-bit digest",
    "The requirement of private key",
    "The running time of decryption"
  ]
}
```

**✅ Your database now accepts BOTH formats!**

---

## 🔧 n8n Node Configuration

### **Node: "POST Questions to Supabase"**

#### Current Settings:
- **Mode**: Manual Mapping
- **Table**: `quiz_questions`
- **Operation**: Insert
- **Return Fields**: All

#### **Fixed Code for "Fields to Set" → `questions_batch`:**

```javascript
{{
  (
    $('Parse and Validate LLM JSON').item.json.questions || []
  ).map(q => {
    // Find which choice index matches the correct answer
    const idx = (q.choices || []).indexOf(q.correct_choice);
    
    // Convert index to label: 0→'A', 1→'B', 2→'C', 3→'D'
    const label = idx >= 0 ? ['A','B','C','D'][idx] : null;

    return {
      quiz_id: ($('POST Quiz to Supabase').item.json.id || $('POST Quiz to Supabase').item.json[0]?.id),
      type: 'mcq',
      prompt: (q.prompt || '').trim(),
      choices: q.choices,                 // ✅ Simple array - works directly!
      answer_hash: label?.toLowerCase(),  // ✅ 'a', 'b', 'c', or 'd'
      correct_label: label,               // ✅ 'A', 'B', 'C', or 'D'
      hint: q.hint ?? null
    };
  })
}}
```

---

## 🔑 Key Changes from Your Old Code:

### ❌ **What Was Wrong Before:**
```javascript
answer_hash: q.correct_choice,  // ❌ This was the full text ("The use of two separate keys...")
```

### ✅ **What's Fixed Now:**
```javascript
answer_hash: label?.toLowerCase(),  // ✅ Just 'a', 'b', 'c', or 'd'
correct_label: label,               // ✅ 'A', 'B', 'C', or 'D'
```

---

## 📊 Understanding the Fields:

| Field | Value | Purpose | Example |
|-------|-------|---------|---------|
| `choices` | `string[]` | The 4 answer options | `["Text A", "Text B", "Text C", "Text D"]` |
| `answer_hash` | `string` | Lowercase letter for verification | `"b"` (means answer B is correct) |
| `correct_label` | `string` | Uppercase letter for display | `"B"` (shows user that B is correct) |
| `hint` | `string \| null` | Optional hint text | `"Think about encryption"` |

---

## 🧪 Testing Your Fix

### **Step 1: Check Gemini Output**
After the "Parse and Validate LLM JSON" node, verify the structure:
```json
{
  "questions": [
    {
      "prompt": "What is X?",
      "choices": ["A", "B", "C", "D"],
      "correct_choice": "A",
      "hint": "Think about Y"
    }
  ]
}
```

### **Step 2: Check POST Questions Output**
After your fixed node runs, the output should look like:
```json
[
  {
    "quiz_id": "abc-123-def",
    "type": "mcq",
    "prompt": "What is X?",
    "choices": ["A", "B", "C", "D"],
    "answer_hash": "a",
    "correct_label": "A",
    "hint": "Think about Y"
  }
]
```

### **Step 3: Verify in Supabase**
Run this query in Supabase SQL Editor:
```sql
SELECT 
  id,
  prompt,
  choices,
  answer_hash,
  correct_label
FROM quiz_questions
ORDER BY created_at DESC
LIMIT 5;
```

You should see:
- `choices` as JSON array: `["text1", "text2", "text3", "text4"]`
- `answer_hash` as single letter: `"a"`, `"b"`, `"c"`, or `"d"`
- `correct_label` as uppercase: `"A"`, `"B"`, `"C"`, or `"D"`

---

## ⚠️ Common Issues & Solutions

### Issue 1: Still seeing `[object Object]`
**Solution**: Make sure you're using the EXACT code above. The issue was that n8n wasn't properly serializing the array.

### Issue 2: "JSON parameter needs to be valid JSON"
**Solution**: 
1. Check that `q.choices` exists in the previous node output
2. Make sure you're NOT wrapping `choices` in `JSON.stringify()` - let Supabase handle it
3. Verify the Supabase node is set to "Manual Mapping" mode

### Issue 3: Quiz questions insert but don't display correctly
**Solution**: 
1. Pull latest code changes from the frontend (quiz-player.tsx was updated)
2. Verify `correct_label` column exists: `ALTER TABLE quiz_questions ADD COLUMN IF NOT EXISTS correct_label TEXT;`

### Issue 4: `quiz_id` is null
**Solution**: 
Check the previous "POST Quiz to Supabase" node returns the ID correctly:
```javascript
// Try both access patterns:
$('POST Quiz to Supabase').item.json.id           // If single object returned
$('POST Quiz to Supabase').item.json[0]?.id       // If array returned
```

---

## 🎬 Full Workflow Recap

```
1. [Gemini] Generate questions
   ↓ Returns: { questions: [{prompt, choices: [...], correct_choice, hint}] }
   
2. [Parse and Validate LLM JSON] Validate structure
   ↓ Passes through the same structure
   
3. [POST Quiz to Supabase] Create quiz record
   ↓ Returns: { id: "quiz-uuid-here" }
   
4. [POST Questions to Supabase] ← YOU ARE HERE - USE THE NEW CODE!
   ↓ Maps each question with correct format
   
5. [Update Upload Status] Mark as completed
   ✅ Done!
```

---

## 💡 Why This Solution is Better

1. **✅ Simpler**: No transformation needed from Gemini → Database
2. **✅ Consistent**: All n8n workflows now use the same format
3. **✅ Backwards Compatible**: Old questions still work!
4. **✅ Flexible**: Frontend can display choices however you want
5. **✅ Debuggable**: Easy to see what's stored in database

---

## 🚀 Next Steps

1. **Copy the new code** from the "Fixed Code" section above
2. **Paste it** into your n8n "POST Questions to Supabase" node
3. **Test the workflow** with a real upload
4. **Check Supabase** to verify the data looks correct
5. **Test in your app** - the quiz should display properly!

---

## 📞 Need Help?

If you're still seeing errors, check:
- [ ] Did you update the n8n code exactly as shown?
- [ ] Is the `correct_label` column added to your database?
- [ ] Are you using the Service Role key in Supabase node?
- [ ] Does the previous "POST Quiz to Supabase" node return an ID?

You can verify the database schema has the correct_label column by running:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'quiz_questions';
```

Good luck! 🎉
