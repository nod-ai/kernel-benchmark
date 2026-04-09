import { useState, useEffect } from "react";
import { GitBranch, Loader2 } from "lucide-react";
import { fetchBranches } from "../../../utils/github";

interface BranchSelectorProps {
  branch: string;
  onChange: (branch: string) => void;
  disabled?: boolean;
}

export default function BranchSelector({
  branch,
  onChange,
  disabled = false,
}: BranchSelectorProps) {
  const [branches, setBranches] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBranches();
  }, []);

  const loadBranches = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const branchList = await fetchBranches();
      setBranches(branchList);
    } catch (err) {
      console.error("Failed to load branches:", err);
      setError("Failed to load branches");
      setBranches(["main", "develop/dashboard-restoration"]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg">
          <GitBranch className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <h4 className="font-semibold text-gray-900">Repository Branch *</h4>
          <p className="text-sm text-gray-600">
            Select the kernel-benchmark branch to use
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading branches...</span>
        </div>
      ) : (
        <div className="space-y-2">
          <select
            value={branch}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {branches.map((branchName) => (
              <option key={branchName} value={branchName}>
                {branchName}
              </option>
            ))}
          </select>
          {error && (
            <p className="text-sm text-amber-600">{error} - Using fallback list</p>
          )}
        </div>
      )}
    </div>
  );
}
