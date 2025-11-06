#!/bin/bash

# Catalog Seed Data Loader
# Loads all catalog dictionaries and optionally sample data
# Usage: ./seed-all.sh [--with-samples]

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo -e "${RED}Error: psql not found. Please install PostgreSQL client.${NC}"
    exit 1
fi

# Check environment variables
if [ -z "$PGHOST" ] || [ -z "$PGDATABASE" ] || [ -z "$PGUSER" ]; then
    echo -e "${YELLOW}Warning: Database connection not configured.${NC}"
    echo "Please set the following environment variables:"
    echo "  export PGHOST='db.xxxxx.supabase.co'"
    echo "  export PGPORT='5432'"
    echo "  export PGDATABASE='postgres'"
    echo "  export PGUSER='postgres'"
    echo "  export PGPASSWORD='your-password'"
    echo ""
    read -p "Do you want to enter them now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "PGHOST: " PGHOST
        read -p "PGPORT (default 5432): " PGPORT
        PGPORT=${PGPORT:-5432}
        read -p "PGDATABASE (default postgres): " PGDATABASE
        PGDATABASE=${PGDATABASE:-postgres}
        read -p "PGUSER (default postgres): " PGUSER
        PGUSER=${PGUSER:-postgres}
        read -sp "PGPASSWORD: " PGPASSWORD
        echo
        export PGHOST PGPORT PGDATABASE PGUSER PGPASSWORD
    else
        exit 1
    fi
fi

# Determine if we should load samples
LOAD_SAMPLES=false
if [ "$1" == "--with-samples" ]; then
    LOAD_SAMPLES=true
    echo -e "${YELLOW}Will load sample data (requires test users)${NC}"
fi

echo -e "${GREEN}Starting catalog seed process...${NC}"
echo ""

# Dictionary seeds
DICT_SEEDS=(
    "device_brands.sql"
    "property_types.sql"
    "epc_ratings.sql"
    "cp_codes.sql"
    "job_contract_types.sql"
    "job_categories.sql"
)

echo -e "${GREEN}Loading dictionary data...${NC}"
for seed in "${DICT_SEEDS[@]}"; do
    if [ -f "$seed" ]; then
        echo -n "  Loading $seed... "
        if psql -f "$seed" -q 2>&1 | grep -q "ERROR"; then
            echo -e "${RED}FAILED${NC}"
            exit 1
        else
            echo -e "${GREEN}OK${NC}"
        fi
    else
        echo -e "  ${YELLOW}Skipping $seed (not found)${NC}"
    fi
done

echo ""

# Sample data (optional)
if [ "$LOAD_SAMPLES" = true ]; then
    echo -e "${GREEN}Loading sample adverts...${NC}"
    if [ -f "samples.sql" ]; then
        echo -n "  Loading samples.sql... "
        if psql -f "samples.sql" -q 2>&1 | grep -q "ERROR"; then
            echo -e "${RED}FAILED${NC}"
            echo -e "${YELLOW}Note: Samples require test users to exist${NC}"
        else
            echo -e "${GREEN}OK${NC}"
        fi
    fi
    echo ""
fi

# Verification
echo -e "${GREEN}Verifying seed data...${NC}"

psql -c "SELECT 
    (SELECT COUNT(*) FROM public.device_brands) as brands,
    (SELECT COUNT(*) FROM public.property_types) as prop_types,
    (SELECT COUNT(*) FROM public.epc_ratings) as epc,
    (SELECT COUNT(*) FROM public.cp_codes) as cp_codes,
    (SELECT COUNT(*) FROM public.job_categories) as job_cats,
    (SELECT COUNT(*) FROM public.job_contract_types) as contract_types;" \
    -t

echo ""
echo -e "${GREEN}✓ Seed process complete!${NC}"
echo ""
echo "Expected counts:"
echo "  - Device brands: ~38"
echo "  - Property types: ~24"
echo "  - EPC ratings: 9"
echo "  - CP codes: ~30"
echo "  - Job categories: 25"
echo "  - Contract types: 11"
echo ""

if [ "$LOAD_SAMPLES" = true ]; then
    echo "Sample adverts loaded. Verify with:"
    echo "  SELECT COUNT(*) FROM public.adverts;"
    echo ""
fi

echo "Next steps:"
echo "  1. Verify data in Supabase Dashboard"
echo "  2. Test API endpoints: GET /api/catalog/property-types"
echo "  3. Start building UI components"

