interface StepIndicatorProps {
  currentStep: number;
  steps: Array<{
    title: string;
    description: string;
  }>;
}

export default function StepIndicator({ currentStep, steps }: StepIndicatorProps) {
  return (
    <div className="surface-card p-5">
      <div className="flex flex-col gap-4 lg:flex-row">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isActive = stepNumber === currentStep;
          const isComplete = stepNumber < currentStep;

          return (
            <div key={step.title} className="flex flex-1 items-start gap-4">
              <div className="flex items-center gap-4 lg:flex-col lg:items-start">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border text-sm font-semibold ${
                    isComplete
                      ? "border-emerald-400/35 bg-emerald-400/15 text-emerald-800 dark:text-emerald-200"
                      : isActive
                        ? "border-orange-400/35 bg-orange-400/15 text-orange-800 dark:text-orange-100"
                        : "border-overlay/10 bg-overlay/[0.03] text-ink-400"
                  }`}
                >
                  {stepNumber}
                </div>
                {index !== steps.length - 1 && <div className="hidden h-12 w-px bg-overlay/10 lg:block" />}
              </div>
              <div>
                <p className={`text-sm font-semibold ${isActive || isComplete ? "text-ink-50" : "text-ink-500"}`}>
                  {step.title}
                </p>
                <p className="mt-1 text-sm leading-6 text-ink-400">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
