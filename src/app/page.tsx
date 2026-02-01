import Link from 'next/link';
import Image from 'next/image';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/lib/auth/jwt';
import { PublicEventsSection } from '@/components/PublicEventsSection';

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
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
      <main className="relative z-10 py-12 px-4">
        {/* Hero Section */}
        <section className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full mb-6">
            <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
            <span className="text-sm text-gray-300">Event tickets available</span>
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">
            Download Your
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400"> Event Ticket</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-xl mx-auto">
            Select your event below and enter your details to download your personalized ticket with QR code.
          </p>
        </section>

        {/* Events Section */}
        <PublicEventsSection />

        {/* How to Download Section */}
        <section className="max-w-4xl mx-auto mt-20 px-4">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
              How It Works
            </h2>
            <p className="text-gray-500">
              Three simple steps to get your ticket
            </p>
          </div>

          <div className="relative">
            {/* Connection Line */}
            <div className="hidden md:block absolute top-1/2 left-[15%] right-[15%] h-px bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-y-1/2"></div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Step 1 */}
              <div className="relative group">
                <div className="bg-gradient-to-b from-white/[0.08] to-transparent border border-white/10 rounded-2xl p-6 text-center transition-all duration-300 hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/5">
                  <div className="w-12 h-12 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-purple-500/30">
                    1
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Choose Event</h3>
                  <p className="text-gray-500 text-sm">
                    Select from the list of available events above
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="relative group">
                <div className="bg-gradient-to-b from-white/[0.08] to-transparent border border-white/10 rounded-2xl p-6 text-center transition-all duration-300 hover:border-pink-500/30 hover:shadow-lg hover:shadow-pink-500/5">
                  <div className="w-12 h-12 mx-auto mb-4 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-pink-500/30">
                    2
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Enter Details</h3>
                  <p className="text-gray-500 text-sm">
                    Provide your email and phone number
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="relative group">
                <div className="bg-gradient-to-b from-white/[0.08] to-transparent border border-white/10 rounded-2xl p-6 text-center transition-all duration-300 hover:border-orange-500/30 hover:shadow-lg hover:shadow-orange-500/5">
                  <div className="w-12 h-12 mx-auto mb-4 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-orange-500/30">
                    3
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">Download</h3>
                  <p className="text-gray-500 text-sm">
                    Get your ticket with QR code
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-6 mt-12">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-gray-600 text-sm">&copy; 2026 Thanima</p>
        </div>
      </footer>
    </div>
  );
}
