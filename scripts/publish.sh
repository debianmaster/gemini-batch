#!/bin/bash

# Release Script
#
# Simple script to automate package publishing with version bumping, tagging, and GitHub releases.
#
# Prerequisites:
# - pnpm installed
# - gh CLI installed and authenticated (gh auth login)
# - npm authenticated (npm login)
#
# Usage:
#   ./scripts/publish.sh patch    # Bump patch version (1.0.4 → 1.0.5)
#   ./scripts/publish.sh minor    # Bump minor version (1.0.4 → 1.1.0)
#   ./scripts/publish.sh major    # Bump major version (1.0.4 → 2.0.0)
#   ./scripts/publish.sh 1.2.3    # Set specific version
#
# Or use the npm script:
#   pnpm run release patch
#
# What it does:
# 1. Validates environment (clean working directory, required tools)
# 2. Bumps version in package.json
# 3. Installs dependencies and builds project
# 4. Commits version bump and creates git tag
# 5. Pushes changes and tag to remote
# 6. Publishes to npm
# 7. Creates GitHub release with auto-generated changelog

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 <version_type>"
    echo "  version_type: patch, minor, major, or specific version (e.g., 1.2.3)"
    echo "Examples:"
    echo "  $0 patch    # Bump patch version (1.0.4 -> 1.0.5)"
    echo "  $0 minor    # Bump minor version (1.0.4 -> 1.1.0)"
    echo "  $0 major    # Bump major version (1.0.4 -> 2.0.0)"
    echo "  $0 1.2.3    # Set specific version"
}

# Check if version type is provided
if [ $# -eq 0 ]; then
    print_error "Version type is required"
    show_usage
    exit 1
fi

VERSION_TYPE=$1

# Validate version type
if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major|[0-9]+\.[0-9]+\.[0-9]+.*)$ ]]; then
    print_error "Invalid version type: $VERSION_TYPE"
    show_usage
    exit 1
fi

# Check if we're on the correct branch (optional, you can modify this)
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "master" ] && [ "$CURRENT_BRANCH" != "main" ]; then
    print_warning "You are not on master/main branch. Current branch: $CURRENT_BRANCH"
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Publishing cancelled."
        exit 1
    fi
fi

# Check if working directory is clean
if [ -n "$(git status --porcelain)" ]; then
    print_error "Working directory is not clean. Please commit your changes first."
    git status --short
    exit 1
fi

# Check if required tools are installed
command -v gh >/dev/null 2>&1 || { print_error "gh CLI is required but not installed. Please install it first."; exit 1; }
command -v pnpm >/dev/null 2>&1 || { print_error "pnpm is required but not installed. Please install it first."; exit 1; }

print_info "Starting publish process..."

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
print_info "Current version: $CURRENT_VERSION"

# Bump version
print_info "Bumping version ($VERSION_TYPE)..."
if [[ "$VERSION_TYPE" =~ ^[0-9]+\.[0-9]+\.[0-9]+.*$ ]]; then
    # Specific version provided
    pnpm version "$VERSION_TYPE" --no-git-tag-version
    NEW_VERSION=$VERSION_TYPE
else
    # Use npm version command for patch/minor/major
    pnpm version "$VERSION_TYPE" --no-git-tag-version
fi

# Get new version
NEW_VERSION=$(node -p "require('./package.json').version")
print_success "Version bumped to: $NEW_VERSION"

# Install dependencies
print_info "Installing dependencies..."
pnpm install

# Build the project
print_info "Building project..."
pnpm run build

# Commit version bump
print_info "Committing version bump..."
git add package.json
git commit -m "chore: bump version to $NEW_VERSION"

# Create and push tag
print_info "Creating tag v$NEW_VERSION..."
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

print_info "Pushing changes and tags..."
git push origin "$CURRENT_BRANCH"
git push origin "v$NEW_VERSION"

# Publish to npm
print_info "Publishing to npm..."
pnpm publish --access public
print_success "Successfully published to npm!"

# Create GitHub release with auto-generated notes
print_info "Creating GitHub release with auto-generated notes..."
gh release create "v$NEW_VERSION" \
    --title "Release v$NEW_VERSION" \
    --generate-notes

print_success "🎉 Release v$NEW_VERSION has been published successfully!"
print_info "📦 NPM: https://www.npmjs.com/package/gemini-batch"
print_info "🏷️  GitHub Release: https://github.com/debianmaster/gemini-batch/releases/tag/v$NEW_VERSION"
