"""
Registry system for tuning paradigms.

This module provides a simple way to register and retrieve tuning paradigms,
making it easy for developers to add new paradigms without modifying CLI code.
"""

from typing import Dict, Type, Callable, Optional
from .paradigm import TuningParadigm


class ParadigmRegistry:
    """
    Registry for tuning paradigms.

    Allows paradigms to be registered by name and retrieved with optional
    configuration parameters.
    """

    def __init__(self):
        self._paradigms: Dict[str, Type[TuningParadigm]] = {}
        self._descriptions: Dict[str, str] = {}
        self._default_configs: Dict[str, dict] = {}

    def register(
        self,
        name: str,
        paradigm_class: Type[TuningParadigm],
        description: str = "",
        default_config: Optional[dict] = None,
    ):
        """
        Register a tuning paradigm.

        Args:
            name: Name to register the paradigm under (used in CLI)
            paradigm_class: The paradigm class to register
            description: Human-readable description of the paradigm
            default_config: Default configuration parameters for the paradigm
        """
        self._paradigms[name] = paradigm_class
        self._descriptions[name] = description
        self._default_configs[name] = default_config or {}

    def get(self, name: str, **kwargs) -> TuningParadigm:
        """
        Get an instance of a registered paradigm.

        Args:
            name: Name of the paradigm to retrieve
            **kwargs: Additional parameters to pass to paradigm constructor
                     (overrides default config)

        Returns:
            Instance of the requested paradigm

        Raises:
            ValueError: If paradigm name is not registered
        """
        if name not in self._paradigms:
            raise ValueError(
                f"Paradigm '{name}' not found. Available: {self.list_names()}"
            )

        # Merge default config with provided kwargs
        config = {**self._default_configs[name], **kwargs}

        return self._paradigms[name](**config)

    def list_names(self) -> list[str]:
        """Get list of registered paradigm names."""
        return sorted(self._paradigms.keys())

    def get_description(self, name: str) -> str:
        """Get description of a paradigm."""
        return self._descriptions.get(name, "No description available")

    def get_help_text(self) -> str:
        """
        Get formatted help text listing all available paradigms.

        Returns:
            Formatted string describing all registered paradigms
        """
        lines = ["Available tuning paradigms:"]
        for name in self.list_names():
            desc = self._descriptions.get(name, "No description")
            lines.append(f"  - {name:20s} {desc}")
        return "\n".join(lines)


# Global registry instance
_registry = ParadigmRegistry()


def register_paradigm(
    name: str, description: str = "", default_config: Optional[dict] = None
) -> Callable:
    """
    Decorator to register a paradigm class.

    Usage:
        @register_paradigm("my_paradigm", "My custom paradigm")
        class MyParadigm(TuningParadigm):
            ...

    Args:
        name: Name to register the paradigm under
        description: Human-readable description
        default_config: Default configuration parameters

    Returns:
        Decorator function
    """

    def decorator(paradigm_class: Type[TuningParadigm]) -> Type[TuningParadigm]:
        _registry.register(name, paradigm_class, description, default_config)
        return paradigm_class

    return decorator


def get_paradigm(name: str, **kwargs) -> TuningParadigm:
    """
    Get an instance of a registered paradigm.

    Args:
        name: Name of the paradigm
        **kwargs: Parameters to pass to paradigm constructor

    Returns:
        Paradigm instance
    """
    return _registry.get(name, **kwargs)


def list_paradigms() -> list[str]:
    """Get list of available paradigm names."""
    return _registry.list_names()


def get_paradigm_help() -> str:
    """Get help text describing all paradigms."""
    return _registry.get_help_text()
