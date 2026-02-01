#!/bin/bash
# CRON ENTRY: 0 0-1,8-23 * * * /path/to/hourly_export_franchise_data.sh
set -ex

run_steps() {
    # Step 1: Import league info
    curl -s -X GET "https://neonsportz.com/api/leagues/OPM/ea/import/league-info/"

    # Step 2: Wait 20 seconds
    sleep 20

    # Step 3a: Get teams (size=1)
    TEAM_JSON=$(curl -s 'https://neonsportz.com/api/leagues/OPM/teams/?size=1')

    # Step 3b: Extract weekIndex
    WEEK_INDEX=$(echo "$TEAM_JSON" | jq -r '.results[0].weekIndex')

    # Step 3c: Import week
    curl -s -X GET "https://neonsportz.com/api/leagues/OPM/ea/import/week/${WEEK_INDEX}/"

    # Step 4: Wait 30 seconds
    sleep 30

    # Step 5: Import rosters
    curl -s -X GET "https://neonsportz.com/api/leagues/OPM/ea/import/rosters/"
}

# Run twice with 60 second pause in between
# Imports will silently fail if executed within 60 min of last successful attempt
# To avoid missing an update on our 60 min cron schedule, we can wait a minute and attempt a second time
run_steps
sleep 60
run_steps
