import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  GraduationCap,
  Brain,
  Calendar,
  Target,
  ArrowRight,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Navigation */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold">LiLearn</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Sign in
            </Link>
            <Link href="/signup">
              <Button>Start Free</Button>
            </Link>
          </div>
        </nav>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden px-4 py-20 sm:py-32">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-muted/50 px-4 py-1.5 text-sm">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>AI-powered adaptive learning</span>
              </div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                Study smarter, not harder with{' '}
                <span className="text-primary">LiLearn</span>
              </h1>
              <p className="mt-6 text-lg text-muted-foreground sm:text-xl">
                Upload your syllabus, get AI-generated quizzes, and let our adaptive
                system create a personalized study plan that focuses on your weak areas.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link href="/signup">
                  <Button size="lg" className="min-w-[200px]">
                    Start Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="#how-it-works">
                  <Button variant="outline" size="lg" className="min-w-[200px]">
                    See How It Works
                  </Button>
                </Link>
              </div>
            </div>
          </div>
          {/* Background gradient */}
          <div className="absolute inset-x-0 top-0 -z-10 h-[500px] bg-gradient-to-b from-primary/5 to-transparent" />
        </section>

        {/* Feature Cards */}
        <section className="px-4 py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Everything you need to ace your exams
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                A complete study companion that adapts to your learning style
              </p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <Card className="group transition-shadow hover:shadow-lg">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
                    <Brain className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>AI Quiz Generator</CardTitle>
                  <CardDescription>
                    Generate unlimited practice quizzes from your topics with
                    intelligent question variety and difficulty scaling.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="group transition-shadow hover:shadow-lg">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
                    <Calendar className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Adaptive Study Plan</CardTitle>
                  <CardDescription>
                    Get a personalized weekly study schedule that automatically
                    adjusts based on your quiz performance and weak areas.
                  </CardDescription>
                </CardHeader>
              </Card>
              <Card className="group transition-shadow hover:shadow-lg sm:col-span-2 lg:col-span-1">
                <CardHeader>
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
                    <Target className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Habit Tracking</CardTitle>
                  <CardDescription>
                    Build consistent study habits with daily check-ins, streak
                    tracking, and progress visualization.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="bg-muted/30 px-4 py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                How it works
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Get started in three simple steps
              </p>
            </div>
            <div className="grid gap-8 md:grid-cols-3">
              {[
                {
                  step: '1',
                  title: 'Upload Your Topics',
                  description:
                    'Paste your syllabus or add topics manually. We\'ll organize them into subjects for easy navigation.',
                },
                {
                  step: '2',
                  title: 'Take Quizzes',
                  description:
                    'Generate practice quizzes and test your knowledge. The system tracks your performance to identify weak areas.',
                },
                {
                  step: '3',
                  title: 'Follow Your Plan',
                  description:
                    'Get a personalized study schedule that prioritizes topics you need to work on most.',
                },
              ].map((item) => (
                <div key={item.step} className="relative text-center">
                  <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary bg-background text-xl font-bold text-primary">
                    {item.step}
                  </div>
                  <h3 className="mb-2 text-xl font-semibold">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-4 py-20">
          <div className="mx-auto max-w-6xl">
            <Card className="overflow-hidden bg-primary text-primary-foreground">
              <CardContent className="flex flex-col items-center gap-6 p-8 text-center sm:p-12">
                <h2 className="text-2xl font-bold sm:text-3xl">
                  Ready to transform your study routine?
                </h2>
                <p className="max-w-lg text-primary-foreground/80">
                  Join thousands of students who are studying smarter with LiLearn.
                  Start for free today.
                </p>
                <Link href="/signup">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="min-w-[200px]"
                  >
                    Get Started Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-primary">
                <GraduationCap className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold">LiLearn</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 LiLearn. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
