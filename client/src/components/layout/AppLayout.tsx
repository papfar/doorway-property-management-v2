import TopBar from "./TopBar";
import Sidebar from "./Sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar />
      <Sidebar />
      <main className="ml-60 mt-16 p-6">
        {children}
      </main>
    </div>
  );
}
