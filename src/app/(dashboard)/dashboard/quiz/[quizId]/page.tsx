'use client';

import { use } from 'react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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

const addQuestionSchema = z.object({
    text: z.string().min(1, 'Question text is required'),
    option0: z.string().min(1, 'Option A is required'),
    option1: z.string().min(1, 'Option B is required'),
    option2: z.string().min(1, 'Option C is required'),
    option3: z.string().min(1, 'Option D is required'),
    correctOptionIndex: z.string().min(1, 'Select the correct answer'),
});

type AddQuestionFormValues = z.infer<typeof addQuestionSchema>;

interface LeaderboardEntry {
    regNo: string;
    name: string;
    totalPoints: number;
    correctAnswers: number;
    totalAnswers: number;
    avgTimeMs: number;
}

export default function QuizManagementPage({
    params,
}: {
    params: Promise<{ quizId: string }>;
}) {
    const { quizId } = use(params);
    const [isAddQuestionOpen, setIsAddQuestionOpen] = useState(false);
    const [showLeaderboard, setShowLeaderboard] = useState(false);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: quizData, isLoading } = useQuery({
        queryKey: ['quiz', quizId],
        queryFn: async () => {
            const res = await fetch(`/api/quiz/${quizId}`);
            if (!res.ok) throw new Error('Failed to fetch quiz');
            return res.json() as Promise<{ quiz: Quiz }>;
        },
    });

    const { data: leaderboardData } = useQuery({
        queryKey: ['leaderboard', quizId],
        queryFn: async () => {
            const res = await fetch(`/api/quiz/${quizId}/leaderboard`);
            if (!res.ok) throw new Error('Failed to fetch leaderboard');
            return res.json() as Promise<{ leaderboard: LeaderboardEntry[] }>;
        },
        enabled: showLeaderboard,
    });

    const toggleVisibilityMutation = useMutation({
        mutationFn: async (isVisible: boolean) => {
            const res = await fetch(`/api/quiz/${quizId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isVisible }),
            });
            if (!res.ok) throw new Error('Failed to update quiz');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['quiz', quizId] });
            toast({ title: 'Quiz visibility updated' });
        },
    });

    const toggleQuestionActiveMutation = useMutation({
        mutationFn: async ({ questionId, isActive }: { questionId: string; isActive: boolean }) => {
            const res = await fetch(`/api/quiz/${quizId}/questions/${questionId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive }),
            });
            if (!res.ok) throw new Error('Failed to update question');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['quiz', quizId] });
            toast({ title: 'Question updated' });
        },
    });

    const addQuestionMutation = useMutation({
        mutationFn: async (data: { text: string; options: string[]; correctOptionIndex: number }) => {
            const res = await fetch(`/api/quiz/${quizId}/questions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to add question');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['quiz', quizId] });
            setIsAddQuestionOpen(false);
            form.reset();
            toast({ title: 'Question added successfully' });
        },
    });

    const deleteQuestionMutation = useMutation({
        mutationFn: async (questionId: string) => {
            const res = await fetch(`/api/quiz/${quizId}/questions/${questionId}`, {
                method: 'DELETE',
            });
            if (!res.ok) throw new Error('Failed to delete question');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['quiz', quizId] });
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

    const quiz = quizData?.quiz;
    if (!quiz) {
        return <div className="text-center py-20 text-gray-400">Quiz not found</div>;
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Link href="/dashboard" className="text-gray-400 hover:text-white">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                        </Link>
                        <h1 className="text-3xl font-bold text-white">{quiz.title}</h1>
                    </div>
                    <div className="flex gap-4 items-center">
                        <p className="text-gray-400">{quiz.questions.length} questions</p>
                        {quiz.leaderboardToken && (
                            <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/10">
                                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                                <a
                                    href={`/leaderboard/${quiz.leaderboardToken}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-blue-400 hover:text-blue-300 hover:underline flex items-center gap-1"
                                >
                                    Public Leaderboard
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                </a>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-400">Quiz Visible</span>
                        <Switch
                            checked={quiz.isVisible}
                            onCheckedChange={(checked) => toggleVisibilityMutation.mutate(checked)}
                        />
                    </div>
                    <Button
                        variant={showLeaderboard ? 'default' : 'outline'}
                        onClick={() => setShowLeaderboard(!showLeaderboard)}
                        className="rounded-xl"
                    >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        {showLeaderboard ? 'Hide Leaderboard' : 'Show Leaderboard'}
                    </Button>
                </div>
            </div>

            {/* Leaderboard */}
            {showLeaderboard && (
                <Card className="bg-white/5 border-white/10">
                    <CardHeader>
                        <CardTitle className="text-white">Leaderboard</CardTitle>
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
            )}

            {/* Add Question Button */}
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

            {/* Questions List */}
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
                                            {question.options.map((option, optIndex) => (
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
        </div>
    );
}
