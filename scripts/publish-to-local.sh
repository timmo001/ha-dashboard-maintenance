#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"

if [[ ! -f "${ENV_FILE}" ]]; then
  printf 'Missing %s. Copy .env.example to .env and update it.\n' "${ENV_FILE}" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

: "${PUBLISH_TARGET:?Set PUBLISH_TARGET in .env}"
: "${PUBLISH_PATH:?Set PUBLISH_PATH in .env}"

SSH_ARGS=()
RSYNC_RSH="ssh"
REMOTE_TRANSFER_USER="${PUBLISH_TARGET%%@*}"

if [[ "${PUBLISH_TARGET}" != *"@"* ]]; then
  REMOTE_TRANSFER_USER="${USER}"
fi

if [[ -n "${PUBLISH_PORT:-}" ]]; then
  SSH_ARGS+=("-p" "${PUBLISH_PORT}")
  RSYNC_RSH+=" -p ${PUBLISH_PORT}"
fi

sync_to_target() {
  local rsync_error_file

  rsync_error_file="$(mktemp)"

  if rsync -rlptz --delete -e "${RSYNC_RSH}" "${OUTPUT_DIR}/" "${PUBLISH_TARGET}:${PUBLISH_PATH}/" 2>"${rsync_error_file}"; then
    rm -f "${rsync_error_file}"
    return 0
  fi

  cat "${rsync_error_file}" >&2

  if grep -Fq "Permission denied" "${rsync_error_file}"; then
    ssh "${SSH_ARGS[@]}" "${PUBLISH_TARGET}" "stat -c '%A %U %G %n' '${PUBLISH_PATH}' 2>/dev/null || true" >&2 || true
    printf 'Rsync could not write to %s as %s.\n' "${PUBLISH_PATH}" "${PUBLISH_TARGET}" >&2
  fi

  rm -f "${rsync_error_file}"
  return 1
}

print_manual_setup_steps() {
  printf '\nOpen a new interactive SSH session and run these commands there:\n\n' >&2
  printf '  ssh %s\n' "${PUBLISH_TARGET}" >&2
  printf '  mkdir -p %q\n' "${PUBLISH_PATH}" >&2
  printf '  chown -R %q:%q %q\n' "${REMOTE_TRANSFER_USER}" "${REMOTE_TRANSFER_USER}" "${PUBLISH_PATH}" >&2
  printf '  exit\n\n' >&2
  printf 'Then rerun `pnpm publish-to-local`.\n' >&2
}

ensure_target_dir() {
  local ssh_error_file

  ssh_error_file="$(mktemp)"

  if ssh "${SSH_ARGS[@]}" "${PUBLISH_TARGET}" "mkdir -p '${PUBLISH_PATH}'" 2>"${ssh_error_file}"; then
    rm -f "${ssh_error_file}"
    return 0
  fi

  if grep -Fq "Permission denied" "${ssh_error_file}"; then
    cat "${ssh_error_file}" >&2
    printf 'Remote target path %s is not writable by %s.\n' "${PUBLISH_PATH}" "${PUBLISH_TARGET}" >&2
    printf 'Home Assistant SSH add-on sessions often run as a non-root user, so /config/custom_components may need to be created and owned appropriately ahead of time.\n' >&2
    print_manual_setup_steps
    rm -f "${ssh_error_file}"
    return 1
  fi

  cat "${ssh_error_file}" >&2
  rm -f "${ssh_error_file}"
  return 1
}

ensure_target_writable() {
  local ssh_error_file
  local write_test_name

  ssh_error_file="$(mktemp)"
  write_test_name=".dashboard_maintenance_write_test_$$"

  if ssh "${SSH_ARGS[@]}" "${PUBLISH_TARGET}" "touch '${PUBLISH_PATH}/${write_test_name}' && rm -f '${PUBLISH_PATH}/${write_test_name}'" 2>"${ssh_error_file}"; then
    rm -f "${ssh_error_file}"
    return 0
  fi

  cat "${ssh_error_file}" >&2
  ssh "${SSH_ARGS[@]}" "${PUBLISH_TARGET}" "stat -c '%A %U %G %n' '${PUBLISH_PATH}' 2>/dev/null || true" >&2 || true
  printf 'Remote target path %s exists but is not writable by %s.\n' "${PUBLISH_PATH}" "${PUBLISH_TARGET}" >&2
  printf 'Adjust ownership or permissions on that directory from the Home Assistant side, then rerun this publish command.\n' >&2
  print_manual_setup_steps
  rm -f "${ssh_error_file}"
  return 1
}

pnpm --dir "${ROOT_DIR}" run build
node --check "${ROOT_DIR}/www/dashboard-maintenance.js"
python -m compileall "${ROOT_DIR}/__init__.py" "${ROOT_DIR}/config_flow.py" "${ROOT_DIR}/const.py"

STAGING_ROOT="$(mktemp -d)"
trap 'rm -rf "${STAGING_ROOT}"' EXIT

OUTPUT_DIR="${STAGING_ROOT}/publish"

mkdir -p "${OUTPUT_DIR}"
cp "${ROOT_DIR}/__init__.py" "${OUTPUT_DIR}/"
cp "${ROOT_DIR}/config_flow.py" "${OUTPUT_DIR}/"
cp "${ROOT_DIR}/const.py" "${OUTPUT_DIR}/"
cp "${ROOT_DIR}/manifest.json" "${OUTPUT_DIR}/"
cp "${ROOT_DIR}/hacs.json" "${OUTPUT_DIR}/"
cp "${ROOT_DIR}/strings.json" "${OUTPUT_DIR}/"
cp -R "${ROOT_DIR}/translations" "${OUTPUT_DIR}/translations"
cp -R "${ROOT_DIR}/www" "${OUTPUT_DIR}/www"

ensure_target_dir
ensure_target_writable
sync_to_target

printf 'Published build output to %s:%s\n' "${PUBLISH_TARGET}" "${PUBLISH_PATH}"
