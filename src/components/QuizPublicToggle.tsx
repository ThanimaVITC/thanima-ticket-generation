'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface Quiz {
    _id: string;
    title: string;
    isVisible: boolean;
    leaderboardToken?: string;
}

function useEventQuiz(eventId: string) {
    return useQuery({
        queryKey: ['quizzes', eventId],
        queryFn: async () => {
            const res = await fetch(`/api/quiz?eventId=${eventId}`);
            if (!res.ok) throw new Error('Failed to fetch quizzes');
            return res.json() as Promise<{ quizzes: Quiz[] }>;
        },
    });
}

export function QuizPublicToggle({ eventId }: { eventId: string }) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { data: quizzesData, isLoading } = useEventQuiz(eventId);
    const quiz = quizzesData?.quizzes[0];

    const toggleMutation = useMutation({
        mutationFn: async (checked: boolean) => {
            if (!quiz) return;
            const res = await fetch(`/api/quiz/${quiz._id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isVisible: checked }),
            });
            if (!res.ok) throw new Error('Failed to update quiz');
            return res.json();
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['quizzes', eventId] });
            toast({ title: data.isVisible ? 'Quiz is now Public' : 'Quiz is now Private' });
        },
        onError: (error: Error) => {
            toast({ title: 'Error', description: error.message, variant: 'destructive' });
        },
    });

    if (isLoading || !quiz) return null;

    return (
        <div className="flex items-center gap-3">
            <Switch
                id="quiz-public"
                checked={quiz.isVisible}
                onCheckedChange={(checked) => toggleMutation.mutate(checked)}
                disabled={toggleMutation.isPending}
            />
            <label htmlFor="quiz-public" className="text-sm text-gray-400">
                Make Quiz Public
            </label>
        </div>
    );
}

export function QuizLeaderboardButton({ eventId }: { eventId: string }) {
    const { toast } = useToast();
    const { data: quizzesData, isLoading } = useEventQuiz(eventId);
    const quiz = quizzesData?.quizzes[0];

    if (isLoading || !quiz || !quiz.leaderboardToken) return null;

    return (
        <Button
            variant="outline"
            className="border-white/10 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl flex items-center gap-2 h-8 px-3 text-xs z-20 relative"
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const url = `${window.location.origin}/leaderboard/${quiz.leaderboardToken}`;
                navigator.clipboard.writeText(url);
                toast({ title: 'Leaderboard Link Copied', description: 'Share this link to show the leaderboard' });
            }}
        >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            Leaderboard
        </Button>
    );

}
