"""
wa_client.py — Klien WhatsApp Gateway untuk Python

Pakai:
    from wa_client import WaClient
    WaClient.send('6281234567890', 'Halo')

Butuh: TIDAK ADA dependency eksternal.
Memakai urllib dari standard library, jadi langsung jalan tanpa pip install.
Kalau 'requests' tersedia, itu dipakai otomatis (lebih cepat untuk file besar).
"""

import base64
import json
import os
import socket
import mimetypes
import urllib.request
import urllib.error


def socket_timeout_types():
    """Tipe exception timeout, yang berbeda antar versi Python."""
    return (socket.timeout, TimeoutError)

try:
    import requests
except ImportError:
    requests = None


class WaClient:
    BASE_URL = os.environ.get("WA_GATEWAY_URL", "http://localhost:5000")
    API_KEY = os.environ.get("WA_GATEWAY_KEY", "")

    # JANGAN turunkan — jeda anti-ban gateway bisa 25 detik
    TIMEOUT = 120
    MAX_FILE_BYTES = 15 * 1024 * 1024

    @staticmethod
    def health():
        """Status gateway + kuota. Selalu return dict, tidak pernah exception."""
        out = {
            "ok": False, "state": "offline", "label": "Offline",
            "pushname": None, "wid": None, "quota": None, "error": None,
        }
        r = WaClient._request("GET", "/status")

        if r["status"] in (401, 403):
            out["state"] = "bad_key"
            out["label"] = "API Key salah"
            out["error"] = r["error"]
            return out
        if not r["ok"]:
            out["error"] = r["error"]
            return out

        d = r["data"]
        out["ok"] = True
        out["state"] = d.get("state", "unknown")
        out["pushname"] = d.get("pushname")
        out["wid"] = d.get("wid")
        out["quota"] = d.get("quota")
        labels = {
            "connected": "Tersambung" + (f" ({d['pushname']})" if d.get("pushname") else ""),
            "connecting": "Menunggu koneksi",
            "qr": "Menunggu scan QR",
            "unavailable": "Gateway restart / tidak terjangkau",
        }
        out["label"] = labels.get(out["state"], f"Status: {out['state']}")
        return out

    @staticmethod
    def send(number, message):
        """Kirim pesan teks."""
        return WaClient._request("POST", "/send", {
            "number": WaClient.normalize(number),
            "message": message,
        })

    @staticmethod
    def send_file(number, file_path, caption="", filename=None):
        """Kirim file (gambar/PDF) + caption opsional."""
        import os
        if not os.path.isfile(file_path):
            return WaClient._fail(f"File tidak ditemukan: {os.path.basename(file_path)}")

        size = os.path.getsize(file_path)
        if size == 0:
            return WaClient._fail("File kosong.")
        if size > WaClient.MAX_FILE_BYTES:
            return WaClient._fail(
                f"File terlalu besar ({size / 1048576:.1f} MB). Maksimal 15 MB."
            )

        mime, _ = mimetypes.guess_type(file_path)
        if mime not in (
            "image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"
        ):
            return WaClient._fail(f"Tipe file tidak didukung: {mime}")

        with open(file_path, "rb") as f:
            encoded = base64.b64encode(f.read()).decode()

        return WaClient._request("POST", "/send-media", {
            "number": WaClient.normalize(number),
            "file": f"data:{mime};base64,{encoded}",
            "caption": caption,
            "filename": filename or os.path.basename(file_path),
        })

    @staticmethod
    def blast(numbers, message):
        """Kirim ke banyak nomor sekaligus. Maks 500."""
        if not isinstance(numbers, (list, tuple)) or len(numbers) == 0:
            return WaClient._fail("numbers harus list yang tidak kosong.")
        if len(numbers) > 500:
            return WaClient._fail("Maksimal 500 nomor per blast.")
        return WaClient._request("POST", "/blast", {
            "numbers": [WaClient.normalize(n) for n in numbers],
            "message": message,
        })

    @staticmethod
    def blast_status(job_id):
        return WaClient._request("GET", f"/blast/{job_id}")

    @staticmethod
    def blast_cancel(job_id):
        return WaClient._request("POST", f"/blast/{job_id}/cancel")

    @staticmethod
    def normalize(number):
        """Ubah 08xx / +62xx / spasi menjadi format yang diterima gateway."""
        d = "".join(ch for ch in str(number) if ch.isdigit())
        if d.startswith("0"):
            return "62" + d[1:]
        if d.startswith("8"):
            return "62" + d
        if not (d.startswith("62") or d.startswith("1")):
            return "62" + d
        return d

    @staticmethod
    def _request(method, path, payload=None):
        url = WaClient.BASE_URL.rstrip("/") + path
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        if WaClient.API_KEY:
            headers["x-api-key"] = WaClient.API_KEY

        body = json.dumps(payload).encode("utf-8") if payload is not None else None

        # pakai requests kalau ada (lebih stabil untuk file besar)
        if requests is not None:
            return WaClient._request_requests(method, url, headers, payload)

        # fallback: urllib dari standard library
        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=WaClient.TIMEOUT) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
                status = resp.status
        except urllib.error.HTTPError as e:
            raw = e.read().decode("utf-8", errors="replace")
            status = e.code
        except socket_timeout_types() as e:
            return WaClient._fail(f"Timeout setelah {WaClient.TIMEOUT} detik: {e}")
        except urllib.error.URLError as e:
            reason = getattr(e, "reason", e)
            if isinstance(reason, (TimeoutError, OSError)) and "timed out" in str(reason).lower():
                return WaClient._fail(f"Timeout setelah {WaClient.TIMEOUT} detik.")
            return WaClient._fail(
                f"Tidak bisa menghubungi gateway di {WaClient.BASE_URL}. "
                f"Pastikan gateway jalan (npm start). [{reason}]"
            )
        except Exception as e:
            return WaClient._fail(str(e))

        try:
            data = json.loads(raw)
        except ValueError:
            return WaClient._fail(f"Respons bukan JSON yang valid (HTTP {status}).")

        ok = data.get("success") is True
        return {
            "ok": ok,
            "status": status,
            "data": data,
            "error": None if ok else data.get("error", f"HTTP {status}"),
        }

    @staticmethod
    def _request_requests(method, url, headers, payload):
        """Jalur alternatif kalau modul 'requests' terpasang."""
        try:
            res = requests.request(
                method, url, headers=headers, json=payload, timeout=WaClient.TIMEOUT
            )
        except requests.exceptions.Timeout:
            return WaClient._fail(f"Timeout setelah {WaClient.TIMEOUT} detik")
        except requests.exceptions.ConnectionError:
            return WaClient._fail(
                f"Tidak bisa menghubungi gateway di {WaClient.BASE_URL}. "
                "Pastikan gateway jalan (npm start)."
            )
        except Exception as e:
            return WaClient._fail(str(e))

        try:
            data = res.json()
        except ValueError:
            return WaClient._fail(f"Respons bukan JSON yang valid (HTTP {res.status_code}).")

        ok = data.get("success") is True
        return {
            "ok": ok,
            "status": res.status_code,
            "data": data,
            "error": None if ok else data.get("error", f"HTTP {res.status_code}"),
        }

    @staticmethod
    def _fail(message):
        return {"ok": False, "status": 0, "data": None, "error": message}
