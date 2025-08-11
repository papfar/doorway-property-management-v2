import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Edit2, Trash2, Building, UserPlus, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Company, CompanyRelation } from "@shared/schema";
import CompanyRelationForm from "./CompanyRelationForm";
import EditRelationDialog from "./EditRelationDialog";

interface OwnershipManagementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  company: Company | null;
}

export default function OwnershipManagementDialog({ 
  isOpen, 
  onClose, 
  company 
}: OwnershipManagementDialogProps) {
  const { toast } = useToast();
  const [isRelationFormOpen, setIsRelationFormOpen] = useState(false);
  const [relationFormData, setRelationFormData] = useState<{
    companyId: string;
    companyName: string;
    relationType: "parent" | "child";
  } | null>(null);
  const [editingRelation, setEditingRelation] = useState<{
    relation: CompanyRelation;
    parentCompany: Company | null;
    childCompany: Company | null;
  } | null>(null);

  const { data: companies = [] } = useQuery<Company[]>({
    queryKey: ['/api/companies'],
    enabled: isOpen,
  });

  const { data: companyRelations = [] } = useQuery<CompanyRelation[]>({
    queryKey: ['/api/company-relations'],
    enabled: isOpen,
    staleTime: 0,
  });

  const { data: parentRelations = [] } = useQuery<CompanyRelation[]>({
    queryKey: ['/api/companies', company?.id, 'parents'],
    queryFn: async () => {
      if (!company?.id) return [];
      const response = await fetch(`/api/companies/${company.id}/parents`);
      if (!response.ok) throw new Error('Failed to fetch parent relations');
      return response.json();
    },
    enabled: isOpen && !!company?.id,
    staleTime: 0,
  });

  const { data: childRelations = [] } = useQuery<CompanyRelation[]>({
    queryKey: ['/api/companies', company?.id, 'children'],
    queryFn: async () => {
      if (!company?.id) return [];
      const response = await fetch(`/api/companies/${company.id}/children`);
      if (!response.ok) throw new Error('Failed to fetch child relations');
      return response.json();
    },
    enabled: isOpen && !!company?.id,
    staleTime: 0,
  });

  const deleteMutation = useMutation({
    mutationFn: async (relationId: string) => {
      const response = await fetch(`/api/company-relations/${relationId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/companies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/company-relations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/companies', company?.id, 'parents'] });
      queryClient.invalidateQueries({ queryKey: ['/api/companies', company?.id, 'children'] });
      toast({ 
        title: "Ejerskabsforhold slettet", 
        description: "Ejerskabsforholdet blev slettet med succes" 
      });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Fejl", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  });

  const getCompanyName = (companyId: string) => {
    const foundCompany = companies.find(c => c.id === companyId);
    return foundCompany?.name || 'Ukendt selskab';
  };

  const getCvrNumber = (companyId: string) => {
    const foundCompany = companies.find(c => c.id === companyId);
    return foundCompany?.cvrNumber || null;
  };

  const handleEditRelation = (relation: CompanyRelation) => {
    const parentCompany = companies.find(c => c.id === relation.parentCompanyId) || null;
    const childCompany = companies.find(c => c.id === relation.childCompanyId) || null;
    
    setEditingRelation({
      relation,
      parentCompany,
      childCompany
    });
  };

  if (!company) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Administrér ejerskab for {company.name}
              {company.cvrNumber && <span className="text-sm text-gray-500">(CVR: {company.cvrNumber})</span>}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Parent Companies (Owners) */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <UserPlus className="h-5 w-5" />
                  Ejere af {company.name}
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRelationFormData({
                      companyId: company.id,
                      companyName: company.name,
                      relationType: "parent",
                    });
                    setIsRelationFormOpen(true);
                  }}
                  data-testid="button-add-parent"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                {parentRelations.length === 0 ? (
                  <div className="text-center py-8">
                    <UserPlus className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Ingen ejere registreret</p>
                    <p className="text-xs text-gray-400 mt-1">Tilføj ejere ved at klikke på + knappen</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ejer</TableHead>
                        <TableHead>Andel</TableHead>
                        <TableHead className="text-right">Handlinger</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parentRelations.map((relation) => (
                        <TableRow key={relation.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{getCompanyName(relation.parentCompanyId)}</div>
                              {getCvrNumber(relation.parentCompanyId) && (
                                <div className="text-xs text-gray-500">
                                  CVR: {getCvrNumber(relation.parentCompanyId)}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-blue-600">
                              {parseFloat(relation.ownershipPercentage).toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditRelation(relation)}
                                data-testid={`button-edit-parent-${relation.id}`}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteMutation.mutate(relation.id)}
                                data-testid={`button-delete-parent-${relation.id}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Child Companies (Subsidiaries) */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="h-5 w-5" />
                  Datterselskaber af {company.name}
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRelationFormData({
                      companyId: company.id,
                      companyName: company.name,
                      relationType: "child",
                    });
                    setIsRelationFormOpen(true);
                  }}
                  data-testid="button-add-child"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                {childRelations.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Ingen datterselskaber registreret</p>
                    <p className="text-xs text-gray-400 mt-1">Tilføj datterselskaber ved at klikke på + knappen</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Datterselskab</TableHead>
                        <TableHead>Andel</TableHead>
                        <TableHead className="text-right">Handlinger</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {childRelations.map((relation) => (
                        <TableRow key={relation.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{getCompanyName(relation.childCompanyId)}</div>
                              {getCvrNumber(relation.childCompanyId) && (
                                <div className="text-xs text-gray-500">
                                  CVR: {getCvrNumber(relation.childCompanyId)}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-semibold text-green-600">
                              {parseFloat(relation.ownershipPercentage).toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditRelation(relation)}
                                data-testid={`button-edit-child-${relation.id}`}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteMutation.mutate(relation.id)}
                                data-testid={`button-delete-child-${relation.id}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Summary */}
          <Card className="mt-4">
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-blue-600">
                    {parentRelations.reduce((sum, rel) => sum + parseFloat(rel.ownershipPercentage), 0).toFixed(1)}%
                  </p>
                  <p className="text-sm text-gray-600">Total ejerskab af andre</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {childRelations.reduce((sum, rel) => sum + parseFloat(rel.ownershipPercentage), 0).toFixed(1)}%
                  </p>
                  <p className="text-sm text-gray-600">Total ejerskab i andre selskaber</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>

      {/* Company Relations Dialog */}
      {relationFormData && (
        <CompanyRelationForm
          isOpen={isRelationFormOpen}
          onClose={() => {
            setIsRelationFormOpen(false);
            setRelationFormData(null);
          }}
          companyId={relationFormData.companyId}
          companyName={relationFormData.companyName}
          relationType={relationFormData.relationType}
        />
      )}

      {/* Edit Relation Dialog */}
      <EditRelationDialog
        isOpen={!!editingRelation}
        onClose={() => setEditingRelation(null)}
        relation={editingRelation?.relation || null}
        parentCompany={editingRelation?.parentCompany || null}
        childCompany={editingRelation?.childCompany || null}
      />
    </>
  );
}