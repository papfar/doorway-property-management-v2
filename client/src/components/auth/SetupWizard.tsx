import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { setupSchema, type SetupData } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Logo } from "../ui/logo";
import { toast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

export default function SetupWizard() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  
  // Check if setup is still needed
  const { data: setupCheck, isLoading: setupLoading } = useQuery<{ needed: boolean }>({
    queryKey: ["/api/setup/needed"],
    retry: false,
    refetchOnWindowFocus: false,
  });
  
  const form = useForm<SetupData>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      organizationName: "",
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const setupMutation = useMutation({
    mutationFn: async (data: SetupData) => {
      await apiRequest("/api/setup", "POST", data);
    },
    onSuccess: () => {
      // Clear all auth-related queries to refresh the app state
      queryClient.invalidateQueries({ queryKey: ["/api/setup/needed"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.refetchQueries({ queryKey: ["/api/auth/me"] });
      
      toast({
        title: "Velkommen til Doorway!",
        description: "Din virksomhed og administrator er oprettet",
      });
      
      // Force a small delay to ensure queries are updated before redirect
      setTimeout(() => {
        setLocation("/dashboard");
      }, 100);
    },
    onError: (error: any) => {
      toast({
        title: "Fejl",
        description: error.message || "Der opstod en fejl under opsætningen",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SetupData) => {
    setupMutation.mutate(data);
  };

  const handleBackToLogin = () => {
    setLocation('/');
  };

  // Show loading while checking setup status
  if (setupLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Multi-tenant system - always allow new organizations

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo size="lg" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Velkommen til Doorway</h1>
          <p className="text-gray-600 mt-2">Opret din virksomhed og administrator for at komme i gang</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Opret virksomhed</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div>
                <Label htmlFor="organizationName">Virksomhedsnavn *</Label>
                <Input
                  id="organizationName"
                  type="text"
                  placeholder="Din virksomheds navn"
                  {...form.register("organizationName")}
                  data-testid="input-organization-name"
                />
                {form.formState.errors.organizationName && (
                  <p className="text-sm text-red-600 mt-1" data-testid="error-organization-name">
                    {form.formState.errors.organizationName.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="name">Fulde navn *</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Dit fulde navn"
                  {...form.register("name")}
                  data-testid="input-name"
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-red-600 mt-1" data-testid="error-name">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="email">E-mail adresse *</Label>
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
                <Label htmlFor="password">Adgangskode *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Minimum 8 tegn"
                  {...form.register("password")}
                  data-testid="input-password"
                />
                {form.formState.errors.password && (
                  <p className="text-sm text-red-600 mt-1" data-testid="error-password">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="confirmPassword">Bekræft adgangskode *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Gentag adgangskode"
                  {...form.register("confirmPassword")}
                  data-testid="input-confirm-password"
                />
                {form.formState.errors.confirmPassword && (
                  <p className="text-sm text-red-600 mt-1" data-testid="error-confirm-password">
                    {form.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full"
                disabled={setupMutation.isPending}
                data-testid="button-create-admin"
              >
                {setupMutation.isPending ? "Opretter..." : "Opret portefølje"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
