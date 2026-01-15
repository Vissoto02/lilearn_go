'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/app/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/lib/types';
import {
    User,
    Download,
    Trash2,
    Loader2,
    Save,
} from 'lucide-react';

const TIMEZONES = [
    'UTC',
    'America/New_York',
    'America/Los_Angeles',
    'America/Chicago',
    'Europe/London',
    'Europe/Paris',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Singapore',
    'Australia/Sydney',
];

export default function SettingsPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [timezone, setTimezone] = useState('UTC');

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
            setEmail(user.email || '');

            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (profile) {
                setName(profile.name || '');
                setTimezone(profile.timezone || 'UTC');
            }
        }
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
            .from('profiles')
            .update({
                name: name.trim(),
                timezone,
            })
            .eq('id', user.id);

        if (error) {
            toast({
                title: 'Error',
                description: 'Failed to save profile',
                variant: 'destructive',
            });
        } else {
            toast({
                title: 'Saved',
                description: 'Your profile has been updated',
            });
        }
        setSaving(false);
    };

    const handleExportData = async () => {
        setExporting(true);
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        try {
            // Fetch all user data
            const [
                { data: profile },
                { data: topics },
                { data: quizzes },
                { data: attempts },
                { data: plans },
                { data: tasks },
                { data: habits },
                { data: availability },
            ] = await Promise.all([
                supabase.from('profiles').select('*').eq('id', user.id).single(),
                supabase.from('topics').select('*').eq('user_id', user.id),
                supabase.from('quizzes').select('*').eq('user_id', user.id),
                supabase.from('quiz_attempts').select('*').eq('user_id', user.id),
                supabase.from('plans').select('*').eq('user_id', user.id),
                supabase.from('plan_tasks').select('*, plans!inner(*)').eq('plans.user_id', user.id),
                supabase.from('habits').select('*').eq('user_id', user.id),
                supabase.from('availability').select('*').eq('user_id', user.id),
            ]);

            const exportData = {
                exportedAt: new Date().toISOString(),
                profile,
                topics,
                quizzes,
                quizAttempts: attempts,
                plans,
                planTasks: tasks,
                habits,
                availability,
            };

            // Download as JSON
            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json',
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `lilearn-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            toast({
                title: 'Export complete',
                description: 'Your data has been downloaded',
            });
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to export data',
                variant: 'destructive',
            });
        }
        setExporting(false);
    };

    const handleDeleteAccount = async () => {
        setDeleting(true);
        const supabase = createClient();

        try {
            // Sign out first
            await supabase.auth.signOut();

            toast({
                title: 'Account deletion requested',
                description: 'Please contact support to complete account deletion',
            });

            router.push('/');
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to process request',
                variant: 'destructive',
            });
        }
        setDeleting(false);
    };

    return (
        <div className="space-y-8 animate-fade-in">
            <PageHeader
                title="Settings"
                description="Manage your account and preferences"
            />

            {/* Profile Settings */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <User className="h-5 w-5" />
                        Profile
                    </CardTitle>
                    <CardDescription>
                        Update your personal information
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Your name"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                            id="email"
                            value={email}
                            disabled
                            className="bg-muted"
                        />
                        <p className="text-xs text-muted-foreground">
                            Email cannot be changed
                        </p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="timezone">Timezone</Label>
                        <Select value={timezone} onValueChange={setTimezone}>
                            <SelectTrigger id="timezone">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {TIMEZONES.map((tz) => (
                                    <SelectItem key={tz} value={tz}>
                                        {tz}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-2 h-4 w-4" />
                        )}
                        Save Changes
                    </Button>
                </CardContent>
            </Card>

            {/* Data Management */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Download className="h-5 w-5" />
                        Data Management
                    </CardTitle>
                    <CardDescription>
                        Export or delete your data
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium">Export Data</p>
                            <p className="text-sm text-muted-foreground">
                                Download all your LiLearn data as JSON
                            </p>
                        </div>
                        <Button variant="outline" onClick={handleExportData} disabled={exporting}>
                            {exporting ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Download className="mr-2 h-4 w-4" />
                            )}
                            Export
                        </Button>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-destructive">Delete Account</p>
                            <p className="text-sm text-muted-foreground">
                                Permanently delete your account and all data
                            </p>
                        </div>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" disabled={deleting}>
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will permanently delete your
                                        account and remove all your data from our servers.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={handleDeleteAccount}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                        {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Delete Account
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
