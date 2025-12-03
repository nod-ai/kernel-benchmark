// PageContainer.tsx
import { type ReactNode } from "react";
import type { PageName } from "./Navbar";
import Navbar from "./Navbar";
import { Loader2 } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

interface PageContainerProps {
  activePage: PageName;
  children: ReactNode;
  isLoading?: boolean;
  requireAuth?: boolean;
}

const authPages: PageName[] = ["history", "new", "tune"];

export default function PageContainer({
  activePage,
  children,
  isLoading,
}: PageContainerProps) {
  const { isAuthenticated } = useAuth();
  const requireAuth = authPages.includes(activePage);

  // useEffect(() => {
  //   if (requireAuth && !isAuthenticated) {
  //     navigate("/dashboard");
  //   }
  // }, [requireAuth, isAuthenticated, navigate]);

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
        "Waiting"
      )}
    </>
  );
}
