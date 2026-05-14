import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path


def _to_serializable(value):
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return str(value)


def _needs_strings_file(plugin_class_path: str, extra_args: list[str] | None) -> bool:
    if plugin_class_path != "windows.strings.Strings":
        return False
    if not extra_args:
        return True
    return not any(
        token == "--strings-file" or token.startswith("--strings-file=")
        for token in extra_args
    )


def _generate_strings_file(dump_path: str) -> str:
    strings_binary = shutil.which("strings")
    if strings_binary is None:
        raise RuntimeError(
            "No se encontro el comando 'strings' necesario para ejecutar el plugin Windows Strings"
        )

    fd, temp_path = tempfile.mkstemp(prefix="volatiliweb_strings_", suffix=".txt")
    os.close(fd)

    try:
        with open(temp_path, "w", encoding="utf-8") as output_handle:
            for strings_args in (
                ["-a", "-t", "d", "-n", "4"],
                ["-a", "-t", "d", "-n", "4", "-e", "l"],
            ):
                completed = subprocess.run(
                    [strings_binary, *strings_args, dump_path],
                    capture_output=True,
                    text=True,
                    check=False,
                )
                if completed.returncode != 0:
                    detail = (completed.stderr or completed.stdout or "").strip()
                    raise RuntimeError(f"Error generando strings\n{detail}")
                if completed.stdout:
                    output_handle.write(completed.stdout)
                    if not completed.stdout.endswith("\n"):
                        output_handle.write("\n")
        return temp_path
    except Exception:
        Path(temp_path).unlink(missing_ok=True)
        raise


def execute_volatility_plugin(
    dump_path: str,
    plugin_class_path: str,
    symbols_path: str,
    extra_args: list[str] | None = None,
    timeout_seconds: int = 1500,
) -> dict:
    effective_extra_args = list(extra_args or [])
    generated_strings_file = None

    if _needs_strings_file(plugin_class_path, effective_extra_args):
        generated_strings_file = _generate_strings_file(dump_path)
        effective_extra_args.extend(["--strings-file", generated_strings_file])

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
    if effective_extra_args:
        cmd.extend(effective_extra_args)

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
    finally:
        if generated_strings_file is not None:
            Path(generated_strings_file).unlink(missing_ok=True)

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
