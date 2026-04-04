import { useState } from "react";
import { HelpCircle, X, ChevronDown } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PAGE_HELP_QA } from "./helpContentQA";

interface ContextualHelpPanelProps {
  routeKey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContextualHelpPanel({ routeKey, open, onOpenChange }: ContextualHelpPanelProps) {
  const help = PAGE_HELP_QA[routeKey];
  if (!help) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <HelpCircle className="h-4 w-4 text-primary shrink-0" />
            {help.title}
          </SheetTitle>
          <p className="text-sm text-muted-foreground">{help.description}</p>
        </SheetHeader>

        <div className="space-y-1">
          {help.questions.map((qa, i) => (
            <QAItem key={i} question={qa.q} answer={qa.a} />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function QAItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-start gap-2 w-full text-left rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors">
        <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 mt-0.5 transition-transform ${open ? "rotate-0" : "-rotate-90"}`} />
        <span className="flex-1">{question}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-2">
        <p className="text-sm text-muted-foreground pl-6 leading-relaxed">{answer}</p>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function HelpIconButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center h-8 w-8 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      title="Help"
    >
      <HelpCircle className="h-4 w-4" />
    </button>
  );
}
