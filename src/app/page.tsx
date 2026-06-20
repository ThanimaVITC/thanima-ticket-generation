import Link from 'next/link';
import Image from 'next/image';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import { verifyToken } from '@/lib/auth/jwt';
import connectDB from '@/lib/db/connection';
import Event from '@/lib/db/models/event';
import { BoxyFrame } from '@/components/boxy';
import { ThemeToggle } from '@/components/theme-toggle';

export default async function HomePage() {
  // Already-logged-in staff go straight to the dashboard.
  const cookieStore = await cookies();
  const token = cookieStore.get('auth-token')?.value;
  if (token) {
    const user = verifyToken(token);
    if (user) {
      redirect('/dashboard');
    }
  }

  // Every event marked "Public" (isActiveDisplay) shows on the portal.
  await connectDB();
  const events = await Event.find({ isActiveDisplay: true })
    .select('title date description isPublicDownload')
    .sort({ date: -1 })
    .lean();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="relative z-10 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2.5">
              <Image src="/thanima_logo.jpg" alt="Thanima" width={28} height={28} className="border border-border" />
              <span className="text-foreground font-semibold text-lg tracking-tight">Thanima</span>
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-grow px-4 py-14">
        <div className="max-w-5xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-12">
            <Image
              src="/thanima_logo.jpg"
              alt="Thanima"
              width={72}
              height={72}
              className="mx-auto mb-6 border border-border"
            />
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Thanima</p>
            <h1 className="mt-2 font-serif text-4xl sm:text-5xl lg:text-6xl tracking-tight text-gradient-name leading-[1.05]">
              Ticketing Portal
            </h1>
            <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
              Find your event below, confirm your details, and get your ticket.
            </p>
          </div>

          {/* Public events */}
          {events.length === 0 ? (
            <BoxyFrame className="max-w-md mx-auto bg-card/40 p-8 text-center">
              <div className="w-14 h-14 mx-auto mb-4 bg-card border border-border flex items-center justify-center">
                <svg className="w-7 h-7 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-foreground mb-2">No Events Yet</h2>
              <p className="text-muted-foreground text-sm">No events are currently available. Please check back soon.</p>
            </BoxyFrame>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event, i) => {
                const id = String(event._id);
                return (
                  <BoxyFrame key={id} className="bg-card/40">
                    <div className="flex flex-col h-full">
                      <div className="flex-1 p-6">
                        <h3 className="font-serif text-3xl sm:text-4xl tracking-tight text-gradient-name leading-tight" style={{ animationDelay: `-${i * 1.6}s` }}>{event.title}</h3>
                        <div className="mt-3 flex items-center gap-2 text-muted-foreground text-sm">
                          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {format(new Date(event.date), 'MMM d, yyyy · h:mm a')}
                        </div>
                        {event.description && (
                          <p className="mt-3 text-muted-foreground text-sm line-clamp-3">{event.description}</p>
                        )}
                      </div>
                      {/* Bottom action strip (the strip itself is the button) */}
                      {event.isPublicDownload ? (
                        <Link
                          href={`/event/${id}`}
                          className="group flex items-center justify-between gap-2 border-t border-border px-6 min-h-[60px] bg-foreground text-background font-semibold hover:bg-foreground/90 transition-colors"
                        >
                          Download Ticket
                          <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-background text-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17L17 7M7 7h10v10" />
                            </svg>
                          </span>
                        </Link>
                      ) : (
                        <div className="flex items-center border-t border-border px-6 min-h-[60px]">
                          <span className="text-sm text-muted-foreground">Tickets are sent to registrants by email.</span>
                        </div>
                      )}
                    </div>
                  </BoxyFrame>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border py-6">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p className="text-muted-foreground text-sm">&copy; 2026 Thanima. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
