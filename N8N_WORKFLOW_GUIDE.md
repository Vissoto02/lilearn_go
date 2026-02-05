# n8n Workflow Setup Guide

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
  "topic_id": "topic-uuid-or-null",
  "subject": "Mathematics",
  "topic": "Calculus",
  "options": {
    "difficulty": "medium",
    "question_count": 10,
    "question_types": ["mcq"]
  },
  "supabase_url": "https://bkmttsciyftuhdwrwppp.supabase.co",
  "supabase_service_key": "eyJhbG..."
}
```

## How to Access These Values in n8n

In your n8n workflow nodes, use these expressions:

| Field | n8n Expression | Example Value |
|-------|---------------|---------------|
| Upload ID | `{{ $json.upload_id }}` | `abc-123-xyz` |
| User ID | `{{ $json.user_id }}` | `user-uuid` |
| File Name | `{{ $json.file_name }}` | `document.pdf` |
| File Path | `{{ $json.file_path }}` | `user-id/upload-id/file.pdf` |
| Signed URL | `{{ $json.signed_url }}` | Full download URL |
| Topic ID | `{{ $json.topic_id }}` | `topic-uuid` or `null` |
| Subject | `{{ $json.subject }}` | `Mathematics` or `null` |
| Topic | `{{ $json.topic }}` | `Calculus` or `null` |
| Supabase URL | `{{ $json.supabase_url }}` | `https://...supabase.co` |
| Service Key | `{{ $json.supabase_service_key }}` | `eyJhbG...` |
| Difficulty | `{{ $json.options.difficulty }}` | `medium` |
| Question Count | `{{ $json.options.question_count }}` | `10` |

## Common n8n Node Configurations

### 1. HTTP Request - Update Upload Status

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
  "status": "processing",
  "updated_at": "{{ $now.toISO() }}"
}
```

### 2. HTTP Request - Download File

**Method:** `GET`

**URL:**
```
{{ $json.signed_url }}
```

**Response Format:** `File`

### 3. HTTP Request - Create Quiz

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
  "subject": "{{ $json.subject || 'General' }}",
  "topic": "{{ $json.topic || 'Mixed Topics' }}",
  "title": "Quiz from {{ $json.file_name }}",
  "description": "Auto-generated quiz",
  "difficulty": "{{ $json.options.difficulty }}",
  "upload_id": "{{ $json.upload_id }}",
  "questions": []
}
```

**Note:** The `subject` and `topic` fields use the values from the upload if the user specified them, otherwise they default to 'General' and 'Mixed Topics'.

## Troubleshooting

### Error: "Cannot read property 'upload_id'"
- **Cause:** The webhook node isn't receiving data
- **Fix:** Make sure your app's `N8N_WEBHOOK_URL` is correct and the workflow is activated (or open in editor for test URL)

### Error: "Invalid URL: /rest/v1/uploads..."
- **Cause:** `supabase_url` is empty
- **Fix:** Make sure `NEXT_PUBLIC_SUPABASE_URL` is set in your app's environment variables

### Error: 401 Unauthorized on Supabase requests
- **Cause:** Missing or invalid service role key
- **Fix:** Make sure `SUPABASE_SERVICE_ROLE_KEY` is set in your app's environment variables

### Red text in n8n expressions
- **Cause:** The field doesn't exist in the previous node's output
- **Fix:** Check the previous node's output data to see what fields are actually available

## Testing Your Workflow

1. **Open your workflow in n8n editor** (for test URL)
2. **Upload a file** through your app
3. **Check the webhook node** - you should see the incoming data
4. **Step through each node** - verify the data is flowing correctly
5. **Check your Supabase database** - verify the status updates are working

## Example: Complete Status Update Flow

```
Webhook Trigger
  ↓ (receives upload data)
Set Variables (optional - for cleaner expressions)
  ↓
HTTP Request - Download File from signed_url
  ↓
[Your AI Processing Nodes]
  ↓
HTTP Request - Update Status to "completed"
  ↓
HTTP Request - Link quiz_id to upload
```
