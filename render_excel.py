import win32com.client as win32
import time
import argparse
from PIL import ImageGrab

def screenshot_excel(path, sheet_name, cell_range, output):
    excel = win32.Dispatch("Excel.Application")
    excel.Visible = False
    excel.DisplayAlerts = False

    wb = excel.Workbooks.Open(path)
    ws = wb.Worksheets(sheet_name)

    excel.CutCopyMode = False
    rng = ws.Range(cell_range)

    # Copy as bitmap: 2 = xlBitmap
    rng.CopyPicture(Appearance=1, Format=2)

    time.sleep(0.6)  # Increase a bit to ensure clipboard filled

    img = ImageGrab.grabclipboard()
    if img is None:
        raise Exception("Clipboard gagal diambil. Range salah? Excel minimized? Coba tambah delay.")

    img.save(output)
    wb.Close(False)
    excel.Quit()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", required=True)
    parser.add_argument("--sheet", required=True)
    parser.add_argument("--range", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    screenshot_excel(args.file, args.sheet, args.range, args.out)
