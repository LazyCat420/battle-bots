import sys
import traceback

print(f"Python executable: {sys.executable}")
print(f"Python path: {sys.path}")

try:
    print("Attempting to import tsr...")
    import tsr
    from tsr.system import TSR
    from tsr.utils import remove_background, resize_foreground
    print("Successfully imported tsr!")
except Exception as e:
    print("Failed to import tsr:")
    traceback.print_exc()
