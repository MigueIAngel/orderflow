"""Redis Streams messaging: event envelopes, transactional outbox and consumer groups.

This package is intentionally duplicated (not shared) between the Python services so each
service can be deployed and versioned on its own. The wire format is defined in
`contracts/README.md` at the repository root.
"""
