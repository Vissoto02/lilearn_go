# n8n Quick Fix - Copy & Paste This!

## 🎯 In Your n8n "POST Questions to Supabase" Node

### Replace the "questions_batch" field with this EXACT code:

```javascript
{{
  (
    $('Parse and Validate LLM JSON').item.json.questions || []
  ).map(q => {
    const idx = (q.choices || []).indexOf(q.correct_choice);
    const label = idx >= 0 ? ['A','B','C','D'][idx] : null;

    return {
      quiz_id: ($('POST Quiz to Supabase').item.json.id || $('POST Quiz to Supabase').item.json[0]?.id),
      type: 'mcq',
      prompt: (q.prompt || '').trim(),
      choices: q.choices,
      answer_hash: label?.toLowerCase(),
      correct_label: label,
      hint: q.hint ?? null
    };
  })
}}
```

## ✅ What Changed:
1. ✅ `choices` - Now sends simple array directly (no formatting needed!)
2. ✅ `answer_hash` - Changed from full text to just 'a', 'b', 'c', or 'd'
3. ✅ `correct_label` - Added uppercase letter 'A', 'B', 'C', or 'D'

## 🧪 Test It:
After pasting, click "Test Step" - you should see actual data instead of `[object Object]`

---

See `n8n_fix_guide.md` for full documentation!
