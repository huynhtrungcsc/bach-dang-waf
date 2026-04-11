import { Alerts } from '@/components/pages'
import { createFileRoute } from '@tanstack/react-router'
import { notificationChannelQueryOptions, alertRuleQueryOptions } from '@/queries/alerts.query-options'

export const Route = createFileRoute('/_auth/alerting')({
  component: RouteComponent,
  loader: async ({ context }) => {
    const { queryClient } = context

    queryClient.prefetchQuery(notificationChannelQueryOptions.all)
    queryClient.prefetchQuery(alertRuleQueryOptions.all)

    return {}
  },
})

function RouteComponent() {
  return <Alerts />
}
