import sys
from pathlib import Path

# backendディレクトリをPythonパスに追加
backend_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(backend_dir))
