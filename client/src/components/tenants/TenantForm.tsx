import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertTenantSchema } from "@shared/schema";
import type { Tenant, InsertTenant } from "@shared/schema";
import { z } from "zod";

const formSchema = insertTenantSchema.extend({
  cvrNumber: z.string().optional(),
  contactPerson: z.string().optional(),
  invoiceEmail: z.string().email("Ugyldig email").optional().or(z.literal("")),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface TenantFormProps {
  tenant?: Tenant | null;
  onSuccess: () => void;
  onCancel: () => void;
}

export function TenantForm({ tenant, onSuccess, onCancel }: TenantFormProps) {
  const { toast } = useToast();
  const isEditing = !!tenant;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: tenant?.name || "",
      type: tenant?.type || "privat",
      cvrNumber: tenant?.cvrNumber || "",
      contactPerson: tenant?.contactPerson || "",
      email: tenant?.email || "",
      invoiceEmail: tenant?.invoiceEmail || "",
      phone: tenant?.phone || "",
      notes: tenant?.notes || "",
    },
  });

  const watchType = form.watch("type");

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const url = isEditing ? `/api/tenants/${tenant.id}` : "/api/tenants";
      const method = isEditing ? "PUT" : "POST";
      
      // Clean up empty strings
      const cleanData = {
        ...data,
        cvrNumber: data.cvrNumber || null,
        contactPerson: data.contactPerson || null,
        invoiceEmail: data.invoiceEmail || null,
        notes: data.notes || null,
      };
      
      return apiRequest(url, method, cleanData);
    },
    onSuccess: () => {
      toast({
        title: isEditing ? "Lejer opdateret" : "Lejer oprettet",
        description: isEditing ? "Lejeren er blevet opdateret" : "Den nye lejer er blevet oprettet",
      });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Fejl",
        description: error.message || "Der opstod en fejl ved gem af lejeren",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Navn *</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Lejerens navn"
                    data-testid="input-name"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type *</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  defaultValue={field.value}
                  data-testid="select-type"
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Vælg lejertype" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="privat">Privat</SelectItem>
                    <SelectItem value="erhverv">Erhverv</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {watchType === "erhverv" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="cvrNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CVR-nummer</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="12345678"
                      data-testid="input-cvr"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="contactPerson"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kontaktperson</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Navn på kontaktperson"
                      data-testid="input-contact-person"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email *</FormLabel>
                <FormControl>
                  <Input 
                    type="email"
                    placeholder="lejer@example.com"
                    data-testid="input-email"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="invoiceEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Faktura email</FormLabel>
                <FormControl>
                  <Input 
                    type="email"
                    placeholder="faktura@example.com"
                    data-testid="input-invoice-email"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Telefon *</FormLabel>
              <FormControl>
                <Input 
                  placeholder="+45 12 34 56 78"
                  data-testid="input-phone"
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Noter</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Yderligere information om lejeren"
                  className="min-h-[100px]"
                  data-testid="textarea-notes"
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2 pt-4">
          <Button 
            type="submit" 
            disabled={mutation.isPending}
            data-testid="button-submit"
          >
            {mutation.isPending ? "Gemmer..." : (isEditing ? "Opdater lejer" : "Opret lejer")}
          </Button>
          <Button 
            type="button" 
            variant="outline" 
            onClick={onCancel}
            data-testid="button-cancel"
          >
            Annuller
          </Button>
        </div>
      </form>
    </Form>
  );
}