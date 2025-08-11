import { AuthProvider } from "@/hooks/useAuth";
import SetupWizard from "@/components/auth/SetupWizard";

export default function SetupPage() {
  return (
    <AuthProvider>
      <SetupWizard />
    </AuthProvider>
  );
}
