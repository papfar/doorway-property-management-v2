import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import NotFound from "@/pages/not-found";
import Setup from "@/pages/setup";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Properties from "@/pages/properties";
import PropertyDetail from "@/pages/property-detail";
import Profile from "@/pages/profile";
import Companies from "@/pages/companies";
import Users from "@/pages/users";
import Leases from "@/pages/leases";
import LeaseDetail from "@/pages/lease-detail";
import Tenants from "@/pages/Tenants";
import Invitation from "@/pages/invitation";
import AppLayout from "@/components/layout/AppLayout";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  if (!user) {
    return <Login />;
  }
  
  return (
    <AppLayout>
      <Component />
    </AppLayout>
  );
}

function Router() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  // In multi-tenant mode, always allow access to setup page
  return (
    <Switch>
      <Route path="/setup" component={Setup} />
      <Route path="/invitation" component={Invitation} />
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={Dashboard} />} />
      <Route path="/properties" component={() => <ProtectedRoute component={Properties} />} />
      <Route path="/properties/:id" component={() => <ProtectedRoute component={PropertyDetail} />} />
      <Route path="/leases" component={() => <ProtectedRoute component={Leases} />} />
      <Route path="/leases/:id" component={() => <ProtectedRoute component={LeaseDetail} />} />
      <Route path="/tenants" component={() => <ProtectedRoute component={Tenants} />} />
      <Route path="/companies" component={() => <ProtectedRoute component={Companies} />} />
      <Route path="/users" component={() => <ProtectedRoute component={Users} />} />
      <Route path="/profile" component={() => <ProtectedRoute component={Profile} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
