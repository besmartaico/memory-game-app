import os
import json
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

load_dotenv()

app = Flask(__name__)
CORS(app)

SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

GOOGLE_SHEETS_ID = os.getenv("GOOGLE_SHEETS_ID", "").strip()
GOOGLE_SHEETS_RANGE = os.getenv("GOOGLE_SHEETS_RANGE", "Sheet1!A:C").strip()
GOOGLE_SERVICE_ACCOUNT_JSON = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()


def get_sheets_service():
    if not GOOGLE_SHEETS_ID:
        raise RuntimeError("Missing env var GOOGLE_SHEETS_ID")
    if not GOOGLE_SERVICE_ACCOUNT_JSON:
        raise RuntimeError("Missing env var GOOGLE_SERVICE_ACCOUNT_JSON")

    info = json.loads(GOOGLE_SERVICE_ACCOUNT_JSON)
    creds = Credentials.from_service_account_info(info, scopes=SCOPES)
    return build("sheets", "v4", credentials=creds)


def normalize_rows(values):
    """
    Expects header row containing: id, question, answer (case-insensitive)
    Returns list: [{id, question, answer}, ...]
    """
    if not values or len(values) < 2:
        return []

    header = [str(h).strip().lower() for h in values[0]]

    def col_index(name: str):
        try:
            return header.index(name)
        except ValueError:
            return None

    id_i = col_index("id")
    q_i = col_index("question")
    a_i = col_index("answer")

    if id_i is None or q_i is None or a_i is None:
        raise RuntimeError("Sheet must include headers: id, question, answer (row 1)")

    out = []
    for row in values[1:]:
        # pad row
        while len(row) < len(header):
            row.append("")

        cid = str(row[id_i]).strip()
        q = str(row[q_i]).strip()
        a = str(row[a_i]).strip()

        if not cid and not q and not a:
            continue

        out.append({"id": cid, "question": q, "answer": a})

    return out


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/api/cards")
def cards():
    service = get_sheets_service()
    resp = (
        service.spreadsheets()
        .values()
        .get(spreadsheetId=GOOGLE_SHEETS_ID, range=GOOGLE_SHEETS_RANGE)
        .execute()
    )

    values = resp.get("values", [])
    cards_list = normalize_rows(values)
    return jsonify({"count": len(cards_list), "cards": cards_list})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
