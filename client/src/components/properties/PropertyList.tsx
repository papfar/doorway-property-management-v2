import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency, formatPropertyType, formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Building, Plus, Eye, Edit2, Trash2, MoreHorizontal, ArrowUpDown, Search, Filter } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import PropertyForm from "./PropertyForm";
import { useLocation } from "wouter";
import { toast } from "@/hooks/use-toast";
import type { Property, Company } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

export default function PropertyList() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | undefined>();
  const [deletingProperty, setDeletingProperty] = useState<Property | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<'name' | 'address' | 'propertyType' | 'ownerCompanyName' | 'acquisitionPrice'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  const isAdmin = user?.role === 'admin';

  const { data: properties = [], isLoading } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
  });

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ["/api/companies"],
  });

  const filteredAndSortedProperties = useMemo(() => {
    let filtered = properties.filter(property => {
      const ownerCompany = companies.find(c => c.id === property.ownerCompanyId);
      const matchesSearch = property.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           property.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           (ownerCompany?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = typeFilter === "all" || property.propertyType === typeFilter;
      return matchesSearch && matchesType;
    });

    filtered.sort((a, b) => {
      let aValue: any = '';
      let bValue: any = '';

      switch (sortField) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'address':
          aValue = a.address.toLowerCase();
          bValue = b.address.toLowerCase();
          break;
        case 'propertyType':
          aValue = a.propertyType?.toLowerCase() || '';
          bValue = b.propertyType?.toLowerCase() || '';
          break;
        case 'ownerCompanyName':
          const aCompany = companies.find(c => c.id === a.ownerCompanyId);
          const bCompany = companies.find(c => c.id === b.ownerCompanyId);
          aValue = aCompany?.name?.toLowerCase() || '';
          bValue = bCompany?.name?.toLowerCase() || '';
          break;
        case 'acquisitionPrice':
          aValue = a.acquisitionPrice || 0;
          bValue = b.acquisitionPrice || 0;
          break;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [properties, companies, searchQuery, typeFilter, sortField, sortDirection]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const uniqueTypes = useMemo(() => {
    const types = properties.map(property => property.propertyType).filter(Boolean);
    return Array.from(new Set(types));
  }, [properties]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest(`/api/properties/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/recent"] });
      setDeletingProperty(undefined);
      toast({
        title: "Success",
        description: "Ejendom slettet",
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

  const handleCreateProperty = () => {
    setEditingProperty(undefined);
    setShowForm(true);
  };

  const handleEditProperty = (property: Property) => {
    setEditingProperty(property);
    setShowForm(true);
  };

  const handleViewProperty = (property: Property) => {
    setLocation(`/properties/${property.id}`);
  };

  const handleDeleteProperty = (property: Property) => {
    setDeletingProperty(property);
  };

  const confirmDelete = () => {
    if (deletingProperty) {
      deleteMutation.mutate(deletingProperty.id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <>
        <Card className="text-center py-12">
          <CardContent className="pt-6">
            <div className="w-24 h-24 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-6">
              <Building className="text-gray-400 text-3xl" size={48} />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Ingen ejendomme endnu</h3>
            <p className="text-gray-600 mb-6 max-w-sm mx-auto">
              Kom i gang ved at oprette din første ejendom. Du kan tilføje alle relevante oplysninger og spore værdien over tid.
            </p>
            {isAdmin && (
              <Button onClick={handleCreateProperty} data-testid="button-create-first-property">
                <Plus className="mr-2" size={16} />
                Opret ejendom
              </Button>
            )}
          </CardContent>
        </Card>

        <PropertyForm
          isOpen={showForm}
          onClose={() => setShowForm(false)}
          property={editingProperty}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {/* Filters and search */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Søg efter ejendom, adresse eller selskab..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-properties"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-48" data-testid="select-filter-type">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filtrer efter type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle typer</SelectItem>
              {uniqueTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {formatPropertyType(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Results count */}
        <div className="text-sm text-gray-600">
          Viser {filteredAndSortedProperties.length} af {properties.length} ejendomme
        </div>

        {/* Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('name')}
                    className="h-auto p-0 font-semibold"
                    data-testid="sort-name"
                  >
                    Ejendom
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('address')}
                    className="h-auto p-0 font-semibold"
                    data-testid="sort-address"
                  >
                    Adresse
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('propertyType')}
                    className="h-auto p-0 font-semibold"
                    data-testid="sort-type"
                  >
                    Type
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('ownerCompanyName')}
                    className="h-auto p-0 font-semibold"
                    data-testid="sort-company"
                  >
                    Ejerselskab
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead className="text-right">
                  <Button
                    variant="ghost"
                    onClick={() => handleSort('acquisitionPrice')}
                    className="h-auto p-0 font-semibold"
                    data-testid="sort-price"
                  >
                    Anskaffelsessum
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                  </Button>
                </TableHead>
                <TableHead className="text-center">Handlinger</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAndSortedProperties.map((property: Property) => {
                const ownerCompany = companies.find(c => c.id === property.ownerCompanyId);
                return (
                  <TableRow key={property.id} data-testid={`row-property-${property.id}`}>
                    <TableCell className="font-medium" data-testid={`text-property-name-${property.id}`}>
                      {property.name}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-900" data-testid={`text-property-address-${property.id}`}>
                        {property.address}
                      </div>
                      <div className="text-sm text-gray-500" data-testid={`text-property-postal-${property.id}`}>
                        {property.postalCode} {property.city}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full" data-testid={`text-property-type-${property.id}`}>
                        {formatPropertyType(property.propertyType)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-900" data-testid={`text-owner-company-${property.id}`}>
                        {ownerCompany ? ownerCompany.name : "Ikke tilknyttet"}
                      </div>
                      {ownerCompany?.cvrNumber && (
                        <div className="text-sm text-gray-500">
                          CVR: {ownerCompany.cvrNumber}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-900" data-testid={`text-acquisition-value-${property.id}`}>
                        {property.acquisitionPrice ? `${formatNumber(property.acquisitionPrice)} kr` : "-"}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" data-testid={`button-actions-${property.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleViewProperty(property)} data-testid={`menu-view-${property.id}`}>
                            <Eye className="h-4 w-4 mr-2" />
                            Se ejendom
                          </DropdownMenuItem>
                          {isAdmin && (
                            <>
                              <DropdownMenuItem onClick={() => handleEditProperty(property)} data-testid={`menu-edit-${property.id}`}>
                                <Edit2 className="h-4 w-4 mr-2" />
                                Rediger
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDeleteProperty(property)} 
                                className="text-red-600"
                                data-testid={`menu-delete-${property.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Slet
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <PropertyForm
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        property={editingProperty}
      />

      <AlertDialog open={!!deletingProperty} onOpenChange={() => setDeletingProperty(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Slet ejendom</AlertDialogTitle>
            <AlertDialogDescription>
              Er du sikker på, at du vil slette ejendommen "{deletingProperty?.name}"? 
              Denne handling kan ikke fortrydes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Annuller</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Sletter..." : "Slet"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
