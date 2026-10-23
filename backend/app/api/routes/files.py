"""Evidence file upload/download/list/delete endpoints.

Allowed types: CSV, PDF, PNG, JPEG, GIF, WebP.
Maximum size:  10 MB per file.

Files are stored as ``bytea`` in PostgreSQL.  The ``data`` column is never
returned in list responses — only in the single-file download endpoint, which
streams bytes with the original MIME type so the browser can render or save
the file directly.
"""

import csv
import io
from base64 import b64encode

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models import EvidenceFile, User
from app.schemas import EvidenceFileMeta
from app.services.access import get_visible_experiment, get_owned_experiment

router = APIRouter(prefix="/experiments", tags=["evidence"])

_MAX = EvidenceFile.MAX_BYTES
_ALLOWED = EvidenceFile.ALLOWED_MIME


@router.post("/{experiment_id}/files", response_model=EvidenceFileMeta, status_code=201)
async def upload_file(
    experiment_id: int,
    file: UploadFile,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Attach an evidence file (CSV / PDF / image) to an experiment."""
    # Access: owner only (same as measurements)
    get_owned_experiment(db, user, experiment_id)

    mime = file.content_type or ""
    if mime not in _ALLOWED:
        raise HTTPException(
            400,
            f"File type '{mime}' not allowed. "
            f"Accepted: {', '.join(sorted(_ALLOWED))}",
        )

    data = await file.read()
    if len(data) > _MAX:
        raise HTTPException(
            400,
            f"File too large ({len(data) // 1024} KB). Maximum is {_MAX // 1024 // 1024} MB.",
        )

    row = EvidenceFile(
        experiment_id=experiment_id,
        filename=file.filename or "upload",
        mime_type=mime,
        size_bytes=len(data),
        data=data,
        uploaded_by=user.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/{experiment_id}/files", response_model=list[EvidenceFileMeta])
def list_files(
    experiment_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """List evidence files attached to an experiment (metadata only, no binary data)."""
    get_visible_experiment(db, user, experiment_id)
    return db.scalars(
        select(EvidenceFile)
        .where(EvidenceFile.experiment_id == experiment_id)
        .order_by(EvidenceFile.created_at)
    ).all()


@router.get("/{experiment_id}/files/{file_id}/download")
def download_file(
    experiment_id: int,
    file_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Stream the raw file bytes with original Content-Type."""
    get_visible_experiment(db, user, experiment_id)
    row = db.get(EvidenceFile, file_id)
    if not row or row.experiment_id != experiment_id:
        raise HTTPException(404, "File not found")
    return Response(
        content=row.data,
        media_type=row.mime_type,
        headers={"Content-Disposition": f'attachment; filename="{row.filename}"'},
    )


@router.get("/{experiment_id}/files/{file_id}/preview")
def preview_csv(
    experiment_id: int,
    file_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Return the first 200 rows of a CSV as JSON for charting.

    Returns ``{"columns": [...], "rows": [[...], ...], "truncated": bool}``.
    Only available for ``text/csv`` files.
    """
    get_visible_experiment(db, user, experiment_id)
    row = db.get(EvidenceFile, file_id)
    if not row or row.experiment_id != experiment_id:
        raise HTTPException(404, "File not found")
    if row.mime_type != "text/csv":
        raise HTTPException(400, "Preview is only available for CSV files")

    text = row.data.decode("utf-8", errors="replace")
    reader = csv.reader(io.StringIO(text))
    all_rows = list(reader)
    if not all_rows:
        return {"columns": [], "rows": [], "truncated": False}

    columns = all_rows[0]
    data_rows = all_rows[1:201]  # cap at 200 data rows
    truncated = len(all_rows) - 1 > 200
    return {"columns": columns, "rows": data_rows, "truncated": truncated}


@router.delete("/{experiment_id}/files/{file_id}", status_code=204)
def delete_file(
    experiment_id: int,
    file_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete an evidence file (owner only)."""
    get_owned_experiment(db, user, experiment_id)
    row = db.get(EvidenceFile, file_id)
    if not row or row.experiment_id != experiment_id:
        raise HTTPException(404, "File not found")
    db.delete(row)
    db.commit()
