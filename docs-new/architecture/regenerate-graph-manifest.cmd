@echo off
REM Regenerate assets/graph-manifest.js after editing graphs/*.json or database-erd.dbml
cd /d "%~dp0"
python -c "import json,pathlib; r=pathlib.Path('graphs'); g={p.name:json.loads(p.read_text(encoding='utf-8')) for p in sorted(r.glob('*.json'))}; d=(r/'database-erd.dbml').read_text(encoding='utf-8'); pathlib.Path('assets/graph-manifest.js').write_text('window.KNOWING_EYE_GRAPHS = '+json.dumps(g,indent=2)+';\nwindow.KNOWING_EYE_DBML = '+json.dumps(d)+';\n',encoding='utf-8'); print('OK: assets/graph-manifest.js')"
pause
