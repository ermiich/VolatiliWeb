import json
import subprocess


def _to_serializable(value):
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def execute_volatility_plugin(
    dump_path: str,
    plugin_class_path: str,
    symbols_path: str,
    timeout_seconds: int = 1500,
) -> dict:
    cmd = [
        "python",
        "/opt/volatility3/vol.py",
        "-q",
        "-f",
        dump_path,
        "-s",
        symbols_path,
        "-r",
        "json",
        plugin_class_path,
    ]

    try:
        completed = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise TimeoutError(
            f"El plugin '{plugin_class_path}' supero el limite de {timeout_seconds}s"
        ) from exc

    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout or "").strip()
        raise RuntimeError(f"Error ejecutando plugin\n{detail}")

    output = (completed.stdout or "").strip()
    if not output:
        raise RuntimeError("Error ejecutando plugin\nSin salida de Volatility")

    try:
        parsed = json.loads(output)
    except json.JSONDecodeError:
        # Some versions print logs before JSON output.
        start = output.find("{")
        end = output.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise RuntimeError(f"Error ejecutando plugin\n{output}")
        parsed = json.loads(output[start : end + 1])

    rows = []
    columns = []

    if isinstance(parsed, list):
        # Volatility 2.28 JSON renderer returns a top-level list of row dicts.
        for row in parsed:
            if not isinstance(row, dict):
                continue
            normalized = {
                key: _to_serializable(value)
                for key, value in row.items()
                if key != "__children"
            }
            if normalized:
                rows.append(normalized)
        if rows:
            columns = list(rows[0].keys())
    elif isinstance(parsed, dict):
        columns_raw = parsed.get("columns", [])
        rows_raw = parsed.get("rows", [])

        columns = [
            col.get("name") if isinstance(col, dict) else str(col)
            for col in columns_raw
        ]

        for raw_row in rows_raw:
            values = raw_row.get("values", []) if isinstance(raw_row, dict) else raw_row
            if not isinstance(values, (list, tuple)):
                continue
            rows.append({
                col_name: _to_serializable(value)
                for col_name, value in zip(columns, values)
            })

    return {"rows": rows, "columns": columns}
