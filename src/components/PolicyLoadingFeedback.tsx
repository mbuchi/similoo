import type { ReactNode } from 'react';
import { LoadingFeedback } from '@aireon/shared';

interface PolicyLoadingFeedbackProps {
  skeleton: ReactNode;
  label: string;
}

export function PolicyLoadingFeedback({ skeleton, label }: PolicyLoadingFeedbackProps) {
  return <LoadingFeedback skeleton={skeleton} label={label} />;
}
