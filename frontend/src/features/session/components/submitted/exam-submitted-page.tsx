import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { CheckCircle, FileText, Home, Loader2 } from "lucide-react";

import { StepFlow } from "@/shared/components/patterns/step-flow";
import { Button } from "@/shared/components/ui/button";

const submissionSteps = [
  { id: "processing", label: "Processing", icon: Loader2 },
  { id: "complete", label: "Complete", icon: CheckCircle },
] as const;

type SubmissionStep = (typeof submissionSteps)[number]["id"];

export function ExamSubmittedPage() {
  const { examId } = useParams();
  const [step, setStep] = useState<SubmissionStep>("processing");

  useEffect(() => {
    const timer = setTimeout(() => setStep("complete"), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <StepFlow step={step} steps={[...submissionSteps]} className="mb-8" />

        {step === "processing" ? (
          <>
            <div className="mx-auto mb-6 h-20 w-20 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
            <h2 className="mb-2 text-2xl font-semibold">Processing Your Exam...</h2>
            <p className="text-muted-foreground">
              Analyzing your responses and behavior data
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-status-safe">
              <CheckCircle className="h-12 w-12 text-white" />
            </div>
            <h1 className="mb-4 text-3xl font-bold">Exam Submitted!</h1>
            <p className="mb-8 text-lg text-muted-foreground">
              Your exam has been successfully submitted. You can now view your results and
              behavioral analysis.
            </p>

            <div className="mb-6 rounded-xl border border-border bg-card p-6 text-left">
              <h3 className="mb-4 font-semibold">What&apos;s Next?</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <div className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>Your answers are being graded automatically</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>AI models are analyzing your behavioral data</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>Results will be available shortly</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button asChild className="flex-1">
                <Link to={`/examinee/exam/${examId}/results`}>
                  <FileText className="h-5 w-5" />
                  View Results
                </Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link to="/examinee">
                  <Home className="h-5 w-5" />
                  Dashboard
                </Link>
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
