import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

const acceptInvitationSchema = z.object({
  name: z.string().min(1, "Navn er påkrævet"),
  password: z.string().min(6, "Adgangskode skal være mindst 6 tegn"),
  confirmPassword: z.string().min(6, "Bekræft adgangskode"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Adgangskoder matcher ikke",
  path: ["confirmPassword"],
});

type AcceptInvitationData = z.infer<typeof acceptInvitationSchema>;

export default function InvitationPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Get token from URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');

  const form = useForm<AcceptInvitationData>({
    resolver: zodResolver(acceptInvitationSchema),
    defaultValues: {
      name: "",
      password: "",
      confirmPassword: "",
    },
  });

  // Verify invitation token
  const { data: invitation, isLoading: isVerifyingInvitation, error: verificationError } = useQuery({
    queryKey: [`/api/users/invitation/verify/${token}`],
    enabled: !!token,
  });

  const acceptInvitationMutation = useMutation({
    mutationFn: async (data: AcceptInvitationData) => {
      return await apiRequest("/api/users/invitation/accept", "POST", {
        token,
        name: data.name,
        password: data.password,
      });
    },
    onSuccess: () => {
      toast({
        title: "Konto oprettet",
        description: "Din konto er blevet oprettet. Du kan nu logge ind.",
      });
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Fejl ved kontooprettelse",
        description: error.message || "Kunne ikke oprette konto",
        variant: "destructive",
      });
    },
  });

  if (!token) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Ugyldig invitation</CardTitle>
            <CardDescription>
              Der mangler et invitationstoken i URL'en.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isVerifyingInvitation) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Verificerer invitation...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (verificationError || !invitation) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Ugyldig invitation</CardTitle>
            <CardDescription>
              Invitationen er ugyldig eller er udløbet. Kontakt venligst din administrator.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Velkommen til Doorway</CardTitle>
          <CardDescription>
            Du er inviteret til at oprette en konto. Udfyld formularen nedenfor for at komme i gang.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>Email:</strong> {invitation.email}
            </p>
            <p className="text-sm text-blue-700">
              <strong>Rolle:</strong> {invitation.role === 'admin' ? 'Administrator' : 'Bruger'}
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => acceptInvitationMutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fulde navn</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Indtast dit fulde navn" 
                        {...field}
                        data-testid="input-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adgangskode</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="Mindst 6 tegn" 
                        {...field}
                        data-testid="input-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bekræft adgangskode</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="Gentag adgangskoden" 
                        {...field}
                        data-testid="input-confirm-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="w-full" 
                disabled={acceptInvitationMutation.isPending}
                data-testid="button-accept-invitation"
              >
                {acceptInvitationMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Opret konto
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}