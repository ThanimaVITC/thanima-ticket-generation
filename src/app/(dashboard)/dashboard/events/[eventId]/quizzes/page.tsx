'use client';

import { useState, use } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

interface Question {
    _id: string;
    text: string;
    options: string[];
    correctOptionIndex: number;
    order: number;
    isActive: boolean;
}

interface Quiz {
    _id: string;
    eventId: string;
    title: string;
    leaderboardToken?: string;
    isVisible: boolean;
    questions: Question[];
    createdAt: string;
}

interface LeaderboardEntry {
    regNo: string;
    name: string;
    totalPoints: number;
    correctAnswers: number;
    totalAnswers: number;
    avgTimeMs: number;
}

const addQuestionSchema = z.object({
    text: z.string().min(1, 'Question text is required'),
    option0: z.string().min(1, 'Option A is required'),
    option1: z.string().min(1, 'Option B is required'),
    option2: z.string().min(1, 'Option C is required'),
    option3: z.string().min(1, 'Option D is required'),
    correctOptionIndex: z.string().min(1, 'Select the correct answer'),
});

type AddQuestionFormValues = z.infer<typeof addQuestionSchema>;

export default function EventQuizzesPage({
    params,
}: {
    params: Promise<{ eventId: string }>;
}) {
    const { eventId } = use(params);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isAddQuestionOpen, setIsAddQuestionOpen] = useState(false);
    const [newQuizTitle, setNewQuizTitle] = useState('Event Quiz');
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: quizzesData, isLoading } = useQuery({
        queryKey: ['quizzes', eventId],
        queryFn: async () => {
            const res = await fetch(`/api/quiz?eventId=${eventId}`);
            if (!res.ok) throw new Error('Failed to fetch quizzes');
            return res.json() as Promise<{ quizzes: Quiz[] }>;
        },
    });

    const quiz = quizzesData?.quizzes[0];
    const quizId = quiz?._id;

    const { data: leaderboardData } = useQuery({
        queryKey: ['leaderboard', quizId],
        queryFn: async () => {
            if (!quizId) return { leaderboard: [] };
            const res = await fetch(`/api/quiz/${quizId}/leaderboard`);
            if (!res.ok) throw new Error('Failed to fetch leaderboard');
            return res.json() as Promise<{ leaderboard: LeaderboardEntry[] }>;
        },
        enabled: !!quizId,
    });

    const createQuizMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/quiz', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId, title: newQuizTitle.trim() || 'Event Quiz' }),
            });
            if (!res.ok) throw new Error('Failed to create quiz');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['quizzes', eventId] });
            setIsCreateDialogOpen(false);
            toast({ title: 'Quiz created successfully' });
        },
        onError: (error: Error) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        },
    });

    const deleteQuizMutation = useMutation({
        mutationFn: async () => {
            if (!quizId) return;
            const res = await fetch(`/api/quiz/${quizId}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Failed to delete quiz');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['quizzes', eventId] });
            queryClient.invalidateQueries({ queryKey: ['leaderboard', quizId] });
            setIsDeleteConfirmOpen(false);
            toast({ title: 'Quiz and all data deleted successfully' });
        },
        onError: (error: Error) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        },
    });

    const toggleQuestionActiveMutation = useMutation({
        mutationFn: async ({ questionId, isActive }: { questionId: string; isActive: boolean }) => {
            if (!quizId) return;
            const res = await fetch(`/api/quiz/${quizId}/questions/${questionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive }),
            });
            if (!res.ok) throw new Error('Failed to update question');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['quizzes', eventId] });
            toast({ title: 'Question updated' });
        },
    });

    const addQuestionMutation = useMutation({
        mutationFn: async (data: { text: string; options: string[]; correctOptionIndex: number }) => {
            if (!quizId) return;
            const res = await fetch(`/api/quiz/${quizId}/questions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to add question');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['quizzes', eventId] });
            setIsAddQuestionOpen(false);
            form.reset();
            toast({ title: 'Question added successfully' });
        },
    });

    const deleteQuestionMutation = useMutation({
        mutationFn: async (questionId: string) => {
            if (!quizId) return;
            const res = await fetch(`/api/quiz/${quizId}/questions/${questionId}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Failed to delete question');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['quizzes', eventId] });
            toast({ title: 'Question deleted' });
        },
    });

    const form = useForm<AddQuestionFormValues>({
        resolver: zodResolver(addQuestionSchema),
        defaultValues: {
            text: '',
            option0: '',
            option1: '',
            option2: '',
            option3: '',
            correctOptionIndex: '',
        },
    });

    function onSubmitQuestion(data: AddQuestionFormValues) {
        addQuestionMutation.mutate({
            text: data.text,
            options: [data.option0, data.option1, data.option2, data.option3],
            correctOptionIndex: parseInt(data.correctOptionIndex),
        });
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="w-12 h-12 relative">
                    <div className="absolute inset-0 border-4 border-purple-500/20 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-purple-500 rounded-full border-t-transparent animate-spin"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Back Button */}
            <Link href={`/dashboard/events/${eventId}`} className="inline-flex items-center text-gray-400 hover:text-white transition-colors">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Event Overview
            </Link>

            {!quiz ? (
                <div className="text-center py-20 bg-white/5 border border-white/10 rounded-2xl">
                    <h2 className="text-2xl font-bold text-white mb-2">No Quiz Found</h2>
                    <p className="text-gray-400 mb-6">This event does not have a quiz yet.</p>
                    <div className="max-w-sm mx-auto mb-6">
                        <label className="block text-sm text-gray-400 mb-2">Quiz Name</label>
                        <Input
                            value={newQuizTitle}
                            onChange={(e) => setNewQuizTitle(e.target.value)}
                            placeholder="Enter quiz name"
                            className="bg-white/10 border-white/20 text-white text-center"
                        />
                    </div>
                    <Button
                        onClick={() => createQuizMutation.mutate()}
                        disabled={createQuizMutation.isPending}
                        className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 rounded-xl"
                    >
                        {createQuizMutation.isPending ? 'Creating...' : 'Initialize Event Quiz'}
                    </Button>
                </div>
            ) : (
                <div className="bg-gradient-to-b from-white/[0.08] to-transparent border border-white/10 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-1">Event Quiz Manager</h2>
                            <p className="text-sm text-gray-500">{quiz.questions.length} questions • {quizzesData?.quizzes[0].isVisible ? 'Public' : 'Private'}</p>
                        </div>
                        {quiz.leaderboardToken && (
                            <a
                                href={`/leaderboard/${quiz.leaderboardToken}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl border border-white/10 transition-colors text-blue-400 hover:text-blue-300"
                            >
                                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                                Public Leaderboard
                                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </a>
                        )}
                        <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
                            <DialogTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                >
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Delete Quiz
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="bg-slate-950 border-white/10 text-white max-w-md">
                                <DialogHeader>
                                    <DialogTitle className="text-red-400">Delete Quiz Data</DialogTitle>
                                    <DialogDescription className="text-gray-400">
                                        This will permanently delete the quiz, all questions, and all leaderboard/response data. This action cannot be undone.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="flex justify-end gap-3 mt-4">
                                    <Button variant="ghost" onClick={() => setIsDeleteConfirmOpen(false)} className="text-gray-400">
                                        Cancel
                                    </Button>
                                    <Button
                                        onClick={() => deleteQuizMutation.mutate()}
                                        disabled={deleteQuizMutation.isPending}
                                        className="bg-red-600 hover:bg-red-700 text-white"
                                    >
                                        {deleteQuizMutation.isPending ? 'Deleting...' : 'Delete Everything'}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <Tabs defaultValue="questions" className="w-full">
                        <TabsList className="bg-white/5 border border-white/10 rounded-xl mb-6">
                            <TabsTrigger value="questions" className="rounded-lg data-[state=active]:bg-white/10 px-6">
                                Questions
                            </TabsTrigger>
                            <TabsTrigger value="leaderboard" className="rounded-lg data-[state=active]:bg-white/10 px-6">
                                Live Leaderboard
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="questions" className="space-y-6">
                            <div className="flex justify-end">
                                <Dialog open={isAddQuestionOpen} onOpenChange={setIsAddQuestionOpen}>
                                    <DialogTrigger asChild>
                                        <Button className="bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:from-purple-600 hover:via-pink-600 hover:to-orange-600 rounded-xl">
                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                            </svg>
                                            Add Question
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="bg-slate-950 border-white/10 text-white max-w-lg">
                                        <DialogHeader>
                                            <DialogTitle>Add New Question</DialogTitle>
                                            <DialogDescription className="text-gray-500">
                                                Create an MCQ question with 4 options.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <Form {...form}>
                                            <form onSubmit={form.handleSubmit(onSubmitQuestion)} className="space-y-4">
                                                <FormField
                                                    control={form.control}
                                                    name="text"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Question</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="Enter the question" className="bg-white/10 border-white/20" {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                {[0, 1, 2, 3].map((i) => (
                                                    <FormField
                                                        key={i}
                                                        control={form.control}
                                                        name={`option${i}` as keyof AddQuestionFormValues}
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Option {String.fromCharCode(65 + i)}</FormLabel>
                                                                <FormControl>
                                                                    <Input placeholder={`Option ${String.fromCharCode(65 + i)}`} className="bg-white/10 border-white/20" {...field} />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                ))}
                                                <FormField
                                                    control={form.control}
                                                    name="correctOptionIndex"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Correct Answer</FormLabel>
                                                            <FormControl>
                                                                <select {...field} className="w-full h-10 px-3 bg-white/10 border border-white/20 rounded-md text-white">
                                                                    <option value="" className="bg-slate-900">Select correct answer</option>
                                                                    <option value="0" className="bg-slate-900">Option A</option>
                                                                    <option value="1" className="bg-slate-900">Option B</option>
                                                                    <option value="2" className="bg-slate-900">Option C</option>
                                                                    <option value="3" className="bg-slate-900">Option D</option>
                                                                </select>
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <Button type="submit" className="w-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl" disabled={addQuestionMutation.isPending}>
                                                    {addQuestionMutation.isPending ? 'Adding...' : 'Add Question'}
                                                </Button>
                                            </form>
                                        </Form>
                                    </DialogContent>
                                </Dialog>
                            </div>

                            <div className="space-y-4">
                                {quiz.questions.length === 0 ? (
                                    <Card className="bg-white/5 border-white/10">
                                        <CardContent className="py-12 text-center">
                                            <p className="text-gray-400">No questions yet. Add your first question above.</p>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    quiz.questions.map((question, index) => (
                                        <Card key={question._id} className={`bg-white/5 border transition-all ${question.isActive ? 'border-green-500/50 shadow-lg shadow-green-500/10' : 'border-white/10'}`}>
                                            <CardContent className="p-6">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-3 mb-3">
                                                            <span className="text-sm font-medium text-gray-500">Q{index + 1}</span>
                                                            {question.isActive && (
                                                                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                                                                    <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></span>
                                                                    LIVE
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-white text-lg mb-4">{question.text}</p>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            {question.options.map((option: string, optIndex: number) => (
                                                                <div
                                                                    key={optIndex}
                                                                    className={`p-3 rounded-lg text-sm ${optIndex === question.correctOptionIndex
                                                                        ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                                                                        : 'bg-white/5 text-gray-300'
                                                                        }`}
                                                                >
                                                                    <span className="font-medium mr-2">{String.fromCharCode(65 + optIndex)}.</span>
                                                                    {option}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant={question.isActive ? 'default' : 'outline'}
                                                            onClick={() => toggleQuestionActiveMutation.mutate({
                                                                questionId: question._id,
                                                                isActive: !question.isActive,
                                                            })}
                                                            className={question.isActive ? 'bg-green-600 hover:bg-green-700' : ''}
                                                        >
                                                            {question.isActive ? 'Deactivate' : 'Activate'}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => {
                                                                if (confirm('Delete this question?')) {
                                                                    deleteQuestionMutation.mutate(question._id);
                                                                }
                                                            }}
                                                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                        >
                                                            Delete
                                                        </Button>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))
                                )}
                            </div>
                        </TabsContent>

                        <TabsContent value="leaderboard">
                            <Card className="bg-white/5 border-white/10">
                                <CardHeader className="flex flex-row items-center justify-between">
                                    <CardTitle className="text-white">Internal Leaderboard</CardTitle>
                                    {quiz.leaderboardToken && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="border-white/20 text-blue-400 hover:text-white hover:bg-blue-500/10"
                                            onClick={() => {
                                                const url = `${window.location.origin}/leaderboard/${quiz.leaderboardToken}`;
                                                navigator.clipboard.writeText(url);
                                                toast({ title: 'Link copied to clipboard' });
                                            }}
                                        >
                                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                                            </svg>
                                            Copy Public Link
                                        </Button>
                                    )}
                                </CardHeader>
                                <CardContent>
                                    {leaderboardData?.leaderboard.length === 0 ? (
                                        <p className="text-gray-400 text-center py-8">No responses yet</p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="border-b border-white/10">
                                                        <th className="text-left py-3 px-4 text-gray-400 font-medium">#</th>
                                                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Reg No</th>
                                                        <th className="text-left py-3 px-4 text-gray-400 font-medium">Name</th>
                                                        <th className="text-right py-3 px-4 text-gray-400 font-medium">Points</th>
                                                        <th className="text-right py-3 px-4 text-gray-400 font-medium">Correct</th>
                                                        <th className="text-right py-3 px-4 text-gray-400 font-medium">Avg Time</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {leaderboardData?.leaderboard.map((entry, index) => (
                                                        <tr key={entry.regNo} className="border-b border-white/5 hover:bg-white/5">
                                                            <td className="py-3 px-4 text-white">
                                                                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                                                            </td>
                                                            <td className="py-3 px-4 text-white font-mono">{entry.regNo}</td>
                                                            <td className="py-3 px-4 text-white">{entry.name}</td>
                                                            <td className="py-3 px-4 text-right text-green-400 font-semibold">{entry.totalPoints}</td>
                                                            <td className="py-3 px-4 text-right text-gray-300">{entry.correctAnswers}/{entry.totalAnswers}</td>
                                                            <td className="py-3 px-4 text-right text-gray-400">{(entry.avgTimeMs / 1000).toFixed(1)}s</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                </div>
            )}
        </div>
    );
}
