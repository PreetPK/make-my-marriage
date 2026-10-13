import Link from "next/link";
import type { ReactNode } from "react";
import type { SetupStep } from "../schemas";
import { SignOutButton } from "@/features/accounts/components/sign-out-button";

const steps = ["Couple details", "Wedding settings", "Venue"];

export function OnboardingShell({
  children,
  step,
}: {
  children: ReactNode;
  step: SetupStep;
}) {
  const headlines = [
    "Let’s begin with you two.",
    "Set the details that keep everything in sync.",
    "Where will you celebrate?",
  ];
  const descriptions = [
    "A few details to bring your wedding workspace together.",
    "Choose how times and amounts appear across your wedding workspace.",
    "Add your main venue, or leave it for later.",
  ];
  return (
    <div className="flex min-h-svh flex-col">
      <a
        href="#onboarding-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-10 focus:bg-background focus:p-3"
      >
        Skip to content
      </a>
      <header className="border-b border-bronze/15">
        <div className="mx-auto flex min-h-20 max-w-[1248px] items-center justify-between gap-4 px-6 md:px-16">
          <Link
            href="/dashboard"
            aria-label="Make My Marriage dashboard"
            className="flex shrink-0 flex-col leading-none"
          >
            <span className="mb-1 text-[10px] font-semibold tracking-[0.25em] text-secondary uppercase">
              Make My
            </span>
            <span className="font-serif text-xl text-primary">Marriage</span>
          </Link>
          <SignOutButton variant="quiet" />
        </div>
      </header>
      <main
        id="onboarding-content"
        className="mx-auto grid w-full max-w-[1248px] flex-1 gap-8 px-6 py-8 md:grid-cols-[2fr_3fr] md:gap-12 md:px-16 md:py-20 lg:gap-16"
      >
        <div className="min-w-0 md:border-r md:border-bronze/20 md:pr-12">
          <div className="mb-6 md:hidden" aria-label="Wedding setup progress">
            <p className="flex justify-between gap-4 text-xs text-secondary">
              <span>Step {step} of 3</span>
              <span>{steps[step - 1]}</span>
            </p>
            <div aria-hidden="true" className="mt-3 flex items-center gap-3">
              {[1, 2, 3].map((number) => (
                <div key={number} className="contents">
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-xs ${number <= step ? "border-primary bg-primary text-white" : "border-bronze/30 text-secondary"}`}
                  >
                    {number < step ? "✓" : number}
                  </span>
                  {number < 3 && <span className="h-px flex-1 bg-bronze/20" />}
                </div>
              ))}
            </div>
          </div>
          <p className="text-[11px] font-semibold tracking-[0.2em] text-secondary uppercase">
            Your wedding workspace
          </p>
          <h1 className="mt-3 max-w-[12ch] font-serif text-[32px] leading-tight text-primary md:text-[44px]">
            <span className="md:hidden">
              {step === 2 ? "A few shared settings." : headlines[step - 1]}
            </span>
            <span className="hidden md:inline">{headlines[step - 1]}</span>
          </h1>
          <p className="mt-4 max-w-[32ch] text-base leading-6 text-secondary">
            {descriptions[step - 1]}
          </p>
          <div className="mt-8 hidden border-t border-bronze/20 pt-5 md:block">
            <p className="text-xs text-secondary">Step {step} of 3</p>
            <ol aria-label="Wedding setup steps" className="mt-4 space-y-4">
              {steps.map((title, index) => (
                <li
                  key={title}
                  aria-current={index + 1 === step ? "step" : undefined}
                  className={`flex items-center gap-3 text-sm ${index + 1 === step ? "text-primary" : "text-secondary"}`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full border text-xs ${index + 1 === step ? "border-primary bg-primary text-white" : "border-bronze/30"}`}
                  >
                    {index + 1 < step ? "✓" : index + 1}
                  </span>
                  {title}
                </li>
              ))}
            </ol>
          </div>
        </div>
        {children}
      </main>
      <footer className="border-t border-bronze/15 px-6 py-6 text-center text-xs leading-5 text-secondary">
        Make My Marriage · Wedding workspace
      </footer>
    </div>
  );
}
