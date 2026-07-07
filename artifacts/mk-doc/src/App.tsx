import React from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";

// Pages
import Dashboard from "@/pages/dashboard";
import Applications from "@/pages/applications";
import ApplicationDetail from "@/pages/application-detail";
import Infrastructure from "@/pages/infrastructure";
import Databases from "@/pages/databases";
import Domains from "@/pages/domains";
import Repositories from "@/pages/repositories";
import Releases from "@/pages/releases";
import Security from "@/pages/security";
import Software from "@/pages/software";
import Documentation from "@/pages/documentation";
import Reports from "@/pages/reports";
import Admin from "@/pages/admin";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/applications" component={Applications} />
        <Route path="/applications/:id" component={ApplicationDetail} />
        <Route path="/infrastructure" component={Infrastructure} />
        <Route path="/databases" component={Databases} />
        <Route path="/domains" component={Domains} />
        <Route path="/repositories" component={Repositories} />
        <Route path="/releases" component={Releases} />
        <Route path="/security" component={Security} />
        <Route path="/software" component={Software} />
        <Route path="/documentation" component={Documentation} />
        <Route path="/reports" component={Reports} />
        <Route path="/admin" component={Admin} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;