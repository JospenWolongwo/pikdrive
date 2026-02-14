'use client'

import { CheckCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'

interface NextStepsCardProps {
  readonly isPending: boolean
  readonly t: (key: string) => string
}

export function NextStepsCard({ isPending, t }: NextStepsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          {t("pages.driver.pending.nextSteps.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {isPending ? <PendingSteps t={t} /> : <ApprovedSteps t={t} />}
        </div>
      </CardContent>
    </Card>
  )
}

function StepItem({ step, color, t, titleKey, descKey }: {
  readonly step: number
  readonly color: 'primary' | 'muted' | 'green'
  readonly t: (key: string) => string
  readonly titleKey: string
  readonly descKey: string
}) {
  const colorMap = {
    primary: 'bg-primary text-primary-foreground',
    muted: 'bg-muted text-muted-foreground',
    green: 'bg-green-500 text-white',
  }

  return (
    <div className="flex items-start gap-3">
      <div className={`w-6 h-6 ${colorMap[color]} rounded-full flex items-center justify-center text-xs font-bold`}>
        {step}
      </div>
      <div>
        <p className="font-medium">{t(titleKey)}</p>
        <p className="text-sm text-muted-foreground">{t(descKey)}</p>
      </div>
    </div>
  )
}

function PendingSteps({ t }: { readonly t: (key: string) => string }) {
  return (
    <>
      <StepItem step={1} color="primary" t={t}
        titleKey="pages.driver.pending.nextSteps.pending.step1.title"
        descKey="pages.driver.pending.nextSteps.pending.step1.description"
      />
      <StepItem step={2} color="muted" t={t}
        titleKey="pages.driver.pending.nextSteps.pending.step2.title"
        descKey="pages.driver.pending.nextSteps.pending.step2.description"
      />
      <StepItem step={3} color="muted" t={t}
        titleKey="pages.driver.pending.nextSteps.pending.step3.title"
        descKey="pages.driver.pending.nextSteps.pending.step3.description"
      />
    </>
  )
}

function ApprovedSteps({ t }: { readonly t: (key: string) => string }) {
  return (
    <>
      <StepItem step={1} color="green" t={t}
        titleKey="pages.driver.pending.nextSteps.approved.step1.title"
        descKey="pages.driver.pending.nextSteps.approved.step1.description"
      />
      <StepItem step={2} color="green" t={t}
        titleKey="pages.driver.pending.nextSteps.approved.step2.title"
        descKey="pages.driver.pending.nextSteps.approved.step2.description"
      />
    </>
  )
}
