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
import InfrastructureDetail from "@/pages/infrastructure-detail";
import Databases from "@/pages/databases";
import DatabaseDetail from "@/pages/database-detail";
import Domains from "@/pages/domains";
import DomainDetail from "@/pages/domain-detail";
import Repositories from "@/pages/repositories";
import RepositoryDetail from "@/pages/repository-detail";
import Releases from "@/pages/releases";
import Security from "@/pages/security";
import Software from "@/pages/software";
import Documentation from "@/pages/documentation";
import DocumentDetail from "@/pages/document-detail";
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
        <Route path="/infrastructure/:id" component={InfrastructureDetail} />
        <Route path="/databases" component={Databases} />
        <Route path="/databases/:id" component={DatabaseDetail} />
        <Route path="/domains" component={Domains} />
        <Route path="/domains/:id" component={DomainDetail} />
        <Route path="/repositories" component={Repositories} />
        <Route path="/repositories/:id" component={RepositoryDetail} />
        <Route path="/releases" component={Releases} />
        <Route path="/security" component={Security} />
        <Route path="/software" component={Software} />
        <Route path="/documentation" component={Documentation} />
        <Route path="/documentation/:id" component={DocumentDetail} />
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