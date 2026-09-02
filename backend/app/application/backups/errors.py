class BackupError(RuntimeError):
    """Base error safe to show in administrative tooling."""


class BackupIntegrityError(BackupError):
    pass


class BackupCompatibilityError(BackupError):
    pass


class BackupProviderError(BackupError):
    pass


class RestoreSafetyError(BackupError):
    pass
