import os
import fnmatch

# --- Configuration ---

# The root directory of the project. Use '.' if the script is in the project root.
PROJECT_ROOT = '.' 

# The name for the final combined text file.
OUTPUT_FILENAME = 'llm_context.txt'

# --- List of items to IGNORE ---

# Patterns for directories to completely ignore.
# IMPORTANT: 'cacti_server' is included here to prevent leaking SSH keys.
IGNORE_DIRS = [
    'node_modules',
    'venv',
    '__pycache__',
    '.git',
    'build',
    'dist',
    'cacti_server' 
]

# Patterns for specific files to ignore.
IGNORE_FILES = [
    'package-lock.json',
    'yarn.lock',
    '.DS_Store',
    '*.pyc',
    '*.log',
    OUTPUT_FILENAME, # Don't include the script's own output
    'create_context.py', # Don't include this script itself
    '.gitattributes',
    'original.txt'
]

# File extensions to ignore (typically binary or non-text files).
IGNORE_EXTENSIONS = [
    '.png',
    '.ico',
    '.jpg',
    '.jpeg',
    '.gif',
    '.bmp',
    '.tiff',
    '.webp',
    '.mp4',
    '.mov',
    '.avi',
    '.key' # Explicitly ignore key files as a safeguard
]

# --- Script Logic ---

def should_ignore(path, is_dir=False):
    """Check if a file or directory path should be ignored based on configured patterns."""
    base_name = os.path.basename(path)

    # Check against directory ignore patterns
    if is_dir:
        return any(fnmatch.fnmatch(base_name, pattern) for pattern in IGNORE_DIRS)

    # Check against file ignore patterns
    if any(fnmatch.fnmatch(base_name, pattern) for pattern in IGNORE_FILES):
        return True
    
    # Check against extension ignore patterns
    if any(base_name.endswith(ext) for ext in IGNORE_EXTENSIONS):
        return True
        
    return False

def generate_file_tree(root_path):
    """Generates a string representing the file tree of relevant files."""
    tree_lines = []
    for root, dirs, files in os.walk(root_path, topdown=True):
        # Filter out ignored directories in-place to prevent traversal
        dirs[:] = [d for d in dirs if not should_ignore(os.path.join(root, d), is_dir=True)]
        
        # Determine indentation level
        level = root.replace(root_path, '').count(os.sep)
        indent = ' ' * 4 * (level)
        
        # Add the directory to the tree
        if level > 0:
            tree_lines.append(f"{indent[:-4]}└── {os.path.basename(root)}/")
        
        sub_indent = ' ' * 4 * (level)
        for f in sorted(files):
            if not should_ignore(f):
                tree_lines.append(f"{sub_indent}    ├── {f}")
    return "\n".join(tree_lines)

def main():
    """Main function to generate the context file."""
    # Open the output file in write mode, which clears it first
    with open(OUTPUT_FILENAME, 'w', encoding='utf-8', errors='ignore') as outfile:
        print("Generating project file tree...")
        outfile.write("PROJECT STRUCTURE OVERVIEW:\n")
        outfile.write("===========================\n\n")
        
        # Write the file tree to the output
        file_tree = generate_file_tree(PROJECT_ROOT)
        outfile.write(file_tree)
        
        outfile.write("\n\n===========================\n\n")
        outfile.write("FILE CONTENTS:\n")
        outfile.write("==============\n\n")
        
        print("Combining relevant files...")
        file_count = 0
        
        # Walk through the directory again to append file contents
        for root, dirs, files in os.walk(PROJECT_ROOT, topdown=True):
            # Prune ignored directories
            dirs[:] = [d for d in dirs if not should_ignore(os.path.join(root, d), is_dir=True)]
            
            for filename in sorted(files):
                file_path = os.path.join(root, filename)
                
                # Check if the file should be ignored
                if not should_ignore(file_path):
                    try:
                        with open(file_path, 'r', encoding='utf-8', errors='ignore') as infile:
                            content = infile.read()
                        
                        relative_path = os.path.relpath(file_path, PROJECT_ROOT)
                        
                        # Write file header, content, and footer
                        outfile.write(f"--- START FILE: {relative_path} ---\n\n")
                        outfile.write(content)
                        outfile.write(f"\n\n--- END FILE: {relative_path} ---\n\n")
                        
                        file_count += 1
                        print(f"  [+] Added: {relative_path}")
                        
                    except Exception as e:
                        print(f"  [!] Error reading {file_path}: {e}")

    print(f"\n✅ Success! Combined {file_count} files into '{OUTPUT_FILENAME}'.")

if __name__ == '__main__':
    main()