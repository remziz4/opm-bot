#!/bin/bash
# CRON ENTRY: 0 5 * * * /path/to/daily_export_full_stats.sh
set -ex

curl -s -X GET "https://neonsportz.com/api/leagues/${LEAGUE_ABBREV}/ea/import/all-stats/"