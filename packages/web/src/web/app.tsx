import { Route, Switch, Redirect } from "wouter";
import { AgentFeedback, RunableBadge } from "@runablehq/website-runtime";
import { Provider } from "./components/provider";
import { authClient } from "./lib/auth";
import { ErrorBoundary } from "./components/error-boundary";

import Index from "./pages/index";
import SignIn from "./pages/sign-in";
import Dashboard from "./pages/dashboard";
import Logs from "./pages/logs";
import Escalations from "./pages/escalations";
import Knowledge from "./pages/knowledge";
import Settings from "./pages/settings";
import Pricing from "./pages/pricing";
import SetupGuide from "./pages/setup-guide";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return <Redirect to="/sign-in" />;
  return <>{children}</>;
}

function App() {
  return (
    <Provider>
      <Switch>
        <Route path="/"><ErrorBoundary><Index /></ErrorBoundary></Route>
        <Route path="/sign-in" component={SignIn} />
        <Route path="/dashboard">
          <AuthGuard><Dashboard /></AuthGuard>
        </Route>
        <Route path="/dashboard/:country">
          <AuthGuard><Dashboard /></AuthGuard>
        </Route>
        <Route path="/logs">
          <AuthGuard><Logs /></AuthGuard>
        </Route>
        <Route path="/escalations">
          <AuthGuard><Escalations /></AuthGuard>
        </Route>
        <Route path="/knowledge">
          <AuthGuard><Knowledge /></AuthGuard>
        </Route>
        <Route path="/settings">
          <AuthGuard><Settings /></AuthGuard>
        </Route>
        <Route path="/pricing">
          <AuthGuard><Pricing /></AuthGuard>
        </Route>
        <Route path="/setup-guide">
          <AuthGuard><SetupGuide /></AuthGuard>
        </Route>
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>
      {import.meta.env.DEV && <AgentFeedback />}
      {<RunableBadge />}
    </Provider>
  );
}

export default App;
