import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { getBackendColor } from "../utils/color";
import { getDefaultBackendSpec } from "../utils/backendSpecs";
import {
  type FilterState,
  type AvailableFilterOptions,
  type FilterDefinition,
} from "../hooks/useKernelFilters";

interface SelectProps {
  title: string;
  options: string[];
}
interface SingleSelectProps extends SelectProps {
  selectedOption: string;
  onInput: (selectedOption: string) => void;
}
interface MultiSelectProps extends SelectProps {
  selectedOptions: string[];
  distinctColors?: boolean;
  onInput: (selectedOptions: string[]) => void;
  latestBackendSpecs?: Record<string, any>; // Backend specs from latest run
  isTrackerDashboard?: boolean; // Whether this is a tracker dashboard (vs individual run)
}

export function SingleSelectFilter({
  title,
  options = [],
  selectedOption,
  onInput,
}: SingleSelectProps) {
  return (
    <div className="select-none flex gap-3 items-center flex-shrink-0">
      <span className="font-medium text-gray-700 text-sm whitespace-nowrap">
        {title}:
      </span>
      <div className="flex gap-2">
        {options.map((option) => (
          <button
            key={option}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 border whitespace-nowrap ${
              option === selectedOption
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-white text-gray-700 border-gray-300 hover:border-gray-400 hover:bg-gray-50"
            }`}
            onClick={() => onInput(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export function MultiSelectFilter({
  title,
  options = [],
  selectedOptions,
  distinctColors,
  onInput,
  latestBackendSpecs,
  isTrackerDashboard = false,
}: MultiSelectProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState<"left" | "right">(
    "left"
  );
  const [expandedBackend, setExpandedBackend] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // Check if this is the Backends filter to show backend spec info buttons
  const isBackendsFilter = title === "Backends";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isDropdownOpen && buttonRef.current) {
      const buttonRect = buttonRef.current.getBoundingClientRect();
      const dropdownWidth = 256; // 64 * 4 (w-64 in tailwind)
      const windowWidth = window.innerWidth;

      // Check if dropdown would overflow on the right
      if (buttonRect.left + dropdownWidth > windowWidth - 20) {
        // 20px margin
        setDropdownPosition("right");
      } else {
        setDropdownPosition("left");
      }
    }
  }, [isDropdownOpen]);

  function handleToggle(
    value: string,
    selected: string[],
    setSelected: (v: string[]) => void
  ) {
    if (selected.includes(value)) {
      if (selected.length === 1) setSelected(options);
      else setSelected(selected.filter((v) => v !== value));
    } else {
      setSelected([...selected, value]);
    }
  }

  function handleOptionClick(option: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (e.shiftKey) onInput([option]);
    else if (e.ctrlKey) onInput(options);
    else handleToggle(option, selectedOptions, onInput);
  }

  const allSelected = selectedOptions.length === options.length;

  // Render as dropdown if more than 10 options
  if (options.length > 10) {
    return (
      <div
        className="select-none flex gap-3 items-center relative flex-shrink-0"
        ref={dropdownRef}
      >
        <span className="font-medium text-gray-700 text-sm whitespace-nowrap">
          {title}:
        </span>
        <div className="relative">
          <button
            ref={buttonRef}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm transition-all duration-200 whitespace-nowrap"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            {allSelected
              ? "All selected"
              : selectedOptions.length === 0
                ? "None selected"
                : `${selectedOptions.length} selected`}
            <span className="ml-2">▼</span>
          </button>

          {isDropdownOpen && (
            <div
              className={`absolute z-10 mt-1 w-80 max-h-90 overflow-auto bg-white border border-gray-300 rounded-lg shadow-lg ${
                dropdownPosition === "right" ? "right-0" : "left-0"
              }`}
            >
              <div className="p-3 border-b border-gray-200">
                <button
                  className="text-sm text-blue-600 hover:text-blue-800 mr-4 font-medium"
                  onClick={(e) => {
                    e.preventDefault();
                    onInput(options);
                  }}
                >
                  Select All
                </button>
                <button
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  onClick={(e) => {
                    e.preventDefault();
                    onInput([]);
                  }}
                >
                  Clear All
                </button>
              </div>
              {options.map((option) => (
                <label
                  key={option}
                  className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={(e) => handleOptionClick(option, e)}
                >
                  <input
                    type="checkbox"
                    checked={selectedOptions.includes(option)}
                    onChange={() => {}} // Handled by label onClick
                    className="mr-3 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <span
                    className="text-sm"
                    style={{
                      color:
                        selectedOptions.includes(option) && distinctColors
                          ? getBackendColor(option).darken(0.2).string()
                          : undefined,
                    }}
                  >
                    {option}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Original row layout for 10 or fewer options
  return (
    <div className="select-none flex flex-col gap-3 flex-shrink-0">
      <div className="flex gap-3 items-center">
        <span className="font-medium text-gray-700 text-sm whitespace-nowrap">
          {title}:
        </span>
        <div className="flex gap-2">
          {options.map((option) => {
            const backendSpec = isBackendsFilter ? getDefaultBackendSpec(option) : null;
            const isSelected = selectedOptions.includes(option);
            
            return (
              <div key={option} className="flex items-center gap-1">
                <button
                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 border outline-0 whitespace-nowrap"
                  style={{
                    backgroundColor:
                      isSelected && distinctColors
                        ? getBackendColor(option).lighten(0.4).string()
                        : isSelected
                          ? "#3b82f6" // blue-600
                          : "#ffffff",
                    borderColor:
                      isSelected && distinctColors
                        ? getBackendColor(option).string()
                        : isSelected
                          ? "#3b82f6" // blue-600
                          : "#d1d5db", // gray-300
                    color:
                      isSelected && distinctColors
                        ? getBackendColor(option).darken(0.3).string()
                        : isSelected
                          ? "#ffffff"
                          : "#374151", // gray-700
                  }}
                  onClick={(e) => handleOptionClick(option, e)}
                >
                  {option}
                </button>
                
                {/* Info button for backends */}
                {isBackendsFilter && isSelected && backendSpec && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedBackend(expandedBackend === option ? null : option);
                    }}
                    className="p-1 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                    title="Show backend details"
                  >
                    <Info className="w-3.5 h-3.5 text-gray-600" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Expanded backend specs */}
      {isBackendsFilter && expandedBackend && (
        (() => {
          // Try to get spec from latest run first, fall back to default
          const backendSpec = (latestBackendSpecs && latestBackendSpecs[expandedBackend]) 
            || getDefaultBackendSpec(expandedBackend);
          
          return backendSpec ? (
            <div className="ml-2 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs space-y-1.5">
              {isTrackerDashboard && latestBackendSpecs && latestBackendSpecs[expandedBackend] && (
                <div className="mb-2 pb-2 border-b border-gray-300">
                  <span className="text-blue-600 font-semibold text-xs">
                    ✓ From Latest Run
                  </span>
                </div>
              )}
              <div className="flex gap-2">
                <span className="font-semibold text-gray-600 min-w-[80px]">
                  Name:
                </span>
                <span className="text-gray-800">{backendSpec.name}</span>
              </div>
              {backendSpec.remoteRepository && (
                <div className="flex gap-2">
                  <span className="font-semibold text-gray-600 min-w-[80px]">
                    Repository:
                  </span>
                  <span className="text-gray-800 font-mono text-xs">
                    {backendSpec.remoteRepository}
                  </span>
                </div>
              )}
              {backendSpec.branch && (
                <div className="flex gap-2">
                  <span className="font-semibold text-gray-600 min-w-[80px]">
                    Branch:
                  </span>
                  <span className="text-gray-800 font-mono text-xs">
                    {backendSpec.branch}
                  </span>
                </div>
              )}
              {backendSpec.commitHash && (
                <div className="flex gap-2">
                  <span className="font-semibold text-gray-600 min-w-[80px]">
                    Commit:
                  </span>
                  <a
                    href={`https://github.com/${backendSpec.remoteRepository}/commit/${backendSpec.commitHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 font-mono text-xs underline"
                    title="View commit on GitHub"
                  >
                    latest ({backendSpec.commitHash.substring(0, 8)})
                  </a>
                </div>
              )}
              {!backendSpec.commitHash && (
                <div className="flex gap-2">
                  <span className="font-semibold text-gray-600 min-w-[80px]">
                    Commit:
                  </span>
                  <span className="text-gray-500 italic text-xs">
                    Will use latest from branch
                  </span>
                </div>
              )}
            </div>
          ) : null;
        })()
      )}
    </div>
  );
}

