#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env"
BUNDLE_NAME="dashboard-maintenance.js"
PUBLISH_PATH="/config/www/community/ha-dashboard-maintenance"

if [[ -t 2 && -z "${NO_COLOR:-}" ]]; then
  ANSI_RESET=$'\033[0m'
  ANSI_BOLD=$'\033[1m'
  ANSI_RED=$'\033[31m'
  ANSI_GREEN=$'\033[32m'
  ANSI_YELLOW=$'\033[33m'
  ANSI_BLUE=$'\033[34m'
else
  ANSI_RESET=""
  ANSI_BOLD=""
  ANSI_RED=""
  ANSI_GREEN=""
  ANSI_YELLOW=""
  ANSI_BLUE=""
fi

print_section() {
  printf '\n%s%s%s\n' "${ANSI_BOLD}${ANSI_BLUE}" "$1" "${ANSI_RESET}" >&2
}

print_success() {
  printf '%s%s%s\n' "${ANSI_GREEN}" "$1" "${ANSI_RESET}" >&2
}

print_warning() {
  printf '%s%s%s\n' "${ANSI_YELLOW}" "$1" "${ANSI_RESET}" >&2
}

print_error() {
  printf '%s%s%s\n' "${ANSI_RED}" "$1" "${ANSI_RESET}" >&2
}

if [[ ! -f "${ENV_FILE}" ]]; then
  print_error "Missing ${ENV_FILE}. Copy .env.example to .env and update it."
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

: "${PUBLISH_TARGET:?Set PUBLISH_TARGET in .env}"

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
    print_error "Rsync could not write to ${PUBLISH_PATH} as ${PUBLISH_TARGET}."
    print_warning 'The destination path is correct; this SSH endpoint is denying non-interactive writes under /config/www.'
  fi

  rm -f "${rsync_error_file}"
  return 1
}

print_manual_setup_steps() {
  print_section "Manual remote setup"
  printf 'This script always publishes to this fixed Home Assistant path:\n\n' >&2
  printf '  %s%s%s\n\n' "${ANSI_BOLD}" "${PUBLISH_PATH}" "${ANSI_RESET}" >&2
  printf 'If non-interactive SSH cannot write there, open an interactive Home Assistant shell and run:\n\n' >&2
  printf '  ssh %s\n' "${PUBLISH_TARGET}" >&2
  printf '  mkdir -p %q\n' "${PUBLISH_PATH}" >&2
  printf '  ls -ld /config/www /config/www/community %q\n' "${PUBLISH_PATH}" >&2
  printf '  exit\n\n' >&2
  print_warning 'If that shell works but `pnpm publish-to-local` still fails, this SSH endpoint likely does not allow non-interactive mkdir/rsync under /config/www.'
  print_warning 'Use a different SSH target with normal shell access, or copy the built file into /config/www manually.'
}

print_resource_setup() {
  local resource_url

  if [[ "${PUBLISH_PATH}" == /config/www/* ]]; then
    resource_url="/local/${PUBLISH_PATH#/config/www/}/${BUNDLE_NAME}"
    resource_url="${resource_url//\/\//\/}"

    print_section "Lovelace resource"
    printf 'Add this resource in Home Assistant:\n\n' >&2
    printf '  URL:  %s%s%s\n' "${ANSI_BOLD}" "${resource_url}" "${ANSI_RESET}" >&2
    printf '  Type: %smodule%s\n\n' "${ANSI_BOLD}" "${ANSI_RESET}" >&2
    printf 'Settings -> Dashboards -> three dots menu -> Resources\n\n' >&2
    printf 'Then reload Lovelace resources or refresh the browser.\n' >&2
    return 0
  fi

  print_section "Lovelace resource"
  print_warning "Published ${BUNDLE_NAME}, but could not derive a /local URL from ${PUBLISH_PATH}."
  printf 'Make sure the file is reachable from Home Assistant and add it as a Lovelace %smodule%s resource.\n' "${ANSI_BOLD}" "${ANSI_RESET}" >&2
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
    print_error "Remote target path ${PUBLISH_PATH} is not writable by ${PUBLISH_TARGET}."
    print_warning 'The script must publish under /config/www, but this SSH endpoint cannot create or write there non-interactively.'
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
  print_error "Remote target path ${PUBLISH_PATH} exists but is not writable by ${PUBLISH_TARGET}."
  print_warning 'The script must publish under /config/www, but this SSH endpoint cannot write to that directory non-interactively.'
  print_manual_setup_steps
  rm -f "${ssh_error_file}"
  return 1
}

print_section "Building bundle"
pnpm --dir "${ROOT_DIR}" run build
node --check "${ROOT_DIR}/dist/${BUNDLE_NAME}"

STAGING_ROOT="$(mktemp -d)"
trap 'rm -rf "${STAGING_ROOT}"' EXIT

OUTPUT_DIR="${STAGING_ROOT}/publish"

mkdir -p "${OUTPUT_DIR}"
cp "${ROOT_DIR}/dist/${BUNDLE_NAME}" "${OUTPUT_DIR}/${BUNDLE_NAME}"

ensure_target_dir
ensure_target_writable
print_section "Uploading bundle"
sync_to_target

print_success "Published build output to ${PUBLISH_TARGET}:${PUBLISH_PATH}"
print_resource_setup
