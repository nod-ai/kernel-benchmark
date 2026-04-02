import { type ReactNode, useEffect } from "react";
import type { PageName } from "./Navbar";
import Navbar from "./Navbar";
import { Loader2, Lock } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

interface PageContainerProps {
  activePage: PageName;
  children: ReactNode;
  isLoading?: boolean;
  requireAuth?: boolean;
}

const authPages: PageName[] = ["history", "runs", "new", "kernels", "tracking"];

export default function PageContainer({
  activePage,
  children,
  isLoading,
}: PageContainerProps) {
  const { isAuthenticated, requestAuth } = useAuth();
  const requireAuth = authPages.includes(activePage);

  useEffect(() => {
    if (requireAuth && !isAuthenticated) {
      requestAuth();
    }
  }, [requireAuth, isAuthenticated, requestAuth]);

  return (
    <>
      <Navbar activePage={activePage} />
      {!requireAuth || isAuthenticated ? (
        <div className="px-12 pt-24 pb-6">
          {isLoading ? (
            <div className="flex items-center justify-center min-h-[60vh]">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
                <p className="text-gray-600 text-lg font-medium">Loading...</p>
              </div>
            </div>
          ) : (
            children
          )}
        </div>
      ) : (
        <div className="px-12 pt-24 pb-6">
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="flex flex-col items-center gap-4">
              <Lock className="w-12 h-12 text-gray-400" />
              <p className="text-gray-600 text-lg font-medium">
                Authentication required to view this page
              </p>
              <button
                onClick={() => requestAuth()}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Sign In
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
