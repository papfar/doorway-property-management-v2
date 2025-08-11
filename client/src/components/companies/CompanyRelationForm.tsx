import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { insertCompanyRelationSchema, insertCompanySchema, type InsertCompanyRelation, type Company } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useState } from "react";
import { z } from "zod";

// Extended schema for creating new parent/child companies
const createRelationSchema = z.object({
  type: z.enum(["parent", "child"]), // Type of relation to create
  existing: z.boolean(), // Whether to use existing company or create new one
  existingCompanyId: z.string().optional(),
  newCompany: z.object({
    name: z.string().min(1, "Selskabsnavn er påkrævet"),
    cvrNumber: z.coerce.number().int().min(10000000).max(99999999).optional().nullable(),
  }).optional(),
  ownershipPercentage: z.coerce.number().min(0.01, "Ejerskabsprocent skal være større end 0").max(100, "Ejerskabsprocent kan ikke overstige 100%"),
});

type CreateRelationFormData = z.infer<typeof createRelationSchema>;

interface CompanyRelationFormProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  companyName: string;
  relationType: "parent" | "child";
}

export default function CompanyRelationForm({ 
  isOpen, 
  onClose, 
  companyId, 
  companyName,
  relationType 
}: CompanyRelationFormProps) {
  const queryClient = useQueryClient();
  const [createNewCompany, setCreateNewCompany] = useState(false);

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    enabled: isOpen,
  });

  // Filter out the current company from the list
  const availableCompanies = companies.filter(c => c.id !== companyId);

  const form = useForm<CreateRelationFormData>({
    resolver: zodResolver(createRelationSchema),
    defaultValues: {
      type: relationType,
      existing: true,
      ownershipPercentage: 0,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateRelationFormData) => {
      let targetCompanyId: string;

      if (data.existing) {
        if (!data.existingCompanyId) {
          throw new Error("Selskab skal vælges");
        }
        targetCompanyId = data.existingCompanyId;
      } else {
        if (!data.newCompany) {
          throw new Error("Selskabsdata mangler");
        }
        // Create new company first  
        console.log('Creating new company:', data.newCompany);
        const response = await fetch('/api/companies', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(data.newCompany),
        });
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Fejl ved oprettelse af selskab');
        }
        
        const newCompany = await response.json() as Company;
        console.log('New company response:', newCompany);
        
        if (!newCompany || !newCompany.id) {
          throw new Error("Fejl ved oprettelse af nyt selskab");
        }
        targetCompanyId = newCompany.id;
      }

      // Create the relation
      const relationData = relationType === "parent" 
        ? {
            parentCompanyId: targetCompanyId,
            childCompanyId: companyId,
            ownershipPercentage: data.ownershipPercentage,
          }
        : {
            parentCompanyId: companyId,
            childCompanyId: targetCompanyId,
            ownershipPercentage: data.ownershipPercentage,
          };

      console.log('RelationType:', relationType, 'TargetCompanyId:', targetCompanyId, 'CompanyId:', companyId);
      console.log('Sending relation data:', relationData);
      return await apiRequest("/api/company-relations", "POST", relationData);
    },
    onSuccess: () => {
      // Invalidate all related queries to ensure fresh data
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/company-relations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/companies", companyId, "relations"] });
      toast({
        title: "Success",
        description: `${relationType === "parent" ? "Moderselskab" : "Datterselskab"} tilføjet`,
      });
      onClose();
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Fejl",
        description: error.message || "Der opstod en fejl",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: CreateRelationFormData) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Tilføj {relationType === "parent" ? "moderselskab" : "datterselskab"} til {companyName}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          {/* Choose existing or create new */}
          <div className="space-y-2">
            <Label>Vælg handling</Label>
            <Select
              value={createNewCompany ? "new" : "existing"}
              onValueChange={(value) => {
                setCreateNewCompany(value === "new");
                form.setValue("existing", value === "existing");
              }}
            >
              <SelectTrigger data-testid="select-action-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="existing">Vælg eksisterende selskab</SelectItem>
                <SelectItem value="new">Opret nyt selskab</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!createNewCompany ? (
            /* Select existing company */
            <div className="space-y-2">
              <Label>Eksisterende selskab</Label>
              <Select
                value={form.watch("existingCompanyId") || ""}
                onValueChange={(value) => form.setValue("existingCompanyId", value)}
              >
                <SelectTrigger data-testid="select-existing-company">
                  <SelectValue placeholder="Vælg selskab" />
                </SelectTrigger>
                <SelectContent>
                  {availableCompanies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                      {company.cvrNumber && ` (CVR: ${company.cvrNumber})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.existingCompanyId && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.existingCompanyId.message}
                </p>
              )}
            </div>
          ) : (
            /* Create new company fields */
            <div className="space-y-4">
              <div>
                <Label htmlFor="newCompanyName">Selskabsnavn</Label>
                <Input
                  id="newCompanyName"
                  {...form.register("newCompany.name")}
                  data-testid="input-new-company-name"
                />
                {form.formState.errors.newCompany?.name && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.newCompany.name.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="newCompanyCvr">CVR-nummer (valgfrit)</Label>
                <Input
                  id="newCompanyCvr"
                  {...form.register("newCompany.cvrNumber")}
                  placeholder="12345678"
                  data-testid="input-new-company-cvr"
                />
                {form.formState.errors.newCompany?.cvrNumber && (
                  <p className="text-sm text-red-600 mt-1">
                    {form.formState.errors.newCompany.cvrNumber.message}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Ownership percentage */}
          <div>
            <Label htmlFor="ownershipPercentage">Ejerandel (%)</Label>
            <Input
              id="ownershipPercentage"
              type="number"
              min="0.01"
              max="100"
              step="0.01"
              {...form.register("ownershipPercentage")}
              data-testid="input-ownership-percentage"
            />
            {form.formState.errors.ownershipPercentage && (
              <p className="text-sm text-red-600 mt-1">
                {form.formState.errors.ownershipPercentage.message}
              </p>
            )}
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" variant="outline" onClick={onClose} data-testid="button-cancel">
              Annuller
            </Button>
            <Button 
              type="submit" 
              disabled={createMutation.isPending}
              data-testid="button-save"
            >
              {createMutation.isPending ? "Gemmer..." : "Gem"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}