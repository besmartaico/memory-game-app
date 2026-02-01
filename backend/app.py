import os
import json
import traceback
from flask import Flask, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

load_dotenv()

app = Flask(__name__)
CORS(app)

SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]

def get_env(name: str, default: str = "") -> str:
    v = os.getenv(name, default)
    return v.strip() if isinstance(v, str) else default

GOOGLE_SHEETS_ID = get_env("GOOGLE_SHEETS_ID")
GOOGLE_SHEETS_RANGE = get_env("GOOGLE_SHEETS_RANGE", "Sheet1!A:C")
GOOGLE_SERVICE_ACCOUNT_JSON = get_env("GOOGLE_SERVICE_ACCOUNT_JSON")


def get_sheets_service():
    if not GOOGLE_SHEETS_ID:
        raise RuntimeError("Missing env var GOOGLE_SHEETS_ID")
    if not GOOGLE_SERVICE_ACCOUNT_JSON:
        raise RuntimeError("Missing env var GOOGLE_SERVICE_ACCOUNT_JSON")

    try:
        info = json.loads(GOOGLE_SERVICE_ACCOUNT_JSON)
    except json.JSONDecodeError as e:
        raise RuntimeError(
            "GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON. "
            "Paste the raw JSON (no surrounding quotes)."
        ) from e

    creds = Credentials.from_service_account_info(info, scopes=SCOPES)
    return build("sheets", "v4", credentials=creds)


def normalize_rows(values):
    if not values or len(values) < 2:
        return []

    header = [str(h).strip().lower() for h in values[0]]

    def idx(name: str):
        try:
            return header.index(name)
        except ValueError:
            return None

    id_i = idx("id")
    q_i = idx("question")
    a_i = idx("answer")

    if id_i is None or q_i is None or a_i is None:
        raise RuntimeError(
            "Sheet must include headers in row 1: id, question, answer "
            f"(found: {header})"
        )

    out = []
    for row in values[1:]:
        row = list(row) + [""] * (len(header) - len(row))
        out.append(
            {
                "id": str(row[id_i]).strip(),
                "question": str(row[q_i]).strip(),
                "answer": str(row[a_i]).strip(),
            }
        )
    return out


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/debug/env")
def debug_env():
    # Show only safe info
    return jsonify(
        {
            "GOOGLE_SHEETS_ID": GOOGLE_SHEETS_ID,
            "GOOGLE_SHEETS_RANGE": GOOGLE_SHEETS_RANGE,
            "SERVICE_JSON_present": bool(GOOGLE_SERVICE_ACCOUNT_JSON),
            "SERVICE_JSON_len": len(GOOGLE_SERVICE_ACCOUNT_JSON) if GOOGLE_SERVICE_ACCOUNT_JSON else 0,
        }
    )


@app.get("/api/cards")
def cards():
    try:
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
    except Exception as e:
        return (
            jsonify(
                {
                    "status": "error",
                    "error": str(e),
                    "trace": traceback.format_exc().splitlines()[-12:],
                }
            ),
            500,
        )


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=True)
