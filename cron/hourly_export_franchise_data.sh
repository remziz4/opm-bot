#!/bin/bash
# CRON ENTRY: 0 0-1,8-23 * * * /path/to/hourly_export_franchise_data.sh >> /var/log/hourly_export_franchise_data.log 2>&1
#
# Required env (set in crontab): LEAGUE_ABBREV
# Refresh token: read from and rewritten to $STATE_DIR/neon_refresh_token on every run
# (the API issues a new one each refresh, each valid for 30 days). To reseed:
#   ssh <host> 'umask 077; cat > /var/lib/opm-bot/neon_refresh_token'
# Optional env (Discord DM on failure): DISCORD_BOT_TOKEN, ALERT_DISCORD_USER_ID
# Optional: STATE_DIR (default /var/lib/opm-bot)
set -uo pipefail

API="https://neonsportz.com/api"
STATE_DIR="${STATE_DIR:-/var/lib/opm-bot}"
REFRESH_FILE="$STATE_DIR/neon_refresh_token"
ALERT_FILE="$STATE_DIR/last_alert"
ALERT_REPEAT_SECONDS=$((6 * 3600))

log() { echo "$(date -u +%FT%TZ) $*"; }

mkdir -p "$STATE_DIR"
umask 077

exec 9> "$STATE_DIR/lock"
flock -n 9 || { log "another run in progress, skipping"; exit 0; }

send_alert() {
    local message="$1"
    log "ALERT: $message"
    [ -n "${DISCORD_BOT_TOKEN:-}" ] && [ -n "${ALERT_DISCORD_USER_ID:-}" ] || return
    local discord="https://discord.com/api/v10"
    local channel_id status
    channel_id=$(curl -s -m 15 -X POST "$discord/users/@me/channels" \
        -H "Authorization: Bot $DISCORD_BOT_TOKEN" \
        -H 'Content-Type: application/json' \
        -d "$(jq -n --arg id "$ALERT_DISCORD_USER_ID" '{recipient_id: $id}')" | jq -r '.id // empty')
    if [ -z "$channel_id" ]; then
        log "could not open Discord DM channel"
        return
    fi
    status=$(curl -s -m 15 -o /dev/null -w '%{http_code}' -X POST "$discord/channels/$channel_id/messages" \
        -H "Authorization: Bot $DISCORD_BOT_TOKEN" \
        -H 'Content-Type: application/json' \
        -d "$(jq -n --arg content "$message" '{content: $content}')")
    [ "$status" = "200" ] || log "Discord DM failed (HTTP $status)"
}

# Re-alert only when the reason changes or ALERT_REPEAT_SECONDS has passed, so a broken
# token doesn't page every hour.
fail() {
    local reason="$1"
    local now last_time=0 last_reason=""
    now=$(date +%s)
    [ -f "$ALERT_FILE" ] && read -r last_time last_reason < "$ALERT_FILE"
    if [ "$reason" != "$last_reason" ] || [ $((now - last_time)) -ge $ALERT_REPEAT_SECONDS ]; then
        send_alert "opm-bot import (${LEAGUE_ABBREV:-?}) failed: $reason"
        echo "$now $reason" > "$ALERT_FILE"
    else
        log "FAILED (alert suppressed): $reason"
    fi
    exit 1
}

# POST with curl args "$@"; sets BODY and STATUS without a temp file.
post() {
    local resp
    resp=$(curl -s -w '\n%{http_code}' -X POST "$@")
    STATUS=${resp##*$'\n'}
    BODY=${resp%$'\n'*}
}

[ -n "${LEAGUE_ABBREV:-}" ] || fail "LEAGUE_ABBREV not set"
[ -s "$REFRESH_FILE" ] || fail "no refresh token at $REFRESH_FILE - reseed it"
REFRESH_TOKEN=$(tr -d '[:space:]' < "$REFRESH_FILE")

post -m 30 "$API/auth/refresh/" \
    -H 'Content-Type: application/json' \
    -d "$(jq -n --arg refresh "$REFRESH_TOKEN" '{refresh: $refresh}')"
[ "$STATUS" = "200" ] || fail "token refresh returned HTTP $STATUS - refresh token likely expired, reseed $REFRESH_FILE"

{ read -r ACCESS_TOKEN; read -r NEW_REFRESH; } < <(jq -r '.access // "", .refresh // ""' <<< "$BODY")
[ -n "$ACCESS_TOKEN" ] || fail "token refresh response had no access token"

# Persist the newly issued refresh token (atomically) so the 30-day expiry keeps sliding forward.
if [ -n "$NEW_REFRESH" ] && [ "$NEW_REFRESH" != "$REFRESH_TOKEN" ]; then
    echo "$NEW_REFRESH" > "$REFRESH_FILE.tmp" && mv "$REFRESH_FILE.tmp" "$REFRESH_FILE"
    log "refresh token rotated"
fi

post -m 120 "$API/leagues/$LEAGUE_ABBREV/ea/import/update/" \
    -H 'Accept: application/json' \
    -H "Authorization: Bearer $ACCESS_TOKEN"

case "$STATUS" in
    2*)
        log "import ok (HTTP $STATUS)"
        if [ -f "$ALERT_FILE" ]; then
            send_alert "opm-bot import ($LEAGUE_ABBREV) recovered"
            rm -f "$ALERT_FILE"
        fi
        ;;
    401|403) fail "import rejected with HTTP $STATUS (auth): ${BODY:0:200}" ;;
    *) fail "import returned HTTP $STATUS: ${BODY:0:200}" ;;
esac
