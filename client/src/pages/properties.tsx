import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import PropertyList from "@/components/properties/PropertyList";
import PropertyForm from "@/components/properties/PropertyForm";
import { useAuth } from "@/hooks/useAuth";

export default function PropertiesPage() {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const canWrite = user?.role === 'admin' || user?.role === 'user';

  const handleCreateProperty = () => {
    setShowForm(true);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Ejendomme</h1>
          <p className="text-gray-600 mt-1">
            {canWrite ? "Administrer og overvåg dine ejendomme" : "Se oversigt over ejendomme"}
          </p>
        </div>
        {canWrite && (
          <Button onClick={handleCreateProperty} data-testid="button-create-property">
            <Plus className="mr-2" size={16} />
            Opret ejendom
          </Button>
        )}
      </div>

      <PropertyList />

      <PropertyForm
        isOpen={showForm}
        onClose={() => setShowForm(false)}
      />
    </>
  );
}
