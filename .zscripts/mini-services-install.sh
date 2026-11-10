#!/bin/bash

# Configuration
ROOT_DIR="/home/z/my-project/mini-services"

main() {
    echo "🚀 Starting batch dependency install..."

    # Check whether the root directory exists
    if [ ! -d "$ROOT_DIR" ]; then
        echo "ℹ️  Directory $ROOT_DIR does not exist; skipping installation"
        return
    fi

    # Counters
    success_count=0
    fail_count=0
    failed_projects=""

    # Iterate over every folder inside mini-services
    for dir in "$ROOT_DIR"/*; do
        # Only directories that contain a package.json are services
        if [ -d "$dir" ] && [ -f "$dir/package.json" ]; then
            project_name=$(basename "$dir")
            echo ""
            echo "📦 Installing dependencies: $project_name..."

            # Enter the project directory and run bun install
            if (cd "$dir" && bun install); then
                echo "✅ $project_name dependencies installed"
                success_count=$((success_count + 1))
            else
                echo "❌ $project_name dependency install failed"
                fail_count=$((fail_count + 1))
                if [ -z "$failed_projects" ]; then
                    failed_projects="$project_name"
                else
                    failed_projects="$failed_projects $project_name"
                fi
            fi
        fi
    done

    # Summarize the result
    echo ""
    echo "=================================================="
    if [ $success_count -gt 0 ] || [ $fail_count -gt 0 ]; then
        echo "🎉 Installation complete!"
        echo "✅ Succeeded: $success_count"
        if [ $fail_count -gt 0 ]; then
            echo "❌ Failed: $fail_count"
            echo ""
            echo "Failed projects:"
            for project in $failed_projects; do
                echo "  - $project"
            done
        fi
    else
        echo "ℹ️  No projects containing a package.json were found"
    fi
    echo "=================================================="
}

main

