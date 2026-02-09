"""
Utilities for fetching commit information from GitHub repositories.
"""

import logging
from typing import Optional
import requests

logger = logging.getLogger(__name__)


def get_latest_commit_hash(repo: str, branch: str) -> Optional[str]:
    """
    Fetch the latest commit hash from a GitHub repository branch.
    
    Args:
        repo: Repository in format "owner/repo" (e.g., "triton-lang/triton")
        branch: Branch name (e.g., "main")
    
    Returns:
        Commit hash (SHA) if successful, None if failed
    
    Example:
        >>> get_latest_commit_hash("triton-lang/triton", "main")
        'a1b2c3d4e5f6...'
    """
    try:
        url = f"https://api.github.com/repos/{repo}/commits/{branch}"
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }
        
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            commit_data = response.json()
            commit_hash = commit_data.get("sha")
            logger.info(f"Fetched commit hash for {repo}@{branch}: {commit_hash[:8]}...")
            return commit_hash
        else:
            logger.error(
                f"Failed to fetch commit hash for {repo}@{branch}: "
                f"Status {response.status_code}"
            )
            return None
            
    except Exception as e:
        logger.error(f"Error fetching commit hash for {repo}@{branch}: {e}")
        return None


def resolve_backend_specs_commits(backend_specs: list[dict]) -> list[dict]:
    """
    Resolve commit hashes for backend specs that don't have them specified.
    
    For each backend spec without a commitHash, fetches the latest commit from
    the specified remote repository and branch.
    
    Args:
        backend_specs: List of backend spec dictionaries
    
    Returns:
        List of backend specs with resolved commit hashes
    
    Example:
        >>> specs = [{"id": "triton-default", "remoteRepository": "triton-lang/triton", 
        ...           "branch": "main", "backend": "triton", "name": "Triton"}]
        >>> resolved = resolve_backend_specs_commits(specs)
        >>> resolved[0]["commitHash"]  # Now has the latest commit hash
        'a1b2c3d4e5f6...'
    """
    resolved_specs = []
    
    for spec in backend_specs:
        resolved_spec = spec.copy()
        
        # If no commit hash specified, fetch the latest
        if not spec.get("commitHash"):
            repo = spec.get("remoteRepository")
            branch = spec.get("branch")
            
            if repo and branch:
                commit_hash = get_latest_commit_hash(repo, branch)
                if commit_hash:
                    resolved_spec["commitHash"] = commit_hash
                    logger.info(
                        f"Resolved commit for {spec.get('name', spec.get('id'))}: "
                        f"{commit_hash[:8]}..."
                    )
                else:
                    logger.warning(
                        f"Could not resolve commit for {spec.get('name', spec.get('id'))}, "
                        f"will use latest from branch at runtime"
                    )
            else:
                logger.warning(
                    f"Backend spec {spec.get('id')} missing repo or branch info"
                )
        
        resolved_specs.append(resolved_spec)
    
    return resolved_specs
