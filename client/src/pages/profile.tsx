import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProfileForm from "@/components/profile/ProfileForm";
import ChangePasswordForm from "@/components/profile/ChangePasswordForm";

export default function ProfilePage() {
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState("profile");

  useEffect(() => {
    const urlParams = new URLSearchParams(location.split('?')[1]);
    const tab = urlParams.get('tab');
    if (tab === 'password') {
      setActiveTab('password');
    }
  }, [location]);

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Min profil</h1>
        <p className="text-gray-600 mt-1">Administrer dine brugeroplysninger</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="profile" data-testid="tab-profile">Profil</TabsTrigger>
          <TabsTrigger value="password" data-testid="tab-password">Adgangskode</TabsTrigger>
        </TabsList>
        
        <TabsContent value="profile" className="mt-6">
          <ProfileForm />
        </TabsContent>
        
        <TabsContent value="password" className="mt-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">Skift adgangskode</h2>
            <p className="text-gray-600 mt-1">Opdater din adgangskode for øget sikkerhed</p>
          </div>
          <ChangePasswordForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}
