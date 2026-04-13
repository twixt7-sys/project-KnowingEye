import { Link, useParams } from "react-router";
import { CheckCircle, Home, FileText } from "lucide-react";
import { useEffect, useState } from "react";

export function ExamSubmitted() {
  const { examId } = useParams();
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setProcessing(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {processing ? (
          <>
            <div className="w-20 h-20 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-6" />
            <h2 className="text-2xl font-semibold mb-2">
              Processing Your Exam...
            </h2>
            <p className="text-muted-foreground">
              Analyzing your responses and behavior data
            </p>
          </>
        ) : (
          <>
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-3xl font-bold mb-4">Exam Submitted!</h1>
            <p className="text-lg text-muted-foreground mb-8">
              Your exam has been successfully submitted. You can now view your
              results and behavioral analysis.
            </p>

            <div className="bg-card rounded-xl border border-border p-6 mb-6 text-left">
              <h3 className="font-semibold mb-4">What's Next?</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span>
                    Your answers are being graded automatically
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span>
                    AI models are analyzing your behavioral data
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span>
                    Results will be available shortly
                  </span>
                </li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to={`/student/exam/${examId}/results`}
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-primary to-secondary text-white font-medium hover:opacity-90 transition-opacity"
              >
                <FileText className="w-5 h-5" />
                View Results
              </Link>
              <Link
                to="/student/dashboard"
                className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-border hover:bg-accent transition-colors"
              >
                <Home className="w-5 h-5" />
                Dashboard
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
