import Users from '@/components/pages/Users'
import { createFileRoute } from '@tanstack/react-router'
import { userQueryOptions } from '@/queries/user.query-options'

export const Route = createFileRoute('/_auth/operators')({
  component: RouteComponent,
  loader: async ({ context }) => {
    const { queryClient } = context
    queryClient.prefetchQuery(userQueryOptions.all())
    queryClient.prefetchQuery(userQueryOptions.stats)
    return {}
  },
})

function RouteComponent() {
  return <Users />
}
