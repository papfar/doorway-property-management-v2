import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertLeaseSchema, type InsertLease, type Lease, type Property } from "@shared/schema";

interface LeaseFormProps {
  lease?: Lease;
  onClose: () => void;
}

export function LeaseForm({ lease, onClose }: LeaseFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ['/api/properties'],
  });

  const form = useForm<InsertLease>({
    resolver: zodResolver(insertLeaseSchema),
    defaultValues: lease ? {
      propertyId: lease.propertyId,
      name: lease.name,
      registeredArea: lease.registeredArea,
      totalArea: lease.totalArea,
      type: lease.type || undefined,
      vatRegistered: lease.vatRegistered || false,
      maxRentPerSqm: lease.maxRentPerSqm ? parseFloat(lease.maxRentPerSqm) : undefined,
      yieldRequirementPct: lease.yieldRequirementPct ? parseFloat(lease.yieldRequirementPct) : undefined,
    } : {
      propertyId: "",
      name: "",
      registeredArea: 0,
      totalArea: 0,
      vatRegistered: false,
    }
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertLease) => apiRequest("/api/leases", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leases"] });
      toast({
        title: "Succes",
        description: "Lejemål oprettet successfully",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Fejl",
        description: error.message || "Der opstod en fejl ved oprettelse af lejemål",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<InsertLease>) => 
      apiRequest(`/api/leases/${lease!.id}`, "PATCH", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leases"] });
      toast({
        title: "Succes", 
        description: "Lejemål opdateret successfully",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Fejl",
        description: error.message || "Der opstod en fejl ved opdatering af lejemål",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertLease) => {
    if (lease) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const formatNumber = (value: string) => {
    const num = parseInt(value.replace(/\D/g, ''));
    if (isNaN(num)) return '';
    return new Intl.NumberFormat('da-DK').format(num);
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="propertyId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ejendom</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-property">
                      <SelectValue placeholder="Vælg ejendom" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {properties.map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Navn</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="f.eks. Butik 1. sal"
                    data-testid="input-lease-name"
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
                <FormLabel>Type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-lease-type">
                      <SelectValue placeholder="Vælg type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Bolig">Bolig</SelectItem>
                    <SelectItem value="Detail">Detail</SelectItem>
                    <SelectItem value="Kontor">Kontor</SelectItem>
                    <SelectItem value="Lager">Lager</SelectItem>
                    <SelectItem value="Garage">Garage</SelectItem>
                    <SelectItem value="Industri">Industri</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="vatRegistered"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="checkbox-vat-registered"
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Momsregistreret</FormLabel>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="registeredArea"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tinglyst areal (m²)</FormLabel>
                <FormControl>
                  <Input 
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    data-testid="input-registered-area"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="totalArea"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Samlet areal (m²)</FormLabel>
                <FormControl>
                  <Input 
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    data-testid="input-total-area"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="maxRentPerSqm"
            render={({ field }) => {
              const [displayValue, setDisplayValue] = React.useState(field.value ? field.value.toString().replace('.', ',') : '');
              
              React.useEffect(() => {
                if (field.value !== undefined) {
                  setDisplayValue(field.value.toString().replace('.', ','));
                }
              }, [field.value]);

              return (
                <FormItem>
                  <FormLabel>Max leje pr. m² (kr)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="2000"
                      data-testid="input-max-rent-per-sqm"
                      value={displayValue}
                      onChange={(e) => {
                        const value = e.target.value;
                        setDisplayValue(value);
                        
                        if (value === '') {
                          field.onChange(undefined);
                        } else {
                          const normalized = value.replace(',', '.');
                          const parsed = parseFloat(normalized);
                          if (!isNaN(parsed)) {
                            field.onChange(parsed);
                          }
                        }
                      }}
                      onBlur={() => {
                        if (field.value !== undefined) {
                          setDisplayValue(field.value.toString().replace('.', ','));
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              );
            }}
          />

          <FormField
            control={form.control}
            name="yieldRequirementPct"
            render={({ field }) => {
              const [displayValue, setDisplayValue] = React.useState(field.value ? field.value.toString().replace('.', ',') : '');
              
              React.useEffect(() => {
                if (field.value !== undefined) {
                  setDisplayValue(field.value.toString().replace('.', ','));
                }
              }, [field.value]);

              return (
                <FormItem>
                  <FormLabel>Afkastkrav (%)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="6,25"
                      data-testid="input-yield-requirement"
                      value={displayValue}
                      onChange={(e) => {
                        const value = e.target.value;
                        setDisplayValue(value);
                        
                        if (value === '') {
                          field.onChange(undefined);
                        } else {
                          const normalized = value.replace(',', '.');
                          const parsed = parseFloat(normalized);
                          if (!isNaN(parsed)) {
                            field.onChange(parsed);
                          }
                        }
                      }}
                      onBlur={() => {
                        if (field.value !== undefined) {
                          setDisplayValue(field.value.toString().replace('.', ','));
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        </div>

        <div className="flex justify-end space-x-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={onClose}
            disabled={isLoading}
            data-testid="button-cancel"
          >
            Annuller
          </Button>
          <Button 
            type="submit" 
            disabled={isLoading}
            data-testid="button-submit"
          >
            {isLoading ? "Gemmer..." : lease ? "Opdater" : "Opret"}
          </Button>
        </div>
      </form>
    </Form>
  );
}