#!/usr/bin/env python3
"""Converge only automation using PostgreSQL's existing internal socket.
Input JSON on stdin: password, stack_dir, optional check. No secrets on argv.
"""
import base64
import hashlib
import hmac
import json
import os
import subprocess
import sys


def matches(password, verifier):
    if not verifier or not verifier.startswith('SCRAM-SHA-256$'):
        return False
    _, params, keys = verifier.split('$')
    rounds, salt = params.split(':')
    salted = hashlib.pbkdf2_hmac('sha256', password.encode(), base64.b64decode(salt), int(rounds))
    stored = hashlib.sha256(hmac.digest(salted, b'Client Key', 'sha256')).digest()
    return hmac.compare_digest(stored, base64.b64decode(keys.split(':')[0]))


def verifier(password):
    salt = os.urandom(16)
    salted = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 4096)
    stored = hashlib.sha256(hmac.digest(salted, b'Client Key', 'sha256')).digest()
    server = hmac.digest(salted, b'Server Key', 'sha256')
    enc = lambda b: base64.b64encode(b).decode()
    return f'SCRAM-SHA-256$4096:{enc(salt)}${enc(stored)}:{enc(server)}'


def converge(config, runner=subprocess.run):
    password = config['password']
    # ASCII avoids password SASLprep ambiguity; matches the repository's hex convention.
    if not isinstance(password, str) or len(password) != 64 or any(c not in '0123456789abcdefABCDEF' for c in password):
        raise ValueError('automation_db_password must be 64 hexadecimal characters')
    command = ['docker', 'compose', '--project-directory', config['stack_dir'], 'exec', '-T',
               'postgres', 'psql', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres']

    def sql(query, database='postgres'):
        # Disable PostgreSQL statement/error sampling for this session before sending verifiers.
        prefix = "SET log_statement='none'; SET log_min_duration_statement=-1; SET log_min_duration_sample=-1; SET log_transaction_sample_rate=0; SET log_min_error_statement='panic';\n"
        result = runner(command + ['-d', database], input=prefix+query, text=True, capture_output=True)
        if result.returncode:
            raise RuntimeError('PostgreSQL provisioning query failed; details suppressed to protect credentials')
        return result.stdout.strip()

    raw = sql("SELECT row_to_json(r) FROM (SELECT rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolpassword FROM pg_authid WHERE rolname='automation_app') r;")
    role = json.loads(raw) if raw else None
    owner = sql("SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname='automation';")
    schema_owner = sql("SELECT pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname='specialist';", 'automation') if owner else ''
    attrs_ok = role and role['rolcanlogin'] and not any(role[k] for k in ['rolsuper','rolcreatedb','rolcreaterole','rolreplication','rolbypassrls'])
    password_ok = role and matches(password, role['rolpassword'])
    changed = not attrs_ok or not password_ok or owner != 'automation_app' or schema_owner != 'automation_app'
    if changed and not config.get('check', False):
        if not role:
            sql('CREATE ROLE automation_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;')
        elif not attrs_ok:
            sql('ALTER ROLE automation_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;')
        if not password_ok:
            sql("ALTER ROLE automation_app PASSWORD '" + verifier(password) + "';")
        if not owner:
            sql('CREATE DATABASE automation OWNER automation_app;')
        elif owner != 'automation_app':
            sql('ALTER DATABASE automation OWNER TO automation_app;')
        if not schema_owner:
            sql('CREATE SCHEMA specialist AUTHORIZATION automation_app;', 'automation')
        elif schema_owner != 'automation_app':
            sql('ALTER SCHEMA specialist OWNER TO automation_app;', 'automation')
    return bool(changed)


if __name__ == '__main__':
    try:
        print(json.dumps({'changed': converge(json.load(sys.stdin))}))
    except Exception:
        # Never emit query text, password/verifier or subprocess stderr.
        print('Automation provisioning failed; check container availability and secret contract.', file=sys.stderr)
        sys.exit(1)
