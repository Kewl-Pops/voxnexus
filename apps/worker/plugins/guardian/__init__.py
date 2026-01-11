"""
VoxNexus Guardian Security Suite
================================

Real-time sentiment analysis, risk detection, and human takeover
capabilities for VoxNexus voice conversations.

This module exports the Guardian class for use by the VoxNexus worker.
The worker dynamically imports this module and instantiates Guardian
if a valid license key is configured.

Usage:
    # In the worker, this happens automatically:
    from voxnexus_guardian import Guardian
    guardian = Guardian(config)

Environment Variables:
    GUARDIAN_KEY: License key for Guardian activation

Copyright (c) 2026 Cothink LLC. All Rights Reserved.
"""

import os
import logging

logger = logging.getLogger("voxnexus.guardian")

# Check if Guardian should be activated
_guardian_key = os.getenv("GUARDIAN_KEY")

if _guardian_key:
    try:
        # Import the real VoxGuardian implementation
        from .vox_guardian import VoxGuardian, __version__

        # Export as Guardian for the worker to import
        Guardian = VoxGuardian

        logger.debug(f"VoxGuardian v{__version__} loaded")

    except ImportError as e:
        logger.error(f"Failed to load VoxGuardian: {e}")
        logger.error("Ensure vaderSentiment is installed: pip install vaderSentiment")
        Guardian = None  # type: ignore
        __version__ = "0.0.0"
else:
    # No license key - Guardian not available
    Guardian = None  # type: ignore
    __version__ = "0.0.0"

__all__ = ["Guardian", "__version__"]