interface FilterConfig {
  type: "single" | "multi";
  props: SingleSelectProps | MultiSelectProps;
}

interface FilterControlsProps {
  filters: FilterConfig[];
}

export default function FilterControls({ filters }: FilterControlsProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(false);

  const checkScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    setShowLeftScroll(scrollLeft > 10);
    setShowRightScroll(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    checkScroll();
    const observer = new ResizeObserver(checkScroll);
    observer.observe(container);

    return () => observer.disconnect();
  }, [filters]);

  const scroll = (direction: "left" | "right") => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = 300;
    const newScrollLeft =
      direction === "left"
        ? container.scrollLeft - scrollAmount
        : container.scrollLeft + scrollAmount;

    container.scrollTo({
      left: newScrollLeft,
      behavior: "smooth",
    });
  };

  return (
    <div className="relative">
      {/* Left fade and scroll button */}
      {showLeftScroll && (
        <>
          <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
          <button
            onClick={() => scroll("left")}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-20 p-1.5 bg-white border border-gray-300 rounded-full shadow-md hover:bg-gray-50 transition-colors"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
        </>
      )}

      {/* Scrollable container */}
      <div
        ref={scrollContainerRef}
        onScroll={checkScroll}
        className="flex gap-6 items-start overflow-x-auto scrollbar-hide pb-2"
        style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {filters.map((filter, index) =>
          filter.type === "single" ? (
            <SingleSelectFilter
              key={index}
              {...(filter.props as SingleSelectProps)}
            />
          ) : (
            <MultiSelectFilter
              key={index}
              {...(filter.props as MultiSelectProps)}
            />
          )
        )}
      </div>

      {/* Right fade and scroll button */}
      {showRightScroll && (
        <>
          <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
          <button
            onClick={() => scroll("right")}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-20 p-1.5 bg-white border border-gray-300 rounded-full shadow-md hover:bg-gray-50 transition-colors"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </>
      )}
    </div>
  );
}

