'use client';

import { use, useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';

interface LeaderboardEntry {
    regNo: string;
    name: string;
    totalPoints: number;
    correctAnswers: number;
    totalAnswers: number;
    avgTimeMs: number;
}

// Animated Counter Component
function AnimatedCounter({ value }: { value: number }) {
    const [displayValue, setDisplayValue] = useState(value);

    useEffect(() => {
        const start = displayValue;
        const end = value;
        const duration = 1000; // 1s animation
        const startTime = performance.now();

        const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out quart
            const ease = 1 - Math.pow(1 - progress, 4);

            const current = Math.floor(start + (end - start) * ease);
            setDisplayValue(current);

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

    return <span>{displayValue.toLocaleString()}</span>;
}

export default function PublicLeaderboardPage({
    params,
}: {
    params: Promise<{ token: string }>;
}) {
    const { token } = use(params);
    const [currentTime, setCurrentTime] = useState(new Date());

    // Update time every second
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const { data, isLoading, error } = useQuery({
        queryKey: ['public-leaderboard', token],
        queryFn: async () => {
            const res = await fetch(`/api/public/leaderboard/${token}`);
            if (!res.ok) throw new Error('Failed to fetch leaderboard');
            return res.json() as Promise<{ quizTitle: string; leaderboard: LeaderboardEntry[] }>;
        },
        refetchInterval: 3000,
    });

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center overflow-hidden relative">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-slate-950 to-slate-950"></div>
                <div className="flex flex-col items-center gap-6 relative z-10">
                    <div className="w-16 h-16 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin"></div>
                    <div className="text-xl font-light tracking-widest text-purple-300 animate-pulse">LOADING DATA</div>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
                <div className="text-center max-w-md">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-20 h-20 mx-auto mb-6 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20"
                    >
                        <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </motion.div>
                    <h1 className="text-3xl font-bold mb-3">Access Denied</h1>
                    <p className="text-gray-400">The leaderboard link is invalid or has expired.</p>
                </div>
            </div>
        );
    }

    const topThree = data.leaderboard.slice(0, 3);
    const restList = data.leaderboard.slice(3);

    return (
        <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden font-sans">
            {/* Dynamic Background */}
            <div className="fixed inset-0 pointer-events-none">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-purple-900/20 via-slate-950 to-slate-950"></div>
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full animate-pulse-slow"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full animate-pulse-slow delay-1000"></div>
            </div>

            <div className="container mx-auto px-4 py-8 relative z-10 max-w-6xl">
                {/* Header */}
                <header className="text-center mb-16 relative">


                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full bg-white/5 border border-white/10 backdrop-blur-md shadow-[0_0_20px_rgba(168,85,247,0.15)]"
                    >
                        <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                        </span>
                        <span className="text-sm font-semibold text-purple-200 tracking-wide uppercase">Live Updates</span>
                    </motion.div>

                    <motion.h1
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5 }}
                        className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-purple-400 mb-4 drop-shadow-[0_0_25px_rgba(168,85,247,0.3)] tracking-tight"
                    >
                        {data.quizTitle}
                    </motion.h1>

                    <p className="text-gray-400 text-xl font-light">Real-time Leaderboard Standings</p>
                </header>

                {/* Podium Section */}
                <AnimatePresence mode='wait'>
                    {topThree.length >= 3 ? (
                        <div className="flex flex-col md:flex-row justify-center items-end gap-6 mb-20 px-4 h-[350px] md:h-auto">
                            {/* 2nd Place */}
                            <motion.div
                                key={topThree[1].regNo}
                                initial={{ opacity: 0, y: 50 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="order-2 md:order-1 flex flex-col items-center w-full md:w-1/3"
                            >
                                <div className="relative">
                                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-slate-400 to-slate-600 p-[3px] shadow-[0_0_20px_rgba(148,163,184,0.3)] mb-4 z-10 relative">
                                        <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
                                            <span className="text-3xl font-bold text-slate-200">2</span>
                                        </div>
                                    </div>
                                    <div className="absolute top-[-10px] left-1/2 -translate-x-1/2 -rotate-12 text-4xl grayscale opacity-50">🥈</div>
                                </div>
                                <div className="w-full bg-gradient-to-b from-slate-800/80 to-slate-900/80 backdrop-blur-md rounded-t-3xl border-t border-slate-600/30 p-6 flex flex-col items-center h-[220px] justify-between relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-slate-400/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <div className="text-center w-full">
                                        <h3 className="text-xl font-bold text-white truncate w-full">{topThree[1].name}</h3>
                                        <p className="text-sm text-slate-400 font-mono mt-1">{topThree[1].regNo}</p>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-4xl font-black text-slate-300 mb-1">
                                            <AnimatedCounter value={topThree[1].totalPoints} />
                                        </div>
                                        <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Points</p>
                                    </div>
                                </div>
                            </motion.div>

                            {/* 1st Place */}
                            <motion.div
                                key={topThree[0].regNo}
                                initial={{ opacity: 0, y: 50 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="order-1 md:order-2 flex flex-col items-center w-full md:w-1/3 -mt-12 md:-mt-24 z-20"
                            >
                                <div className="relative">
                                    <div className="absolute -inset-4 bg-yellow-500/20 blur-xl rounded-full animate-pulse"></div>
                                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-yellow-300 via-yellow-500 to-yellow-700 p-[4px] shadow-[0_0_30px_rgba(234,179,8,0.5)] mb-6 z-10 relative">
                                        <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center border-4 border-yellow-900/50">
                                            <span className="text-5xl">👑</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="w-full bg-gradient-to-b from-yellow-900/40 to-slate-900/90 backdrop-blur-xl rounded-t-[40px] border-t-2 border-yellow-500/30 p-8 flex flex-col items-center h-[280px] justify-between relative overflow-hidden group hover:shadow-[0_-10px_40px_rgba(234,179,8,0.15)] transition-shadow">
                                    <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-yellow-500 to-transparent opacity-50"></div>
                                    <div className="text-center w-full">
                                        <h3 className="text-2xl font-bold text-white truncate w-full">{topThree[0].name}</h3>
                                        <p className="text-sm text-yellow-500/80 font-mono mt-1 bg-yellow-500/10 px-3 py-1 rounded-full inline-block">{topThree[0].regNo}</p>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 mb-2 drop-shadow-sm">
                                            <AnimatedCounter value={topThree[0].totalPoints} />
                                        </div>
                                        <p className="text-xs uppercase tracking-widest text-yellow-500/60 font-semibold flex items-center justify-center gap-2">
                                            <span>Start Points</span>
                                        </p>
                                    </div>
                                </div>
                            </motion.div>

                            {/* 3rd Place */}
                            <motion.div
                                key={topThree[2].regNo}
                                initial={{ opacity: 0, y: 50 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4 }}
                                className="order-3 flex flex-col items-center w-full md:w-1/3"
                            >
                                <div className="relative">
                                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-400 to-orange-700 p-[3px] shadow-[0_0_20px_rgba(194,65,12,0.3)] mb-4 z-10 relative">
                                        <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
                                            <span className="text-3xl font-bold text-orange-200">3</span>
                                        </div>
                                    </div>
                                    <div className="absolute top-[-10px] left-1/2 -translate-x-1/2 12 text-4xl grayscale opacity-50">🥉</div>
                                </div>
                                <div className="w-full bg-gradient-to-b from-slate-800/80 to-slate-900/80 backdrop-blur-md rounded-t-3xl border-t border-orange-700/30 p-6 flex flex-col items-center h-[200px] justify-between relative overflow-hidden group">
                                    <div className="absolute inset-0 bg-orange-400/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    <div className="text-center w-full">
                                        <h3 className="text-xl font-bold text-white truncate w-full">{topThree[2].name}</h3>
                                        <p className="text-sm text-orange-400/70 font-mono mt-1">{topThree[2].regNo}</p>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-4xl font-black text-orange-200 mb-1">
                                            <AnimatedCounter value={topThree[2].totalPoints} />
                                        </div>
                                        <p className="text-xs uppercase tracking-widest text-orange-500/60 font-semibold">Points</p>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    ) : null}
                </AnimatePresence>

                {/* List View */}
                <motion.div
                    layout
                    className="max-w-4xl mx-auto bg-slate-900/60 border border-white/5 rounded-3xl overflow-hidden backdrop-blur-xl shadow-2xl"
                >
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/[0.02]">
                                <th className="py-5 px-6 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Rank</th>
                                <th className="py-5 px-6 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Participant</th>
                                <th className="py-5 px-6 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Stats</th>
                                <th className="py-5 px-6 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Score</th>
                            </tr>
                        </thead>
                        <tbody className='relative'>
                            <AnimatePresence>
                                {data.leaderboard.slice(data.leaderboard.length >= 3 ? 3 : 0).map((entry, index) => {
                                    const rank = (data.leaderboard.length >= 3 ? 3 : 0) + index + 1;
                                    return (
                                        <motion.tr
                                            layout
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 20 }}
                                            transition={{ duration: 0.3 }}
                                            key={entry.regNo}
                                            className="border-b border-white/5 group bg-transparent hover:bg-white/[0.03] transition-colors relative"
                                        >
                                            <td className="py-4 px-6">
                                                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center font-mono text-sm text-gray-400 font-bold group-hover:bg-purple-500 group-hover:text-white transition-colors">
                                                    {rank}
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div>
                                                    <p className="font-bold text-white text-lg">{entry.name}</p>
                                                    <p className="text-xs text-gray-500 font-mono">{entry.regNo}</p>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-right">
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className="text-xs text-gray-400 flex items-center gap-1">
                                                        <span className="text-green-400 font-bold">{entry.correctAnswers}</span><span className="text-gray-600">/</span><span>{entry.totalAnswers}</span>
                                                    </span>
                                                    <span className="text-[10px] text-gray-600 uppercase tracking-wider">Accuracy</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-right">
                                                <div className="text-2xl font-bold text-purple-200 tabular-nums">
                                                    <AnimatedCounter value={entry.totalPoints} />
                                                </div>
                                            </td>
                                        </motion.tr>
                                    );
                                })}
                            </AnimatePresence>
                            {data.leaderboard.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="py-16 text-center text-gray-500 text-lg">
                                        No submissions yet. The race hasn't started! 🏁
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </motion.div>

                <footer className="mt-16 text-center text-gray-600 text-sm">
                    <p>Updating live every 3 seconds</p>
                </footer>
            </div>
        </div>
    );
}
