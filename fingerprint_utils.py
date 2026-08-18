"""
Simulated fingerprint authentication.

Consumer laptops don't expose sensor-level fingerprint APIs to a Python/
Flask app, so this module simulates the matching step: at registration
time a "fingerprint template" (really just a unique ID string) is stored
against the user in MySQL. Scanning compares a captured/entered ID
against the stored templates and returns the matching user, exactly the
way a real fingerprint SDK would return a match score against enrolled
templates.

This keeps the *system design* -- capture, compare against enrolled
templates, log the attempt -- identical to a production biometric flow,
which is the part that actually matters for demonstrating the concept.
"""

from db import get_user_by_fingerprint


def verify_fingerprint(scanned_id):
    """
    scanned_id: the fingerprint ID being 'scanned' (in the demo UI this
    is selected from a dropdown of simulated fingerprints, or typed in).

    Returns the matching user dict, or None if no match.
    """
    user = get_user_by_fingerprint(scanned_id)
    return user
