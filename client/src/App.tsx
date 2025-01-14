import { Switch, Route } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Loader2 } from "lucide-react";
import { MainLayout } from "@/layouts/MainLayout";
import Channel from "@/pages/Channel"; // Changed to default import
import { DirectMessage } from "@/pages/DirectMessage";
import { Home } from "@/pages/Home";
import AuthPage from "@/pages/AuthPage";
import ProfilePage from "@/pages/ProfilePage";
import { UserProfile } from "@/pages/UserProfile";
import { useUser } from "@/hooks/use-user";
import { ToastProvider, ToastViewport } from "./components/ui/toast";
import { BotChat } from "@/pages/BotChat"; // Added import for BotChat

function App() {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <ToastProvider>
      <MainLayout>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/channel/:id" component={Channel} />
          <Route path="/dm/:id" component={DirectMessage} />
          <Route path="/profile" component={ProfilePage} />
          <Route path="/profile/:id" component={UserProfile} />
          <Route path="/bot" component={BotChat} /> {/* Added route for BotChat */}
          <Route component={NotFound} />
        </Switch>
      </MainLayout>
      <ToastViewport />
    </ToastProvider>
  );
}

// fallback 404 not found page
function NotFound() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">404 Page Not Found</h1>
          </div>
          <p className="mt-4 text-sm text-gray-600">
            The page you're looking for doesn't exist.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default App;