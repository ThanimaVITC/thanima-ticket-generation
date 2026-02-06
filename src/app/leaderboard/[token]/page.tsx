'use client';

import { use, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

interface LeaderboardEntry {
    regNo: string;
    name: string;
    totalPoints: number;
    correctAnswers: number;
    totalAnswers: number;
    avgTimeMs: number;
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
        refetchInterval: 5000, // Refresh every 5 seconds
    });

    if (isLoading) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin"></div>
                    <p className="text-gray-400 animate-pulse">Loading Leaderboard...</p>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
                <div className="text-center max-w-md">
                    <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-2xl flex items-center justify-center">
                        <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold mb-2">Access Denied</h1>
                    <p className="text-gray-400">The leaderboard link is invalid or has expired.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-[500px] bg-purple-500/10 blur-[100px] -translate-y-1/2 pointer-events-none"></div>
            <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-500/10 blur-[100px] translate-y-1/2 pointer-events-none"></div>

            <div className="container mx-auto px-4 py-8 relative z-10">
                {/* Header */}
                <div className="text-center mb-12">
                    <div className="inline-block px-3 py-1 mb-4 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-purple-300">
                        LIVE UPDATES
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 mb-4">
                        {data.quizTitle}
                    </h1>
                    <p className="text-gray-400 text-lg">Leaderboard Standings</p>
                    <p className="text-gray-600 text-sm mt-2 font-mono">
                        {currentTime.toLocaleTimeString()}
                    </p>
                </div>

                {/* Top 3 Podium (Visible on larger screens) */}
                {data.leaderboard.length >= 3 && (
                    <div className="hidden md:flex justify-center items-end gap-6 mb-16">
                        {/* 2nd Place */}
                        <div className="flex flex-col items-center">
                            <div className="w-20 h-20 rounded-full bg-slate-800 border-4 border-slate-700 flex items-center justify-center mb-4 shadow-lg shadow-slate-900/50 relative">
                                <span className="text-2xl font-bold text-gray-300">2</span>
                                <div className="absolute -bottom-2 bg-slate-700 text-white text-xs px-2 py-0.5 rounded-full font-bold">SILVER</div>
                            </div>
                            <div className="w-48 bg-gradient-to-b from-slate-800 to-slate-900/50 rounded-t-2xl p-6 text-center border-t border-slate-700 h-48 flex flex-col justify-between hover:-translate-y-2 transition-transform duration-300">
                                <div>
                                    <p className="font-bold text-white truncate px-2">{data.leaderboard[1].name}</p>
                                    <p className="text-xs text-gray-500 font-mono mt-1">{data.leaderboard[1].regNo}</p>
                                </div>
                                <div>
                                    <p className="text-3xl font-bold text-green-400">{data.leaderboard[1].totalPoints}</p>
                                    <p className="text-xs text-gray-500">Points</p>
                                </div>
                            </div>
                        </div>

                        {/* 1st Place */}
                        <div className="flex flex-col items-center z-10 -mb-4">
                            <div className="w-24 h-24 rounded-full bg-yellow-500/20 border-4 border-yellow-500 flex items-center justify-center mb-4 shadow-lg shadow-yellow-500/20 relative animate-bounce-slow">
                                <span className="text-4xl">👑</span>
                                <div className="absolute -bottom-3 bg-yellow-500 text-black text-xs px-3 py-1 rounded-full font-bold">CHAMPION</div>
                            </div>
                            <div className="w-56 bg-gradient-to-b from-yellow-500/10 to-slate-900/50 rounded-t-2xl p-6 text-center border-t border-yellow-500/30 h-60 flex flex-col justify-between hover:-translate-y-2 transition-transform duration-300 shadow-xl shadow-yellow-500/5">
                                <div>
                                    <p className="font-bold text-white text-lg truncate px-2">{data.leaderboard[0].name}</p>
                                    <p className="text-xs text-yellow-500/70 font-mono mt-1">{data.leaderboard[0].regNo}</p>
                                </div>
                                <div className="py-2">
                                    <div className="text-xs text-gray-400 mb-1">{data.leaderboard[0].correctAnswers} correct</div>
                                    <p className="text-4xl font-bold text-yellow-400">{data.leaderboard[0].totalPoints}</p>
                                    <p className="text-xs text-gray-500">Points</p>
                                </div>
                            </div>
                        </div>

                        {/* 3rd Place */}
                        <div className="flex flex-col items-center">
                            <div className="w-20 h-20 rounded-full bg-orange-900/40 border-4 border-orange-700 flex items-center justify-center mb-4 shadow-lg shadow-orange-900/50 relative">
                                <span className="text-2xl font-bold text-orange-200">3</span>
                                <div className="absolute -bottom-2 bg-orange-800 text-orange-100 text-xs px-2 py-0.5 rounded-full font-bold">BRONZE</div>
                            </div>
                            <div className="w-48 bg-gradient-to-b from-slate-800 to-slate-900/50 rounded-t-2xl p-6 text-center border-t border-slate-700 h-40 flex flex-col justify-between hover:-translate-y-2 transition-transform duration-300">
                                <div>
                                    <p className="font-bold text-white truncate px-2">{data.leaderboard[2].name}</p>
                                    <p className="text-xs text-gray-500 font-mono mt-1">{data.leaderboard[2].regNo}</p>
                                </div>
                                <div>
                                    <p className="text-3xl font-bold text-green-400">{data.leaderboard[2].totalPoints}</p>
                                    <p className="text-xs text-gray-500">Points</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Full List */}
                <div className="max-w-4xl mx-auto">
                    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-white/5 border-b border-white/10">
                                        <th className="text-left py-4 px-6 text-gray-400 font-medium text-sm uppercase tracking-wider">Rank</th>
                                        <th className="text-left py-4 px-6 text-gray-400 font-medium text-sm uppercase tracking-wider">Participant</th>
                                        <th className="text-right py-4 px-6 text-gray-400 font-medium text-sm uppercase tracking-wider">Accuracy</th>
                                        <th className="text-right py-4 px-6 text-gray-400 font-medium text-sm uppercase tracking-wider hidden sm:table-cell">Avg Time</th>
                                        <th className="text-right py-4 px-6 text-gray-400 font-medium text-sm uppercase tracking-wider">Score</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {data.leaderboard.map((entry, index) => (
                                        <tr
                                            key={entry.regNo}
                                            className={`hover:bg-white/5 transition-colors ${index < 3 ? 'bg-gradient-to-r from-white/[0.02] to-transparent' : ''
                                                }`}
                                        >
                                            <td className="py-4 px-6">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${index === 0 ? 'bg-yellow-500 text-black' :
                                                        index === 1 ? 'bg-gray-300 text-black' :
                                                            index === 2 ? 'bg-orange-700 text-white' :
                                                                'text-gray-500 bg-white/5'
                                                    }`}>
                                                    {index + 1}
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-white">{entry.name}</span>
                                                    <span className="text-xs text-gray-500 font-mono">{entry.regNo}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6 text-right">
                                                <span className="text-gray-300">{entry.correctAnswers}</span>
                                                <span className="text-gray-600">/{entry.totalAnswers}</span>
                                            </td>
                                            <td className="py-4 px-6 text-right text-gray-400 font-mono hidden sm:table-cell">
                                                {(entry.avgTimeMs / 1000).toFixed(1)}s
                                            </td>
                                            <td className="py-4 px-6 text-right">
                                                <span className="font-bold text-green-400 text-lg">{entry.totalPoints}</span>
                                            </td>
                                        </tr>
                                    ))}
                                    {data.leaderboard.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-12 text-center text-gray-500">
                                                No submissions yet. Be the first!
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
