'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Subject as BaseSubject, Topic, Quiz } from '@/lib/types';

interface Subject extends BaseSubject {
    isTimetable?: boolean;
}
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { updateQuizMetadata } from '@/app/actions/uploads';
import { 
    Plus, 
    Edit2, 
    Trash2, 
    ChevronDown, 
    ChevronRight, 
    BookOpen, 
    Layers, 
    Search, 
    Library, 
    LayoutGrid, 
    List, 
    MoreVertical,
    AlertCircle,
    FileText,
    History,
    CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function SubjectsTopicsManager() {
    const { toast } = useToast();
    const supabase = createClient();

    const [loading, setLoading] = useState(true);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [topics, setTopics] = useState<Topic[]>([]);
    const [quizzes, setQuizzes] = useState<Quiz[]>([]);
    const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
    
    // Selection state
    const [selectedView, setSelectedView] = useState<{
        type: 'all' | 'subject' | 'topic' | 'unassigned';
        id?: string;
        name?: string;
    }>({ type: 'all' });

    // Modals
    const [subjectModalOpen, setSubjectModalOpen] = useState(false);
    const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
    const [subjectName, setSubjectName] = useState('');

    const [topicModalOpen, setTopicModalOpen] = useState(false);
    const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
    const [topicName, setTopicName] = useState('');
    const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);

    const [quizModalOpen, setQuizModalOpen] = useState(false);
    const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
    const [quizEditData, setQuizEditData] = useState({ subject: '', topic: '' });
    const [updatingQuiz, setUpdatingQuiz] = useState(false);

    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<{ type: 'subject' | 'topic' | 'quiz', id: string, name: string } | null>(null);
    const [deleting, setDeleting] = useState(false);

    const [addingVirtual, setAddingVirtual] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch subjects
        const { data: subjectsData, error: subjectsError } = await supabase
            .from('subjects')
            .select('*')
            .eq('user_id', user.id)
            .order('name');

        // Fetch topics
        const { data: topicsData, error: topicsError } = await supabase
            .from('topics')
            .select('*')
            .eq('user_id', user.id)
            .order('topic');

        // Fetch quizzes with more fields
        const { data: quizzesData } = await supabase
            .from('quizzes')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        // Fetch timetable classes
        const { data: timetableData } = await supabase
            .from('calendar_events')
            .select('title')
            .eq('user_id', user.id)
            .eq('event_type', 'timetable_class');

        if (subjectsError) console.error(subjectsError);
        if (topicsError) console.error(topicsError);

        let combinedSubjects: Subject[] = [];

        if (subjectsData) {
            combinedSubjects = [...subjectsData];
        }

        if (timetableData) {
            const uniqueTimetableClasses = Array.from(new Set(timetableData.map(e => e.title)));
            uniqueTimetableClasses.forEach(className => {
                const existing = combinedSubjects.find(s => s.name === className);
                if (existing) {
                    existing.isTimetable = true;
                } else {
                    combinedSubjects.push({
                        id: `virtual_${className}`,
                        user_id: user.id,
                        name: className,
                        created_at: new Date().toISOString(),
                        isTimetable: true
                    });
                }
            });
        }

        setSubjects(combinedSubjects);
        if (topicsData) setTopics(topicsData);
        if (quizzesData) setQuizzes(quizzesData as Quiz[]);

        // Pre-expand all by default
        if (combinedSubjects.length > 0) {
            setExpandedSubjects(new Set(combinedSubjects.map(s => s.id)));
        }
        
        setLoading(false);
    };

    const toggleSubject = (id: string) => {
        const next = new Set(expandedSubjects);
        if (next.has(id)) {
            next.delete(id);
        } else {
            next.add(id);
        }
        setExpandedSubjects(next);
    };

    // --- Subject Handlers ---
    const handleOpenAddSubject = () => {
        setEditingSubject(null);
        setSubjectName('');
        setSubjectModalOpen(true);
    };

    const handleOpenEditSubject = (subject: Subject) => {
        setEditingSubject(subject);
        setSubjectName(subject.name);
        setSubjectModalOpen(true);
    };

    const handleSaveSubject = async () => {
        if (!subjectName.trim()) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        try {
            if (editingSubject) {
                // Update
                const { error, data } = await supabase
                    .from('subjects')
                    .update({ name: subjectName.trim() })
                    .eq('id', editingSubject.id)
                    .select()
                    .single();

                if (error) throw error;
                
                // Update local state
                setSubjects(prev => prev.map(s => s.id === editingSubject.id ? data : s));

                // Also update the legacy 'subject' string in topics table for consistency
                await supabase
                    .from('topics')
                    .update({ subject: subjectName.trim() })
                    .eq('subject_id', editingSubject.id);
                
                // Refresh topics to reflect updated subject strings
                const { data: topicsData } = await supabase.from('topics').select('*').eq('user_id', user.id);
                if (topicsData) setTopics(topicsData);

                toast({ title: 'Success', description: 'Subject updated.' });
            } else {
                // Insert
                const { error, data } = await supabase
                    .from('subjects')
                    .insert({ user_id: user.id, name: subjectName.trim() })
                    .select()
                    .single();

                if (error) throw error;
                setSubjects(prev => [...prev, data]);
                setExpandedSubjects(prev => new Set(prev).add(data.id));
                toast({ title: 'Success', description: 'Subject added.' });
            }
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        } finally {
            setSubjectModalOpen(false);
        }
    };

    // --- Topic Handlers ---
    const handleOpenAddTopic = async (subjectId: string, e: React.MouseEvent) => {
        e.stopPropagation(); // prevent expanding/collapsing subject
        
        let targetSubjectId = subjectId;
        const subject = subjects.find(s => s.id === subjectId);

        // If it's a virtual subject from timetable, we must create it in DB first
        if (subjectId.startsWith('virtual_') && subject) {
            setAddingVirtual(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { error, data } = await supabase
                    .from('subjects')
                    .insert({ user_id: user.id, name: subject.name })
                    .select()
                    .single();

                if (!error && data) {
                    // Update frontend state with real ID
                    targetSubjectId = data.id;
                    const newSubject = { ...data, isTimetable: true };
                    setSubjects(prev => prev.map(s => s.id === subjectId ? newSubject : s));
                    setExpandedSubjects(prev => {
                        const next = new Set(prev);
                        next.delete(subjectId);
                        next.add(data.id);
                        return next;
                    });
                } else if (error && error.code === '23505') {
                    // Just in case it was created concurrently
                    toast({ title: 'Notice', description: 'Subject already exists.' });
                }
            }
            setAddingVirtual(false);
        }

        setEditingTopic(null);
        setTopicName('');
        setActiveSubjectId(targetSubjectId);
        setTopicModalOpen(true);
    };

    const handleOpenEditTopic = (topic: Topic) => {
        setEditingTopic(topic);
        setTopicName(topic.topic);
        setActiveSubjectId(topic.subject_id);
        setTopicModalOpen(true);
    };

    const handleSaveTopic = async () => {
        if (!topicName.trim() || !activeSubjectId) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const parentSubject = subjects.find(s => s.id === activeSubjectId);
        if (!parentSubject) return;

        try {
            if (editingTopic) {
                // Update
                const { error, data } = await supabase
                    .from('topics')
                    .update({ 
                        topic: topicName.trim(),
                        subject_id: activeSubjectId,
                        subject: parentSubject.name // Keep legacy schema string intact
                    })
                    .eq('id', editingTopic.id)
                    .select()
                    .single();

                if (error) throw error;
                setTopics(prev => prev.map(t => t.id === editingTopic.id ? data : t));
                toast({ title: 'Success', description: 'Topic updated.' });
            } else {
                // Insert
                const { error, data } = await supabase
                    .from('topics')
                    .insert({ 
                        user_id: user.id,
                        topic: topicName.trim(),
                        subject_id: activeSubjectId,
                        subject: parentSubject.name // Keep legacy schema string intact
                    })
                    .select()
                    .single();

                if (error) throw error;
                setTopics(prev => [...prev, data]);
                toast({ title: 'Success', description: 'Topic added.' });
            }
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        } finally {
            setTopicModalOpen(false);
        }
    };

    // --- Quiz Handlers ---
    const handleEditQuiz = (quiz: Quiz) => {
        setEditingQuiz(quiz);
        setQuizEditData({ subject: quiz.subject, topic: quiz.topic });
        setQuizModalOpen(true);
    };

    const handleSaveQuizMetadata = async () => {
        if (!editingQuiz || !quizEditData.subject.trim() || !quizEditData.topic.trim()) return;
        
        setUpdatingQuiz(true);
        try {
            const result = await updateQuizMetadata(
                editingQuiz.id,
                quizEditData.subject.trim(),
                quizEditData.topic.trim()
            );

            if (result.error) throw new Error(result.error);

            toast({ title: 'Success', description: 'Quiz updated and hierarchy synced.' });
            setQuizModalOpen(false);
            fetchData(); // Refresh everything to see new subjects/topics if created
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        } finally {
            setUpdatingQuiz(false);
        }
    };

    // --- Delete Handlers ---
    const confirmDelete = (type: 'subject' | 'topic' | 'quiz', id: string, name: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setItemToDelete({ type, id, name });
        setDeleteConfirmOpen(true);
    };

    const handleDelete = async () => {
        if (!itemToDelete) return;
        setDeleting(true);
        try {
            const table = itemToDelete.type === 'subject' ? 'subjects' : (itemToDelete.type === 'topic' ? 'topics' : 'quizzes');
            const { error } = await supabase.from(table).delete().eq('id', itemToDelete.id);
            if (error) throw error;

            if (itemToDelete.type === 'subject') {
                setSubjects(prev => prev.filter(s => s.id !== itemToDelete.id));
                setTopics(prev => prev.filter(t => t.subject_id !== itemToDelete.id)); 
            } else if (itemToDelete.type === 'topic') {
                setTopics(prev => prev.filter(t => t.id !== itemToDelete.id));
            } else {
                setQuizzes(prev => prev.filter(q => q.id !== itemToDelete.id));
            }

            toast({ title: 'Deleted', description: `${itemToDelete.type.charAt(0).toUpperCase() + itemToDelete.type.slice(1)} removed.` });
        } catch (err: any) {
            toast({ title: 'Error', description: err.message, variant: 'destructive' });
        } finally {
            setDeleting(false);
            setDeleteConfirmOpen(false);
            setItemToDelete(null);
        }
    };

    // --- Filtering Logic ---
    const unassignedQuizzes = quizzes.filter(q => {
        const hasTopic = topics.some(t => t.topic === q.topic && (t.subject === q.subject || t.subject_id));
        return !hasTopic;
    });

    const filteredQuizzes = quizzes.filter(q => {
        // Search filter first
        if (searchQuery.trim()) {
            const search = searchQuery.toLowerCase();
            if (!q.topic.toLowerCase().includes(search) && !q.subject.toLowerCase().includes(search)) {
                return false;
            }
        }

        if (selectedView.type === 'all') return true;
        if (selectedView.type === 'unassigned') {
            return unassignedQuizzes.some(uq => uq.id === q.id);
        }
        if (selectedView.type === 'subject') {
            return q.subject === selectedView.name;
        }
        if (selectedView.type === 'topic') {
            return q.topic === selectedView.name && q.subject === selectedView.id; // Using id as subject name for topics
        }
        return true;
    });

    return (
        <div className="flex flex-col lg:flex-row gap-8 min-h-[600px] animate-fade-in">
            {/* Sidebar */}
            <aside className="w-full lg:w-72 space-y-6 flex-shrink-0">
                <div className="space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search library..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 h-10 bg-muted/30 border-muted-foreground/10 focus:bg-background transition-colors"
                        />
                    </div>

                    <div className="space-y-1">
                        <button
                            onClick={() => setSelectedView({ type: 'all' })}
                            className={cn(
                                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                selectedView.type === 'all' 
                                    ? "bg-primary/10 text-primary" 
                                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <Library className="h-4 w-4" />
                                All Quizzes
                            </div>
                            <Badge variant="outline" className="text-[10px] h-4 min-w-[1.25rem] px-1 justify-center border-muted-foreground/20">
                                {quizzes.length}
                            </Badge>
                        </button>

                        <button
                            onClick={() => setSelectedView({ type: 'unassigned' })}
                            className={cn(
                                "w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                selectedView.type === 'unassigned' 
                                    ? "bg-amber-500/10 text-amber-600" 
                                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                            )}
                        >
                            <div className="flex items-center gap-2">
                                <AlertCircle className="h-4 w-4" />
                                Unassigned
                            </div>
                            {unassignedQuizzes.length > 0 && (
                                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] h-4 min-w-[1.25rem] px-1 justify-center">
                                    {unassignedQuizzes.length}
                                </Badge>
                            )}
                        </button>
                    </div>

                    <Separator className="bg-muted-foreground/10" />

                    <ScrollArea className="h-[calc(100vh-400px)] -mx-3 px-3">
                        <div className="space-y-2 pb-4">
                            <div className="flex items-center justify-between px-3 mb-2">
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Subjects</span>
                                <Button variant="ghost" size="icon" className="h-4 w-4 rounded-full" onClick={handleOpenAddSubject}>
                                    <Plus className="h-3 w-3" />
                                </Button>
                            </div>
                            
                            {loading ? (
                                <div className="space-y-2 px-3">
                                    <Skeleton className="h-8 w-full rounded-md" />
                                    <Skeleton className="h-8 w-full rounded-md" />
                                    <Skeleton className="h-8 w-full rounded-md" />
                                </div>
                            ) : subjects.length === 0 ? (
                                <p className="text-xs text-center text-muted-foreground py-4 px-3">No subjects yet.</p>
                            ) : (
                                subjects.map(subject => {
                                    const isExpanded = expandedSubjects.has(subject.id);
                                    const subjectTopics = topics.filter(t => t.subject_id === subject.id || t.subject === subject.name);
                                    const isSelected = selectedView.type === 'subject' && selectedView.name === subject.name;

                                    return (
                                        <div key={subject.id} className="space-y-0.5">
                                            <div 
                                                className={cn(
                                                    "flex items-center justify-between px-3 py-1.5 rounded-lg cursor-pointer group transition-colors",
                                                    isSelected ? "bg-primary/5 text-primary" : "hover:bg-muted/50"
                                                )}
                                                onClick={() => {
                                                    toggleSubject(subject.id);
                                                    setSelectedView({ type: 'subject', id: subject.id, name: subject.name });
                                                }}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <div className="text-muted-foreground group-hover:text-foreground">
                                                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                                    </div>
                                                    <span className="text-sm font-medium truncate">{subject.name}</span>
                                                    {subject.isTimetable && <div className="h-1 w-1 rounded-full bg-blue-500" title="Timetable" />}
                                                </div>
                                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        className="h-5 w-5 hover:bg-muted" 
                                                        onClick={(e) => handleOpenAddTopic(subject.id, e)}
                                                    >
                                                        <Plus className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="ml-7 space-y-0.5 border-l border-muted-foreground/10 pl-2">
                                                    {subjectTopics.length === 0 ? (
                                                        <div className="text-[10px] text-muted-foreground py-1 px-2 italic">No topics</div>
                                                    ) : (
                                                        subjectTopics.map(topic => {
                                                            const isTopicSelected = selectedView.type === 'topic' && selectedView.name === topic.topic && selectedView.id === subject.name;
                                                            return (
                                                                <button
                                                                    key={topic.id}
                                                                    onClick={() => setSelectedView({ type: 'topic', id: subject.name, name: topic.topic })}
                                                                    className={cn(
                                                                        "w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors",
                                                                        isTopicSelected ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                                                                    )}
                                                                >
                                                                    {topic.topic}
                                                                </button>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </ScrollArea>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">
                            {selectedView.type === 'all' && "All Content"}
                            {selectedView.type === 'unassigned' && "Unassigned Quizzes"}
                            {selectedView.type === 'subject' && selectedView.name}
                            {selectedView.type === 'topic' && selectedView.name}
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            {selectedView.type === 'all' && `Showing all ${quizzes.length} items`}
                            {selectedView.type === 'unassigned' && `Items without matching subject or topic`}
                            {selectedView.type === 'subject' && `Quizzes in ${selectedView.name}`}
                            {selectedView.type === 'topic' && `Topic in ${selectedView.id}`}
                        </p>
                    </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                    {loading ? (
                        Array.from({ length: 6 }).map((_, i) => (
                            <Card key={i} className="overflow-hidden border-muted/20">
                                <CardContent className="p-4 space-y-3">
                                    <Skeleton className="h-4 w-3/4" />
                                    <Skeleton className="h-3 w-1/2" />
                                    <div className="flex gap-2">
                                        <Skeleton className="h-5 w-16 rounded-full" />
                                        <Skeleton className="h-5 w-16 rounded-full" />
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    ) : filteredQuizzes.length === 0 ? (
                        <div className="col-span-full flex flex-col items-center justify-center p-12 text-center bg-muted/20 rounded-2xl border border-dashed border-muted-foreground/20">
                            <div className="p-4 bg-background rounded-full shadow-sm mb-4">
                                <BookOpen className="h-8 w-8 text-muted-foreground" />
                            </div>
                            <h3 className="font-semibold text-lg">No Quizzes Found</h3>
                            <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-2">
                                {searchQuery ? `No results for "${searchQuery}"` : "This section is empty. Quizzes generate automatically from your uploads."}
                            </p>
                        </div>
                    ) : (
                        filteredQuizzes.map(quiz => (
                            <Card key={quiz.id} className="group overflow-hidden border-muted/20 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
                                <CardContent className="p-5 flex flex-col h-full">
                                    <div className="flex items-start justify-between gap-2 mb-3">
                                        <div className="p-2 rounded-lg bg-primary/5 text-primary group-hover:bg-primary/10 transition-colors">
                                            <FileText className="h-5 w-5" />
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditQuiz(quiz)}>
                                                <Edit2 className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => confirmDelete('quiz', quiz.id, quiz.topic)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    
                                    <div className="flex-1 min-w-0 mb-4">
                                        <h3 className="font-bold text-lg leading-tight truncate mb-1" title={quiz.topic}>
                                            {quiz.topic}
                                        </h3>
                                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                            <Layers className="h-3.5 w-3.5" />
                                            <span className="truncate">{quiz.subject}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-4 border-t border-muted/50 mt-auto">
                                        <div className="flex gap-2">
                                            <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-wider bg-background">
                                                {quiz.difficulty}
                                            </Badge>
                                            <Badge variant="outline" className="text-[10px] font-semibold uppercase tracking-wider bg-background">
                                                {quiz.question_type || 'MCQ'}
                                            </Badge>
                                        </div>
                                        <span className="text-[10px] text-muted-foreground">
                                            {new Date(quiz.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            </main>

            {/* Modals */}
            
            {/* Subject Modal */}
            <Dialog open={subjectModalOpen} onOpenChange={setSubjectModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{editingSubject ? 'Edit Subject' : 'Add New Subject'}</DialogTitle>
                        <DialogDescription>
                            {editingSubject ? 'Update your subject name below.' : 'Create a new main subject group to hold your topics.'}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="subject_name">Subject Name</Label>
                            <Input
                                id="subject_name"
                                placeholder="e.g. Mathematics, Network Security..."
                                value={subjectName}
                                onChange={(e) => setSubjectName(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSubjectModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveSubject} disabled={!subjectName.trim()}>Save Changes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Topic Modal */}
            <Dialog open={topicModalOpen} onOpenChange={setTopicModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>{editingTopic ? 'Edit Topic' : 'Add New Topic'}</DialogTitle>
                        <DialogDescription>
                            Define a specific topic inside this subject for targeted studying.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="topic_name">Topic Name</Label>
                            <Input
                                id="topic_name"
                                placeholder="e.g. Algebra, Firewalls..."
                                value={topicName}
                                onChange={(e) => setTopicName(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setTopicModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveTopic} disabled={!topicName.trim() || !activeSubjectId}>Save Topic</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Quiz Modal */}
            <Dialog open={quizModalOpen} onOpenChange={setQuizModalOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Update Quiz Location</DialogTitle>
                        <DialogDescription>
                            Move this quiz to a different subject or topic. Typing a new name will create it automatically.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Subject</Label>
                                <Input
                                    placeholder="Subject Name"
                                    value={quizEditData.subject}
                                    onChange={(e) => setQuizEditData(prev => ({ ...prev, subject: e.target.value }))}
                                />
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {subjects.slice(0, 4).map(s => (
                                        <Badge 
                                            key={s.id} 
                                            variant="secondary" 
                                            className="cursor-pointer hover:bg-muted"
                                            onClick={() => setQuizEditData(prev => ({ ...prev, subject: s.name }))}
                                        >
                                            {s.name}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Topic</Label>
                                <Input
                                    placeholder="Topic Name"
                                    value={quizEditData.topic}
                                    onChange={(e) => setQuizEditData(prev => ({ ...prev, topic: e.target.value }))}
                                />
                                <div className="flex flex-wrap gap-1 mt-1">
                                    {topics
                                        .filter(t => t.subject === quizEditData.subject)
                                        .slice(0, 4)
                                        .map(t => (
                                        <Badge 
                                            key={t.id} 
                                            variant="secondary" 
                                            className="cursor-pointer hover:bg-muted"
                                            onClick={() => setQuizEditData(prev => ({ ...prev, topic: t.topic }))}
                                        >
                                            {t.topic}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setQuizModalOpen(false)} disabled={updatingQuiz}>Cancel</Button>
                        <Button 
                            onClick={handleSaveQuizMetadata} 
                            disabled={updatingQuiz || !quizEditData.subject.trim() || !quizEditData.topic.trim()}
                        >
                            {updatingQuiz ? "Syncing..." : "Update & Sync"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Modal */}
            <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="text-rose-500">Confirm Deletion</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete the {itemToDelete?.type} <strong className="text-foreground">"{itemToDelete?.name}"</strong>?
                            {itemToDelete?.type === 'subject' && (
                                <span className="block mt-2 font-medium text-rose-500">
                                     This will permanently delete all topics inside this subject as well.
                                </span>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="mt-4 gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} disabled={deleting}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                            {deleting ? 'Deleting...' : 'Yes, Delete Permanently'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

