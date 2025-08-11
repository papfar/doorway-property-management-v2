import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Building, TrendingUp, Clock, FileText, Square } from "lucide-react";
import { formatCurrency, formatDate, formatNumber } from "@/lib/utils";

export default function DashboardStats() {
  const { data: stats, isLoading } = useQuery<{
    count: number;
    totalValue: string;
    latestProperty: { name: string; acquisitionDate: string } | null;
    leaseStats: { count: number; totalRentCapacity: string };
  }>({
    queryKey: ["/api/dashboard/stats"],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                <div className="ml-4 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                  <div className="h-6 bg-gray-200 rounded w-16"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
      {/* Property Count Card */}
      <Card data-testid="card-property-count">
        <CardContent className="p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Building className="text-blue-600" size={24} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Antal ejendomme</p>
              <p className="text-2xl font-semibold text-gray-900" data-testid="text-property-count">
                {stats.count}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total Acquisition Value Card */}
      <Card data-testid="card-total-value">
        <CardContent className="p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="text-green-600" size={24} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total anskaffelsessum</p>
              <p className="text-2xl font-semibold text-gray-900" data-testid="text-total-value">
                {formatNumber(stats.totalValue)} kr
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lease Count Card */}
      <Card data-testid="card-lease-count">
        <CardContent className="p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <FileText className="text-orange-600" size={24} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Antal lejemål</p>
              <p className="text-2xl font-semibold text-gray-900" data-testid="text-lease-count">
                {stats.leaseStats?.count || 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Latest Property Card */}
      <Card data-testid="card-latest-property">
        <CardContent className="p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Clock className="text-purple-600" size={24} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Senest anskaffede</p>
              {stats.latestProperty ? (
                <>
                  <p className="text-lg font-semibold text-gray-900" data-testid="text-latest-property-name">
                    {stats.latestProperty.name}
                  </p>
                  <p className="text-sm text-gray-500" data-testid="text-latest-property-date">
                    {formatDate(stats.latestProperty.acquisitionDate)}
                  </p>
                </>
              ) : (
                <p className="text-lg font-semibold text-gray-500">-</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total Area Card */}
      <Card data-testid="card-total-area">
        <CardContent className="p-6">
          <div className="flex items-center">
            <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
              <Square className="text-indigo-600" size={24} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Antal m²</p>
              <p className="text-2xl font-semibold text-gray-900" data-testid="text-total-area">
                {formatNumber(stats.leaseStats?.totalRentCapacity || "0")} m²
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
