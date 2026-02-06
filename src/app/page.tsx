import Link from 'next/link';
import Image from 'next/image';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import { verifyToken } from '@/lib/auth/jwt';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';

export default async function HomePage() {
  // Check if user is already logged in
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;

  if (token) {
    const user = verifyToken(token);
    if (user) {
      redirect('/dashboard');
    }
  }

  // Fetch active event
  await connectDB();
  const activeEvent = await Event.findOne({
    isActiveDisplay: true,
  }).select('title date description isPublicDownload').lean();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex flex-col">
      {/* Ambient Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-purple-500/5 to-pink-500/5 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-center h-16">
            <Link href="/" className="flex items-center space-x-3">
              <Image
                src="/thanima_logo.jpg"
                alt="Thanima Logo"
                width={36}
                height={36}
                className="rounded-xl"
              />
              <span className="text-white font-semibold text-xl tracking-tight">Thanima</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-grow flex items-center justify-center px-4 py-12">
        {activeEvent ? (
          // ACTIVE EVENT LAYOUT
          <div className="max-w-4xl w-full mx-auto text-center space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-full">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-sm font-medium text-green-400">Tickets Available</span>
              </div>

              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white tracking-tight leading-tight">
                {activeEvent.title}
              </h1>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-gray-400 text-lg">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>{format(new Date(activeEvent.date), 'PPPP')}</span>
                </div>
                {activeEvent.description && (
                  <>
                    <span className="hidden sm:inline w-1.5 h-1.5 rounded-full bg-gray-700"></span>
                    <p className="max-w-md line-clamp-1">{activeEvent.description}</p>
                  </>
                )}
              </div>
            </div>

            <div className="p-8 bg-white/[0.03] border border-white/10 rounded-3xl backdrop-blur-sm max-w-2xl mx-auto shadow-2xl">
              <h3 className="text-xl font-semibold text-white mb-2">Ready to join?</h3>
              <p className="text-gray-400 mb-6">
                Confirm your details and download your official event ticket instantly.
              </p>

              <Link
                href={`/event/${activeEvent._id}`}
                className="group relative inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 text-white font-bold text-lg rounded-xl overflow-hidden shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-300 transform hover:-translate-y-1"
              >
                <span className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></span>
                <span className="relative flex items-center gap-2">
                  Get Your Ticket
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </span>
              </Link>
              <p className="mt-4 text-xs text-gray-500">
                *Requires email & phone for verification
              </p>
            </div>
          </div>
        ) : (
          // NO EVENT LAYOUT
          <div className="max-w-2xl w-full mx-auto text-center">
            <div className="w-24 h-24 mx-auto mb-6 bg-white/5 border border-white/10 rounded-3xl flex items-center justify-center transform rotate-12">
              <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Global Ticketing Portal
            </h1>
            <p className="text-gray-400 text-lg mb-8 max-w-md mx-auto">
              No events are currently scheduled for ticketing. Please check back later for updates on upcoming events.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg text-gray-500 text-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Check back soon
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-6">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-gray-600 text-sm">&copy; 2026 Thanima. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
