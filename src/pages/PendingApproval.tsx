import { useState } from "react";
import { Truck, Clock, Mail, LogOut, BookOpen, CheckCircle2, Users, BarChart3, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

const trainingModules = [
  {
    title: "Dispatch Operations",
    description: "Learn how to manage daily dispatch, assign crews to trucks, and track real-time trip status.",
    icon: Truck,
    duration: "5 min read",
    topics: ["Dispatch Board overview", "Status workflow (pending → completed)", "Alert management"],
  },
  {
    title: "Patient Scheduling",
    description: "Understand how to set up recurring dialysis runs, outpatient transports, and ad-hoc trips.",
    icon: Users,
    duration: "7 min read",
    topics: ["Scheduling legs (A-leg / B-leg)", "Template builder", "Run pool management"],
  },
  {
    title: "Billing & Claims",
    description: "Walk through the claims lifecycle from trip completion to payer submission.",
    icon: BarChart3,
    duration: "6 min read",
    topics: ["Clean trip validation", "HCPCS coding", "Denial management"],
  },
  {
    title: "Compliance & HIPAA",
    description: "Review compliance requirements, QA review workflows, and audit logging.",
    icon: FileText,
    duration: "4 min read",
    topics: ["QA flag review", "Audit trail", "Session security"],
  },
];

export default function PendingApproval() {
  const { signOut, onboardingStatus } = useAuth();
  const navigate = useNavigate();
  const [expandedModule, setExpandedModule] = useState<number | null>(null);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const isRejected = onboardingStatus === "rejected";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="h-5 w-5 text-primary" />
          <span className="font-bold text-foreground">PodDispatch</span>
          <Badge variant="outline" className="text-[10px] ml-2">
            {isRejected ? "Application Rejected" : "Access Pending"}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2 text-muted-foreground">
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </Button>
      </header>

      <div className="max-w-4xl mx-auto p-4 lg:p-8 space-y-6">
        {/* Status Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Clock className="h-8 w-8 text-primary" />
              </div>

              <h1 className="text-xl font-bold text-foreground mb-2">
                {isRejected ? "Application Not Approved" : "Account Pending Approval"}
              </h1>

              <p className="text-sm text-muted-foreground max-w-md">
                {isRejected
                  ? "Your company application was not approved. Please contact support for more information."
                  : "Your company account is being reviewed by the PodDispatch team. You'll receive an email notification when your account is activated."}
              </p>
            </div>

            <div className="rounded-lg border bg-card p-4 space-y-3 text-sm max-w-sm mx-auto">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Truck className="h-4 w-4 shrink-0" />
                <span>Company setup complete</span>
                <span className="ml-auto text-xs text-[hsl(var(--status-green))]">✓</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4 shrink-0" />
                <span>Legal agreements accepted</span>
                <span className="ml-auto text-xs text-[hsl(var(--status-green))]">✓</span>
              </div>
              <div className="flex items-center gap-2 text-foreground font-medium">
                <Clock className="h-4 w-4 shrink-0 text-[hsl(var(--status-yellow))]" />
                <span>{isRejected ? "Application reviewed" : "Awaiting manual approval"}</span>
                <span className="ml-auto text-xs">
                  {isRejected ? "✗" : "⏳"}
                </span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center mt-4">
              {isRejected
                ? "Contact "
                : "This usually takes less than 24 hours. If you have questions, contact "}
              <span className="font-medium text-foreground">support@poddispatch.com</span>.
            </p>
          </CardContent>
        </Card>

        {/* Training Mode */}
        {!isRejected && (
          <>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold text-foreground">Training Mode</h2>
              <Badge variant="secondary" className="text-[10px]">Available Now</Badge>
            </div>

            <p className="text-sm text-muted-foreground -mt-4">
              While your account is being reviewed, explore how PodDispatch works. These training modules cover every major feature you'll use once approved.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {trainingModules.map((mod, i) => (
                <Card
                  key={i}
                  className="cursor-pointer transition-shadow hover:shadow-md"
                  onClick={() => setExpandedModule(expandedModule === i ? null : i)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-primary/10 p-2">
                          <mod.icon className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-sm font-medium">{mod.title}</CardTitle>
                          <span className="text-[10px] text-muted-foreground">{mod.duration}</span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground mb-2">{mod.description}</p>
                    {expandedModule === i && (
                      <ul className="space-y-1.5 mt-3 border-t pt-3">
                        {mod.topics.map((topic, j) => (
                          <li key={j} className="flex items-center gap-2 text-xs text-foreground">
                            <CheckCircle2 className="h-3 w-3 text-primary shrink-0" />
                            {topic}
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
