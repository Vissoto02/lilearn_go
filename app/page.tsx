'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  Brain,
  Calendar,
  Target,
  ArrowRight,
  Sparkles,
  BookOpen,
  Trophy,
  BarChart3,
  Zap,
  Users,
  Star,
  ChevronRight,
  Play,
} from 'lucide-react';

/* ============================================================================
   DECORATIVE COMPONENTS
   ============================================================================ */

function FloatingOrb({
  className,
  size = 'md',
  color = 'purple',
}: {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  color?: 'purple' | 'blue' | 'lavender';
}) {
  const sizes = { sm: 'w-32 h-32', md: 'w-64 h-64', lg: 'w-96 h-96' };
  const colors = {
    purple: 'from-violet-400/30 to-purple-600/10',
    blue: 'from-blue-400/20 to-indigo-500/10',
    lavender: 'from-violet-200/40 to-fuchsia-300/10',
  };

  return (
    <div
      className={`absolute rounded-full bg-gradient-radial ${sizes[size]} ${colors[color]} blur-3xl pointer-events-none ${className}`}
    />
  );
}

function GlowDot({ className }: { className?: string }) {
  return (
    <div
      className={`absolute w-1.5 h-1.5 rounded-full bg-violet-400/60 animate-glow-pulse pointer-events-none ${className}`}
    />
  );
}

function GridPattern() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.03] dark:opacity-[0.05]">
      <svg width="100%" height="100%">
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <circle cx="20" cy="20" r="0.6" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
    </div>
  );
}

/* ============================================================================
   INTERSECTION OBSERVER HOOK — animate sections on scroll
   ============================================================================ */

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-reveal-up');
            entry.target.classList.remove('opacity-0', 'translate-y-8');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -50px 0px' }
    );

    const children = el.querySelectorAll('[data-reveal]');
    children.forEach((child) => observer.observe(child));

    return () => observer.disconnect();
  }, []);

  return ref;
}

/* ============================================================================
   FEATURE CARD — Glassmorphism feature presentation
   ============================================================================ */

