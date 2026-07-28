import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { checkAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ location }) => {
    const auth = await checkAuth();
    if (!auth.authenticated) {
      throw redirect({
        to: "/portal",
        search: {
          redirect: location.href,
        },
      });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <div className="dq-console flex min-h-screen w-full bg-background text-foreground">
      <AppSidebar />
      <div className="console-ambient flex min-w-0 flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  );
}
