"""Run interactively as root once; owner transfers the secret to Vercel, never chat."""
import os
from pathlib import Path
import secrets

target = Path('/etc/classflow-agent.env')
if target.exists():
    raise SystemExit('Already configured; no credential was changed.')
secret = secrets.token_hex(32)
with os.fdopen(os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w') as file:
    file.write('CLASSFLOW_URL=https://class-flow-fawn.vercel.app\n')
    file.write(f'CONVERSION_WORKER_SECRET={secret}\n')
print('Paste these two lines into Vercel Production environment variables, then save.')
print('Do not send the secret to chat or commit it.')
print(f'CONVERSION_WORKER_SECRET={secret}')
print('PPT_CONVERSION_ENABLED=1')
