'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';

interface ActiveQuestion {
    _id: string;
    text: string;
    options: string[];
}

interface QuizSectionProps {
    eventId: string;
    regNo: string;
}

export function QuizSection({ eventId, regNo }: QuizSectionProps) {
    const [hasQuiz, setHasQuiz] = useState(false);
    const [quizId, setQuizId] = useState<string | null>(null);
    const [quizTitle, setQuizTitle] = useState('');
    const [activeQuestion, setActiveQuestion] = useState<ActiveQuestion | null>(null);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
    const [answeredQuestions, setAnsweredQuestions] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);

    const [isStarted, setIsStarted] = useState(false);

    // Timer
    const [startTime, setStartTime] = useState<number | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Load answered questions from localStorage and server
    useEffect(() => {
        const loadAnsweredQuestions = async () => {
            // Load from localStorage first
            const cacheKey = `quiz_answered_${eventId}_${regNo}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                setAnsweredQuestions(new Set(JSON.parse(cached)));
            }

            // Then sync with server
            try {
                const res = await fetch('/api/public/quiz/answered');
                if (res.ok) {
                    const data = await res.json();
                    const serverAnswered = new Set(data.answeredQuestionIds as string[]);
                    setAnsweredQuestions(serverAnswered);
                    localStorage.setItem(cacheKey, JSON.stringify(Array.from(serverAnswered)));
                }
            } catch {
                console.error('Failed to sync answered questions');
            }
        };
        loadAnsweredQuestions();
    }, [eventId, regNo]);

    // Fetch active quiz question
    const fetchActiveQuestion = useCallback(async () => {
        try {
            const res = await fetch('/api/public/quiz/active');
            if (!res.ok) {
                setHasQuiz(false);
                return;
            }

            const data = await res.json();
            setHasQuiz(data.hasQuiz);
            setQuizId(data.quizId || null);
            setQuizTitle(data.quizTitle || '');

            if (data.activeQuestion) {
                const questionId = data.activeQuestion._id;
                // Check if already answered
                if (answeredQuestions.has(questionId)) {
                    setActiveQuestion(null);
                    setSubmitted(true);
                    setIsStarted(false);
                } else {
                    // Only update if it's a new question we haven't seen yet
                    // or if we're not currently looking at a question
                    setActiveQuestion(prev => {
                        if (prev?._id !== questionId) {
                            setIsStarted(false); // Reset start state for new question
                            return data.activeQuestion;
                        }
                        return prev;
                    });
                    setSubmitted(false);
                    // Do NOT automatically set startTime here anymore
                }
            } else {
                setActiveQuestion(null);
                setIsStarted(false);
            }
        } catch {
            console.error('Failed to fetch quiz');
        } finally {
            setIsLoading(false);
        }
    }, [answeredQuestions]);

    useEffect(() => {
        fetchActiveQuestion();
        // Poll every 5 seconds for new questions
        const pollInterval = setInterval(fetchActiveQuestion, 5000);
        return () => clearInterval(pollInterval);
    }, [fetchActiveQuestion]);

    // Handle Start Quiz
    const handleStart = () => {
        setIsStarted(true);
        setStartTime(Date.now());
        setElapsedTime(0);
    };

    // Timer effect
    useEffect(() => {
        if (isStarted && activeQuestion && !submitted && startTime) {
            timerRef.current = setInterval(() => {
                setElapsedTime(Date.now() - startTime);
            }, 100);
        } else if (timerRef.current) {
            clearInterval(timerRef.current);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [isStarted, activeQuestion, submitted, startTime]);

    async function handleSubmit() {
        if (selectedOption === null || !activeQuestion || !quizId) return;

        setIsSubmitting(true);
        setError('');

        const timeTakenMs = Date.now() - (startTime || Date.now());

        try {
            const res = await fetch('/api/public/quiz/answer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    quizId,
                    questionId: activeQuestion._id,
                    selectedOptionIndex: selectedOption,
                    timeTakenMs,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                if (data.alreadyAnswered) {
                    setSubmitted(true);
                    // Update local cache
                    const newAnswered = new Set(answeredQuestions);
                    newAnswered.add(activeQuestion._id);
                    setAnsweredQuestions(newAnswered);
                    localStorage.setItem(
                        `quiz_answered_${eventId}_${regNo}`,
                        JSON.stringify(Array.from(newAnswered))
                    );
                } else {
                    throw new Error(data.error || 'Failed to submit answer');
                }
                return;
            }

            // Success
            setSubmitted(true);
            const newAnswered = new Set(answeredQuestions);
            newAnswered.add(activeQuestion._id);
            setAnsweredQuestions(newAnswered);
            localStorage.setItem(
                `quiz_answered_${eventId}_${regNo}`,
                JSON.stringify(Array.from(newAnswered))
            );

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to submit answer');
        } finally {
            setIsSubmitting(false);
        }
    }

    if (isLoading) {
        return (
            <div className="bg-gradient-to-b from-white/[0.08] to-transparent border border-white/10 rounded-2xl p-6">
                <div className="flex items-center justify-center py-8">
                    <div className="w-8 h-8 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin"></div>
                </div>
            </div>
        );
    }

    if (!hasQuiz) {
        return (
            <div className="bg-gradient-to-b from-white/[0.08] to-transparent border border-white/10 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-xl font-bold text-white mb-1">Quiz</h2>
                        <p className="text-gray-500 text-sm">Participate in the event quiz</p>
                    </div>
                </div>
                <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-600/20 rounded-2xl flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <p className="text-gray-400">No active quiz at the moment</p>
                    <p className="text-gray-600 text-sm mt-1">Check back later when the quiz is live!</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-b from-white/[0.08] to-transparent border border-white/10 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-white mb-1">Quiz: {quizTitle}</h2>
                    <p className="text-gray-500 text-sm">Answer the question below</p>
                </div>
                {activeQuestion && isStarted && !submitted && (
                    <div className="text-right">
                        <p className="text-sm text-gray-400">Time</p>
                        <p className="text-2xl font-mono text-white">{(elapsedTime / 1000).toFixed(1)}s</p>
                    </div>
                )}
            </div>

            {!activeQuestion ? (
                submitted ? (
                    <div className="text-center py-8">
                        <div className="w-16 h-16 mx-auto mb-4 bg-green-500/20 rounded-2xl flex items-center justify-center">
                            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <p className="text-green-400 font-medium">Answer Submitted!</p>
                        <p className="text-gray-500 text-sm mt-1">Waiting for the next question...</p>
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <div className="w-16 h-16 mx-auto mb-4 bg-purple-500/20 rounded-2xl flex items-center justify-center">
                            <svg className="w-8 h-8 text-purple-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <p className="text-gray-400">Waiting for a question...</p>
                        <p className="text-gray-600 text-sm mt-1">The admin will activate a question soon</p>
                    </div>
                )
            ) : !isStarted ? (
                <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-6 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/20 animate-bounce">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">New Question Active!</h3>
                    <p className="text-gray-400 mb-6">A new question is ready for you. Click start when you are ready.</p>
                    <Button
                        onClick={handleStart}
                        className="px-8 py-6 text-lg font-bold bg-white text-purple-600 hover:bg-gray-100 rounded-xl"
                    >
                        Start Quiz
                    </Button>
                </div>
            ) : (
                <div className="space-y-4">
                    <p className="text-lg text-white font-medium">{activeQuestion.text}</p>

                    <div className="grid gap-3">
                        {activeQuestion.options.map((option, index) => (
                            <button
                                key={index}
                                onClick={() => !submitted && setSelectedOption(index)}
                                disabled={submitted || isSubmitting}
                                className={`w-full p-4 rounded-xl text-left transition-all ${selectedOption === index
                                    ? 'bg-purple-500/30 border-2 border-purple-500 text-white'
                                    : 'bg-white/5 border-2 border-transparent hover:bg-white/10 text-gray-300'
                                    } ${submitted ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                            >
                                <span className="font-medium mr-3 text-gray-400">{String.fromCharCode(65 + index)}.</span>
                                {option}
                            </button>
                        ))}
                    </div>

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {!submitted && (
                        <Button
                            onClick={handleSubmit}
                            disabled={selectedOption === null || isSubmitting}
                            className="w-full h-12 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 hover:from-purple-600 hover:via-pink-600 hover:to-orange-600 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/25"
                        >
                            {isSubmitting ? (
                                <span className="flex items-center gap-2">
                                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                    </svg>
                                    Submitting...
                                </span>
                            ) : (
                                'Submit Answer'
                            )}
                        </Button>
                    )}

                    {submitted && (
                        <div className="text-center py-4">
                            <p className="text-green-400 font-medium">Answer submitted!</p>
                            <p className="text-gray-500 text-sm">Your answer has been recorded</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
