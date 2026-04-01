import { useEffect, useState } from "react";
import type { Kernel, Tracker, TrackerRunHistory } from "../types";
import { fetchData } from "../utils/csv";
import PageContainer from "../components/PageContainer";
import { useLocation } from "react-router-dom";
import { TrendingUp } from "lucide-react";
import DashboardPerformanceSection from "../components/DashboardSections/DashboardPerformanceSection";
import TrackerDashboardSection from "../components/DashboardSections/TrackerDashboardSection";

export default function Dashboard() {
  const [kernels, setKernels] = useState<Kernel[]>([]);
  const [isTrackerDashboard, setIsTrackerDashboard] = useState(false);
  const [tracker, setTracker] = useState<Tracker | null>(null);
  const [selectedRunBlobName, setSelectedRunBlobName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [runBackendSpecs, setRunBackendSpecs] = useState<Record<string, any>>({});

  const location = useLocation();

  // Detect dashboard type from URL and load initial data
  useEffect(() => {
    const detectDashboardType = async () => {
      setIsLoading(true);
      
      if (location.pathname.includes('/dashboard/tracker/')) {
        // Tracker dashboard mode
        setIsTrackerDashboard(true);
        const dashboardName = location.pathname.split('/').pop();
        
        try {
          // Fetch tracker info
          const trackerResponse = await fetch(
            `${import.meta.env.VITE_BACKEND_SERVER_URL}/api/trackers/dashboard/${dashboardName}`
          );
          
          if (!trackerResponse.ok) {
            throw new Error("Tracker not found");
          }
          
          const trackerData = await trackerResponse.json();
          setTracker(trackerData);
          
          // Fetch tracker runs to get the latest run
          const runsResponse = await fetch(
            `${import.meta.env.VITE_BACKEND_SERVER_URL}/api/trackers/${trackerData._id}/runs`
          );
          const runsData: TrackerRunHistory[] = await runsResponse.json();
          
          // Auto-select the latest run (first in sorted array)
          if (runsData.length > 0) {
            const latestRun = runsData[0];
            setSelectedRunBlobName(latestRun.run.blobName);
          }
        } catch (error) {
          console.error("Failed to fetch tracker:", error);
        } finally {
          setIsLoading(false);
        }
      } else {
        // Artifact-only dashboard mode
        setIsTrackerDashboard(false);
        const runIdOrBlobName = location.pathname.split('/').pop();
        setSelectedRunBlobName(runIdOrBlobName || null);
        
        // Fetch run data to get backendSpecs
        if (runIdOrBlobName) {
          try {
            const response = await fetch(
              `${import.meta.env.VITE_BACKEND_SERVER_URL}/api/runs?page=1&page_size=1000&completed_only=true`
            );
            const data = await response.json();
            const runs = data.runs || [];
            
            // Find matching run by blobName or ID
            const item = runs.find((item: any) => 
              item.run?.blobName === runIdOrBlobName || item.run?._id === runIdOrBlobName
            );
            
            // Extract backendSpecs from trigger metadata
            if (item?.trigger?.metadata?.backendSpecs) {
              const specsMap: Record<string, any> = {};
              item.trigger.metadata.backendSpecs.forEach((spec: any) => {
                // Use backendParam as key if available (e.g., wave_4wave), otherwise use backend
                const key = spec.backendParam || spec.backend;
                specsMap[key] = spec;
              });
              setRunBackendSpecs(specsMap);
            }
          } catch (error) {
            console.error("Failed to fetch run data:", error);
          }
        }
        
        setIsLoading(false);
      }
    };

    detectDashboardType();
  }, [location.pathname]);

  // Load kernel data when blobName is available
  useEffect(() => {
    if (selectedRunBlobName) {
      fetchData(selectedRunBlobName).then(setKernels);
    }
  }, [selectedRunBlobName]);

  const handleRunSelected = (_runId: string, blobName: string) => {
    setSelectedRunBlobName(blobName);
  };

  return (
    <PageContainer activePage="dashboard" isLoading={isLoading}>
      <div className="flex flex-col gap-6">
        {/* Compact Tracker Header */}
        {isTrackerDashboard && tracker && (
          <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg border border-blue-200 px-6 py-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-600 rounded-lg">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">{tracker.name}</h1>
                <p className="text-xs text-gray-600">Performance tracking dashboard</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Performance Results - Main Focus */}
        {kernels.length > 0 && (
          <DashboardPerformanceSection 
            kernels={kernels}
            latestBackendSpecs={isTrackerDashboard ? undefined : runBackendSpecs}
            trackerId={isTrackerDashboard ? tracker?._id : undefined}
          />
        )}
        
        {/* Tracker Controls and Timeline */}
        {isTrackerDashboard && tracker && (
          <TrackerDashboardSection
            trackerId={tracker._id}
            onRunSelected={handleRunSelected}
            selectedRunBlobName={selectedRunBlobName}
          />
        )}
        
        {!isTrackerDashboard && kernels.length === 0 && !isLoading && (
          <div className="text-center py-12 text-gray-500">
            <p>No kernel data available for this run.</p>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
