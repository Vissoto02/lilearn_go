'use client';

import { PageHeader } from '@/components/app/page-header';
import { SubjectsTopicsManager } from '@/components/planner/SubjectsTopicsManager';

export default function UploadPage() {
    return (
        <div className="space-y-8 animate-fade-in">
            <PageHeader
                title="Syllabus Management"
                description="Manage your subjects and topics. The AI will use these to generate quizzes and study plans."
            />
            
            <SubjectsTopicsManager />
        </div>
    );
}
