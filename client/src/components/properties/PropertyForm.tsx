import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { insertPropertySchema, type InsertProperty, type Property, type Company } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { formatNumber } from "@/lib/utils";

interface PropertyFormProps {
  isOpen: boolean;
  onClose: () => void;
  property?: Property;
}

export default function PropertyForm({ isOpen, onClose, property }: PropertyFormProps) {
  const queryClient = useQueryClient();
  const [showShareFields, setShowShareFields] = useState(false);
  const [displayPrice, setDisplayPrice] = useState("");

  // Fetch companies for the dropdown
  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    enabled: isOpen,
  });

  // Helper function to format number input with Danish formatting
  const formatPriceInput = (value: string): { display: string; raw: string } => {
    // Remove all non-digits
    const rawValue = value.replace(/\D/g, '');
    
    // Format with Danish thousand separators
    const displayValue = rawValue ? formatNumber(parseInt(rawValue, 10)) : '';
    
    return { display: displayValue, raw: rawValue };
  };
  
  const form = useForm<InsertProperty>({
    resolver: zodResolver(insertPropertySchema),
    defaultValues: {
      name: property?.name || "",
      address: property?.address || "",
      postalCode: property?.postalCode || "",
      city: property?.city || "",
      acquisitionPrice: property?.acquisitionPrice ? parseInt(property.acquisitionPrice.toString(), 10) : 0,
      acquisitionDate: property?.acquisitionDate || "",
      propertyType: property?.propertyType || "",
      shareNumerator: property?.shareNumerator || undefined,
      shareDenominator: property?.shareDenominator || undefined,
      ownerCompanyId: property?.ownerCompanyId || null,
    },
  });

  const isEdit = !!property;

  useEffect(() => {
    if (property) {
      form.reset({
        name: property.name,
        address: property.address,
        postalCode: property.postalCode,
        city: property.city,
        acquisitionPrice: property.acquisitionPrice ? parseInt(property.acquisitionPrice.toString(), 10) : 0,
        acquisitionDate: property.acquisitionDate,
        propertyType: property.propertyType,
        shareNumerator: property.shareNumerator || undefined,
        shareDenominator: property.shareDenominator || undefined,
        ownerCompanyId: property.ownerCompanyId || null,
      });
      setShowShareFields(property.propertyType === 'ejerlejlighed');
      // Set display price for existing property
      if (property.acquisitionPrice) {
        setDisplayPrice(formatNumber(parseInt(property.acquisitionPrice.toString(), 10)));
      }
    } else {
      form.reset({
        name: "",
        address: "",
        postalCode: "",
        city: "",
        acquisitionPrice: 0,
        acquisitionDate: "",
        propertyType: "",
        shareNumerator: undefined,
        shareDenominator: undefined,
        ownerCompanyId: null,
      });
      setShowShareFields(false);
      setDisplayPrice(""); // Clear display price for new property
    }
  }, [property, form]);

  // Reset display price when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setDisplayPrice("");
    }
  }, [isOpen]);

  const createMutation = useMutation({
    mutationFn: async (data: InsertProperty) => {
      await apiRequest("/api/properties", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recent"] });
      onClose();
      toast({
        title: "Success",
        description: "Ejendom oprettet",
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

  const updateMutation = useMutation({
    mutationFn: async (data: InsertProperty) => {
      await apiRequest(`/api/properties/${property!.id}`, "PUT", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties", property!.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recent"] });
      onClose();
      toast({
        title: "Success",
        description: "Ejendom opdateret",
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

  const onSubmit = (data: InsertProperty) => {
    if (isEdit) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handlePostalCodeChange = async (value: string) => {
    form.setValue("postalCode", value);
    
    if (value.length === 4) {
      try {
        const response = await fetch(`/api/postal-codes/${value}`);
        const data = await response.json();
        if (data.city) {
          form.setValue("city", data.city);
        }
      } catch (error) {
        console.error("Failed to lookup city:", error);
      }
    }
  };

  const handlePropertyTypeChange = (value: string) => {
    form.setValue("propertyType", value);
    setShowShareFields(value === 'ejerlejlighed');
    
    if (value !== 'ejerlejlighed') {
      form.setValue("shareNumerator", undefined);
      form.setValue("shareDenominator", undefined);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Redigér ejendom" : "Opret ejendom"}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={form.handleSubmit((data: InsertProperty) => onSubmit(data))} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Property Name */}
            <div className="md:col-span-2">
              <Label htmlFor="name">Ejendomsnavn *</Label>
              <Input
                id="name"
                placeholder="F.eks. Strandvejen 15, 3. th"
                {...form.register("name")}
                data-testid="input-property-name"
              />
              {form.formState.errors.name && (
                <p className="text-sm text-red-600 mt-1" data-testid="error-name">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>

            {/* Address */}
            <div className="md:col-span-2">
              <Label htmlFor="address">Adresse *</Label>
              <Input
                id="address"
                placeholder="Indtast den fulde adresse"
                {...form.register("address")}
                data-testid="input-address"
              />
              {form.formState.errors.address && (
                <p className="text-sm text-red-600 mt-1" data-testid="error-address">
                  {form.formState.errors.address.message}
                </p>
              )}
            </div>

            {/* Postal Code */}
            <div>
              <Label htmlFor="postalCode">Postnummer *</Label>
              <Input
                id="postalCode"
                placeholder="2100"
                maxLength={4}
                {...form.register("postalCode")}
                onChange={(e) => handlePostalCodeChange(e.target.value)}
                data-testid="input-postal-code"
              />
              {form.formState.errors.postalCode && (
                <p className="text-sm text-red-600 mt-1" data-testid="error-postal-code">
                  {form.formState.errors.postalCode.message}
                </p>
              )}
            </div>

            {/* City */}
            <div>
              <Label htmlFor="city">By *</Label>
              <Input
                id="city"
                placeholder="Autoudfyldes fra postnummer"
                {...form.register("city")}
                data-testid="input-city"
              />
              <p className="text-xs text-gray-500 mt-1">Udfyldes automatisk, men kan overskrives</p>
              {form.formState.errors.city && (
                <p className="text-sm text-red-600 mt-1" data-testid="error-city">
                  {form.formState.errors.city.message}
                </p>
              )}
            </div>

            {/* Property Type */}
            <div>
              <Label htmlFor="propertyType">Ejendomstype *</Label>
              <Select
                value={form.watch("propertyType")}
                onValueChange={handlePropertyTypeChange}
              >
                <SelectTrigger data-testid="select-property-type">
                  <SelectValue placeholder="Vælg type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ejerlejlighed">Ejerlejlighed</SelectItem>
                  <SelectItem value="samlet_fast_ejendom">Samlet Fast Ejendom</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.propertyType && (
                <p className="text-sm text-red-600 mt-1" data-testid="error-property-type">
                  {form.formState.errors.propertyType.message}
                </p>
              )}
            </div>

            {/* Acquisition Price */}
            <div>
              <Label htmlFor="acquisitionPrice">Anskaffelsessum *</Label>
              <div className="relative">
                <Input
                  id="acquisitionPrice"
                  type="text"
                  placeholder="2.450.000"
                  value={displayPrice}
                  onChange={(e) => {
                    const { display, raw } = formatPriceInput(e.target.value);
                    setDisplayPrice(display);
                    // Update the form with the raw numeric value
                    form.setValue("acquisitionPrice", parseInt(raw, 10) || 0);
                  }}
                  className="pr-8"
                  data-testid="input-acquisition-price"
                />
                <span className="absolute right-3 top-2 text-gray-500 text-sm">kr</span>
              </div>
              {form.formState.errors.acquisitionPrice && (
                <p className="text-sm text-red-600 mt-1" data-testid="error-acquisition-price">
                  {form.formState.errors.acquisitionPrice.message}
                </p>
              )}
            </div>

            {/* Acquisition Date */}
            <div>
              <Label htmlFor="acquisitionDate">Anskaffelsesdato</Label>
              <Input
                id="acquisitionDate"
                type="date"
                {...form.register("acquisitionDate")}
                data-testid="input-acquisition-date"
              />
              {form.formState.errors.acquisitionDate && (
                <p className="text-sm text-red-600 mt-1" data-testid="error-acquisition-date">
                  {form.formState.errors.acquisitionDate.message}
                </p>
              )}
            </div>

            {/* Owner Company */}
            <div>
              <Label htmlFor="ownerCompany">Ejerselskab (valgfrit)</Label>
              <Select
                value={form.watch("ownerCompanyId") || "none"}
                onValueChange={(value) => form.setValue("ownerCompanyId", value === "none" ? null : value)}
              >
                <SelectTrigger data-testid="select-owner-company">
                  <SelectValue placeholder="Vælg ejerselskab" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Intet selskab</SelectItem>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                      {company.cvrNumber && ` (CVR: ${company.cvrNumber})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.ownerCompanyId && (
                <p className="text-sm text-red-600 mt-1" data-testid="error-owner-company">
                  {form.formState.errors.ownerCompanyId.message}
                </p>
              )}
            </div>

            {/* Share Numbers (only for condominiums) */}
            {showShareFields && (
              <div className="md:col-span-2">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-blue-900 mb-3">Fordelingstal (kun for ejerlejligheder)</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="shareNumerator">Tæller *</Label>
                      <Input
                        id="shareNumerator"
                        type="number"
                        placeholder="192"
                        {...form.register("shareNumerator", { valueAsNumber: true })}
                        className="border-blue-300"
                        data-testid="input-share-numerator"
                      />
                      {form.formState.errors.shareNumerator && (
                        <p className="text-sm text-red-600 mt-1" data-testid="error-share-numerator">
                          {form.formState.errors.shareNumerator.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="shareDenominator">Nævner *</Label>
                      <Input
                        id="shareDenominator"
                        type="number"
                        placeholder="2384"
                        {...form.register("shareDenominator", { valueAsNumber: true })}
                        className="border-blue-300"
                        data-testid="input-share-denominator"
                      />
                      {form.formState.errors.shareDenominator && (
                        <p className="text-sm text-red-600 mt-1" data-testid="error-share-denominator">
                          {form.formState.errors.shareDenominator.message}
                        </p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-blue-700 mt-2">Begge felter skal udfyldes hvis ejendommen er en ejerlejlighed</p>
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              data-testid="button-cancel"
            >
              Annuller
            </Button>
            <Button 
              type="submit" 
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save"
            >
              {createMutation.isPending || updateMutation.isPending 
                ? "Gemmer..." 
                : "Gem ejendom"
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
