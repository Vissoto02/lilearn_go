# Topic Support for File Uploads - Implementation Summary

## Overview
Added the ability for users to specify which topic/subject their uploaded files are for. This information is now sent to n8n workflows for better quiz generation context.

## Changes Made

### 1. Database Schema (`db/add_topic_to_uploads.sql`)
- Added `topic_id` column to `uploads` table (references `topics` table)
- Added `subject` column for denormalized quick access
- Added `topic` column for denormalized quick access
- Added indexes for better query performance

**To apply:** Run this SQL in your Supabase SQL Editor

### 2. TypeScript Types (`lib/uploads/types.ts`)
- Updated `Upload` interface to include `topic_id`, `subject`, and `topic`
- Updated `CreateUploadInput` to accept optional topic fields
- Updated `N8nWebhookPayload` to include topic fields for n8n workflows

### 3. Server Actions

#### New File: `app/actions/topics.ts`
Created server actions for topic management:
- `getTopics()` - Fetch all user topics
- `getTopicsBySubject()` - Fetch topics grouped by subject
- `createTopic()` - Create a new topic
- `getOrCreateTopic()` - Get existing or create new topic

#### Updated: `app/actions/uploads.ts`
- Modified `createUpload()` to save topic information
- Modified `confirmUpload()` to include topic fields in n8n webhook payload

### 4. UI Components (`components/uploads/UploadPanel.tsx`)
Enhanced upload form with topic selection:
- **Topic Selector**: Dropdown to select from existing topics
- **Create New Topic**: Inline form to create topics on-the-fly
  - Subject field (e.g., "Mathematics")
  - Topic field (e.g., "Calculus")
- **Optional**: Users can skip topic selection
- Topics are displayed as "Subject - Topic" in the dropdown

### 5. Documentation (`N8N_WORKFLOW_GUIDE.md`)
Updated n8n webhook guide:
- Added topic fields to webhook payload example
- Added n8n expressions for accessing topic data:
  - `{{ $json.topic_id }}`
  - `{{ $json.subject }}`
  - `{{ $json.topic }}`
- Updated quiz creation example to use topic information

## User Experience

### Upload Flow
1. User selects a file
2. **NEW:** User can optionally select or create a topic
   - Select from existing topics dropdown
   - OR click "New Topic" to create one
3. User sets difficulty and question count
4. User clicks "Generate Quiz"

### Topic Creation
- Click "New Topic" button
- Enter Subject (e.g., "Physics")
- Enter Topic (e.g., "Thermodynamics")
- Click "Create Topic"
- Topic is immediately available for selection

## n8n Workflow Integration

### Webhook Payload
The n8n workflow now receives:
```json
{
  "upload_id": "...",
  "user_id": "...",
  "file_name": "document.pdf",
  "topic_id": "uuid-or-null",
  "subject": "Mathematics",
  "topic": "Calculus",
  "options": { ... },
  ...
}
```

### Using Topic Data in n8n
Your AI workflow can now:
1. Use `{{ $json.subject }}` and `{{ $json.topic }}` to provide context
2. Generate more relevant questions based on the topic
3. Automatically categorize the quiz when creating it in Supabase
4. Use topic information in prompts to your AI model

### Example Quiz Creation
```json
{
  "user_id": "{{ $json.user_id }}",
  "subject": "{{ $json.subject || 'General' }}",
  "topic": "{{ $json.topic || 'Mixed Topics' }}",
  "upload_id": "{{ $json.upload_id }}",
  "difficulty": "{{ $json.options.difficulty }}",
  ...
}
```

## Benefits

1. **Better Organization**: Users can organize uploads by topic
2. **Improved AI Context**: n8n workflows receive topic information for better quiz generation
3. **Flexible**: Topic selection is optional - users can skip it
4. **User-Friendly**: Create topics on-the-fly without leaving the upload form
5. **Consistent**: Uses existing topics table structure

## Next Steps

1. **Run the SQL migration** in Supabase to add the new columns
2. **Update your n8n workflow** to use the topic fields
3. **Test the upload flow** with and without topic selection
4. **Monitor** that topic data is flowing correctly to n8n

## Notes

- Topic selection is **optional** - users can upload without specifying a topic
- When no topic is specified, the fields will be `null` in the database and webhook
- The n8n guide shows how to use default values when topic is null
- Topics are shared across the app (calendar, quizzes, uploads)
