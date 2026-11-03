import subprocess
import sys
import pytest


def test_cli_exit_code():
    proc = subprocess.run([sys.executable, "-m", "app.cli", "--fail"])
    assert proc.returncode == 1


def test_exit_raises():
    with pytest.raises(SystemExit):
        sys.exit(1)


if __name__ == "__main__":
    sys.exit(pytest.main([__file__]))
