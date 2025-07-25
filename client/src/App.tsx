import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Matches from "@/pages/matches-clean";
import MatchSetup from "@/pages/match-setup";
import MatchSettings from "@/pages/match-settings";
import Scorer from "@/pages/scorer";
import Scoreboard from "@/pages/scoreboard";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import PlayerManagement from "@/pages/PlayerManagement";
import UserManagement from "@/pages/UserManagementNew";
import FranchiseManagementComplete from "@/pages/FranchiseManagementComplete";
import MatchStats from "@/pages/MatchStats";
import Archives from "@/pages/Archives";
import PlayerStats from "@/pages/PlayerStats";
import TossTest from "@/pages/toss-test";
import NotFound from "@/pages/not-found";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/" component={Dashboard} />
      <Route path="/matches" component={MatchesWithNav} />
      <Route path="/match-setup" component={MatchSetupWithNav} />
      <Route path="/match-settings/:matchId" component={MatchSettingsWithNav} />
      <Route path="/scorer/:matchId" component={ScorerWithNav} />
      <Route path="/scoreboard/:matchId" component={ScoreboardWithNav} />
      <Route path="/players" component={PlayerManagementWithNav} />
      <Route path="/user-management" component={UserManagementWithNav} />
      <Route path="/franchises" component={FranchiseManagementWithNav} />
      <Route path="/match-stats" component={MatchStatsWithNav} />
      <Route path="/archives" component={ArchivesWithNav} />
      <Route path="/player-stats" component={PlayerStatsWithNav} />
      <Route path="/toss-test" component={TossTest} />
      <Route component={NotFound} />
    </Switch>
  );
}

function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navigation />
      <div className="flex-1">
        <Matches />
      </div>
      <Footer />
    </div>
  );
}

function MatchesWithNav() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navigation />
      <div className="flex-1">
        <Matches />
      </div>
      <Footer />
    </div>
  );
}

function MatchSetupWithNav() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navigation />
      <div className="flex-1">
        <MatchSetup />
      </div>
      <Footer />
    </div>
  );
}

function ScorerWithNav({ params }: { params: { matchId: string } }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navigation />
      <div className="flex-1">
        <Scorer params={params} />
      </div>
      <Footer />
    </div>
  );
}

function ScoreboardWithNav({ params }: { params: { matchId: string } }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navigation />
      <div className="flex-1">
        <Scoreboard params={params} />
      </div>
      <Footer />
    </div>
  );
}

function PlayerManagementWithNav() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navigation />
      <div className="flex-1">
        <PlayerManagement />
      </div>
      <Footer />
    </div>
  );
}

function UserManagementWithNav() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navigation />
      <div className="flex-1">
        <UserManagement />
      </div>
      <Footer />
    </div>
  );
}

function FranchiseManagementWithNav() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navigation />
      <div className="flex-1">
        <FranchiseManagementComplete />
      </div>
      <Footer />
    </div>
  );
}

function MatchStatsWithNav() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navigation />
      <div className="flex-1">
        <MatchStats />
      </div>
      <Footer />
    </div>
  );
}

function ArchivesWithNav() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navigation />
      <div className="flex-1">
        <Archives />
      </div>
      <Footer />
    </div>
  );
}

function PlayerStatsWithNav() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navigation />
      <div className="flex-1">
        <PlayerStats />
      </div>
      <Footer />
    </div>
  );
}

function MatchSettingsWithNav({ params }: { params: { matchId: string } }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navigation />
      <div className="flex-1">
        <MatchSettings params={params} />
      </div>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
