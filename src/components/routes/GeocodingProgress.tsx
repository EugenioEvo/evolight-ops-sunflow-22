import React from 'react';
import { Progress } from "@/components/ui/progress";
import { RefreshCw } from "lucide-react";

interface GeocodingProgressProps {
  isGeocoding: boolean;
  progress: number;
  completed: number;
  total: number;
}

const GeocodingProgressComponent: React.FC<GeocodingProgressProps> = ({
  isGeocoding,
  progress,
  completed,
  total
}) => {
  if (!isGeocoding) return null;

  return (
    <div className="fixed top-4 right-4 w-80 bg-card shadow-lg rounded-lg p-4 z-50 border animate-fade-in">
      <div className="flex items-center space-x-3">
        <RefreshCw className="h-5 w-5 animate-spin text-primary" />
        <div className="flex-1">
          <p className="text-sm font-medium">Geocodificando endereços</p>
          <Progress value={progress} className="mt-2" />
          <p className="text-xs text-muted-foreground mt-1">
            {completed}/{total} concluídos
          </p>
        </div>
      </div>
    </div>
  );
};

export const GeocodingProgress = React.memo(GeocodingProgressComponent);
