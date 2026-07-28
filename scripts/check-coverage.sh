#!/usr/bin/env bash
set -euo pipefail

# Check code coverage against stored thresholds.
# Usage: check-coverage.sh <package-name> <working-dir> <test-command...>
# Reads thresholds from .github/coverage-thresholds.yml

PACKAGE="$1"
WORK_DIR="$2"
shift 2

THRESHOLDS_FILE=".github/coverage-thresholds.yml"
COVERAGE_DIR=$(mktemp -d)

# Parse threshold for this package
THRESHOLD=$(grep -A100 "^thresholds:" "$THRESHOLDS_FILE" | grep "\"$PACKAGE\":" | sed 's/.*: *//' || echo "")
if [ -z "$THRESHOLD" ]; then
  echo "❌ No threshold defined for $PACKAGE in $THRESHOLDS_FILE"
  exit 1
fi

echo "📊 Running tests with coverage for $PACKAGE (threshold: ${THRESHOLD}%)..."

# Run tests and capture coverage
(cd "$WORK_DIR" && "$@" --coverage) 2>&1 | tee "$COVERAGE_DIR/output.txt"

# Parse the average statement coverage of src/ files
COVERAGE=$(grep -E "^\s+src/" "$COVERAGE_DIR/output.txt" |
  awk -F'|' '{gsub(/^[[:space:]]+|[[:space:]]+$/, "", $2); if($2!="" && $2!~/^[0-9]/) next; sum+=$2; count++} END {if(count>0) printf "%.1f", sum/count; else print "0"}')

echo ""
echo "📈 $PACKAGE average statement coverage: ${COVERAGE}%"

if (($(echo "$COVERAGE < $THRESHOLD" | bc -l 2>/dev/null || echo 1))); then
  echo "❌ FAIL: $PACKAGE coverage ${COVERAGE}% is below threshold ${THRESHOLD}%"
  exit 1
fi

echo "✅ PASS: $PACKAGE coverage ${COVERAGE}% >= ${THRESHOLD}%"
rm -rf "$COVERAGE_DIR"
