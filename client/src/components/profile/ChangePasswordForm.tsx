import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { changePasswordSchema, type ChangePasswordData } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";

export default function ChangePasswordForm() {
  const form = useForm<ChangePasswordData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: ChangePasswordData) => {
      await apiRequest("/api/user/change-password", "POST", data);
    },
    onSuccess: () => {
      form.reset();
      toast({
        title: "Success",
        description: "Adgangskode ændret",
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

  const onSubmit = (data: ChangePasswordData) => {
    changePasswordMutation.mutate(data);
  };

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <Label htmlFor="currentPassword">Nuværende adgangskode *</Label>
            <Input
              id="currentPassword"
              type="password"
              {...form.register("currentPassword")}
              data-testid="input-current-password"
            />
            {form.formState.errors.currentPassword && (
              <p className="text-sm text-red-600 mt-1" data-testid="error-current-password">
                {form.formState.errors.currentPassword.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="newPassword">Ny adgangskode *</Label>
            <Input
              id="newPassword"
              type="password"
              {...form.register("newPassword")}
              data-testid="input-new-password"
            />
            {form.formState.errors.newPassword && (
              <p className="text-sm text-red-600 mt-1" data-testid="error-new-password">
                {form.formState.errors.newPassword.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="confirmPassword">Bekræft ny adgangskode *</Label>
            <Input
              id="confirmPassword"
              type="password"
              {...form.register("confirmPassword")}
              data-testid="input-confirm-password"
            />
            {form.formState.errors.confirmPassword && (
              <p className="text-sm text-red-600 mt-1" data-testid="error-confirm-password">
                {form.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => form.reset()}
              data-testid="button-reset-form"
            >
              Annuller
            </Button>
            <Button 
              type="submit" 
              disabled={changePasswordMutation.isPending}
              data-testid="button-change-password"
            >
              {changePasswordMutation.isPending ? "Skifter..." : "Skift adgangskode"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
