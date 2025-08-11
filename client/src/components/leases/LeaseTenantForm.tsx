import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { insertLeaseTenantSchema } from "@shared/schema";
import type { Tenant, LeaseTenant, InsertLeaseTenant } from "@shared/schema";
import { z } from "zod";

// Danish number formatting functions
const formatDanishNumber = (value: string | number): string => {
  // If it's a number, use Intl.NumberFormat for proper Danish formatting
  if (typeof value === 'number') {
    return new Intl.NumberFormat('da-DK', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  }
  
  // If it's a string, process it for manual input
  const cleanValue = value.replace(/[^\d,]/g, '');
  
  // Handle empty input
  if (!cleanValue || cleanValue === ',') return '';
  
  // Split by comma to handle decimals - only allow one comma
  const parts = cleanValue.split(',');
  let integerPart = parts[0] || '';
  let decimalPart = parts[1] || '';
  
  // If multiple commas, only use first two parts
  if (parts.length > 2) {
    integerPart = parts[0];
    decimalPart = parts[1];
  }
  
  // Add thousand separators to integer part (dots)
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  
  // Return formatted number with comma as decimal separator if user typed comma
  return parts.length > 1 ? `${formattedInteger},${decimalPart}` : formattedInteger;
};

const parseDanishNumber = (value: string): number => {
  // Remove thousand separators (dots) and replace comma with dot for parsing
  const cleanValue = value.replace(/\./g, '').replace(',', '.');
  return parseFloat(cleanValue) || 0;
};

const formSchema = z.object({
  tenantId: z.string().min(1, "Lejer er påkrævet"),
  leaseId: z.string().min(1, "Lejemål er påkrævet"),
  periodStart: z.string().min(1, "Startdato er påkrævet"),
  periodEnd: z.string().optional(),
  rentAmount: z.union([z.string(), z.number()]).refine((val) => {
    if (val === "" || val === null || val === undefined) return false;
    const num = typeof val === 'string' ? parseDanishNumber(val) : val;
    return num > 0;
  }, "Lejebeløb skal være større end 0"),
  advanceWater: z.union([z.string(), z.number()]).optional().or(z.literal("")),
  advanceHeating: z.union([z.string(), z.number()]).optional().or(z.literal("")),
  advanceElectricity: z.union([z.string(), z.number()]).optional().or(z.literal("")),
  advanceOther: z.union([z.string(), z.number()]).optional().or(z.literal("")),
  depositType: z.string().min(1, "Depositum type er påkrævet"),
  depositAmount: z.union([z.string(), z.number()]).optional().or(z.literal("")),
  prepaidType: z.string().min(1, "Forudbetalt leje type er påkrævet"),
  prepaidAmount: z.union([z.string(), z.number()]).optional().or(z.literal("")),
  regulationType: z.string().min(1, "Regulering er påkrævet"),
  note: z.string().optional(),
}).refine((data) => {
  if (data.periodEnd && data.periodStart) {
    return new Date(data.periodEnd) >= new Date(data.periodStart);
  }
  return true;
}, {
  message: "Slutdato skal være efter eller lig med startdato",
  path: ["periodEnd"],
}).refine((data) => {
  if (data.depositType === "amount") {
    return data.depositAmount && parseFloat(data.depositAmount.toString()) > 0;
  }
  return true;
}, {
  message: "Depositumbeløb er påkrævet når 'Beløb' er valgt",
  path: ["depositAmount"],
}).refine((data) => {
  if (data.prepaidType === "amount") {
    return data.prepaidAmount && parseFloat(data.prepaidAmount.toString()) > 0;
  }
  return true;
}, {
  message: "Forudbetalt beløb er påkrævet når 'Beløb' er valgt",
  path: ["prepaidAmount"],
});

type FormData = z.infer<typeof formSchema>;

interface LeaseTenantFormProps {
  leaseId: string;
  leaseTenant?: LeaseTenant | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const depositOptions = [
  { value: "none", label: "Ingen" },
  { value: "1_month", label: "1 måned" },
  { value: "2_months", label: "2 måneder" },
  { value: "3_months", label: "3 måneder" },
  { value: "4_months", label: "4 måneder" },
  { value: "5_months", label: "5 måneder" },
  { value: "6_months", label: "6 måneder" },
  { value: "amount", label: "Beløb" },
];

const prepaidOptions = [
  { value: "none", label: "Ingen" },
  { value: "1_month", label: "1 måned" },
  { value: "2_months", label: "2 måneder" },
  { value: "3_months", label: "3 måneder" },
  { value: "4_months", label: "4 måneder" },
  { value: "5_months", label: "5 måneder" },
  { value: "6_months", label: "6 måneder" },
  { value: "amount", label: "Beløb" },
];

const regulationOptions = [
  { value: "none", label: "Ingen regulering" },
  { value: "NPI", label: "NPI" },
  { value: "NPI_min_1", label: "NPI min. 1%" },
  { value: "NPI_min_2", label: "NPI min. 2%" },
  { value: "NPI_min_3", label: "NPI min. 3%" },
];

export function LeaseTenantForm({ leaseId, leaseTenant, onSuccess, onCancel }: LeaseTenantFormProps) {
  const { toast } = useToast();
  const isEditing = !!leaseTenant;
  const [calculatedDeposit, setCalculatedDeposit] = useState<number>(0);
  const [calculatedPrepaid, setCalculatedPrepaid] = useState<number>(0);

  const { data: tenants = [] } = useQuery<Tenant[]>({
    queryKey: ["/api/tenants"],
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      leaseId,
      tenantId: leaseTenant?.tenantId || "",
      rentAmount: leaseTenant?.rentAmount ? parseFloat(leaseTenant.rentAmount.toString()) : "",
      advanceWater: leaseTenant?.advanceWater ? parseFloat(leaseTenant.advanceWater.toString()) : "",
      advanceHeating: leaseTenant?.advanceHeating ? parseFloat(leaseTenant.advanceHeating.toString()) : "",
      advanceElectricity: leaseTenant?.advanceElectricity ? parseFloat(leaseTenant.advanceElectricity.toString()) : "",
      advanceOther: leaseTenant?.advanceOther ? parseFloat(leaseTenant.advanceOther.toString()) : "",
      periodStart: leaseTenant?.periodStart ? leaseTenant.periodStart.split('T')[0] : "",
      periodEnd: leaseTenant?.periodEnd ? leaseTenant.periodEnd.split('T')[0] : "",
      depositType: leaseTenant?.depositType || "none",
      depositAmount: leaseTenant?.depositAmount ? parseFloat(leaseTenant.depositAmount.toString()) : "",
      prepaidType: leaseTenant?.prepaidType || "none",
      prepaidAmount: leaseTenant?.prepaidAmount ? parseFloat(leaseTenant.prepaidAmount.toString()) : "",
      regulationType: leaseTenant?.regulationType || "none",
      note: leaseTenant?.note || "",
    },
  });

  const watchRentAmount = form.watch("rentAmount");
  const watchDepositType = form.watch("depositType");
  const watchPrepaidType = form.watch("prepaidType");

  // Calculate deposit and prepaid amounts when rent or type changes
  useEffect(() => {
    // Handle both number and formatted string values
    let rentAmount = 0;
    if (typeof watchRentAmount === 'number') {
      rentAmount = watchRentAmount;
    } else if (typeof watchRentAmount === 'string') {
      rentAmount = parseDanishNumber(watchRentAmount);
    }
    
    console.log("Rent calculation - watchRentAmount:", watchRentAmount, "type:", typeof watchRentAmount, "parsed:", rentAmount);
    
    // Calculate deposit amount
    if (watchDepositType !== "amount" && watchDepositType !== "none" && rentAmount > 0) {
      const months = parseInt(watchDepositType.split("_")[0]);
      const calculated = Math.round(rentAmount * months * 100) / 100; // Round to 2 decimal places
      console.log("Deposit calculation - rentAmount:", rentAmount, "months:", months, "calculated:", calculated);
      setCalculatedDeposit(calculated);
      // Only set form value if not editing or if type is not "amount"
      if (!isEditing || watchDepositType !== "amount") {
        form.setValue("depositAmount", calculated);
      }
    } else if (watchDepositType === "none") {
      setCalculatedDeposit(0);
      form.setValue("depositAmount", "");
    } else if (watchDepositType === "amount") {
      setCalculatedDeposit(0); // No calculation for manual amount
    }

    // Calculate prepaid amount
    if (watchPrepaidType !== "amount" && watchPrepaidType !== "none" && rentAmount > 0) {
      const months = parseInt(watchPrepaidType.split("_")[0]);
      const calculated = Math.round(rentAmount * months * 100) / 100; // Round to 2 decimal places
      console.log("Prepaid calculation - rentAmount:", rentAmount, "months:", months, "calculated:", calculated);
      setCalculatedPrepaid(calculated);
      // Only set form value if not editing or if type is not "amount"
      if (!isEditing || watchPrepaidType !== "amount") {
        form.setValue("prepaidAmount", calculated);
      }
    } else if (watchPrepaidType === "none") {
      setCalculatedPrepaid(0);
      form.setValue("prepaidAmount", "");
    } else if (watchPrepaidType === "amount") {
      setCalculatedPrepaid(0); // No calculation for manual amount
    }
  }, [watchRentAmount, watchDepositType, watchPrepaidType, form, isEditing]);

  // Format numbers when editing existing data
  useEffect(() => {
    if (isEditing && leaseTenant) {
      console.log("Loading existing lease tenant data:", leaseTenant);
      // Set formatted values for display
      if (leaseTenant.rentAmount) {
        const rentValue = Math.round(parseFloat(leaseTenant.rentAmount.toString()) * 100) / 100;
        console.log("Rent amount from DB:", leaseTenant.rentAmount, "parsed:", rentValue);
        form.setValue("rentAmount", rentValue);
      }
      
      if (leaseTenant.advanceWater) {
        const waterValue = parseFloat(leaseTenant.advanceWater.toString());
        form.setValue("advanceWater", waterValue);
      }
      
      if (leaseTenant.advanceHeating) {
        const heatingValue = parseFloat(leaseTenant.advanceHeating.toString());
        console.log("Advance heating from DB:", leaseTenant.advanceHeating, "parsed:", heatingValue);
        form.setValue("advanceHeating", heatingValue);
      }
      
      if (leaseTenant.advanceElectricity) {
        const electricityValue = parseFloat(leaseTenant.advanceElectricity.toString());
        form.setValue("advanceElectricity", electricityValue);
      }
      
      if (leaseTenant.advanceOther) {
        const otherValue = parseFloat(leaseTenant.advanceOther.toString());
        form.setValue("advanceOther", otherValue);
      }
      
      if (leaseTenant.depositAmount) {
        const depositValue = parseFloat(leaseTenant.depositAmount.toString());
        console.log("Deposit amount from DB:", leaseTenant.depositAmount, "parsed:", depositValue);
        form.setValue("depositAmount", depositValue);
        // Set the displayed calculated amount when editing
        if (leaseTenant.depositType !== "amount" && leaseTenant.depositType !== "none") {
          setCalculatedDeposit(depositValue);
        }
      }
      
      if (leaseTenant.prepaidAmount) {
        const prepaidValue = parseFloat(leaseTenant.prepaidAmount.toString());
        form.setValue("prepaidAmount", prepaidValue);
        // Set the displayed calculated amount when editing
        if (leaseTenant.prepaidType !== "amount" && leaseTenant.prepaidType !== "none") {
          setCalculatedPrepaid(prepaidValue);
        }
      }
    }
  }, [isEditing, leaseTenant, form]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const url = isEditing ? `/api/lease-tenants/${leaseTenant.id}` : "/api/lease-tenants";
      const method = isEditing ? "PATCH" : "POST";
      
      // Clean up empty strings and convert to proper types
      const cleanData = {
        ...data,
        periodEnd: data.periodEnd || null,
        rentAmount: typeof data.rentAmount === 'string' ? parseDanishNumber(data.rentAmount) : data.rentAmount,
        advanceWater: data.advanceWater && data.advanceWater !== "0,00" && data.advanceWater !== "0" ? (typeof data.advanceWater === 'string' ? parseDanishNumber(data.advanceWater) : data.advanceWater) : null,
        advanceHeating: data.advanceHeating && data.advanceHeating !== "0,00" && data.advanceHeating !== "0" ? (typeof data.advanceHeating === 'string' ? parseDanishNumber(data.advanceHeating) : data.advanceHeating) : null,
        advanceElectricity: data.advanceElectricity && data.advanceElectricity !== "0,00" && data.advanceElectricity !== "0" ? (typeof data.advanceElectricity === 'string' ? parseDanishNumber(data.advanceElectricity) : data.advanceElectricity) : null,
        advanceOther: data.advanceOther && data.advanceOther !== "0,00" && data.advanceOther !== "0" ? (typeof data.advanceOther === 'string' ? parseDanishNumber(data.advanceOther) : data.advanceOther) : null,
        depositAmount: data.depositAmount ? Math.round((typeof data.depositAmount === 'string' ? parseDanishNumber(data.depositAmount) : data.depositAmount) * 100) / 100 : null,
        prepaidAmount: data.prepaidAmount ? Math.round((typeof data.prepaidAmount === 'string' ? parseDanishNumber(data.prepaidAmount) : data.prepaidAmount) * 100) / 100 : null,
        note: data.note || null,
      };
      
      console.log("Sending to server:", JSON.stringify(cleanData, null, 2));
      return apiRequest(url, method, cleanData);
    },
    onSuccess: () => {
      toast({
        title: isEditing ? "Kontrakt opdateret" : "Kontrakt oprettet",
        description: isEditing ? "Lejekontrakten er blevet opdateret" : "Den nye lejekontrakt er blevet oprettet",
      });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Fejl",
        description: error.message || "Der opstod en fejl ved gem af kontrakten",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    mutation.mutate(data);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('da-DK', {
      style: 'currency',
      currency: 'DKK',
    }).format(amount);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="tenantId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lejer *</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  defaultValue={field.value}
                  data-testid="select-tenant"
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Vælg lejer" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {tenants.map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id}>
                        #{tenant.internalNumber} - {tenant.name}
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
            name="rentAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Månedlig leje *</FormLabel>
                <FormControl>
                  <Input 
                    type="text"
                    placeholder="25.000,50"
                    data-testid="input-rent-amount"
                    value={field.value !== undefined && field.value !== null ? (typeof field.value === 'number' ? formatDanishNumber(field.value) : field.value) : ""}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      
                      // Allow typing of numbers, comma, and dots
                      if (inputValue === "" || /^[\d.,]*$/.test(inputValue)) {
                        // Store the raw formatted value (with comma) instead of converting to number
                        const formatted = formatDanishNumber(inputValue);
                        field.onChange(formatted);
                      }
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <FormField
            control={form.control}
            name="advanceWater"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Aconto vand</FormLabel>
                <FormControl>
                  <Input 
                    type="text"
                    placeholder="0,00"
                    data-testid="input-advance-water"
                    value={field.value !== undefined && field.value !== null ? (typeof field.value === 'number' ? formatDanishNumber(field.value) : field.value) : ""}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      if (inputValue === "" || /^[\d.,]*$/.test(inputValue)) {
                        const formatted = formatDanishNumber(inputValue);
                        field.onChange(formatted);
                      }
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="advanceHeating"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Aconto varme</FormLabel>
                <FormControl>
                  <Input 
                    type="text"
                    placeholder="0,00"
                    data-testid="input-advance-heating"
                    value={field.value !== undefined && field.value !== null ? (typeof field.value === 'number' ? formatDanishNumber(field.value) : field.value) : ""}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      if (inputValue === "" || /^[\d.,]*$/.test(inputValue)) {
                        const formatted = formatDanishNumber(inputValue);
                        field.onChange(formatted);
                      }
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="advanceElectricity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Aconto el</FormLabel>
                <FormControl>
                  <Input 
                    type="text"
                    placeholder="0,00"
                    data-testid="input-advance-electricity"
                    value={field.value !== undefined && field.value !== null ? (typeof field.value === 'number' ? formatDanishNumber(field.value) : field.value) : ""}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      if (inputValue === "" || /^[\d.,]*$/.test(inputValue)) {
                        const formatted = formatDanishNumber(inputValue);
                        field.onChange(formatted);
                      }
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="advanceOther"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Aconto øvrigt</FormLabel>
                <FormControl>
                  <Input 
                    type="text"
                    placeholder="0,00"
                    data-testid="input-advance-other"
                    value={field.value !== undefined && field.value !== null ? (typeof field.value === 'number' ? formatDanishNumber(field.value) : field.value) : ""}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      if (inputValue === "" || /^[\d.,]*$/.test(inputValue)) {
                        const formatted = formatDanishNumber(inputValue);
                        field.onChange(formatted);
                      }
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="periodStart"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lejeperiode start *</FormLabel>
                <FormControl>
                  <Input 
                    type="date"
                    data-testid="input-period-start"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="periodEnd"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lejeperiode slut</FormLabel>
                <FormControl>
                  <Input 
                    type="date"
                    data-testid="input-period-end"
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <FormField
              control={form.control}
              name="depositType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Depositum type</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                    data-testid="select-deposit-type"
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {depositOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
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
              name="depositAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Depositum beløb
                    {watchDepositType !== "amount" && calculatedDeposit > 0 && (
                      <span className="text-sm text-gray-500 ml-2">
                        (Beregnet: {formatCurrency(calculatedDeposit)})
                      </span>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="text"
                      placeholder="75.000,50"
                      disabled={watchDepositType !== "amount"}
                      data-testid="input-deposit-amount"
                      value={
                        watchDepositType !== "amount" && calculatedDeposit > 0 
                          ? formatCurrency(calculatedDeposit).replace(' kr', '').replace(' DKK', '') 
                          : field.value !== undefined && field.value !== null ? (typeof field.value === 'number' ? formatDanishNumber(field.value) : field.value) : ""
                      }
                      onChange={(e) => {
                        const inputValue = e.target.value;
                        if (inputValue === "" || /^[\d.,]*$/.test(inputValue)) {
                          const formatted = formatDanishNumber(inputValue);
                          field.onChange(formatted);
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-2">
            <FormField
              control={form.control}
              name="prepaidType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Forudbetalt leje type</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                    data-testid="select-prepaid-type"
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {prepaidOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
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
              name="prepaidAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Forudbetalt beløb
                    {watchPrepaidType !== "amount" && calculatedPrepaid > 0 && (
                      <span className="text-sm text-gray-500 ml-2">
                        (Beregnet: {formatCurrency(calculatedPrepaid)})
                      </span>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="text"
                      placeholder="25.000,50"
                      disabled={watchPrepaidType !== "amount"}
                      data-testid="input-prepaid-amount"
                      value={
                        watchPrepaidType !== "amount" && calculatedPrepaid > 0 
                          ? formatCurrency(calculatedPrepaid).replace(' kr', '').replace(' DKK', '') 
                          : field.value !== undefined && field.value !== null ? (typeof field.value === 'number' ? formatDanishNumber(field.value) : field.value) : ""
                      }
                      onChange={(e) => {
                        const inputValue = e.target.value;
                        if (inputValue === "" || /^[\d.,]*$/.test(inputValue)) {
                          const formatted = formatDanishNumber(inputValue);
                          field.onChange(formatted);
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <FormField
          control={form.control}
          name="regulationType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Lejeregulering</FormLabel>
              <Select 
                onValueChange={field.onChange} 
                defaultValue={field.value}
                data-testid="select-regulation"
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {regulationOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
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
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Note</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Yderligere information om kontrakten"
                  className="min-h-[80px]"
                  data-testid="textarea-note"
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
            {mutation.isPending ? "Gemmer..." : (isEditing ? "Opdater kontrakt" : "Opret kontrakt")}
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