import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

const profileSchema = z.object({
  name: z.string().min(1, "Navn påkrævet"),
  email: z.string().email("Ugyldig e-mail adresse"),
});

type ProfileData = z.infer<typeof profileSchema>;

export default function ProfileForm() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const form = useForm<ProfileData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ProfileData) => {
      await apiRequest("/api/user/profile", "PUT", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: "Success",
        description: "Profil opdateret",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Fejl",
        description: error.message || "Der opstod en fejl",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ProfileData) => {
    updateMutation.mutate(data);
  };

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <Label htmlFor="name">Navn *</Label>
            <Input
              id="name"
              type="text"
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
            <Label htmlFor="email">E-mail *</Label>
            <Input
              id="email"
              type="email"
              {...form.register("email")}
              data-testid="input-email"
            />
            {form.formState.errors.email && (
              <p className="text-sm text-red-600 mt-1" data-testid="error-email">
                {form.formState.errors.email.message}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end pt-6 border-t border-gray-200">
            <Button 
              type="submit" 
              disabled={updateMutation.isPending}
              data-testid="button-save-profile"
            >
              {updateMutation.isPending ? "Gemmer..." : "Gem ændringer"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