function FeatureCard({
  icon,
  title,
  description,
  gradient,
  delay = '0ms',
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
  delay?: string;
}) {
  return (
    <div
      data-reveal
      className="opacity-0 translate-y-8 group relative overflow-hidden rounded-2xl border border-violet-200/30 dark:border-violet-500/10 bg-white/70 dark:bg-white/5 backdrop-blur-sm p-6 sm:p-8 transition-all duration-500 hover:shadow-brand hover:border-violet-300/50 dark:hover:border-violet-400/20 hover:-translate-y-1"
      style={{ animationDelay: delay }}
    >
      {/* Gradient accent line */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 ${gradient}`} />

      {/* Icon */}
      <div
        className={`inline-flex items-center justify-center w-12 h-12 rounded-xl ${gradient} mb-5 shadow-lg`}
      >
        {icon}
      </div>

      <h3 className="text-lg font-semibold font-display mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">
        {description}
      </p>

      {/* Hover glow */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none bg-gradient-to-br from-violet-500/5 to-transparent" />
    </div>
  );
}

/* ============================================================================
   STEP CARD — How it works flow
   ============================================================================ */

function StepCard({
  step,
  title,
  description,
  icon,
}: {
  step: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div data-reveal className="opacity-0 translate-y-8 relative flex gap-5">
      {/* Step number with gradient ring */}
      <div className="relative shrink-0">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white font-bold text-lg font-display shadow-lg shadow-violet-500/25">
          {step}
        </div>
        {step < 3 && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 w-px h-16 bg-gradient-to-b from-violet-300 to-transparent dark:from-violet-500/40" />
        )}
      </div>

      {/* Content */}
      <div className="pt-1 pb-10">
        <div className="flex items-center gap-2 mb-1.5">
          {icon}
          <h3 className="font-semibold font-display text-lg">{title}</h3>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
          {description}
        </p>
      </div>
    </div>
  );
}

/* ============================================================================
   TESTIMONIAL CARD
   ============================================================================ */

function TestimonialCard({
  quote,
  name,
  role,
  avatar,
}: {
  quote: string;
  name: string;
  role: string;
  avatar: string;
}) {
  return (
    <div
      data-reveal
      className="opacity-0 translate-y-8 rounded-2xl border border-violet-200/30 dark:border-violet-500/10 bg-white/60 dark:bg-white/5 backdrop-blur-sm p-6 transition-all hover:shadow-brand-sm"
    >
      {/* Stars */}
      <div className="flex gap-0.5 mb-4">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className="w-4 h-4 fill-amber-400 text-amber-400"
          />
        ))}
      </div>
      <p className="text-sm text-foreground/80 leading-relaxed mb-5 italic">
        &ldquo;{quote}&rdquo;
      </p>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center text-white text-sm font-bold">
          {avatar}
        </div>
        <div>
          <p className="text-sm font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">{role}</p>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   LANDING PAGE
   ============================================================================ */

export default function LandingPage() {
  const sectionsRef = useScrollReveal();

  return (
    <div ref={sectionsRef} className="flex min-h-screen flex-col overflow-hidden">
      {/* ===================================================================
          NAVIGATION
          =================================================================== */}
      <header className="sticky top-0 z-50 glass-strong">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5 group">
            <Image
              src="/logo_only.png"
              alt="LiLearn"
              width={36}
              height={36}
              className="transition-transform group-hover:scale-105"
            />
            <span className="text-xl font-bold font-display text-gradient-purple">
              LiLearn
            </span>
          </Link>

          <div className="hidden sm:flex items-center gap-6 text-sm">
            <Link
              href="#features"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              How It Works
            </Link>
            <Link
              href="#testimonials"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Students
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:inline-block"
            >
              Sign in
            </Link>
            <Link href="/auth/sign-up">
              <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-lg shadow-violet-500/25 rounded-xl px-5 text-sm font-medium">
                Get Started
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        {/* ===================================================================
            HERO SECTION — Asymmetric, immersive, gradient mesh
            =================================================================== */}
        <section className="relative min-h-[90vh] flex items-center overflow-hidden">
          {/* Background mesh */}
          <div className="absolute inset-0 gradient-mesh dark:gradient-mesh-dark" />
          <GridPattern />

          {/* Floating orbs */}
          <FloatingOrb
            size="lg"
            color="purple"
            className="top-[-10%] right-[-8%] animate-float-slow"
          />
          <FloatingOrb
            size="md"
            color="blue"
            className="bottom-[5%] left-[-5%] animate-float-delayed"
          />
          <FloatingOrb
            size="sm"
            color="lavender"
            className="top-[30%] right-[15%] animate-float"
          />

          {/* Glow dots */}
          <GlowDot className="top-[20%] left-[10%]" />
          <GlowDot className="top-[60%] right-[20%] animation-delay-500" />
          <GlowDot className="top-[40%] left-[40%] animation-delay-300" />
          <GlowDot className="top-[75%] left-[25%] animation-delay-700" />
          <GlowDot className="top-[15%] right-[35%] animation-delay-1000" />

          {/* Content */}
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 sm:py-28">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left — Copy */}
              <div className="max-w-xl">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 rounded-full border border-violet-200/50 dark:border-violet-500/20 bg-white/60 dark:bg-white/5 backdrop-blur-sm px-4 py-1.5 text-sm text-violet-700 dark:text-violet-300 mb-6 animate-reveal-up">
                  <Sparkles className="h-4 w-4" />
                  AI-Powered Adaptive Learning
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold font-display tracking-tight leading-[1.1] animate-reveal-up animation-delay-100">
                  Study smarter,{' '}
                  <span className="text-gradient">not harder</span>
                </h1>

                <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-lg animate-reveal-up animation-delay-200">
                  Upload your syllabus, take AI-generated quizzes, and let
                  LiLearn's adaptive engine create a personalized study plan
                  that focuses exactly where you need it.
                </p>

                {/* CTAs */}
                <div className="mt-8 flex flex-col sm:flex-row items-start gap-4 animate-reveal-up animation-delay-300">
                  <Link href="/auth/sign-up">
                    <Button
                      size="lg"
                      className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-xl shadow-violet-500/25 rounded-xl px-8 text-base font-semibold h-12 hover:scale-[1.02] transition-transform"
                    >
                      Start Free Today
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  <Link href="#how-it-works">
                    <Button
                      variant="outline"
                      size="lg"
                      className="rounded-xl px-8 h-12 border-violet-200/50 dark:border-violet-500/20 hover:bg-violet-50 dark:hover:bg-violet-500/10"
                    >
                      <Play className="mr-2 h-4 w-4" />
                      See How It Works
                    </Button>
                  </Link>
                </div>
              </div>

              {/* Right — Product preview (floating card composition) */}
              <div className="relative hidden lg:block">
                {/* Main dashboard card */}
                <div className="relative rounded-3xl overflow-hidden border border-violet-200/40 dark:border-violet-500/15 shadow-brand-lg bg-white/80 dark:bg-gray-900/80 backdrop-blur-md p-6 animate-reveal-right animation-delay-300">
                  {/* Mini stat cards row */}
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    {[
                      { label: 'Streak', value: '12 days', color: 'from-orange-400 to-rose-500' },
                      { label: 'Accuracy', value: '87%', color: 'from-violet-500 to-indigo-500' },
                      { label: 'Topics', value: '24', color: 'from-emerald-400 to-teal-500' },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-xl border border-violet-100/50 dark:border-violet-500/10 bg-white/90 dark:bg-white/5 p-3"
                      >
                        <p className="text-[11px] text-muted-foreground mb-0.5">
                          {stat.label}
                        </p>
                        <p className="text-lg font-bold font-display">
                          {stat.value}
                        </p>
                        <div
                          className={`h-1 rounded-full bg-gradient-to-r ${stat.color} mt-2 opacity-60`}
                          style={{
                            width: `${stat.label === 'Accuracy' ? '87' : stat.label === 'Streak' ? '60' : '100'}%`,
                          }}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Mini calendar grid */}
                  <div className="rounded-xl border border-violet-100/50 dark:border-violet-500/10 bg-white/90 dark:bg-white/5 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold text-muted-foreground">
                        This Week
                      </span>
                      <span className="text-xs text-violet-500 font-medium">
                        5 sessions planned
                      </span>
                    </div>
                    <div className="grid grid-cols-7 gap-1.5">
                      {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                        <div key={i} className="text-center">
                          <p className="text-[10px] text-muted-foreground mb-1">
                            {day}
                          </p>
                          <div
                            className={`w-full aspect-square rounded-lg flex items-center justify-center text-[10px] font-medium ${
                              [0, 2, 4].includes(i)
                                ? 'bg-gradient-to-br from-violet-500 to-indigo-500 text-white'
                                : i === 1
                                  ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300'
                                  : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {10 + i}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Floating quiz card */}
                <div className="absolute -bottom-4 -left-8 w-56 rounded-2xl border border-violet-200/40 dark:border-violet-500/15 shadow-brand bg-white/90 dark:bg-gray-900/90 backdrop-blur-md p-4 animate-float-delayed">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                      <Brain className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-xs font-semibold">AI Quiz</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    Photosynthesis MCQ
                  </p>
                  <div className="space-y-1.5">
                    {['Light reaction', 'Calvin cycle', 'ATP synthesis'].map(
                      (opt, i) => (
                        <div
                          key={opt}
                          className={`text-[10px] px-2.5 py-1.5 rounded-lg border ${
                            i === 1
                              ? 'border-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                              : 'border-violet-100/50 dark:border-violet-500/10'
                          }`}
                        >
                          {opt}
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Floating achievement badge */}
                <div className="absolute -top-3 -right-4 w-44 rounded-2xl border border-violet-200/40 dark:border-violet-500/15 shadow-brand bg-white/90 dark:bg-gray-900/90 backdrop-blur-md p-3 animate-float">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                      <Trophy className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold">5-Day Streak!</p>
                      <p className="text-[10px] text-muted-foreground">
                        Keep going! 🔥
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            FEATURES — Cinematic storytelling, not generic card grid
            =================================================================== */}
        <section id="features" className="relative py-24 sm:py-32">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-50/50 to-transparent dark:from-transparent dark:via-violet-500/5 dark:to-transparent pointer-events-none" />

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {/* Section header */}
            <div data-reveal className="opacity-0 translate-y-8 max-w-2xl mb-16">
              <p className="text-sm font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-3 font-display">
                Everything You Need
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold font-display tracking-tight">
                A complete AI study companion{' '}
                <span className="text-gradient">built for how you learn</span>
              </h2>
              <p className="mt-4 text-muted-foreground text-lg leading-relaxed">
                Not just another study app — LiLearn understands your weaknesses
                and adapts in real-time.
              </p>
            </div>

            {/* Feature cards — staggered grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <FeatureCard
                icon={<Brain className="w-6 h-6 text-white" />}
                title="AI Quiz Engine"
                description="Generate unlimited practice quizzes from your topics. Intelligent question variety with MCQ, True/False, and fill-in-the-blank formats."
                gradient="bg-gradient-to-r from-violet-500 to-purple-600"
                delay="0ms"
              />
              <FeatureCard
                icon={<Calendar className="w-6 h-6 text-white" />}
                title="Adaptive Study Planner"
                description="Get a personalized weekly schedule that automatically adjusts based on your quiz performance, weak areas, and available time."
                gradient="bg-gradient-to-r from-indigo-500 to-blue-600"
                delay="100ms"
              />
              <FeatureCard
                icon={<Target className="w-6 h-6 text-white" />}
                title="Habit Tracking"
                description="Build consistent study habits with daily check-ins, streak tracking, and a beautiful activity heatmap that keeps you motivated."
                gradient="bg-gradient-to-r from-emerald-500 to-teal-600"
                delay="200ms"
              />
              <FeatureCard
                icon={<BarChart3 className="w-6 h-6 text-white" />}
                title="Performance Insights"
                description="Visual analytics that reveal your strengths and weak spots. See exactly which topics need more attention with data-driven insights."
                gradient="bg-gradient-to-r from-amber-500 to-orange-600"
                delay="300ms"
              />
              <FeatureCard
                icon={<Trophy className="w-6 h-6 text-white" />}
                title="Leaderboard & Rankings"
                description="Compete with fellow students on the leaderboard. Earn points through validated study sessions and climb the ranks."
                gradient="bg-gradient-to-r from-rose-500 to-pink-600"
                delay="400ms"
              />
              <FeatureCard
                icon={<Zap className="w-6 h-6 text-white" />}
                title="Revision Sessions"
                description="Structured revision mode with proof-of-study validation. AI verifies your learning through quizzes after each session."
                gradient="bg-gradient-to-r from-violet-600 to-indigo-700"
                delay="500ms"
              />
            </div>
          </div>
        </section>

        {/* ===================================================================
            HOW IT WORKS — Vertical flow with connected steps
            =================================================================== */}
        <section
          id="how-it-works"
          className="relative py-24 sm:py-32 overflow-hidden"
        >
          <FloatingOrb
            size="md"
            color="lavender"
            className="top-[10%] right-[-10%] animate-float-slow"
          />

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-start">
              {/* Left — Steps */}
              <div>
                <div data-reveal className="opacity-0 translate-y-8 mb-12">
                  <p className="text-sm font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-3 font-display">
                    How It Works
                  </p>
                  <h2 className="text-3xl sm:text-4xl font-bold font-display tracking-tight">
                    From upload to{' '}
                    <span className="text-gradient">mastery</span>
                  </h2>
                  <p className="mt-4 text-muted-foreground text-lg">
                    Three simple steps to transform your study routine.
                  </p>
                </div>

                <div className="space-y-2">
                  <StepCard
                    step={1}
                    icon={<BookOpen className="w-4 h-4 text-violet-500" />}
                    title="Upload Your Content"
                    description="Paste your syllabus, upload documents, or add topics manually. LiLearn organizes everything into subjects and topics for you."
                  />
                  <StepCard
                    step={2}
                    icon={<Brain className="w-4 h-4 text-indigo-500" />}
                    title="Take AI Quizzes"
                    description="Generate practice quizzes that test your knowledge. The AI tracks every answer to build a detailed picture of your strengths and weaknesses."
                  />
                  <StepCard
                    step={3}
                    icon={<Sparkles className="w-4 h-4 text-blue-500" />}
                    title="Follow Your Adaptive Plan"
                    description="Get a personalized study schedule that prioritizes topics you struggle with. The plan evolves as you improve."
                  />
                </div>
              </div>

              {/* Right — Visual showcase */}
              <div data-reveal className="opacity-0 translate-y-8 relative hidden lg:block sticky top-24">
                {/* Adaptive plan visualization */}
                <div className="rounded-3xl overflow-hidden border border-violet-200/40 dark:border-violet-500/15 shadow-brand-lg bg-white/80 dark:bg-gray-900/80 backdrop-blur-md">
                  {/* Header */}
                  <div className="px-6 py-4 border-b border-violet-100/50 dark:border-violet-500/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500" />
                      <span className="text-sm font-semibold font-display">
                        Your Adaptive Plan
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      This Week
                    </span>
                  </div>

                  {/* Plan items */}
                  <div className="p-5 space-y-3">
                    {[
                      {
                        time: '9:00 AM',
                        subject: 'Mathematics',
                        topic: 'Algebra II',
                        priority: 'high',
                        color: 'from-rose-500 to-orange-500',
                      },
                      {
                        time: '11:00 AM',
                        subject: 'Biology',
                        topic: 'Cell Division',
                        priority: 'medium',
                        color: 'from-emerald-500 to-teal-500',
                      },
                      {
                        time: '2:00 PM',
                        subject: 'Physics',
                        topic: 'Thermodynamics',
                        priority: 'high',
                        color: 'from-violet-500 to-indigo-500',
                      },
                      {
                        time: '4:00 PM',
                        subject: 'Chemistry',
                        topic: 'Organic Reactions',
                        priority: 'low',
                        color: 'from-blue-500 to-cyan-500',
                      },
                    ].map((item) => (
                      <div
                        key={item.topic}
                        className="flex items-center gap-4 p-3 rounded-xl border border-violet-100/40 dark:border-violet-500/10 bg-white/60 dark:bg-white/5 hover:bg-violet-50/50 dark:hover:bg-violet-500/5 transition-colors"
                      >
                        <div
                          className={`w-1.5 h-10 rounded-full bg-gradient-to-b ${item.color}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">
                              {item.subject}
                            </span>
                            {item.priority === 'high' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300 font-medium">
                                Focus Area
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {item.topic}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {item.time}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* AI insight bar */}
                  <div className="mx-5 mb-5 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-500/10 to-indigo-500/10 border border-violet-200/30 dark:border-violet-500/10 flex items-center gap-3">
                    <Sparkles className="w-4 h-4 text-violet-500 shrink-0" />
                    <p className="text-xs text-violet-700 dark:text-violet-300">
                      <span className="font-medium">AI Insight:</span> Focus on
                      Algebra II — your accuracy dropped 15% this week.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            TESTIMONIALS — Organic staggered layout
            =================================================================== */}
        <section
          id="testimonials"
          className="relative py-24 sm:py-32 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-50/30 to-transparent dark:from-transparent dark:via-violet-500/3 dark:to-transparent pointer-events-none" />

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div data-reveal className="opacity-0 translate-y-8 text-center mb-14">
              <p className="text-sm font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-3 font-display">
                Student Voices
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold font-display tracking-tight">
                Loved by students who{' '}
                <span className="text-gradient">want results</span>
              </h2>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <TestimonialCard
                quote="LiLearn's quizzes actually pinpointed my weak areas in Organic Chemistry. My scores went from 55% to 82% in just two weeks."
                name="Yee Chin Chieh"
                role="Information Technology Student"
                avatar="Y"
              />
              <TestimonialCard
                quote="The adaptive planner is a game-changer. It adjusts my study schedule based on how I actually perform, not just guessing."
                name="Ng Yang Lian"
                role="Information Technology Student"
                avatar="N"
              />
              <TestimonialCard
                quote="I love the streak tracking and leaderboard. It makes studying competitive in a healthy way. My study time went up 3x."
                name="Aloysius Lim"
                role="Information Technology Student"
                avatar="A"
              />
            </div>
          </div>
        </section>

        {/* ===================================================================
            FUTURE VISION — Lecturer dashboard teaser
            =================================================================== */}
        <section className="relative py-24 sm:py-32 overflow-hidden">
          <FloatingOrb
            size="lg"
            color="blue"
            className="bottom-[-20%] left-[-10%] animate-float-slow"
          />

          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Visual */}
              <div data-reveal className="opacity-0 translate-y-8 order-2 lg:order-1">
                <div className="rounded-3xl overflow-hidden border border-violet-200/40 dark:border-violet-500/15 shadow-brand bg-white/60 dark:bg-gray-900/60 backdrop-blur-md p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
                      <Users className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold font-display">
                        Lecturer Dashboard
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Coming Soon
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {/* Mini stats */}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Students', val: '142' },
                        { label: 'Avg Score', val: '72%' },
                        { label: 'Active', val: '89%' },
                      ].map((s) => (
                        <div
                          key={s.label}
                          className="rounded-xl bg-violet-50/50 dark:bg-violet-500/5 p-3 text-center"
                        >
                          <p className="text-lg font-bold font-display">
                            {s.val}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {s.label}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Placeholder chart bars */}
                    <div className="rounded-xl border border-violet-100/40 dark:border-violet-500/10 p-4">
                      <p className="text-xs font-medium mb-3">
                        Class Performance
                      </p>
                      <div className="flex items-end gap-2 h-20">
                        {[40, 65, 55, 80, 70, 90, 75].map((h, i) => (
                          <div
                            key={i}
                            className="flex-1 rounded-t-md bg-gradient-to-t from-violet-500 to-indigo-400 opacity-60"
                            style={{ height: `${h}%` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Copy */}
              <div
                data-reveal
                className="opacity-0 translate-y-8 order-1 lg:order-2"
              >
                <p className="text-sm font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wider mb-3 font-display">
                  Coming Soon
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold font-display tracking-tight">
                  LiLearn for{' '}
                  <span className="text-gradient">lecturers</span>
                </h2>
                <p className="mt-4 text-muted-foreground text-lg leading-relaxed">
                  A dedicated dashboard for educators to track class performance,
                  identify struggling students early, and get AI-powered
                  recommendations for teaching adjustments.
                </p>
                <ul className="mt-6 space-y-3">
                  {[
                    'Class-wide performance analytics',
                    'Early warning for at-risk students',
                    'AI-suggested teaching focus areas',
                    'Automated quiz distribution',
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3 text-sm">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shrink-0">
                        <ChevronRight className="w-3 h-3 text-white" />
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ===================================================================
            FINAL CTA — Gradient glass with brand mesh
            =================================================================== */}
        <section className="relative py-24 sm:py-32 overflow-hidden">
          <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
            <div
              data-reveal
              className="opacity-0 translate-y-8 relative rounded-3xl overflow-hidden p-10 sm:p-16 text-center"
            >
              {/* Background gradient */}
              <div className="absolute inset-0 bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-700 opacity-95" />
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(255,255,255,0.15),transparent)]" />

              {/* Floating dots overlay */}
              <div className="absolute inset-0 opacity-20">
                <div className="absolute w-2 h-2 bg-white rounded-full top-[15%] left-[10%] animate-float" />
                <div className="absolute w-1.5 h-1.5 bg-white rounded-full top-[60%] left-[20%] animate-float-delayed" />
                <div className="absolute w-1 h-1 bg-white rounded-full top-[30%] right-[15%] animate-float-slow" />
                <div className="absolute w-2 h-2 bg-white rounded-full bottom-[20%] right-[25%] animate-float" />
              </div>

              <div className="relative">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-sm px-4 py-1.5 text-sm text-white/90 mb-6">
                  <Sparkles className="w-4 h-4" />
                  Free to get started
                </div>

                <h2 className="text-3xl sm:text-4xl font-bold font-display text-white tracking-tight">
                  Ready to transform your study routine?
                </h2>
                <p className="mt-4 text-lg text-white/75 max-w-lg mx-auto">
                  Join hundreds of students who are studying smarter with
                  LiLearn. Start your personalized learning journey today.
                </p>

                <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Link href="/auth/sign-up">
                    <Button
                      size="lg"
                      className="bg-white text-violet-700 hover:bg-white/90 shadow-xl rounded-xl px-8 h-12 font-semibold text-base hover:scale-[1.02] transition-transform"
                    >
                      Get Started Free
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </Link>
                  <Link href="/auth/login">
                    <Button
                      variant="ghost"
                      size="lg"
                      className="text-white/80 hover:text-white hover:bg-white/10 rounded-xl px-8 h-12"
                    >
                      Sign in
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ===================================================================
          FOOTER
          =================================================================== */}
      <footer className="border-t border-violet-200/30 dark:border-violet-500/10 bg-white/50 dark:bg-transparent backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2.5">
              <Image
                src="/logo_only.png"
                alt="LiLearn"
                width={28}
                height={28}
              />
              <span className="font-bold font-display text-gradient-purple">
                LiLearn
              </span>
            </div>

            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link
                href="#features"
                className="hover:text-foreground transition-colors"
              >
                Features
              </Link>
              <Link
                href="#how-it-works"
                className="hover:text-foreground transition-colors"
              >
                How It Works
              </Link>
              <Link
                href="/auth/sign-up"
                className="hover:text-foreground transition-colors"
              >
                Get Started
              </Link>
            </div>

            <p className="text-xs text-muted-foreground">
              © 2026 LiLearn. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