interface DashboardFilterControlsProps {
  filters: FilterState;
  availableOptions: AvailableFilterOptions;
  updateFilter: (key: keyof FilterState, value: any) => void;
  latestBackendSpecs?: Record<string, any>; // Backend specs from latest run indexed by backend name
  isTrackerDashboard?: boolean; // Whether this is a tracker dashboard (vs individual run)
  filterConfigs: FilterDefinition[];
}

export function DashboardFilterControls({
  filters,
  availableOptions,
  updateFilter,
  latestBackendSpecs,
  isTrackerDashboard = false,
  filterConfigs: filterDefinitions,
}: DashboardFilterControlsProps) {
  // Build filter configurations dynamically (filter by condition, then map to UI config)
  const filterConfigs: FilterConfig[] = filterDefinitions
    .filter(
      (config: FilterDefinition) =>
        !config.condition || config.condition(filters)
    )
    .map((config: FilterDefinition) => {
    // Map filter keys to available options keys
    let options: string[] = [];

    switch (config.key) {
      case "kernelType":
        options = availableOptions.kernelTypes;
        break;
      case "machine":
        options = availableOptions.machines;
        break;
      case "backends":
        options = availableOptions.backends;
        break;
      case "dtypes":
        options = availableOptions.dtypes;
        break;
      case "tags":
        options = availableOptions.tags;
        break;
      case "variants":
        options = availableOptions.variants;
        break;
      default:
        options = [];
    }

    // Ensure options is always an array
    options = options || [];

    if (config.type === "single") {
      return {
        type: "single",
        props: {
          title: config.title,
          options,
          selectedOption: (filters[config.key] ?? "") as string,
          onInput: (value: string) => updateFilter(config.key, value),
        },
      };
    } else {
      return {
        type: "multi",
        props: {
          title: config.title,
          options,
          selectedOptions: (filters[config.key] ?? []) as string[],
          distinctColors: config.key === "backends",
          onInput: (values: string[]) => updateFilter(config.key, values),
          latestBackendSpecs: config.key === "backends" ? latestBackendSpecs : undefined,
          isTrackerDashboard: config.key === "backends" ? isTrackerDashboard : false,
        },
      };
    }
  });

  return <FilterControls filters={filterConfigs} />;
}
