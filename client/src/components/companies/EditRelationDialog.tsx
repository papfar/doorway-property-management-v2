import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import type { CompanyRelation, Company } from '@shared/schema';

interface EditRelationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  relation: CompanyRelation | null;
  parentCompany: Company | null;
  childCompany: Company | null;
}

export default function EditRelationDialog({ 
  isOpen, 
  onClose, 
  relation, 
  parentCompany, 
  childCompany 
}: EditRelationDialogProps) {
  const { toast } = useToast();
  const [ownershipPercentage, setOwnershipPercentage] = useState(
    relation ? relation.ownershipPercentage : ''
  );

  const updateMutation = useMutation({
    mutationFn: async (data: { ownershipPercentage: number }) => {
      if (!relation) throw new Error('Ingen relation at opdatere');
      return await apiRequest(`/api/company-relations/${relation.id}`, "PUT", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/company-relations"] });
      toast({
        title: "Opdateret",
        description: "Ejerskabsforhold blev opdateret",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Fejl",
        description: error.message || "Kunne ikke opdatere ejerskabsforhold",
        variant: "destructive",
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!relation) throw new Error('Ingen relation at slette');
      return await apiRequest(`/api/company-relations/${relation.id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/companies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/company-relations"] });
      toast({
        title: "Slettet",
        description: "Ejerskabsforhold blev slettet",
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Fejl",
        description: error.message || "Kunne ikke slette ejerskabsforhold",
        variant: "destructive",
      });
    }
  });

  const handleSave = () => {
    const percentage = parseFloat(ownershipPercentage);
    if (isNaN(percentage) || percentage < 0.01 || percentage > 100) {
      toast({
        title: "Fejl",
        description: "Ejerskabsprocent skal være mellem 0.01 og 100",
        variant: "destructive",
      });
      return;
    }

    updateMutation.mutate({ ownershipPercentage: percentage });
  };

  const handleDelete = () => {
    if (confirm('Er du sikker på at du vil slette dette ejerskabsforhold?')) {
      deleteMutation.mutate();
    }
  };

  // Reset state when dialog opens with new relation
  React.useEffect(() => {
    if (relation) {
      setOwnershipPercentage(relation.ownershipPercentage);
    }
  }, [relation]);

  if (!relation || !parentCompany || !childCompany) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rediger ejerskabsforhold</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              <strong className="text-gray-900 dark:text-white">{parentCompany.name}</strong> ejer
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <strong className="text-gray-900 dark:text-white">{childCompany.name}</strong>
            </div>
          </div>

          <div>
            <Label htmlFor="ownershipPercentage">Ejerskabsprocent</Label>
            <Input
              id="ownershipPercentage"
              type="number"
              min="0.01"
              max="100"
              step="0.01"
              value={ownershipPercentage}
              onChange={(e) => setOwnershipPercentage(e.target.value)}
              placeholder="f.eks. 51"
              data-testid="input-ownership-percentage"
            />
            <div className="text-xs text-gray-500 mt-1">
              Indtast ejerskabsprocent mellem 0.01 og 100
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              data-testid="button-delete-relation"
            >
              {deleteMutation.isPending ? 'Sletter...' : 'Slet forhold'}
            </Button>

            <div className="space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onClose}
                data-testid="button-cancel"
              >
                Annuller
              </Button>
              <Button
                type="button"
                onClick={handleSave}
                disabled={updateMutation.isPending}
                data-testid="button-save-relation"
              >
                {updateMutation.isPending ? 'Gemmer...' : 'Gem'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}