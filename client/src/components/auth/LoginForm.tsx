import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, type LoginData } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Logo } from "../ui/logo";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { useLocation } from "wouter";

export default function LoginForm() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const [rememberMe, setRememberMe] = useState(false);
  
  const form = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  // Load saved credentials on component mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('doorway_email');
    const savedPassword = localStorage.getItem('doorway_password');
    if (savedEmail && savedPassword) {
      form.setValue('email', savedEmail);
      form.setValue('password', savedPassword);
      setRememberMe(true);
    }
  }, [form]);

  const onSubmit = async (data: LoginData) => {
    try {
      // Save credentials if remember me is checked
      if (rememberMe) {
        localStorage.setItem('doorway_email', data.email);
        localStorage.setItem('doorway_password', data.password);
      } else {
        localStorage.removeItem('doorway_email');
        localStorage.removeItem('doorway_password');
      }
      
      await login(data.email, data.password);
    } catch (error: any) {
      const message = error.message?.includes("401") || error.message?.includes("Ugyldig") 
        ? "Ugyldig e-mail eller adgangskode" 
        : error.message || "Der opstod en fejl ved login";
      
      toast({
        title: "Login fejl",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleCreateAccount = () => {
    setLocation('/setup');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo size="lg" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Log ind på Doorway</h1>
          <p className="text-gray-600 mt-2">Administrer dine ejendomme</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Log ind</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <Label htmlFor="email">E-mail adresse</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="din@email.dk"
                  {...form.register("email")}
                  data-testid="input-email"
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-red-600 mt-1" data-testid="error-email">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="password">Adgangskode</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Din adgangskode"
                  {...form.register("password")}
                  data-testid="input-password"
                />
                {form.formState.errors.password && (
                  <p className="text-sm text-red-600 mt-1" data-testid="error-password">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="remember" 
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                  data-testid="checkbox-remember"
                />
                <Label htmlFor="remember" className="text-sm">
                  Husk mig
                </Label>
              </div>

              <Button 
                type="submit" 
                className="w-full"
                disabled={form.formState.isSubmitting}
                data-testid="button-login"
              >
                {form.formState.isSubmitting ? "Logger ind..." : "Log ind"}
              </Button>

              <div className="text-center">
                <Button 
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleCreateAccount}
                  data-testid="button-create-account"
                >
                  Opret konto
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
