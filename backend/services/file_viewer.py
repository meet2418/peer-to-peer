import re
import zipfile
from pathlib import Path


IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}
TEXT_EXTENSIONS = {".txt", ".md", ".py", ".json", ".csv", ".log"}
DOCX_EXTENSIONS = {".docx"}
DOC_EXTENSIONS = {".doc"}
BASE_DIR = Path(__file__).resolve().parents[1]


def _read_docx_text(local_path: Path) -> str:
    try:
        with zipfile.ZipFile(local_path) as archive:
            xml = archive.read("word/document.xml").decode("utf-8", errors="ignore")
        xml = xml.replace("</w:p>", "\n").replace("<w:tab/>", "\t")
        text = re.sub(r"<[^>]+>", "", xml)
        text = re.sub(r"\r", "", text)
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text).strip()
        return text[:20000] if text else "No readable text found in DOCX."
    except Exception:
        return "Could not parse DOCX preview."


def get_file_preview_payload(file_url: str) -> dict:
    extension = Path(file_url).suffix.lower()
    local_path = BASE_DIR / file_url.lstrip("/")

    if extension == ".pdf":
        return {"kind": "pdf", "url": file_url, "text": None}

    if extension in IMAGE_EXTENSIONS:
        return {"kind": "image", "url": file_url, "text": None}

    if extension in DOCX_EXTENSIONS:
        if not local_path.exists():
            return {"kind": "text", "url": None, "text": "File not found."}
        return {"kind": "text", "url": None, "text": _read_docx_text(local_path)}

    if extension in DOC_EXTENSIONS:
        return {"kind": "document", "url": file_url, "text": "Word document preview depends on browser support."}

    if extension in TEXT_EXTENSIONS:
        if not local_path.exists():
            return {"kind": "text", "url": None, "text": "File not found."}
        content = local_path.read_text(encoding="utf-8", errors="ignore")
        return {"kind": "text", "url": None, "text": content[:20000]}

    return {"kind": "unsupported", "url": file_url, "text": "Preview unavailable for this format."}
