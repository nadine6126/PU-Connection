import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap, Users, MessageCircle, Calendar, HelpCircle, BookOpen, ArrowRight } from "lucide-react";

const features = [
  { icon: Users, title: "Study Groups", description: "Find or create study groups for any course and collaborate with peers." },
  { icon: MessageCircle, title: "Community", description: "Connect with fellow students, share experiences, and build your network." },
  { icon: HelpCircle, title: "Anonymous Q&A", description: "Ask questions freely with optional anonymity. Get answers from the community." },
  { icon: Calendar, title: "Events", description: "Discover campus events, workshops, hackathons, and career fairs." },
  { icon: BookOpen, title: "AI Study Tools", description: "AI-powered summaries and chatbot to help you learn more efficiently." },
];

const LandingPage = () => (
  <div className="min-h-screen bg-background">
    {/* Nav */}
    <nav className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold text-foreground">PU Academic Hub</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login">
            <Button variant="ghost">Sign In</Button>
          </Link>
          <Link to="/login">
            <Button>Get Started</Button>
          </Link>
        </div>
      </div>
    </nav>

    {/* Hero */}
    <section className="container mx-auto px-4 py-24 text-center">
      <div className="max-w-3xl mx-auto animate-fade-in">
        <h1 className="text-4xl md:text-5xl font-bold text-foreground leading-tight">
          Your Campus,{" "}
          <span className="text-primary">Connected</span>
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
          Study smarter together. Join study groups, ask questions, discover events, and collaborate with AI-powered tools.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link to="/login">
            <Button size="lg">
              Start Learning <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
          <Button variant="outline" size="lg">Learn More</Button>
        </div>
      </div>
    </section>

    {/* Features */}
    <section className="container mx-auto px-4 pb-24">
      <div className="text-center mb-12">
        <h2 className="text-2xl font-bold text-foreground">Everything You Need</h2>
        <p className="text-muted-foreground mt-2">Tools designed for academic success.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {features.map((f) => (
          <Card key={f.title} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                <f.icon className="w-5 h-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">{f.title}</h3>
              <p className="text-sm text-muted-foreground mt-1">{f.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>

    {/* Footer */}
    <footer className="border-t py-8 text-center text-sm text-muted-foreground">
      <p>© 2025 PU Academic Hub. Built for students, by students.</p>
    </footer>
  </div>
);

export default LandingPage;
